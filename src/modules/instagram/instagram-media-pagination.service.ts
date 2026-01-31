import { Injectable } from '@nestjs/common';
import { InstagramApiService } from '../utils/instagram/api.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { InstagramMediaRepositoryService } from '@database/dynamodb/repository-services/instagram.media.service';
import { InstagramMediaAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.mediaAnalytics.service';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '@database/dto/pagination.dto';
import { InstagramMedia, InstagramMediaInsight } from '@lib/dto';

@Injectable()
export class InstagramMediaPaginationService {
  constructor(
    private readonly instagramApiService: InstagramApiService,
    private readonly instagramAccountService: InstagramAccountRepositoryService,
    private readonly instagramMediaRepositoryService: InstagramMediaRepositoryService,
    private readonly instagramMediaAnalyticsRepositoryService: InstagramMediaAnalyticsRepositoryService,
  ) {}

  /**
   * Main method: Fetches media with pagination, syncs to DynamoDB incrementally
   */
  async getMediaWithPagination(
    accountId: string,
    paginationDto: PaginationQueryDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const account = await this.instagramAccountService.getAccount(accountId);
      if (!account) throw new Error('Account not found');

      // Decode cursor if provided
      const decodedCursor = paginationDto.cursor
        ? this.decodeCursor(paginationDto.cursor)
        : null;

      return await this.fetchFromInstagramAndSync(
        accountId,
        account.access_token,
        paginationDto.limit,
        decodedCursor?.instagramCursor,
      );
    } catch (error) {
      console.error(`Error in pagination for ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch from Instagram API with pagination and sync to DynamoDB
   */
  private async fetchFromInstagramAndSync(
    accountId: string,
    accessToken: string,
    limit: number = 15,
    instagramCursor?: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      // Fetch paginated media from Instagram
      const instagramResponse =
        await this.instagramApiService.getMediaPaginated(
          accountId,
          accessToken,
          limit,
          instagramCursor,
        );

      if (!instagramResponse.data || instagramResponse.data.length === 0) {
        return {
          data: [],
          pagination: {
            hasMore: false,
            count: 0,
            limit,
          },
        };
      }

      // Fetch insights for each media item
      const mediaWithInsights = await Promise.all(
        instagramResponse.data.map(async (media) => {
          try {
            const insights = await this.instagramApiService.getMediaInsight(
              media.id,
              accessToken,
              media.media_type,
            );
            const mediaWithInsight =
              insights && insights.length > 0
                ? this.buildInsights(media, insights)
                : media;

            return { ...mediaWithInsight, accountId };
          } catch (error) {
            console.error(
              `Failed to fetch insights for media ID ${media.id}:`,
              error,
            );
            return { ...media, accountId };
          }
        }),
      );

      // Batch insert/update to DynamoDB (parallel execution)
      await Promise.all([
        ...mediaWithInsights.map((media) =>
          this.instagramMediaRepositoryService.updateMediaDetails(media),
        ),
        ...mediaWithInsights.map((media) =>
          this.instagramMediaAnalyticsRepositoryService.updateAnalyticsDetails(
            media,
          ),
        ),
      ]);

      // NEW: Fetch enriched data from DynamoDB to get ai_enabled and tag_and_value_pair
      const mediaIds = mediaWithInsights.map((m) => m.id);
      const enrichedData = await this.fetchEnrichedFromDynamoDB(
        accountId,
        mediaIds,
      );

      // Build pagination metadata
      const nextCursor = instagramResponse.paging?.next
        ? this.encodeCursor({
            instagramCursor: this.extractCursorFromUrl(
              instagramResponse.paging.next,
            ),
          })
        : undefined;

      return {
        data: enrichedData,
        pagination: {
          nextCursor,
          hasMore: !!instagramResponse.paging?.next,
          count: enrichedData.length,
          limit,
        },
      };
    } catch (error) {
      console.error('Error fetching from Instagram and syncing:', error);
      throw error;
    }
  }

  /**
   * NEW: Fetch enriched data from DynamoDB with ai_enabled and tag_and_value_pair
   */
  private async fetchEnrichedFromDynamoDB(
    accountId: string,
    mediaIds: string[],
  ): Promise<any[]> {
    try {
      // Single batch get call for all media IDs
      const mediaItems =
        await this.instagramMediaRepositoryService.batchGetMediaByIds(mediaIds);

      // Filter by accountId (safety check) and add is_automated
      const enrichedMedia = mediaItems
        .filter((item) => item.accountId === accountId)
        .map((item) => ({
          ...item,
          is_automated: this.isAutomatedPost(item),
        }));

      // Maintain original Instagram API order
      const orderedMedia = mediaIds
        .map((id) => enrichedMedia.find((m) => m.id === id))
        .filter(Boolean);

      return orderedMedia;
    } catch (error) {
      console.error('Error fetching enriched data:', error);
      throw error;
    }
  }

  /**
   * Encode cursor to base64 for security
   */
  private encodeCursor(cursorData: any): string {
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  /**
   * Decode cursor from base64
   */
  private decodeCursor(cursor: string): any {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (error) {
      console.error('Invalid cursor format:', error);
      return null;
    }
  }

  /**
   * Extract cursor parameter from Instagram pagination URL
   */
  private extractCursorFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('after') || undefined;
    } catch (error) {
      console.error('Failed to extract cursor from URL:', error);
      return undefined;
    }
  }

  private isAutomatedPost(image: any): boolean {
    const ai_enabled = image?.ai_enabled;
    const tag_and_value_pair = image?.tag_and_value_pair;

    // Check ai_enabled logic
    if (ai_enabled && typeof ai_enabled === 'object') {
      for (const category of Object.values(ai_enabled)) {
        if (category && typeof category === 'object') {
          const mode = (category as any)?.mode;
          if (mode && mode !== 'leave_comment') {
            return true;
          }
        }
      }
    }

    // Check tag_and_value_pair as array
    if (Array.isArray(tag_and_value_pair) && tag_and_value_pair.length > 0) {
      return true;
    }

    return false;
  }

  private buildInsights(
    media: InstagramMedia,
    insights: InstagramMediaInsight[],
  ) {
    insights.forEach((insight) => {
      const key = insight.name;
      media[key] = insight.values[0].value | 0;
    });
    return media;
  }


  private normalizeInstagramPermalink(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return url.replace(/\?.*$/, '').replace(/\/$/, '');
  }
}


  async findMediaByPermalink(
  accountId: string,
  access_token: string,
  permalink: string,
  limit = 25,
): Promise<InstagramMedia | null> {
  let instagramCursor: string | undefined;
  let pagesFetched = 0;
  const MAX_PAGES = 5;

  const account = await this.instagramAccountService.getAccount(accountId);
  console.log("account:", account)
  if (!account || !account.access_token) {
    throw new Error(`Instagram account or access token not found for ${accountId}`);
  }

  const normalizedInputPermalink = this.normalizeInstagramPermalink(permalink);

  do {
    const response = await this.instagramApiService.getMediaPaginated(
      accountId,
      access_token,
      limit,
      instagramCursor,
    );

    for (const media of response.data ?? []) {
      const normalizedMediaPermalink = this.normalizeInstagramPermalink(media.permalink);
      if (normalizedMediaPermalink === normalizedInputPermalink) {
        return media; // 🎯 FOUND → STOP
      }
    }

    instagramCursor = response.paging?.next
      ? this.extractCursorFromUrl(response.paging.next)
      : undefined;

    pagesFetched++;
  } while (instagramCursor && pagesFetched < MAX_PAGES);

  return null;
}
}
