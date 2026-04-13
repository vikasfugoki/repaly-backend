import { Injectable } from '@nestjs/common';
import { InstagramApiService } from '../utils/instagram/api.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { InstagramStoryRepositoryService } from '@database/dynamodb/repository-services/instagram.story.service';
import { InstagramStoryAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.storyAnalytics.service';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '@database/dto/pagination.dto';

@Injectable()
export class InstagramStoryPaginationService {
    constructor (
        private readonly instagramApiService: InstagramApiService,
            private readonly instagramAccountService: InstagramAccountRepositoryService,
            private readonly instagramStoryRepositoryService: InstagramStoryRepositoryService,
            private readonly instagramStoryAnalyticsRepositoryService: InstagramStoryAnalyticsRepositoryService,
    ) {}

    async getStoryWithPagination(
  accountId: string,
  paginationDto: PaginationQueryDto,
): Promise<PaginatedResponse<any>> {
  try {
    const account = await this.instagramAccountService.getAccount(accountId);
    if (!account) throw new Error('Account not found');

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

private async fetchFromInstagramAndSync(
  accountId: string,
  accessToken: string,
  limit: number = 1,
  instagramCursor?: string,
): Promise<PaginatedResponse<any>> {
  try {
    // Fetch paginated stories from Instagram
    const instagramResponse =
      await this.instagramApiService.getStoriesPaginated(
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

    // Sync each story to DynamoDB
    await Promise.all(
      instagramResponse.data.map(story =>
        this.instagramStoryRepositoryService.updateStoryDetails({
          ...story,
          accountId, // ✅ now saved to DynamoDB
        }),
      ),
    );

    // Fetch enriched data from DynamoDB
    const storyIds = instagramResponse.data.map(s => s.id);
    console.log('Story IDs from Instagram:', storyIds);
    const enrichedData = await this.fetchEnrichedStoriesFromDynamoDB(
      accountId,
      storyIds,
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

private async fetchEnrichedStoriesFromDynamoDB(
  accountId: string,
  storyIds: string[],
): Promise<any[]> {
  try {
    // Single batch get call for all story IDs
    const storyItems =
      await this.instagramStoryRepositoryService.batchGetStoriesByIds(storyIds);

    console.log("storyItems:", storyItems);

    // Filter by accountId (safety check)
    const enrichedStories = storyItems
      .filter((item) => item.accountId === accountId)
      .map((item) => ({
        ...item,
        is_automated: this.isAutomatedPost(item)
      }));

    // Maintain original Instagram API order
    const orderedStories = storyIds
      .map((id) => enrichedStories.find((s) => s.story_id === id))
      .filter(Boolean);

    return orderedStories;
  } catch (error) {
    console.error('Error fetching enriched stories:', error);
    throw error;
  }
    }

    private decodeCursor(cursor: string): any {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (error) {
      console.error('Invalid cursor format:', error);
      return null;
    }
  }

  private encodeCursor(cursorData: any): string {
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }
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
    const keyword_value_pair = image?.keyword_value_pair;

    const tags = keyword_value_pair?.tags;
    const replyToAll = keyword_value_pair?.reply_to_all === true;
    const dmPayload = keyword_value_pair?.dm_payload;

    const hasTags = Array.isArray(tags) && tags.length > 0;
    const hasValidPayload =
        dmPayload != null &&
        typeof dmPayload === "object" &&
        Object.keys(dmPayload).length > 0;

    return (hasTags || replyToAll) && hasValidPayload;
}
}