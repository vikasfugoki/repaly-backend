import { Injectable } from '@nestjs/common';
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramCommentAnalyticsRepositoryService {
  private readonly tableName = 'instagram_comment_analytics';

  /**
   * How many raw items to read per DynamoDB round trip while collecting a
   * category-filtered page. DynamoDB applies `Limit` *before* a
   * `FilterExpression`, so we over-read and paginate ourselves until the
   * post-filter result reaches the caller's requested page size.
   */
  private readonly SCAN_PAGE_SIZE = 100;

  /**
   * Safety cap on those round trips for a single page request, so an extremely
   * sparse category can't make one call fan out into an unbounded scan. When
   * hit, we return whatever was collected so far plus the cursor to resume.
   */
  private readonly MAX_SCAN_ROUND_TRIPS = 50;

  constructor(private readonly dynamoDbService: DynamoDBService) { }

  /**
   * Fetch ALL comment items for a business account within an optional
   * [startTs, endTs] (epoch seconds) window, by paging through the base
   * table partition (business_account_id). Used for account-level analytics.
   */
  async getAllByAccount(
    businessAccountId: string,
    startTs?: number,
    endTs?: number,
  ) {
    const hasRange = startTs !== undefined && endTs !== undefined;

    const baseParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'business_account_id = :businessAccountId',
      ExpressionAttributeValues: {
        ':businessAccountId': businessAccountId,
        ...(hasRange ? { ':startTs': startTs, ':endTs': endTs } : {}),
      },
      ...(hasRange
        ? { FilterExpression: '#ts BETWEEN :startTs AND :endTs' }
        : {}),
      ...(hasRange ? { ExpressionAttributeNames: { '#ts': 'timestamp' } } : {}),
    };

    return this.queryAll(baseParams);
  }

  /**
   * Fetch ALL comment items for a media_id (via media_id-index) within an
   * optional [startTs, endTs] (epoch seconds) window. Used for media-level
   * analytics.
   */
  async getAllByMedia(mediaId: string, startTs?: number, endTs?: number) {
    const hasRange = startTs !== undefined && endTs !== undefined;

    const baseParams: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'media_id-index',
      KeyConditionExpression: 'media_id = :mediaId',
      ExpressionAttributeValues: {
        ':mediaId': mediaId,
        ...(hasRange ? { ':startTs': startTs, ':endTs': endTs } : {}),
      },
      ...(hasRange
        ? { FilterExpression: '#ts BETWEEN :startTs AND :endTs' }
        : {}),
      ...(hasRange ? { ExpressionAttributeNames: { '#ts': 'timestamp' } } : {}),
    };

    return this.queryAll(baseParams);
  }

  /**
   * Paginated comments for a media, optionally filtered by category.
   *
   * Always queries `media_id-index` by media_id, then optionally applies a
   * FilterExpression for category. A single media has a bounded number of
   * comments, so this stays efficient. `limit` is honoured *after* the category
   * filter (see `collectFilteredPage`) — a sparse category still returns a full
   * page instead of a near-empty one.
   */
  async getCommentsPage(
    mediaId: string,
    category?: string,
    limit = 20,
    exclusiveStartKey?: Record<string, any>,
  ) {
    console.log('[getCommentsPage] querying media_id-index', { mediaId, category, limit });
    const baseParams: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'media_id-index',
      KeyConditionExpression: 'media_id = :mediaId',
      ExpressionAttributeValues: {
        ':mediaId': mediaId,
        ...(category ? { ':category': category } : {}),
      },
      ...(category ? { FilterExpression: 'category = :category' } : {}),
    };

    return this.collectFilteredPage(baseParams, limit, exclusiveStartKey, !!category);
  }

  /**
   * Paginated comments for a whole business account, optionally filtered by
   * category. Queries the base table partition (business_account_id) directly;
   * the sort key `comment_id_timestamp` gives a roughly newest-first order when
   * read with `ScanIndexForward: false`.
   *
   * `limit` is the number of comments returned *after* the category filter is
   * applied (see `collectFilteredPage`), so a category with few comments no
   * longer returns empty/short pages just because DynamoDB's own `Limit` is
   * applied before the `FilterExpression`.
   */
  async getAccountCommentsPage(
    businessAccountId: string,
    category?: string,
    limit = 20,
    exclusiveStartKey?: Record<string, any>,
  ) {
    console.log('[getAccountCommentsPage] querying base table', {
      businessAccountId,
      category,
      limit,
    });
    const baseParams: QueryCommandInput = {
      TableName: this.tableName,
      KeyConditionExpression: 'business_account_id = :businessAccountId',
      ExpressionAttributeValues: {
        ':businessAccountId': businessAccountId,
        ...(category ? { ':category': category } : {}),
      },
      ...(category ? { FilterExpression: 'category = :category' } : {}),
      ScanIndexForward: false,
    };

    return this.collectFilteredPage(baseParams, limit, exclusiveStartKey, !!category);
  }

  /**
   * Reads forward through a Query until `limit` items have been collected
   * *after* any `FilterExpression`, then returns a cursor that resumes exactly
   * after the last returned item.
   *
   * Why this exists: DynamoDB evaluates `Limit` before `FilterExpression`, so a
   * plain `{ Limit: limit, FilterExpression: category }` query returns "up to
   * `limit` items that also match the filter" — which is near-empty for a
   * sparse category. Here we over-read in `SCAN_PAGE_SIZE` chunks and stop once
   * enough post-filter items are in hand.
   *
   * When the last chunk overshoots `limit`, the resume key is synthesised from
   * the boundary item using the key attribute names DynamoDB reports in
   * `LastEvaluatedKey` (which lists every table + index key attribute).
   */
  private async collectFilteredPage(
    baseParams: QueryCommandInput,
    limit: number,
    exclusiveStartKey: Record<string, any> | undefined,
    filtered: boolean,
  ) {
    // No filter: DynamoDB's own `Limit` is already exact — one round trip.
    if (!filtered) {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
        new QueryCommand({
          ...baseParams,
          Limit: limit,
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      return {
        items: response.Items ?? [],
        lastEvaluatedKey: response.LastEvaluatedKey,
      };
    }

    const collected: Record<string, any>[] = [];
    let cursor = exclusiveStartKey;
    let keyNames: string[] | undefined;

    for (let roundTrip = 0; roundTrip < this.MAX_SCAN_ROUND_TRIPS; roundTrip++) {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
        new QueryCommand({
          ...baseParams,
          Limit: this.SCAN_PAGE_SIZE,
          ExclusiveStartKey: cursor,
        }),
      );

      collected.push(...(response.Items ?? []));
      cursor = response.LastEvaluatedKey;
      if (response.LastEvaluatedKey) {
        keyNames = Object.keys(response.LastEvaluatedKey);
      }

      if (collected.length >= limit) {
        const resumeKey = this.projectKey(collected[limit - 1], keyNames);
        if (resumeKey) {
          return { items: collected.slice(0, limit), lastEvaluatedKey: resumeKey };
        }
        // Can't synthesise a key (unknown schema on a single exhausted page):
        // only safe to hand back everything with no cursor at end of data.
        if (!cursor) {
          return { items: collected, lastEvaluatedKey: undefined };
        }
      }

      if (!cursor) {
        // Reached the end of the partition.
        return { items: collected, lastEvaluatedKey: undefined };
      }
    }

    // Hit the round-trip cap: return what we have, let the caller resume.
    return { items: collected.slice(0, limit), lastEvaluatedKey: cursor };
  }

  /**
   * Builds an `ExclusiveStartKey` for `item` from the key attribute names
   * DynamoDB reported in a `LastEvaluatedKey`. Returns `undefined` if the names
   * are unknown or the item is missing one of them (schema mismatch — bail
   * rather than emit a broken cursor).
   */
  private projectKey(
    item: Record<string, any> | undefined,
    keyNames: string[] | undefined,
  ): Record<string, any> | undefined {
    if (!item || !keyNames?.length) return undefined;

    const key: Record<string, any> = {};
    for (const name of keyNames) {
      if (item[name] === undefined) return undefined;
      key[name] = item[name];
    }
    return key;
  }

  /**
   * Runs a Query repeatedly, following LastEvaluatedKey, and returns the
   * full concatenated set of Items.
   */
  private async queryAll(params: QueryCommandInput) {
    const items: Record<string, any>[] = [];
    let exclusiveStartKey: Record<string, any> | undefined;

    do {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
        new QueryCommand({ ...params, ExclusiveStartKey: exclusiveStartKey }),
      );
      items.push(...(response.Items ?? []));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }
}
