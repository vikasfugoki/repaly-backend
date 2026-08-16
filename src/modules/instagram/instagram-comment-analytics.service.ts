import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InstagramCommentAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.commentAnalytics.service';
import { InstagramMediaRepositoryService } from '@database/dynamodb/repository-services/instagram.media.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import {
  CommentAnalyticsQueryDto,
  CommentsListQueryDto,
} from '@database/dto/comment-analytics.dto';

const GRANULARITY_SECONDS: Record<'hour' | 'day', number> = {
  hour: 3600,
  day: 86400,
};

@Injectable()
export class InstagramCommentAnalyticsService {
  constructor(
    private readonly commentAnalyticsRepositoryService: InstagramCommentAnalyticsRepositoryService,
    private readonly instagramMediaRepositoryService: InstagramMediaRepositoryService,
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
  ) {}

  /**
   * Account-level comment analytics: bucketed counts (total + per category)
   * between `start` and `end`, grouped by `granularity` (hour|day).
   *
   * `accountId` (the API param) is the internal `id` from
   * instagram_account_repository. instagram_comment_analytics is keyed by
   * `business_account_id`, which corresponds to that account's
   * `pro_user_id` — so we resolve it first.
   */
  async getAccountAnalytics(
    accountId: string,
    query: CommentAnalyticsQueryDto,
  ) {
    const businessAccountId = await this.resolveBusinessAccountId(accountId);

    const { startTs, endTs } = this.parseRange(query.start, query.end);
    const granularity = query.granularity ?? 'day';

    const items = await this.commentAnalyticsRepositoryService.getAllByAccount(
      businessAccountId,
      startTs,
      endTs,
    );

    return this.buildBuckets(items, granularity, startTs, endTs);
  }


  /**
   * Media-level comment analytics: same bucketing as account-level, scoped
   * to a single media_id via the media_id-index GSI. `accountId` is
   * validated against the media's owning account before querying.
   */
  async getMediaAnalytics(
    accountId: string,
    mediaId: string,
    query: CommentAnalyticsQueryDto,
  ) {
    await this.assertMediaBelongsToAccount(accountId, mediaId);

    const { startTs, endTs } = this.parseRange(query.start, query.end);
    const granularity = query.granularity ?? 'day';

    const items = await this.commentAnalyticsRepositoryService.getAllByMedia(
      mediaId,
      startTs,
      endTs,
    );

    return this.buildBuckets(items, granularity, startTs, endTs);
  }

  /**
   * Cursor-paginated list of comments for a media, optionally filtered by
   * category. `accountId` is validated against the media's owning account
   * before querying.
   */
  async getComments(
    accountId: string,
    mediaId: string,
    query: CommentsListQueryDto,
  ) {
    await this.assertMediaBelongsToAccount(accountId, mediaId);

    const limit = query.limit ?? 20;
    const exclusiveStartKey = query.cursor
      ? this.decodeCursor(query.cursor)
      : undefined;

    const { items, lastEvaluatedKey } =
      await this.commentAnalyticsRepositoryService.getCommentsPage(
        mediaId,
        query.category,
        limit,
        exclusiveStartKey,
      );

    return {
      data: items,
      pagination: {
        nextCursor: lastEvaluatedKey
          ? this.encodeCursor(lastEvaluatedKey)
          : undefined,
        hasMore: !!lastEvaluatedKey,
        count: items.length,
        limit,
      },
    };
  }

  /**
   * Resolves the internal accountId (instagram_account_repository.id) to
   * its pro_user_id, which is what instagram_comment_analytics stores as
   * `business_account_id`.
   */
  private async resolveBusinessAccountId(accountId: string): Promise<string> {
    const account =
      await this.instagramAccountRepositoryService.getAccount(accountId);

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }
    if (!account.pro_user_id) {
      throw new BadRequestException(
        `pro_user_id is not present for account ${accountId}`,
      );
    }

    return account.pro_user_id;
  }

  /** Ensures the media exists and belongs to the given accountId. */
  private async assertMediaBelongsToAccount(
    accountId: string,
    mediaId: string,
  ): Promise<void> {
    const result = await this.instagramMediaRepositoryService.getMedia(
      mediaId,
    );
    const media = result?.Item;

    if (!media) {
      throw new NotFoundException(`Media ${mediaId} not found`);
    }
    if (media.accountId !== accountId) {
      throw new ForbiddenException(
        `Media ${mediaId} does not belong to account ${accountId}`,
      );
    }
  }

  private parseRange(
    start?: string,
    end?: string,
  ): { startTs?: number; endTs?: number } {
    if (!start && !end) return {};
    if (!start || !end) {
      throw new BadRequestException(
        'Both start and end must be provided together',
      );
    }

    const startTs = this.toEpochSeconds(start);
    const endTs = this.toEpochSeconds(end);

    if (startTs === undefined || endTs === undefined) {
      throw new BadRequestException(
        'start/end must be epoch seconds, epoch milliseconds, or ISO 8601 dates',
      );
    }
    if (startTs > endTs) {
      throw new BadRequestException('start must be before end');
    }

    return { startTs, endTs };
  }

  private toEpochSeconds(value: string): number | undefined {
    // Purely numeric -> treat as epoch (seconds if 10 digits, ms if 13)
    if (/^\d+$/.test(value)) {
      const num = Number(value);
      return value.length > 10 ? Math.floor(num / 1000) : num;
    }

    // Otherwise try ISO 8601 / any Date-parseable string
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : Math.floor(parsed / 1000);
  }

  private buildBuckets(
    items: Record<string, any>[],
    granularity: 'hour' | 'day',
    startTs?: number,
    endTs?: number,
  ) {
    const bucketSize = GRANULARITY_SECONDS[granularity];
    const buckets: Record<
      number,
      { total: number; by_category: Record<string, number> }
    > = {};

    for (const item of items) {
      const ts = Number(item.timestamp);
      if (Number.isNaN(ts)) continue;
      if (startTs !== undefined && ts < startTs) continue;
      if (endTs !== undefined && ts > endTs) continue;

      const bucketTs = ts - (ts % bucketSize);
      if (!buckets[bucketTs]) {
        buckets[bucketTs] = { total: 0, by_category: {} };
      }

      buckets[bucketTs].total += 1;
      const category = item.category ?? 'uncategorized';
      buckets[bucketTs].by_category[category] =
        (buckets[bucketTs].by_category[category] ?? 0) + 1;
    }

    const series = Object.keys(buckets)
      .map((ts) => ({
        bucket_start: Number(ts),
        bucket_start_iso: new Date(Number(ts) * 1000).toISOString(),
        total: buckets[Number(ts)].total,
        by_category: buckets[Number(ts)].by_category,
      }))
      .sort((a, b) => a.bucket_start - b.bucket_start);

    return {
      granularity,
      start: startTs,
      end: endTs,
      total_comments: items.length,
      series,
    };
  }

  private encodeCursor(key: Record<string, any>): string {
    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  private decodeCursor(cursor: string): Record<string, any> | undefined {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (error) {
      console.error('Invalid cursor format:', error);
      throw new BadRequestException('Invalid cursor');
    }
  }
}
