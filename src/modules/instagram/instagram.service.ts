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
import { InstagramStoryRepositoryService } from '@database/dynamodb/repository-services/instagram.story.service';
import { InstagramStoryAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.storyAnalytics.service';
import { log } from 'console';

@Injectable()
export class InstagramAccountService {
  constructor(
    private readonly instagramMediaAnalyticsRepositoryService: InstagramMediaAnalyticsRepositoryService,
    private readonly instagramApiService: InstagramApiService,
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
    private readonly instagramMediaRepositoryService: InstagramMediaRepositoryService,
    private readonly instagramStoryRepositoryService: InstagramStoryRepositoryService,
    private readonly instagramStoryAnalyticsRepositoryService: InstagramStoryAnalyticsRepositoryService
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

  async addInstagramStoryAutomation(storyId: string, input: Record<string, any>) {

    try {
      console.log("tag value:", input)
      if (input === undefined || input === null) {
        throw new Error('Input is undefined or null');
      }
      input['id'] = storyId;
      return await this.instagramStoryRepositoryService.updateStoryDetails(input);

    } catch (error) {
      console.error(`Error inserting automation details for ${storyId}:`, error);
      throw error;
  }
  }

  async addInstagramMediaAutomation(mediaId: string, input: Record<string, any>) {

      try {
          console.log("received input:", input);
          if (input === undefined || input === null) {
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
        if (!account) throw new Error('Account not found');

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
            await this.instagramMediaAnalyticsRepositoryService.updateAnalyticsDetails(media);
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

        const potential_buyers = (item?.comment_counts?.potential_buyers ?? 0);
        const DMs_by_us = (item?.comment_counts?.tagged_comment_dm ?? 0);
        const inquiry = (item?.comment_counts?.inquiry ?? 0);
        const negative_comments = (item?.comment_counts?.negative ?? 0);
        const positive_comments = (item?.comment_counts?.positive ?? 0);
        const tagged_comment = (item?.comment_counts?.tagged_comment ?? 0);
        const tagged_comment_dm = (item?.comment_counts?.tagged_comment_dm ?? 0);

        const comment_by_us = potential_buyers + inquiry + negative_comments + positive_comments + tagged_comment + tagged_comment_dm;
    
        // Extract only numerical stats
        const stats = {
          comment_by_us: comment_by_us,
          potential_buyers: potential_buyers,
          DMs_by_us: DMs_by_us,
          inquiry: inquiry,
          negative_comments: negative_comments,
          positive_comments: positive_comments,
          tagged_comment: tagged_comment,
          tagged_comment_dm:  tagged_comment_dm
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
        // const comments = item?.[type] ?? [];
        const comments =  item?.comments_by_type?.[type] ?? [];
    
        return comments;
      } catch (error) {
        console.error(`Failed to fetch ${type} comments for media ${mediaId}`);
        return { success: false, message: `Error fetching ${type} comments for media` };
      }
    }

    async getCommentTimeSeriesByIntervals(mediaId: string) {
      try {
        // Fetch the full item
        const item = await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(mediaId);
        const commentTimeseries = item?.comment_timeseries;
    
        if (!commentTimeseries) {
          return { by_10m: [], by_1h: [] };
        }
    
        const intervals = {
          by_10m: 600,   // 10 minutes in seconds
          by_1h: 3600    // 1 hour in seconds
        };
    
        const result: Record<string, any[]> = {
          by_10m: [],
          by_1h: []
        };
    
        // Helper function to aggregate by interval
        const aggregateByInterval = (intervalKey: string, intervalSize: number) => {
          const bucketCounts: Record<number, Record<string, number>> = {};
    
          for (const type in commentTimeseries) {
            const entries = commentTimeseries[type];
    
            for (const entry of entries) {
              const ts = entry.ts;
              const bucketTs = ts - (ts % intervalSize);
    
              if (!bucketCounts[bucketTs]) {
                bucketCounts[bucketTs] = {};
              }
    
              bucketCounts[bucketTs][type] = (bucketCounts[bucketTs][type] ?? 0) + entry.count;
            }
          }
    
          // Sort and format
          const formatted = Object.keys(bucketCounts)
            .map(ts => {
              const bucket: any = { ts: Number(ts) };
    
              for (const type in commentTimeseries) {
                bucket[type] = bucketCounts[ts][type] ?? 0;
              }
    
              return bucket;
            })
            .sort((a, b) => a.ts - b.ts);
    
          result[intervalKey] = formatted;
        };
    
        // Generate both 10m and 1h data
        for (const [key, size] of Object.entries(intervals)) {
          aggregateByInterval(key, size);
        }
    
        return result;
    
      } catch (error) {
        console.error(`Failed to fetch comment timeseries for media ${mediaId}:`, error);
        return { success: false, message: 'Error fetching comment timeseries data' };
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

        // delete all the story for given accountId from the "instagram_story_repository"
        await this.instagramStoryRepositoryService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_story_repository'`);

        // delete all the story-analytics for given accountId from the "instagram_story_analytics_repository"
        await this.instagramStoryAnalyticsRepositoryService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_story_analytics_repository'`);

        return {success: true, message: `account has been removed.`}
        
      } catch (error) {
        console.error(`Failed to delete the account ${accountId}`);
        return {success: false, message: `Failed to delete the account`};
      }
    }

    async getRecentStory(accountId: string, access_token: string) {

      try {
         // Fetch all the story from Instagram API
        //  console.log(accountId, access_token);
         const storyList = await this.instagramApiService.getStories(accountId, access_token);
         console.log(storyList);
  
         // Ensure storyList is always an array
         if (!Array.isArray(storyList)) {
            console.warn(`Expected an array, but received:`, storyList);
            return [];
         }
  
         return storyList;
      } catch (error) {
        console.error(`Failed to fetch recent stroy for accountId ${accountId}:`, (error as Error).message);
        throw new Error('Unable to retrieve recent story');
      }
    }

    // story function
    async updateAccountStoryOnTable(accountId: string) {
      try {
        console.log(`Updating story for accountId: ${accountId}`);

        // Fetch account details
        const account = await this.instagramAccountRepositoryService.getAccount(accountId);
        if (!account) throw new Error('Account not found');
        
        const storyDetails = await this.getRecentStory(accountId, account.access_token);
        if (!storyDetails || storyDetails.length === 0) {
            console.warn(`No story found for accountId: ${accountId}`);
            return [];
        }

        const now = new Date();
        // Insert into 'instagram_media_repository' DynamoDB table
        for (const story of storyDetails) {
          const storyTimestamp = new Date(story.timestamp);
          const hoursDiff = (now.getTime() - storyTimestamp.getTime()) / (1000 * 60 * 60);
          const isActive = hoursDiff <= 24;
          const storyWithExtras = {
            ...story,
            accountId,
            IsActive: isActive,
            tag_and_value_pair: {},
          };
          await this.instagramStoryRepositoryService.updateStoryDetails(storyWithExtras);
        }

        for (const story of storyDetails) { 
          await this.instagramStoryAnalyticsRepositoryService.updateStoryAnalytics({
            "id": story?.id,
            "account_id": accountId 
          });

          console.log("story fetched and inserted successfully.");
          return { success: true, message: "Story updated successfully" };
      }

      } catch (error) {
        console.error(`Error updating stroy for ${accountId}:`, error);
        return { success: false, message: `Error updating story in the table` };
      }
    }

    async getInstagramStoryFromTable(accountId: string) {
      try {
        console.log("accountId:", accountId);
        const response = await this.instagramStoryRepositoryService.getStoryByAccountId(accountId);

        console.log(`DynamoDB Response:`, response);

        // Extract items from response if they exist
      const items = response?.Items || [];

      // Ensure response is an array and limit its length to 15
      if (Array.isArray(items)) {
        return items
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
            // .slice(0, 15);
    } else {
        console.warn("Unexpected response type, expected an array:", response);
        return [];
    }
      } catch (error) {
        console.error(`Error getting media details for ${accountId}:`, error);
        throw error;
    }
      
  }

  async getStoryDetailsFromTable(storyId: string) {
    try {
        const response = await this.instagramStoryRepositoryService.getStory(storyId);
        return response?.Item ?? {};

    } catch (error) {
        console.error(`Error getting story details for media ${storyId}:`, error);
        throw error;
    }
  }

  async getStoryStatsFromTable(storyId: string) {
    try {
      const now = new Date();
      const detailsResponse = await this.instagramStoryRepositoryService.getStory(storyId);
      const timestamp = detailsResponse?.Item?.timestamp;
      
      if (!timestamp) {
        console.warn(`No timestamp found for storyId: ${storyId}`);
        return {};
      }
  
      const storyTimestamp = new Date(timestamp);
      const hoursDiff = (now.getTime() - storyTimestamp.getTime()) / (1000 * 60 * 60);
      const isActive = hoursDiff <= 24;
  
      if (isActive) {
        const analyticsResponse = await this.instagramStoryAnalyticsRepositoryService.getStoryAnalytics(storyId);
        return analyticsResponse?.Item ?? {};;
      }
  
      return {};
    } catch (error) {
      console.error(`Failed to get story-analytics for ${storyId}:`, error);
      return {};
    }
  }

}
