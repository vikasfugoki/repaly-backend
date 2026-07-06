import { Injectable } from '@nestjs/common';
import { FacebookApiService } from '../utils/facebook/api.service';
import { FacebookAccountRepositoryService } from '@database/dynamodb/repository-services/facebook.account.service';
import { FacebookMediaRepositoryService } from '@database/dynamodb/repository-services/facebook.media.service';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '@database/dto/pagination.dto';
import { normalizeFacebookPost } from './facebook-post.mapper';

/**
 * Paginated listing of a Facebook Page's posts. Mirrors
 * InstagramMediaPaginationService: each page is fetched live from the Graph
 * API, synced into `facebook_media_repository`, then re-read so the response
 * carries the stored automation state (`ai_enabled`, `tag_and_value_pair`,
 * `is_automated`).
 */
@Injectable()
export class FacebookMediaPaginationService {
  constructor(
    private readonly facebookApiService: FacebookApiService,
    private readonly facebookAccountRepositoryService: FacebookAccountRepositoryService,
    private readonly facebookMediaRepositoryService: FacebookMediaRepositoryService,
  ) {}

  async getMediaWithPagination(
    accountId: string,
    paginationDto: PaginationQueryDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const account =
        await this.facebookAccountRepositoryService.getAccount(accountId);
      if (!account) throw new Error('Account not found');
      if (!account.access_token) throw new Error('Page access token not found');

      const decodedCursor = paginationDto.cursor
        ? this.decodeCursor(paginationDto.cursor)
        : null;

      return await this.fetchFromFacebookAndSync(
        accountId,
        account.access_token,
        paginationDto.limit,
        decodedCursor?.facebookCursor,
      );
    } catch (error) {
      console.error(`Error in pagination for ${accountId}:`, error);
      // If the page token is dead, persist that so the frontend can show a
      // "reconnect" prompt instead of silently failing forever.
      if ((error as any)?.response?.code === 'FB_TOKEN_EXPIRED') {
        await this.facebookAccountRepositoryService
          .updateAccountDetails({ id: accountId, token_status: 'expired' })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private async fetchFromFacebookAndSync(
    accountId: string,
    accessToken: string,
    limit = 15,
    facebookCursor?: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      const facebookResponse =
        await this.facebookApiService.getPagePostsPaginated(
          accountId,
          accessToken,
          limit,
          facebookCursor,
        );

      if (!facebookResponse.data || facebookResponse.data.length === 0) {
        return {
          data: [],
          pagination: {
            hasMore: false,
            count: 0,
            limit,
          },
        };
      }

      // Normalize + sync each post into DynamoDB (partial update — keeps
      // automation fields intact).
      const mediaItems = facebookResponse.data.map((post) =>
        normalizeFacebookPost(post, accountId),
      );

      await Promise.all(
        mediaItems.map((media) =>
          this.facebookMediaRepositoryService.updateMediaDetails(media),
        ),
      );

      // Re-read enriched records (with automation settings) from DynamoDB.
      const mediaIds = mediaItems.map((m) => m.id);
      const enrichedData = await this.fetchEnrichedFromDynamoDB(
        accountId,
        mediaIds,
      );

      const nextCursor = facebookResponse.paging?.next
        ? this.encodeCursor({
            facebookCursor:
              facebookResponse.paging?.cursors?.after ||
              this.extractCursorFromUrl(facebookResponse.paging.next),
          })
        : undefined;

      return {
        data: enrichedData,
        pagination: {
          nextCursor,
          hasMore: !!facebookResponse.paging?.next,
          count: enrichedData.length,
          limit,
        },
      };
    } catch (error) {
      console.error('Error fetching from Facebook and syncing:', error);
      throw error;
    }
  }

  private async fetchEnrichedFromDynamoDB(
    accountId: string,
    mediaIds: string[],
  ): Promise<any[]> {
    try {
      const mediaItems =
        await this.facebookMediaRepositoryService.batchGetMediaByIds(mediaIds);

      const enrichedMedia = mediaItems
        .filter((item) => item.accountId === accountId)
        .map((item) => ({
          ...item,
          is_automated: this.isAutomatedPost(item),
        }));

      // Maintain original Facebook API order
      const orderedMedia = mediaIds
        .map((id) => enrichedMedia.find((m) => m.id === id))
        .filter(Boolean);

      return orderedMedia;
    } catch (error) {
      console.error('Error fetching enriched data:', error);
      throw error;
    }
  }

  private encodeCursor(cursorData: any): string {
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  private decodeCursor(cursor: string): any {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch (error) {
      console.error('Invalid cursor format:', error);
      return null;
    }
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
    const ai_enabled = image?.ai_enabled;
    const tag_and_value_pair = image?.tag_and_value_pair;

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

    if (Array.isArray(tag_and_value_pair) && tag_and_value_pair.length > 0) {
      return true;
    }

    return false;
  }
}
