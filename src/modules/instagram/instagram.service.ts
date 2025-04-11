import { Injectable } from '@nestjs/common';
import { InstagramApiService } from '../utils/instagram/api.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import {InstagramMediaRepositoryService} from '@database/dynamodb/repository-services/instagram.media.service';
import {
  InstagramAccountResponse,
  InstagramMedia,
  InstagramMediaInsight,
} from '@lib/dto';
import { InstagramMediaAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.mediaAnalytics.service';

@Injectable()
export class InstagramAccountService {
  constructor(
    private readonly instagramMediaAnalyticsRepositoryService: InstagramMediaAnalyticsRepositoryService,
    private readonly instagramApiService: InstagramApiService,
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
    private readonly instagramMediaRepositoryService: InstagramMediaRepositoryService,
  ) {}

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

  private async getAllMedia(
    userId: string,
    access_token: string,
  ): Promise<InstagramAccountResponse[]> {
    const mediaList = await this.instagramApiService.getMedia(
      userId,
      access_token,
    );
    const mediaWithInsights = await Promise.all(
      mediaList.map(async (media) => {
        try {
          const insights = await this.instagramApiService.getMediaInsight(
            media.id,
            access_token,
            media.media_type,
          );
          return insights && insights.length > 0
            ? this.buildInsights(media, insights)
            : media;
        } catch (error) {
          console.error(
            `Failed to fetch insights for media ID ${media.id}:`,
            error,
          );
          return media;
        }
      }),
    );
    return mediaWithInsights;
  }

  async getInstagramMedia(
    accountId: string,
  ): Promise<InstagramAccountResponse[]> {
    const userId = accountId;
    const account =
      await this.instagramAccountRepositoryService.getAccount(userId);
    if (!account) throw new Error('Token not found');
    const { access_token } = account;
    return await this.getAllMedia(userId, access_token);
  }

  // async getInstagramMediaAnalytics(mediaId: string) {
  //   const response =
  //     await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(
  //       mediaId,
  //     );
  //   return (
  //     response?.analytics ?? {
  //       negative_comments: 0,
  //       potential_buyers: 0,
  //       comments: 0,
  //       leads: 0,
  //       positive_comments: 0,
  //     }
  //   );
  // }

  async addTagAndValue(mediaId: string, input: JSON) {
    return await this.instagramMediaAnalyticsRepositoryService.createMediaAnalytics(
      mediaId,
      JSON.stringify(input),
    );
  }

  // async getInstagramMediaTagAndValuePair(mediaId: string) {
  //   const response =
  //     await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(
  //       mediaId,
  //     );
  //   return (
  //     response?.tag_and_value_pair ?? {
  //       tagAndValuePair: [],
  //     }
  //   );
  // }

  async updateMediaResponseTypeOnTable(mediaId: string, response: Record<string, any>) {

    try {
        console.log("received input:", response);
        if (!response) {
            throw new Error('Input is undefined or null');
        }
        response['id'] = mediaId;
        return await this.instagramMediaRepositoryService.updateMediaDetails(response);
    } catch (error) {
        console.error(`Error inserting response details for ${mediaId}:`, error);
        throw error;
    }   
  }

  async getMediaResponseTypeFromTable(mediaId: string) {
    try {
        const response = await this.instagramMediaRepositoryService.getMedia(mediaId);
        // const tagAndValuePair = response?.Item?.tag_and_value_pair ?? {};
        // const ai_enabled = response?.Item?.ai_enabled ?? {};

        // return {
        //   tag_and_value_pair: tagAndValuePair,
        //   ai_enabled: ai_enabled
        // };
        return response?.Item ?? {};

    } catch (error) {
        console.error(`Error getting media details for media ${mediaId}:`, error);
        throw error;
    }
  }

  async getTagAndValuePairFromTable(mediaId: string) {
      const response = await this.instagramMediaRepositoryService.getMedia(mediaId);
      const tagAndValuePair = response?.Item?.tag_and_value_pair ?? {};
      return tagAndValuePair;
      }

  async getAIEnabledInfoFromTable(mediaId: string) {
        const response = await this.instagramMediaRepositoryService.getMedia(mediaId);
          return {
        positive_comments: response?.Item?.positive_comments ?? false,
        negative_comments: response?.Item?.negative_comments ?? false,
        inquiries: response?.Item?.inquiries ?? {},
        lead: response?.Item?.lead ?? false,
        potential_buyers: response?.Item?.potential_buyers ?? false
      };
  }

  async getRecentMedia(accountId: string, access_token: string) {
    try {
        // Fetch the media list from Instagram API
        const mediaList = await this.instagramApiService.getMedia(accountId, access_token);
        console.log(mediaList)

        // Ensure mediaList is always an array
        if (!Array.isArray(mediaList)) {
            console.warn(`Expected an array, but received:`, mediaList);
            return [];
        }

        const mediaWithInsights = await Promise.all(
      mediaList.map(async (media) => {
        try {
          const insights = await this.instagramApiService.getMediaInsight(
            media.id,
            access_token,
            media.media_type,
          );
          const mediaWithInsight = insights && insights.length > 0
                        ? this.buildInsights(media, insights)
                        : media;

          // Add accountId to each media item
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


  return mediaWithInsights;
    } catch (error) {
        console.error(`Failed to fetch recent media for accountId ${accountId}:`, (error as Error).message);
        throw new Error('Unable to retrieve recent media');
    }
}


  async getInstagramRecentMedia(accountId: string) {
      const account = await this.instagramAccountRepositoryService.getAccount(accountId);
      console.log(account)
      if (!account) throw new Error('Token not found');
      const mediaWithInsights =  await this.getRecentMedia(accountId, account.access_token);
      console.log(mediaWithInsights)

      try {
      await this.instagramMediaRepositoryService.insertMultipleMediaDetails(mediaWithInsights);
    } catch (error) {
      console.error('Error inserting media details:', error);
      throw error;
    }
      return mediaWithInsights;
      }

  async addInstagramMediaAutomation(mediaId: string, input: Record<string, any>) {

      try {
          console.log("received input:", input);
          if (!input) {
              throw new Error('Input is undefined or null');
          }
          input['id'] = mediaId;
          return await this.instagramMediaRepositoryService.updateMediaDetails(input);
      } catch (error) {
          console.error(`Error inserting automation details for ${mediaId}:`, error);
          throw error;
      }
  }

  async getInstagramMediaFromTable(accountId: string) {
      try {
          console.log(accountId)
          const response =
              await this.instagramMediaRepositoryService.getMediaByAccountId(
                accountId,
      );
        console.log(`DynamoDB Response:`, response);

        // Extract items from response if they exist
        const items = response?.Items || [];

        // Ensure response is an array and limit its length to 15
        if (Array.isArray(items)) {
            return items
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, 15);
        } else {
            console.warn("Unexpected response type, expected an array:", response);
            return [];
        }
  }catch (error) {
          console.error(`Error getting media details for ${accountId}:`, error);
          throw error;
      }
  }

  async updateAccountMediaOnTable(accountId: string) {
    try {
        console.log(`Updating media for accountId: ${accountId}`);

        // Fetch account details
        const account = await this.instagramAccountRepositoryService.getAccount(accountId);
        if (!account) throw new Error('Token not found');

        // Get recent media with insights
        const mediaWithInsights = await this.getRecentMedia(accountId, account.access_token);
        if (!mediaWithInsights || mediaWithInsights.length === 0) {
            console.warn(`No media found for accountId: ${accountId}`);
            return [];
        }

        // Insert into 'instagram_media_repository' DynamoDB table
        for (const media of mediaWithInsights) {
            await this.instagramMediaRepositoryService.updateMediaDetails(media);
        }

        // Insert into 'instagram_analytics_repository' DynamoDB table
        for (const media of mediaWithInsights) {
            await this.instagramMediaAnalyticsRepositoryService.addMedia(media);
        }

        console.log("media fetched and inserted successfully.");
        return { success: true, message: "Media updated successfully" };

    } catch (error) {
        console.error(`Error updating media for ${accountId}:`, error);
        return { success: false, message: `Error updating media in the table` };
    }
    }


    // analytics section
    async mediaStatsFromTable(mediaId: string) {
      try {
        console.log("Fetching media stats...");
    
        // Fetch the full item
        const item = await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(mediaId);
        
        // Log the full item for debugging
        console.log("Full item:", item);
    
        // Extract only numerical stats
        const stats = {
          comment_by_us: item?.comment_by_us ?? 0,
          potential_buyers: item?.potential_buyers ?? 0,
          DMs_by_us: item?.DMs_by_us ?? 0,
          lead_generated: item?.lead_generated ?? 0,
          negative_comments: item?.negative_comments ?? 0,
          positive_comments: item?.positive_comments ?? 0,
          tagged: item?.tagged ?? 0
        };
    
        console.log("Extracted stats:", stats);
        return stats;
      } catch (error) {
        console.error(`Error fetching media stats for media ${mediaId}:`, error);
        return {success: false, message: `Error fetching media stats from table`};
      }
    }

    async getCommentsFromAnalyticsTable(mediaId: string, type: string) {
      try {
        // Fetch the full item
        const item = await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(mediaId);
    
        // Dynamically get the comments based on the type
        const comments = item?.[type] ?? [];
    
        return comments;
      } catch (error) {
        console.error(`Failed to fetch ${type} comments for media ${mediaId}`);
        return { success: false, message: `Error fetching ${type} comments for media` };
      }
    }

    // function to delete the Instagram account
    async deleteInstagramAccount(accountId: string) {
      try {
        
        // delete the entries from the 'instagram_account_repository'
        await this.instagramAccountRepositoryService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_account_repository'`);

        const mediaList = await this.instagramMediaRepositoryService.getMediaIdsByAccountId(accountId);
        console.log(`media id list: ${mediaList}`);
        

        const deletePromises = mediaList.map((mediaId) => 
          this.instagramMediaAnalyticsRepositoryService.deleteMedia(mediaId) // Reusing existing delete function
        );

        await Promise.all(deletePromises);
        console.log(`deleted from 'instagram_analytics_repository'`);
        
        // // delete the all media which have the given accountId from the 'instagram_media_repository'
        await this.instagramMediaRepositoryService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_media_repository'`);

        return {success: true, message: `account has been removed.`}
        
      } catch (error) {
        console.error(`Failed to delete the account ${accountId}`);
        return {success: false, message: `Failed to delete the account`};
      }
    }

}
