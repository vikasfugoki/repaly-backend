import axios from "axios";
import { S3Client, PutObjectCommand, ObjectCannedACL } from "@aws-sdk/client-s3";
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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
import { InstagramDMService } from '@database/dynamodb/repository-services/instagram.dm.service';
import { log } from 'console';
import { FacebookApiService } from '../utils/facebook/api.service';
import { InstagramAdsService } from '@database/dynamodb/repository-services/instagram.ads.service';
import { InstagramFbAccessTokenService } from '@database/dynamodb/repository-services/instagram.fbAccessToken.service';
import  { InstagramAdAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.adAnalytics.service';
import { InstagramAccountLevelAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.accountLevelAnalytics.service';
import { InstagramDmMessageDetailsService } from '@database/dynamodb/repository-services/instagram.dmMessageDetails.service';
import { InstagramDmMessagesService } from '@database/dynamodb/repository-services/instagram.dmMessages.service';
import { InstagramQuickReplyRepositoryService } from '@database/dynamodb/repository-services/instagram.qucikReply.service';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: process.env.AWS_REGION });

@Injectable()
export class InstagramAccountService {
  constructor(
    private readonly instagramMediaAnalyticsRepositoryService: InstagramMediaAnalyticsRepositoryService,
    private readonly instagramApiService: InstagramApiService,
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
    private readonly instagramMediaRepositoryService: InstagramMediaRepositoryService,
    private readonly instagramStoryRepositoryService: InstagramStoryRepositoryService,
    private readonly instagramStoryAnalyticsRepositoryService: InstagramStoryAnalyticsRepositoryService,
    private readonly instagramDMService: InstagramDMService,
    private readonly instagramAdsService: InstagramAdsService,
    private readonly instagramFbAccessTokenService: InstagramFbAccessTokenService,
    private readonly facebookApiService: FacebookApiService,
    private readonly instagramAdAnalyticsRepositoryService: InstagramAdAnalyticsRepositoryService,
    private readonly instagramAccountLevelAnalyticsRepositoryService: InstagramAccountLevelAnalyticsRepositoryService,
    private readonly instagramDmMessageDetailsService: InstagramDmMessageDetailsService,
    private readonly instagramDmMessagesService: InstagramDmMessagesService,
    private readonly instagramQuickReplyRepositoryService: InstagramQuickReplyRepositoryService,
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

private isAutomatedPost(image: any): boolean {
  const ai_enabled = image?.ai_enabled;
  const tag_and_value_pair = image?.tag_and_value_pair;

  // Check ai_enabled logic
  if (ai_enabled && typeof ai_enabled === 'object') {
      for (const category of Object.values(ai_enabled)) {
          if (category && typeof category === 'object') {
              const mode = (category as any)?.mode;
              if (mode && mode !== "leave_comment") {
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
            .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
            .slice(0, 15)
            .map(item => ({
              ...item,
              is_automated: this.isAutomatedPost(item)
            }));
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

        // const mediaList = await this.instagramMediaRepositoryService.getMediaIdsByAccountId(accountId);
        // console.log(`media id list: ${mediaList}`);
        

        // const deletePromises = mediaList.map((mediaId) => 
        //   this.instagramMediaAnalyticsRepositoryService.deleteMedia(mediaId) // Reusing existing delete function
        // );

        // await Promise.all(deletePromises);
        await this.instagramMediaAnalyticsRepositoryService.deleteAccount(accountId);
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

        // delete all the conversation for given accountId from the "instagram_dm_categorization_repository"
        await this.instagramDMService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_dm_categorization_repository'`);

        // delete the instagram account and the attached facebook access_token from the "facebook_access_token_repository"
        await this.instagramFbAccessTokenService.deleteAccount(accountId);
        console.log(`delete from 'facebook_access_token_repository'`)

        // delete all the ads related details for given accountId from "instagram_ads_repository"
        await this.instagramAdsService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_ads_repository'`);
        // delete all the ads analytics related details for given accountId from "instagram_ads_analytics_repository"
        await this.instagramAdAnalyticsRepositoryService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_ads_analytics_repository'`);

        await this.instagramDmMessageDetailsService.deleteConversationDetails(accountId);
        console.log(`deleted from 'instagram_dm_message_details_repository'`);
        await this.instagramDmMessagesService.deleteConversation(accountId);
        console.log(`deleted from 'instagram_dm_messages_repository'`);

        // await new Promise((resolve) => setTimeout(resolve, 2 * 60 * 1000));
        await this.instagramAccountLevelAnalyticsRepositoryService.deleteAccount(accountId);
        console.log(`deleted from 'instagram_account_level_analytics_repository'`);
        return {success: true, message: `account has been removed.`};
        
        
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

    async uploadToS3(imageUrl: string, key: string): Promise<string> {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    
      const uploadParams = {
        Bucket: "influex-bucket",
        Key: key,
        Body: response.data,
        ContentType: "image/jpeg"
      };
    
      await s3Client.send(new PutObjectCommand(uploadParams));
    
      return `https://influex-bucket.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
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

          // Pick thumbnail for VIDEO, media_url for IMAGE
          const imageUrl =
          story.media_type === "VIDEO" && story.thumbnail_url
            ? story.thumbnail_url
            : story.media_url;

        // Upload to S3 and get new URL
        const s3Key = `instagram/stories/${accountId}/${story.id}.jpg`;
        const s3Url = await this.uploadToS3(imageUrl, s3Key);

          const response = await this.instagramStoryRepositoryService.getStory(story.id);
          const existingStory = response?.Item || null;

          const storyWithExtras = {
            ...story,
            accountId,
            IsActive: isActive,
            media_url: s3Url, // Use S3 URL
            // image_data: imageBase64,
            tag_and_value_pair: existingStory && 'tag_and_value_pair' in existingStory
                                ? existingStory.tag_and_value_pair
                                : {},
          };
          await this.instagramStoryRepositoryService.updateStoryDetails(storyWithExtras);
        }

        for (const story of storyDetails) { 
          await this.instagramStoryAnalyticsRepositoryService.updateStoryAnalytics({
            "id": story?.id,
            "account_id": accountId 
          });

          console.log("story fetched and inserted successfully.");
          
      }

      return { success: true, message: "Story updated successfully" };

      } catch (error) {
        console.error(`Error updating stroy for ${accountId}:`, error);
        return { success: false, message: `Error updating story in the table ${error}` };
      }
    }

    async getInstagramStoryFromTable(accountId: string) {
      try {
        console.log("accountId:", accountId);
        const response = await this.instagramStoryRepositoryService.getStoryByAccountId(accountId);
    
        console.log(`DynamoDB Response:`, response);
    
        const items = response?.Items || [];
        const now = new Date();
    
        if (!Array.isArray(items)) {
          console.warn("Unexpected response type, expected an array:", response);
          return [];
        }
    
        const updatedItems = await Promise.all(
          items
            .sort(
              (a, b) =>
                new Date(b.timestamp || 0).getTime() -
                new Date(a.timestamp || 0).getTime()
            )
            .slice(0, 15)
            .map(async (item) => {
              const storyTimestamp = new Date(item.timestamp as string);
              const hoursDiff = (now.getTime() - storyTimestamp.getTime()) / (1000 * 60 * 60);
              const isActive = hoursDiff <= 24;

              if (item.IsActive !== isActive) {
                await this.instagramStoryRepositoryService.updateStoryDetails({
                  ...item,
                  IsActive: isActive,
                });
                console.log(`Updated IsActive for story ${item.id} → ${isActive}`);
              }
    
              return {
                ...item,
                IsActive: isActive,
                is_automated: this.isAutomatedPost(item),
              };
            })
        );
    
        // Return only active stories
        // return updatedItems.filter(item => item.IsActive);
        return updatedItems;
    
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

  async getDMCategorization(accountId: string) {
    
    try {
        const conversations = await this.instagramDMService.getConversationsByAccountId(accountId);
        const items = conversations.Items || [];

        const simplified = items.map((item) => ({
          id: item.id,
          sender_username: item.sender_username,
          recipient_username: item.recipient_username,
          sender_pic_url: item.sender_pic_url,
          recipient_pic_url: item.recipient_pic_url,
          category: item.category,
          sender_data: item.sender_data,
          sender_id: item.senderId,
          recipient_id: item.recipientId
        }));

        return simplified;
    } catch (error) {
      console.error(`Failed to get DM categorization for ${accountId}:`, error);
      return {};
    }
  }

  async getDMConversation(conversationId: string) {

    try {
      const conversation = await this.instagramDMService.getConversations(conversationId);
      return conversation?.Item ?? [];
    } catch (error) {
      console.error(`Failed to get conversation details for ${conversationId}:`, error);
      throw error;
    }  
  }

  async updateDMCategory(conversationId: string, response: Record<string, any>) {
    try {
      console.log("received input:", response);
        if (!response) {
            throw new Error('Input is undefined or null');
        }
        response['id'] = conversationId;
        return await this.instagramDMService.updateConversationDetails(response);

    } catch (error) {
      console.error(`Failed to PUT conversation category for ${conversationId}:`, error);
      throw error;
    }
  }

  async getSummaries(mediaId: string) {
    try {

      const mediaItem = await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(mediaId);

      if (!mediaItem) {
        throw new Error(`Media item not found for mediaId: ${mediaId}`);
      }
  
      const negativeSummary = mediaItem.negative_summary || "No negative summary available.";
      const inquirySummary = mediaItem.inquiry_summary || "No inquiry summary available.";
  
      return {
        negative_summary: negativeSummary,
        inquiry_summary: inquirySummary,
      };
  


    } catch (error) {
      console.error(`Failed to get summaries details for ${mediaId}:`, error);
      throw error;
    }  
  }

    // story apis
    // async updateAdsOnTable(accountId: string, input: Record<string, any>) {
    //   try {
    //     const isAccountIdPresent = await this.instagramFbAccessTokenService.isIdPresent(accountId);
    //     if (isAccountIdPresent == false) {
    //         if (input?.code != null) {
    //           console.log("instagram authorization code:", input.code);
    //           const tokenResponse = await this.facebookApiService.getAccessTokenAds(input.code);
    //           console.log("access token using authorization code:", tokenResponse);
    //           // await this.instagramFbAccessTokenService.insertFacebookDetails({"id": accountId, "access_token": tokenResponse.access_token});

    //           const ads_lst = await this.facebookApiService.getAdAccounts(tokenResponse.access_token);

    //           // pro user id
    //           const account = await this.instagramAccountRepositoryService.getAccount(accountId);
    //           const pro_user_id = account?.pro_user_id;

    //           console.log("pro user id:", pro_user_id);

    //           if (!pro_user_id) {
    //             return {
    //               statusCode: 400,
    //               message: `pro_user_id is not present for the given Instagram account.`,
    //               success: false,
    //             };
    //           }

    //           // Add accountId to each ad in the list
    //           const enriched_ads_lst = ads_lst.map(ad => ({
    //             ...ad,
    //             account_id: accountId,
    //           }));

    //           console.log('Enriched ads list:', enriched_ads_lst);

    //           for (const ad of enriched_ads_lst) {
    //             console.log("this is one of the enriched ad:", ad);
    //             let ad_details = await this.facebookApiService.getAdCreatives(ad.id, tokenResponse.access_token);
    //             for (const ad_detail of ad_details) {
    //               console.log("ad details:", ad_detail);

    //               // ✅ Validation: accountId must match instagram_user_id
    //               const igUserId = ad_detail?.instagram_user_id;
    //               if (igUserId !== pro_user_id) {
    //                 throw new BadRequestException(
    //                   "Facebook account is not connected to this Instagram user. Only accounts linked to the Instagram profile are allowed."
    //                 );
    //               }

    //               const new_ad_detail = {...ad_detail, "accountId": ad.account_id, "adId": ad.id}
                  

    //               const ad_analytics_detail =  {
    //                                             "id": new_ad_detail.id,
    //                                             "accountId": new_ad_detail.accountId,
    //                                             "effective_instagram_media_id": new_ad_detail?.effective_instagram_media_id,
    //                                             "adId": new_ad_detail.adId
    //               }

    //               if (new_ad_detail?.effective_instagram_media_id != null) {
    //                 await this.instagramAdsService.updateAdsDetails(new_ad_detail)
    //                 await this.instagramAdAnalyticsRepositoryService.updateAdAnalytics(ad_analytics_detail);
    //               }
                  
    //             }
    //           }

    //           console.log('ads being inserted successfully!!!!')
    //           await this.instagramFbAccessTokenService.insertFacebookDetails({"id": accountId, "access_token": tokenResponse.access_token});

    //         }
    //     }
    //     else {
          
    //         const facebookItem = await this.instagramFbAccessTokenService.getFacebookDetails(accountId);
    //         const access_token = await facebookItem?.Item?.access_token;

    //         const ads_lst = await this.facebookApiService.getAdAccounts(access_token);

    //         // Add accountId to each ad in the list
    //         const enriched_ads_lst = ads_lst.map(ad => ({
    //           ...ad,
    //           account_id: accountId,
    //         }));

    //         console.log('Enriched ads list:', enriched_ads_lst);

    //         for (const ad of enriched_ads_lst) {
    //           console.log("this is one of the enriched ad:", ad);
    //           let ad_details = await this.facebookApiService.getAdCreatives(ad.id, access_token);
    //           for (const ad_detail of ad_details) {
    //             console.log("ad details:", ad_details);
    //             const new_ad_detail = {...ad_detail, "accountId": ad.account_id, "adId": ad.id}
    //             console.log("new ad details:", new_ad_detail);

    //             if (new_ad_detail?.effective_instagram_media_id != null) {
    //               await this.instagramAdsService.updateAdsDetails(new_ad_detail)
    //             }
    //           }
    //         }
    //         console.log('ads being inserted successfully!!!!')

    //     }

    //     return {success: true, message: `ads being inserted successfully!!!!`};

    //   } catch (error) {
    //     console.error(`Failed to update ad details ${accountId}:`, error);
    //     throw error;
    //   }
    // }

    async updateAdsOnTable(accountId: string, input: Record<string, any>) {
      try {
        const isAccountIdPresent = await this.instagramFbAccessTokenService.isIdPresent(accountId);
        let accessToken: string;
        console.log("isAccountIdPresent:", isAccountIdPresent);
    
        // 1. Get access token
        if (!isAccountIdPresent) {
          console.log("Account ID not present, input code:", input);
          if (!input?.code) {
            throw new BadRequestException("Missing authorization code for new account");
          }
    
          const tokenResponse = await this.facebookApiService.getAccessTokenAds(input.code);
          accessToken = tokenResponse.access_token;
    
          // await this.instagramFbAccessTokenService.insertFacebookDetails({
          //   id: accountId,
          //   access_token: accessToken,
          // });
        } else {
          const facebookItem = await this.instagramFbAccessTokenService.getFacebookDetails(accountId);
          accessToken = facebookItem?.Item?.access_token;
    
          if (!accessToken) {
            throw new InternalServerErrorException("Access token not found for existing account");
          }
        }

        let adsProcessed: number = 0;
    
        // 2. Get ad accounts
        const adsList = await this.facebookApiService.getAdAccounts(accessToken);
        const enrichedAdsList = adsList.map(ad => ({
          ...ad,
          account_id: accountId,
        }));
    
        // 3. Get pro_user_id for validation
        const account = await this.instagramAccountRepositoryService.getAccount(accountId);
        const proUserId = account?.pro_user_id;
    
        if (!proUserId) {
          return {
            statusCode: 400,
            message: `pro_user_id is not present for the given Instagram account.`,
            success: false,
          };
        }

        console.log("enrichedAdsList:", enrichedAdsList);
    
        // 4. Iterate over all ads and fetch creative + insight
        for (const ad of enrichedAdsList) {
          const adsWithData = await this.facebookApiService.getAdsWithCreativesAndInsights(ad.id, accessToken);
    
          for (const adData of adsWithData) {
            const igUserId = adData?.object_story_spec?.instagram_user_id;

            console.log("igUserId:", igUserId);
            console.log("proUserId:", proUserId);
            console.log("adData:", adData);
    
            // Validate: Facebook ad must be linked to the same IG user
            // if (igUserId && igUserId !== proUserId) {
            //   throw new BadRequestException("Facebook account is not connected to this Instagram user.");
            // }
            if (!igUserId && igUserId !== proUserId) {
                console.warn(`Skipping ad ${adData.ad_id} - Instagram user mismatch (${igUserId} ≠ ${proUserId})`);
                continue; // Skip this ad and continue with the next one
            }
    
            // Combine all data into one object
            const adDetail = {
              ...adData,
              id: adData.ad_id,
              accountId: ad.account_id,
              adId: adData.ad_id,
              insights: adData.insights || {},
            };

            // Analytics record for Instagram Analytics table
            const adAnalytics = {
              id: adData.ad_id,
              adId: adData.ad_id,
              accountId: ad.account_id,
              creativeId: adData.creative_id,
              effective_instagram_media_id: adData.effective_instagram_media_id,
            };

            console.log("ad with insights:", adDetail);
    
            // Save into DynamoDB (single table)
            if (adData?.effective_instagram_media_id) {
              await this.instagramAdsService.updateAdsDetails(adDetail);
              await this.instagramAdAnalyticsRepositoryService.updateAdAnalytics(adAnalytics);
            }

            adsProcessed++;
          }
        }

        if (adsProcessed > 0) {
          await this.instagramFbAccessTokenService.insertFacebookDetails({
            id: accountId,
            access_token: accessToken,
          });

          console.log("Ads, creatives, and insights inserted successfully!");
          return { success: true, message: "Ads inserted successfully!" };
        }
    
        console.log("accountID and facebook access_token being stores!!!");
        return { success: true, message: "No instagram Ads available in this account!!!"};
        
      } catch (error) {
        console.error(`Failed to update ad-details for ${accountId}:`, error);
        throw error;
      }
    }

  async getAdsFromTable(accountId: string) {
    try {
      const isAccountPresent = await this.instagramFbAccessTokenService.isIdPresent(accountId);
      if (isAccountPresent == false) {
        return {
          is_facebook_added: isAccountPresent,
          ads: []
        };
      }

      // Fetch actual ads if the account is present
      const ads = await this.instagramAdsService.getAdsByAccountId(accountId);
      const items = ads?.Items || [];

      // Add is_automated to each ad item using isAutomatedPost
      const adsWithAutomation = items.map(item => ({
        ...item,
        is_automated: this.isAutomatedPost(item)
      }));

      return {
        is_facebook_added: true,
        ads: adsWithAutomation
      };

    } catch (error) {
      console.error(`Failed to get ad details for account: ${accountId}`, error);
      throw error;
    }
  }

  async isFacebookLinked(accountId: string) {
    try {
      const isAccountPresent = await this.instagramFbAccessTokenService.isIdPresent(accountId);
      console.log("isFacebook linked:", isAccountPresent);
      if (isAccountPresent == true) {
        return {success: true, is_facebook_added: true };
      }
      return {success: true, is_facebook_added: false };
    } catch (error) {
      console.error(`Failed to facebook account linked status to instagram account: ${accountId}`, error);
      throw error;
    }
  }

  async getAdDetails(adId: string) {
    try {
      const ad_detail = this.instagramAdsService.getAds(adId);
      return ad_detail;
    } catch (error) {
      console.error(`Failed to get details for ad: ${adId}`, error);
      throw error;
    }
  }

  async addInstagramAdAutomation(adId: string, input: Record<string, any>) {
      try {
        console.log("tag value:", input)
        if (input === undefined || input === null) {
          throw new Error('Automation is undefined or null');
        }
        input['id'] = adId;
        return await this.instagramAdsService.updateAdsDetails(input);

      } catch (error) {
        console.error(`Error inserting automation details for ${adId}:`, error);
        throw error;
      }
  }


  async getAdStatsFromTable(adId: string) {
    try {
      const result = await this.instagramAdAnalyticsRepositoryService.getAdAnalytics(adId);
      console.log("result ad stats:", result);
      const item = result?.Item?.comment_counts;
      console.log("item ad stats:", item);

      return {
        positive_counts: item?.positive,
        negative_counts: item?.negative,
        potential_buyers_count: item?.potential_buyers,
        inquiry_count: item?.inquiry,
        others_count: item?.others
      };
  
    } catch (error) {
      console.error(`Error getting ad analytic stats details for ${adId}:`, error);
      throw error;
    }
  }

  async getCommentsFromAdAnalyticsTable(adId: string, type: "positive" | "negative" | "potential_buyers" | "inquiry") {
    try {
          const result = await this.instagramAdAnalyticsRepositoryService.getAdAnalytics(adId);
        const item = result?.Item;

        if (!item) {
          console.warn(`No analytics found for adId: ${adId}`);
          return [];
        }

        const key = `${type}_comments`; // Dynamically build the field name
        const comments = item?.[key] ?? [];

        return comments;
    }
     catch (error) {
      console.error(`Failed to fetch ${type} comments for media ${adId}`);
      return { success: false, message: `Error fetching ${type} comments for ad` };
     }
  }

  
// async dmReply(accountId: string, input: { type: string; recipientId: string; content: string }) {
//     try {
//       console.log("accountId:", accountId);
//       console.log("input:", input);
  
//       const account = await this.instagramAccountRepositoryService.getAccount(accountId);
//       if (!account) throw new Error('Token not found');
//       const { access_token } = account;
  
//       console.log(`access token: ${access_token}`);
  
//       // Construct the message payload
//       const payload = {
//         recipient: {
//           id: input.recipientId
//         },
//         message: {
//           text: input.content
//         }
//       };
  
//       const response = await fetch(`https://graph.instagram.com/v23.0/${accountId}/messages`, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${access_token}`,
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(payload)
//       });
  
//       const result = await response.json();
//       console.log('result:', result);

//       if (!response.ok) {
//        console.error(`Instagram API error:`, result);
//        return { success: false, message: result.error?.message || 'Unknown error' };
//      }
  
//     return { success: true, message: 'Message sent successfully', data: result };
  
//     } catch (error) {
//        console.error(`Failed to send message for ${accountId}`, error);
//       return { success: false, message: `Failed to send message for ${accountId}` };
//     }
//   }

async dmReply(
  accountId: string,
    input: { type: 'text' | 'image' | 'video' | 'audio'; recipientId: string; content: string }
  ): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    console.log("accountId:", accountId);
    console.log("input:", input);

    const account = await this.instagramAccountRepositoryService.getAccount(accountId);
    if (!account) {
      throw new Error('Access token not found for account');
    }

    const { access_token, pro_user_id: igId } = account;
    if (!igId) {
      throw new Error('Instagram ID (pro_user_id) is missing for this account');
    }

    // Construct the payload
    const payload =
      input.type === 'text'
        ? {
            recipient: { id: input.recipientId },
            message: { text: input.content }
          }
        : {
            recipient: { id: input.recipientId },
            message: {
              attachment: {
                type: input.type,
                payload: { url: input.content }
              }
            }
          };

    const response = await fetch(`https://graph.instagram.com/v23.0/${igId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('Instagram API result:', result);

    if (!response.ok) {
      console.error('Instagram API error:', result);
      return {
        success: false,
        message: result.error?.message || 'Unknown error from Instagram API',
        data: result
      };
    }

    return {
      success: true,
      message: 'Message sent successfully',
      data: result
    };

  } catch (error: any) {
    console.error(`Failed to send message for account ${accountId}:`, error?.message || error);
    return {
      success: false,
      message: `Failed to send message for account ${accountId}`,
      data: error?.response?.data || null
    };
  }
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////  ACCOUNT LEVEL ANALYTICS  //////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////



async getAccountLevelAnalytics(accountId: string) {
  try {
    // Fetch the account details

    console.log("Fetching account level analytics for accountId:", accountId);

    const stats = await this.instagramAccountLevelAnalyticsRepositoryService.getAccountLevelAnalyticsByAccountId(accountId);
    const accountInfo = await this.instagramAccountRepositoryService.getAccount(accountId);
    if (!accountInfo?.access_token) {
      throw new Error(`Access token not found for accountId: ${accountId}`);
    }
    const { access_token, created_time } = accountInfo ?? {};
    const media_count = await this.instagramApiService.getMediaCount(accountId, access_token);
    console.log("access token:", access_token);
    console.log("Account Level Analytics:", stats);

    const levels = ['account_media', 'account_ads', 'account_media_automated_posts', 'account_ad_automated_posts', 'account_dm_automated_posts'];

    if (!stats || !stats.Items || stats.Items.length === 0) {
      throw new Error(`No analytics found for accountId: ${accountId}`);
    }

    const getByLevel = (level: string) =>
      (stats.Items || []).find((item: any) => item.level === level) || {};

    const media = getByLevel('account_media');
    const media_post = getByLevel('account_media_automated_posts');
    const ads = getByLevel('account_ads');
    const ads_post = getByLevel('account_ad_automated_posts');
    const stories = getByLevel("account_story");
    const stories_post = getByLevel('account_story_automated_posts');
    const dm = getByLevel('account_dm_automated_posts');

    console.log("Media Analytics:", media);

    const collapsed = {
      comments: (media.total_comments || 0) + (ads.total_comments || 0),
      dms: (media.total_dms || 0) + (ads.total_dms || 0),
      negative: (media.negative || 0) + (ads.negative || 0),
      unreplied: dm.total_unreplied || 0,
      total_posts:
        (media_count || media_post.total_post || 0) +
        (ads_post.total_post || 0) +
        (stories_post.total_post || 0),
      automated_posts:
        (media_post.automated_post || 0) +
        (ads_post.automated_post || 0) +
        (stories_post.automated_post || 0)
    };

    const mediaDetails = {
      total_comments: media.total_comments || 0,
      replied_comments: (media.inquiry || 0) + (media.positive || 0) + (media.negative || 0) + (media.potential_buyers || 0) + (media.tagged_comment || 0) + (media.tagged_comment_dm || 0),
      buyers: media.potential_buyers || 0,
      inquiries: media.inquiry || 0,
      negative_comments: media.negative || 0,
      positive_comments: media.positive || 0,
      others: (media.others || 0) + (media.positive_no_automation || 0) + (media.negative_no_automation || 0) + (media.potential_buyers_no_automation || 0) + (media.inquiry_no_automation || 0), 
      tagged_comment: (media.tagged_comment || 0) + (media.tagged_comment_dm || 0),
      total_post: media_count || media_post.total_post || 0,
      automated_post: media_post.automated_post || 0
    };

    const adsDetails = {
      total_comments: ads.total_comments || 0,
      replied_comments: (ads.inquiry || 0) + (ads.positive || 0) + (ads.negative || 0) + (ads.potential_buyers || 0) + (ads.tagged_comment || 0) + (ads.tagged_comment_dm || 0),
      buyers: ads.potential_buyers || 0,
      inquiries: ads.inquiry || 0,
      negative_comments: ads.negative || 0,
      positive_comments: ads.positive || 0,
      others: (ads.others || 0) + (ads.positive_no_automation || 0) + (ads.negative_no_automation || 0) + (ads.potential_buyers_no_automation || 0) + (ads.inquiry_no_automation || 0), 
      tagged_comment: (ads.tagged_comment || 0) + (ads.tagged_comment_dm || 0),
      total_ads: ads_post.total_post || 0,
      automated_ads: ads_post.automated_post || 0
    };

    const storyDetails = {
      tagged_comments: stories.tagged || 0,
      others: stories.others || 0,
      total_comments: stories.total_comments || 0,
      total_stories: stories_post.total_post || 0,
      automated_stories: stories_post.automated_post || 0
    }

    const dmDetails = {
      total_unreplied: dm.total_unreplied || 0,
      total_dm: dm.total_dm || 0,
      others: dm.category_others || 0,
      lead: dm.category_lead || 0,
      inquiry: dm.category_inquiry || 0,
      collaboration: dm.category_collaboration || 0
    }


    const expanded = {
      media: mediaDetails,
      ads: adsDetails,
      stories: storyDetails,
      dm: dmDetails
    }

    console.log("Collapsed Analytics:", collapsed);

    // // Combine all metrics into a single response
    return {
      accountId,
      collapsed,
      expanded,
      updated_at: new Date().toISOString(),
      added_at: created_time
    };

  } catch (error) {
    console.error(`Failed to fetch account analytics for ${accountId}:`, error);
    throw new Error('Unable to retrieve account analytics');
  }
} 

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////////////  DM LEVEL ANALYTICS  //////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////
  async getDMSummaryAnalytics(accountId: string) {
    try {
      console.log("Fetching DM level analytics for accountId:", accountId);
  
      const stats = await this.instagramAccountLevelAnalyticsRepositoryService
        .getAccountLevelAnalytics(accountId + "_dm_automated_posts");
  
      if (!stats || !stats.Item) {
        console.warn(`No DM analytics found for accountId: ${accountId}`);
        return {
          statusCode: 404,
          message: `No DM analytics found for accountId: ${accountId}`,
          data: null,
        };
      }

      // Calculate total_dm if not present
      if (stats.Item.total_dm === undefined || stats.Item.total_dm === null) {
        const category_inquiry = stats.Item.category_inquiry || 0;
        const category_collaboration = stats.Item.category_collaboration || 0;
        const category_others = stats.Item.category_others || 0;
        const category_lead = stats.Item.category_lead || 0;
        
        stats.Item.total_dm = category_inquiry + category_collaboration + category_others + category_lead;
        console.log(`Calculated total_dm: ${stats.Item.total_dm} from categories`);
      }

      // If total_dm is 0 but total_unreplied exists, use total_unreplied as total_dm
      if (stats.Item.total_dm === 0 && stats.Item.total_unreplied !== undefined && stats.Item.total_unreplied !== null) {
        stats.Item.total_dm = stats.Item.total_unreplied;
        console.log(`Using total_unreplied (${stats.Item.total_unreplied}) as total_dm since calculated total_dm was 0`);
      }
  
      return {
        statusCode: 200,
        message: "DM analytics retrieved successfully",
        data: stats.Item,
      };
    } catch (error) {
      console.error(`Failed to fetch DM analytics for ${accountId}:`, error);
      return {
        statusCode: 500,
        message: "Unable to retrieve DM analytics",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDMConversations(accountId: string) {
    try {
      // Fetch all conversations for the account
      const { items, lastEvaluatedKey } =
        await this.instagramDmMessageDetailsService.getConversationDetails(accountId);
      console.log("DM Conversations:", items);
  
      if (!items || items.length === 0) {
        return [];
      }
  
      // Optionally return pagination key as well if you need to load more pages
      return { items, lastEvaluatedKey };
    } catch (error) {
      console.error(`Failed to get DM conversations for ${accountId}:`, error);
      throw new Error("Unable to retrieve DM conversations");
    }
  }

  async getDMConversationDetails(account_id: string, conversationId: string) {
    try {
      // Fetch conversation details by ID
      const conversation = await this.instagramDmMessagesService.getConversationById(conversationId);
      console.log("DM Conversation Details:", conversation);
  
      if (!conversation || Object.keys(conversation).length === 0) {
        throw new Error(`No conversation found for ID: ${conversationId}`);
      }
  
      return conversation;
    } catch (error) {
      console.error(`Failed to get DM conversation details for ${conversationId}:`, error);
      throw new Error("Unable to retrieve DM conversation details");
    }
  }
  

  //////////////////////////////////////////////////////////////////////////////////////////////////////
  /////////////////////////////////// COMMENT LEVEL ANALYTICS ///////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////////////////////

  ////////////////////////////////////////// MEDIA ///////////////////////////////////////////////////////////

  async getMediaAnalytics(accountId: string) {
    try {
      const mediaAutomatedPostsResult = await this.instagramAccountLevelAnalyticsRepositoryService.getAccountLevelAnalytics(accountId + "_media_automated_posts");
      const mediaAutomatedPosts = mediaAutomatedPostsResult?.Item || {};
      const mediaAnalyticsResult = await this.instagramAccountLevelAnalyticsRepositoryService.getAccountLevelAnalytics(accountId + "_media");
      const mediaAnalytics = mediaAnalyticsResult?.Item || {};

      const {access_token} = await this.instagramAccountRepositoryService.getAccount(accountId) ?? {};
      if (!access_token) {
        throw new Error(`Access token not found for accountId: ${accountId}`);
      }
      console.log("access token:", access_token);
      const media_count = await this.instagramApiService.getMediaCount(accountId, access_token);
      console.log("media count:", media_count);
      mediaAutomatedPosts.total_post = media_count;
      
      // mediaAutomatedPosts = mediaAutomatedPosts?.Item || {};
      // mediaAnalytics = mediaAnalytics?.Item || {};

      const res = {
        inquiry: mediaAnalytics.inquiry ?? 0,
        inquiry_dm: mediaAnalytics.inquiry_dm ?? 0,
        inquiry_no_automation: mediaAnalytics.inquiry_no_automation ?? 0,
        level: mediaAnalytics.level ?? "account_media",
        negative: mediaAnalytics.negative ?? 0,
        negative_no_automation: mediaAnalytics.negative_no_automation ?? 0,
        no_automation_comments: mediaAnalytics.no_automation_comments ?? 1,
        other_comments: mediaAnalytics.other_comments ?? 0,
        positive: mediaAnalytics.positive ?? 0,
        positive_no_automation: mediaAnalytics.positive_no_automation ?? 1,
        potential_buyers: mediaAnalytics.potential_buyers ?? 0,
        potential_buyers_no_automation: mediaAnalytics.potential_buyers_no_automation ?? 0,
        tagged: mediaAnalytics.tagged ?? 0,
        tagged_comment: mediaAnalytics.tagged_comment ?? 0,
        tagged_comment_dm: mediaAnalytics.tagged_comment_dm ?? 1,
        total_comments: mediaAnalytics.total_comments ?? 2,
        total_dms: mediaAnalytics.total_dms ?? 1,
        media_automated_posts: mediaAutomatedPosts.automated_post ?? 0,
        total_posts: mediaAutomatedPosts.total_post ?? 0,
        total_positive: (mediaAnalytics.positive ?? 0) + (mediaAnalytics.positive_no_automation ?? 0),
        total_negative: (mediaAnalytics.negative ?? 0) + (mediaAnalytics.negative_no_automation ?? 0),
        total_potential_buyers: (mediaAnalytics.potential_buyers ?? 0) + (mediaAnalytics.potential_buyers_no_automation ?? 0),
        total_inquiry: (mediaAnalytics.inquiry ?? 0) + (mediaAnalytics.inquiry_no_automation ?? 0) + (mediaAnalytics.inquiry_dm ?? 0),
        total_tagged: (mediaAnalytics.tagged_comment ?? 0) + (mediaAnalytics.tagged_comment_dm ?? 0),
        total_others: mediaAnalytics.other_comments ?? 0
      };

      return res;
    } catch (error) {
      console.error(`Failed to get media analytics for ${accountId}:`, error);
      throw new Error('Unable to retrieve media analytics');
    }
  }

  async getMediaAnalyticsById(accountId: string, mediaId: string) {
    try {
      const mediaAnalytics = await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(mediaId);
      if (!mediaAnalytics || Object.keys(mediaAnalytics).length === 0) {
        throw new Error(`No analytics found for mediaId: ${mediaId}`);
      }
  
      const commentsByType = mediaAnalytics.comments_by_type || {};
      const allComments: Array<{
        comment_timestamp: number;
        commenter_username: string;
        comment: string;
        response_comment: string;
        response_dm: string;
        reply_timestamp: number;
        category: string;
      }> = [];
  
      // Define mapping from raw categories -> normalized categories
      const categoryMap: Record<string, string> = {
        positive: "positive",
        positive_no_automation: "positive",
        negative: "negative",
        negative_no_automation: "negative",
        inquiry: "inquiry",
        inquiry_no_automation: "inquiry",
        inquiry_dm: "inquiry",
        potential_buyers: "potential_buyers",
        potential_buyers_no_automation: "potential_buyers",
        tagged_comment: "tagged_comment",
        tagged_comment_dm: "tagged_comment",
        others: "others",
      };
  
      for (const [rawCategory, comments] of Object.entries(commentsByType)) {
        const normalizedCategory = categoryMap[rawCategory];
        if (!normalizedCategory) {
          // Skip categories we don't care about
          continue;
        }
  
        for (const commentArr of comments as any[]) {
          const [
            comment_timestamp,
            commenter_username,
            comment,
            response,
            reply_timestamp,
          ] = commentArr;
  
          allComments.push({
            comment_timestamp,
            commenter_username,
            comment,
            response_comment: rawCategory.includes("dm") ? "" : response,
            response_dm: rawCategory.includes("dm") ? response : "",
            reply_timestamp,
            category: normalizedCategory,
          });
        }
      }
  
      return allComments;
    } catch (error) {
      console.error(`Failed to get media analytics for ${mediaId}:`, error);
      throw new Error("Unable to retrieve media analytics");
    }
  }
  

  async getMediaCommentsByCategory(accountId: string, mediaId: string, category: string) {
    try {
      // Define valid categories
      const validCategories = [
        'positive',
        'negative',
        'potential_buyers',
        'inquiry',
        'others',
        'tagged_comment'
      ];

      if (!validCategories.includes(category)) {
        throw new Error(`Invalid category: ${category}. Valid categories are: ${validCategories.join(', ')}`);
      }

      // Get media analytics
      const mediaAnalytics = await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(mediaId);
      if (!mediaAnalytics || Object.keys(mediaAnalytics).length === 0) {
        throw new Error(`No analytics found for mediaId: ${mediaId}`);
      }

      const commentsByType = mediaAnalytics.comments_by_type || {};
      let filteredComments: Array<{
        comment_timestamp: number;
        commenter_username: string;
        comment: string;
        response_comment: string;
        response_dm: string;
        reply_timestamp: number;
        category: string;
      }> = [];

      // Helper to process comments
      const processComments = (comments: any[], cat: string) => {
        for (const commentArr of comments) {
          const [
            comment_timestamp,
            commenter_username,
            comment,
            response,
            reply_timestamp
          ] = commentArr;

          filteredComments.push({
            comment_timestamp,
            commenter_username,
            comment,
            response_comment: cat.includes('dm') ? '' : response,
            response_dm: cat.includes('dm') ? response : '',
            reply_timestamp,
            category: cat
          });
        }
      };

      // Combine categories as per requirements
      if (category === 'positive') {
        processComments(commentsByType['positive'] || [], 'positive');
        processComments(commentsByType['positive_no_automation'] || [], 'positive_no_automation');
      } else if (category === 'negative') {
        processComments(commentsByType['negative'] || [], 'negative');
        processComments(commentsByType['negative_no_automation'] || [], 'negative_no_automation');
      } else if (category === 'potential_buyers') {
        processComments(commentsByType['potential_buyers'] || [], 'potential_buyers');
        processComments(commentsByType['potential_buyers_no_automation'] || [], 'potential_buyers_no_automation');
      } else if (category === 'inquiry') {
        processComments(commentsByType['inquiry'] || [], 'inquiry');
        processComments(commentsByType['inquiry_dm'] || [], 'inquiry_dm');
        processComments(commentsByType['inquiry_no_automation'] || [], 'inquiry_no_automation');
      } else if (category === 'tagged_comment') {
        processComments(commentsByType['tagged_comment'] || [], 'tagged_comment');
        processComments(commentsByType['tagged_comment_dm'] || [], 'tagged_comment_dm');
      } else if (category === 'others') {
        processComments(commentsByType['others'] || [], 'others');
        processComments(commentsByType['other_comments'] || [], 'other_comments');
      }

      return filteredComments;
    } catch (error) {
      console.error(`Failed to get ${category} comments for media ${mediaId}:`, error);
      throw new Error(`Unable to retrieve ${category} comments for media`);
    }
  }

  async getMediaCommentCounts(accountId: string) {
    try {
      // Fetch all media for the account
      const mediaListResponse = await this.instagramMediaRepositoryService.getMediaByAccountId(accountId);
      const mediaItems = mediaListResponse?.Items || [];
      
      if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
        throw new Error(`No media found for accountId: ${accountId}`);
      }
  
      // For each media, fetch analytics and build stats using comment_counts and combined categories
      const result = await Promise.all(
        mediaItems.map(async (media) => {
          const mediaId = media.id;
          const media_url = media.media_url;
          const thumbnail_url = media.thumbnail_url;
          const media_type = media.media_type;
          const timestamp = media.timestamp;
          
          const analytics = await this.instagramMediaAnalyticsRepositoryService.getMediaAnalytics(mediaId);
          const comment_counts = (analytics?.comment_counts ?? {}) as {
            positive?: number;
            positive_no_automation?: number;
            negative?: number;
            negative_no_automation?: number;
            inquiry?: number;
            inquiry_dm?: number;
            inquiry_no_automation?: number;
            potential_buyers?: number;
            potential_buyers_no_automation?: number;
            tagged_comment?: number;
            tagged_comment_dm?: number;
            others?: number;
            other_comments?: number;
            total_comments?: number;
          };
  
          // Combine stats for positive, negative, inquiry, potential_buyers, etc.
          const combinedStats = {
            mediaId,
            media_url,
            media_type,
            thumbnail_url,
            timestamp,
            positive: (comment_counts.positive ?? 0) + (comment_counts.positive_no_automation ?? 0),
            negative: (comment_counts.negative ?? 0) + (comment_counts.negative_no_automation ?? 0),
            inquiry: (comment_counts.inquiry ?? 0) + (comment_counts.inquiry_no_automation ?? 0) + (comment_counts.inquiry_dm ?? 0),
            potential_buyers: (comment_counts.potential_buyers ?? 0) + (comment_counts.potential_buyers_no_automation ?? 0),
            tagged_comment: (comment_counts.tagged_comment ?? 0) + (comment_counts.tagged_comment_dm ?? 0),
            others: (comment_counts.others ?? 0), //(comment_counts.others_comments ?? 0)
            replied_comment: (comment_counts.positive ?? 0) + (comment_counts.negative ?? 0) + (comment_counts.inquiry ?? 0) + (comment_counts.inquiry_dm ?? 0) + (comment_counts.potential_buyers ?? 0) + (comment_counts.tagged_comment ?? 0) + (comment_counts.tagged_comment_dm ?? 0),
            // no_automation_comments: (comment_counts.positive_no_automation ?? 0) + (comment_counts.negative_no_automation ?? 0) + (comment_counts.potential_buyers_no_automation ?? 0) + (comment_counts.inquiry_no_automation ?? 0),
            // total_dms: (comment_counts.inquiry_dm ?? 0) + (comment_counts.tagged_comment_dm ?? 0),
            total_comments:
              (comment_counts.positive ?? 0) +
              (comment_counts.positive_no_automation ?? 0) +
              (comment_counts.negative ?? 0) +
              (comment_counts.negative_no_automation ?? 0) +
              (comment_counts.inquiry ?? 0) +
              (comment_counts.inquiry_no_automation ?? 0) +
              (comment_counts.inquiry_dm ?? 0) +
              (comment_counts.potential_buyers ?? 0) +
              (comment_counts.potential_buyers_no_automation ?? 0) +
              (comment_counts.tagged_comment ?? 0) +
              (comment_counts.tagged_comment_dm ?? 0) +
              (comment_counts.others ?? 0)
              // (comment_counts.other_comments ?? 0),
          };
  
          return combinedStats;
        })
      );
  
      // Sort result by timestamp descending (newest first)
      const sortedResult = result.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  
      return sortedResult;
      
    } catch (error) {
      console.error(`Failed to get media comment counts for account ${accountId}:`, error);
      throw error;
    }
  }

  //////////////////////////////////////////////  Ads //////////////////////////////////////////////////////////

  async getAdsAnalytics(accountId: string) {
    try {
      const adsAutomatedPostsResult = await this.instagramAccountLevelAnalyticsRepositoryService.getAccountLevelAnalytics(accountId + "_ad_automated_posts");
      const adsAutomatedPosts = adsAutomatedPostsResult?.Item || {};
      const adsAnalyticsResult = await this.instagramAccountLevelAnalyticsRepositoryService.getAccountLevelAnalytics(accountId + "_ads");
      const adsAnalytics = adsAnalyticsResult?.Item || {};

      // adsAutomatedPosts = adsAutomatedPosts?.Item || {};
      // adsAnalytics = adsAnalytics?.Item || {};

      const res = {
        inquiry: adsAnalytics.inquiry ?? 0,
        inquiry_dm: adsAnalytics.inquiry_dm ?? 0,
        inquiry_no_automation: adsAnalytics.inquiry_no_automation ?? 0,
        level: adsAnalytics.level ?? "account_ads",
        negative: adsAnalytics.negative ?? 0,
        negative_no_automation: adsAnalytics.negative_no_automation ?? 0,
        no_automation_comments: adsAnalytics.no_automation_comments ?? 0,
        other_comments: adsAnalytics.other_comments ?? 0,
        positive: adsAnalytics.positive ?? 0,
        positive_no_automation: adsAnalytics.positive_no_automation ?? 0,
        potential_buyers: adsAnalytics.potential_buyers ?? 0,
        potential_buyers_no_automation: adsAnalytics.potential_buyers_no_automation ?? 0,
        tagged: adsAnalytics.tagged ?? 0,
        tagged_comment: adsAnalytics.tagged_comment ?? 0,
        tagged_comment_dm: adsAnalytics.tagged_comment_dm ?? 0,
        total_comments: adsAnalytics.total_comments ?? 0,
        total_dms: adsAnalytics.total_dms ?? 0,
        media_automated_posts: adsAutomatedPosts.automated_post ?? 0,
        total_ads: adsAutomatedPosts.total_post ?? 0,
        total_positive: (adsAnalytics.positive ?? 0) + (adsAnalytics.positive_no_automation ?? 0),
        total_negative: (adsAnalytics.negative ?? 0) + (adsAnalytics.negative_no_automation ?? 0),
        total_potential_buyers: (adsAnalytics.potential_buyers ?? 0) + (adsAnalytics.potential_buyers_no_automation ?? 0),
        total_inquiry: (adsAnalytics.inquiry ?? 0) + (adsAnalytics.inquiry_dm ?? 0) + (adsAnalytics.inquiry_no_automation ?? 0),
        total_tagged: (adsAnalytics.tagged_comment ?? 0) + (adsAnalytics.tagged_comment_dm ?? 0),
        total_others: (adsAnalytics.other_comments ?? 0)
      };

      return res;
    } catch (error) {
      console.error(`Failed to get ad analytics for ${accountId}:`, error);
      throw new Error('Unable to retrieve ad analytics');
    }
  }

  async getAdAnalyticsById(accountId: string, adId: string) {
    try {
      const adAnalytics = await this.instagramAdAnalyticsRepositoryService.getAdAnalytics(adId);
      if (!adAnalytics || Object.keys(adAnalytics).length === 0) {
        throw new Error(`No analytics found for adId: ${adId}`);
      }

      console.log("DEBUG adAnalytics.Item:", JSON.stringify(adAnalytics.Item, null, 2));
  
      const item = adAnalytics.Item || {};
      const allComments: Array<{
        comment_timestamp: string;
        commenter_username: string;
        comment: string;
        response_comment: string;
        response_dm: string;
        reply_timestamp: string;
        category: string;
      }> = [];
  
      // iterate over keys that end with "_comments"
      for (const [key, comments] of Object.entries(item)) {
        if (!key.endsWith("_comments")) continue;
  
        const category = key.replace("_comments", ""); // e.g. "others" or "positive_no_automation"
  
        for (const c of comments as any[]) {
          allComments.push({
            comment_timestamp: c.comment_timestamp,
            commenter_username: c.commenter_username,
            comment: c.comment_text,
            response_comment: category.includes("dm") ? "" : c.comment_response,
            response_dm: category.includes("dm") ? c.comment_response : "",
            reply_timestamp: c.response_timestamp,
            category
          });
        }
      }
  
      return allComments;
    } catch (error) {
      console.error(`Failed to get ad analytics for ${adId}:`, error);
      throw new Error("Unable to retrieve ad analytics");
    }
  }
  

  async getAdCommentCounts(accountId: string) {
    try {
      // Fetch all ads for the account
      const adsListResponse = await this.instagramAdsService.getAdsByAccountId(accountId);
      const adsItems = adsListResponse?.Items || [];
      if (!Array.isArray(adsItems) || adsItems.length === 0) {
        // Handle empty ads list gracefully
        console.log(`No ads found for account ${accountId}`);
        return [];
      }
      // For each ad, fetch analytics and build stats using comment_counts and combined categories
      const result = await Promise.all(
        adsItems.map(async (ad) => {
          const adId = ad.id;
          const media_url = ad.media_url;
          const thumbnail_url = ad.thumbnail_url;
          const media_type = ad.media_type;
          const analytics = await this.instagramAdAnalyticsRepositoryService.getAdAnalytics(adId);
          const comment_counts = (analytics?.Item?.comment_counts ?? {}) as {
            positive?: number;
            positive_no_automation?: number;
            negative?: number;
            negative_no_automation?: number;
            inquiry?: number;
            inquiry_dm?: number;
            inquiry_no_automation?: number;
            potential_buyers?: number;
            potential_buyers_no_automation?: number;
            tagged_comment?: number;
            tagged_comment_dm?: number;
            others?: number;
            other_comments?: number;
            total_comments?: number;
          };
          // Combine stats for positive, negative, inquiry, potential_buyers, etc.
          const combinedStats = {
            adId,
            media_url,
            media_type,
            thumbnail_url,
            positive: (comment_counts.positive ?? 0) + (comment_counts.positive_no_automation ?? 0),
            negative: (comment_counts.negative ?? 0) + (comment_counts.negative_no_automation ?? 0),
            inquiry: (comment_counts.inquiry ?? 0) + (comment_counts.inquiry_no_automation ?? 0),
            potential_buyers: (comment_counts.potential_buyers ?? 0) + (comment_counts.potential_buyers_no_automation ?? 0),
            tagged_comment: (comment_counts.tagged_comment ?? 0) + (comment_counts.tagged_comment_dm ?? 0),
            others: (comment_counts.others ?? 0) + (comment_counts.other_comments ?? 0),
            no_automation_comments: (comment_counts.positive_no_automation ?? 0) + (comment_counts.negative_no_automation ?? 0) + (comment_counts.potential_buyers_no_automation ?? 0) + (comment_counts.inquiry_no_automation ?? 0),
            total_dms: (comment_counts.inquiry_dm ?? 0) + (comment_counts.tagged_comment_dm ?? 0),
            total_comments:
              (comment_counts.positive ?? 0) +
              (comment_counts.positive_no_automation ?? 0) +
              (comment_counts.negative ?? 0) +
              (comment_counts.negative_no_automation ?? 0) +
              (comment_counts.inquiry ?? 0) +
              (comment_counts.inquiry_no_automation ?? 0) +
              (comment_counts.inquiry_dm ?? 0) +
              (comment_counts.potential_buyers ?? 0) +
              (comment_counts.potential_buyers_no_automation ?? 0) +
              (comment_counts.tagged_comment ?? 0) +
              (comment_counts.tagged_comment_dm ?? 0) +
              (comment_counts.others ?? 0) +
              (comment_counts.other_comments ?? 0),
          };
          return combinedStats;
        })
      );
      return result;
    } catch (error) {
      console.error(`Failed to get ad comment counts for account ${accountId}:`, error);
      throw error;
    }
  }
  

  // quick replies
  async getQuickReplies(accountId: string) {
    try {
      const quickReplies = await this.instagramQuickReplyRepositoryService.getQuickReplyByAccountId(accountId);
      const items = quickReplies?.Items || [];
      const grouped: Record<string, any[]> = {};

      for (const item of items) {
        const category = item.category || 'uncategorized';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(item);
      }

      return grouped;
    } catch (error) {
      console.error(`Failed to get quick replies for account: ${accountId}`, error);
      throw error;
    }
  }

  async createQuickReply(accountId: string, quickReplies: Array<{ category: string; title: string; content: string }>) {
    try {
      if (!Array.isArray(quickReplies) || quickReplies.length === 0) {
        throw new Error('Input must be a non-empty array of quick replies');
      }

      // Prepare each quick reply item for DynamoDB
      const items = quickReplies.map(qr => ({
        id: uuidv4(), // use uuid for unique key
        accountId,
        category: qr.category,
        title: qr.title,
        content: qr.content,
        created_at: new Date().toISOString()
      }));

      // Insert each item as a row in DynamoDB
      await Promise.all(items.map(item =>
        this.instagramQuickReplyRepositoryService.addQuickReply(item)
      ));

      return { success: true, message: 'Quick replies created successfully'};
    } catch (error) {
      console.error('Failed to create quick replies:', error);
      throw error;
    }
  }

  async updateQuickReply(accountId: string, quickReplyId: string, updateData: { category?: string; title?: string; content?: string }) {
    try {
      if (!updateData || Object.keys(updateData).length === 0) {
        throw new Error('Update data must be a non-empty object');
      }
      const items = {
        id: quickReplyId,
        accountId,
        ...updateData,
        updated_at: new Date().toISOString()
      }
      const updatedQuickReply = await this.instagramQuickReplyRepositoryService.addQuickReply(items);
      return { success: true, message: 'Quick reply updated successfully', updatedQuickReply };
    } catch (error) {
      console.error(`Failed to update quick reply ${quickReplyId}:`, error);
      throw error;
    }
  }

  async deleteQuickReply(accountId: string, quickReplyId: string) {
    try {
      await this.instagramQuickReplyRepositoryService.deleteQuickReply(quickReplyId);
      return { success: true, message: 'Quick reply deleted successfully' };
    } catch (error) {
      console.error(`Failed to delete quick reply ${quickReplyId}:`, error);
      throw error;
    }
  }

  

  // async getAdAnalyticsById(accountId: string, adId: string) {
  //   try {
  //     const adAnalytics = await this.instagramAdAnalyticsRepositoryService.getAdAnalytics(adId);
  //     if (!adAnalytics || Object.keys(adAnalytics).length === 0) {
  //       throw new Error(`No analytics found for adId: ${adId}`);
  //     }

  //     const commentsByType = adAnalytics.comments_by_type || {};
  //     const allComments: Array<{
  //       comment_timestamp: number;
  //       commenter_username: string;
  //       comment: string;
  //       response_comment: string;
  //       response_dm: string;
  //       reply_timestamp: number;
  //       category: string;
  //     }> = [];

  //     for (const [category, comments] of Object.entries(commentsByType)) {
  //       for (const commentArr of comments as any[]) {
  //         const [
  //           comment_timestamp,
  //           commenter_username,
  //           comment,
  //           response,
  //           reply_timestamp
  //         ] = commentArr;

  //         allComments.push({
  //           comment_timestamp,
  //           commenter_username,
  //           comment,
  //           response_comment: category.includes('dm') ? '' : response,
  //           response_dm: category.includes('dm') ? response : '',
  //           reply_timestamp,
  //           category
  //         });
  //       }
  //     }

  //     return allComments;
  //   } catch (error) {
  //     console.error(`Failed to get ad analytics for ${adId}:`, error);
  //     throw new Error('Unable to retrieve ad analytics');
  //   }
  // }

}
