import { Injectable } from '@nestjs/common';
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramCommentAnalyticsRepositoryService {
  private readonly tableName = 'instagram_comment_analytics';

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
   * FilterExpression for category. This is correct because:
   *   - A single media has a bounded number of comments (efficient).
   *   - Querying `category-index` would scan ALL comments for that category
   *     across every media, and DynamoDB's `Limit` applies before the
   *     `media_id` FilterExpression — producing empty pages with a nextCursor
   *     that never resolves to the target media's comments.
   */
  async getCommentsPage(
    mediaId: string,
    category?: string,
    limit = 20,
    exclusiveStartKey?: Record<string, any>,
  ) {
    console.log('[getCommentsPage] querying media_id-index', { mediaId, category, limit });
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'media_id-index',
      KeyConditionExpression: 'media_id = :mediaId',
      ExpressionAttributeValues: {
        ':mediaId': mediaId,
        ...(category ? { ':category': category } : {}),
      },
      ...(category
        ? { FilterExpression: 'category = :category' }
        : {}),
      Limit: limit,
      ExclusiveStartKey: exclusiveStartKey,
    };

    const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
      new QueryCommand(params),
    );

    return {
      items: response.Items ?? [],
      lastEvaluatedKey: response.LastEvaluatedKey,
    };
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
