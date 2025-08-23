import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBody, ApiParam} from '@nestjs/swagger';
import { InstagramAccountService } from './instagram.service';
import { InstagramOwnershipGuard } from '../auth/instagram-ownership.guard';
import { InstagramResourceType } from '../auth/instagram-resource-type.decorator';


@ApiTags('Instagram Account')
@Controller('instagram')
@UseGuards(InstagramOwnershipGuard)
export class InstagramAccountController {
  constructor(
    private readonly instagramAccountService: InstagramAccountService,
  ) {}

  @InstagramResourceType('account')
  @Post(':accountId/media')
  async getAccountMedia(@Param('accountId') accountId: string) {
    try {
      return await this.instagramAccountService.getInstagramMedia(accountId);
    } catch (error) {
      console.log('Failed to get Media', (error as Error).message);
      throw new Error('Failed to get Media');
    }
  }

  // @Get(':mediaId/analytics')
  // async getAccountMediaAnalytics(@Param('mediaId') mediaId: string) {
  //   try {
  //     return await this.instagramAccountService.getInstagramMediaAnalytics(
  //       mediaId,
  //     );
  //   } catch (error) {
  //     console.log('Failed to get Media', (error as Error).message);
  //     throw new Error('Failed to get Media');
  //   }
  // }

  // @Put(':mediaId/tag-and-value-pair')
  // async addTagAndValuePair(
  //   @Param('mediaId') mediaId: string,
  //   @Body() input: JSON,
  // ) {
  //   try {
  //     return await this.instagramAccountService.addTagAndValue(mediaId, input);
  //   } catch (error) {
  //     console.log('Failed to get Media', (error as Error).message);
  //     throw new Error('Failed to get Media');
  //   }
  // }

  // @Get(':mediaId/tag-and-value-pair')
  // async getTagAndValuePair(@Param('mediaId') mediaId: string) {
  //   try {
  //     return await this.instagramAccountService.getInstagramMediaTagAndValuePair(
  //       mediaId,
  //     );
  //   } catch (error) {
  //     console.log('Failed to get Media', (error as Error).message);
  //     throw new Error('Failed to get Media');
  //   }
  // }

  @InstagramResourceType('account')
  @Get(':accountId/recent-media')
  async getAccountRecentMedia(@Param('accountId') accountId: string){
      try {
          return await this.instagramAccountService.getInstagramRecentMedia(
              accountId,
              );
          } catch (error) {
              console.log('Failed to get recent media:', (error as Error).message);
              throw new Error('Failed to get recent media');
              }
      }

      @InstagramResourceType('media')
      @Put(':mediaId/apply-automation')
      async putAutomation(
        @Param('mediaId') mediaId: string,
        @Body() input: Record<string, any>
      ) {
        try {
          // // Convert input to JSON string
          // const jsonInput = JSON.stringify(input);
          
          // Pass the JSON string to the service method
          return await this.instagramAccountService.addInstagramMediaAutomation(mediaId, input);
        } catch (error) {
          console.log('Failed to apply automation:', (error as Error).message);
          throw new Error('Failed to apply automation');
        }
      }
      
    @InstagramResourceType('account')
    @Get(':accountId/get-media')
    async getAccountMediaFromTable(@Param('accountId') accountId: string) {
      try {
        return await this.instagramAccountService.getInstagramMediaFromTable(accountId);
      } catch (error) {
        console.log('Failed to get media from dynamodb table:', (error as Error).message);
        throw new Error('Failed to get media from dynamodb table');
      }
    }
  
  @InstagramResourceType('account')
  @Put(':accountId/update-media')
  async updateAccountMedia(@Param('accountId') accountId: string) {
        try{
            return await this.instagramAccountService.updateAccountMediaOnTable(accountId);
            } catch (error) {
                console.log("Failed to update the media-table with recent media:", (error as Error).message);
                throw new Error('Failed to update the media-table with recent media.')
                }

        }

   @InstagramResourceType('media')
   @Get(':mediaId/tag-value')
   async getTagAndValueFromTable(@Param('mediaId') mediaId: string) {
       try {
            return await this.instagramAccountService.getTagAndValuePairFromTable(mediaId);
           }catch (error) {
                console.log("Failed to get the tag_and_value for given media:", (error as Error).message);
                throw new Error('Failed to get the tag_and_value for given media.')
                }
       }
    
    @InstagramResourceType('media')
    @Put(':mediaId/response-type')
    async updateMediaResponseType(@Param('mediaId') mediaId: string, @Body() input: Record<string, any>) {
      try {
              return await this.instagramAccountService.updateMediaResponseTypeOnTable(mediaId, input);
      } catch (error) {
              console.log("Failed to update the table with media response type:", (error as Error).message);
              throw new Error('Failed to update the table with media response type.')
      }
    }

    @InstagramResourceType('media')
    @Get(':mediaId/media-details')
    async getMediaResponseType(@Param('mediaId') mediaId:  string) {
      try {
            return await this.instagramAccountService.getMediaResponseTypeFromTable(mediaId);
      } catch (error) {
            console.log("Failed to get the media details:", (error as Error).message);
            throw new Error('Failed to get ther media details.')
      }
    }

   @InstagramResourceType('media')
   @Get(':mediaId/ai-enabled')
   async getAIEnabledFromTable(@Param('mediaId') mediaId: string) {
       try {
           return await this.instagramAccountService.getAIEnabledInfoFromTable(mediaId);
           }catch (error) {
                console.log("Failed to get the ai_enabled information for given media:", (error as Error).message);
                throw new Error('Failed to get the ai_enabled information for given media.')
                }
       }


  // get the overall stats related to media
  @InstagramResourceType('media')
  @Get(':mediaId/analytics-stats')
  async getMediaStats(@Param('mediaId') mediaId: string) {
    try {
      return await this.instagramAccountService.mediaStatsFromTable(mediaId);
    } catch (error) {
      console.log(`Failed to get the numerical stats (positive comments, leads, etc.) for ${mediaId}:`, (error as Error).message);
      throw new Error(`Failed to get the numerical stats (positive comments, leads, etc.) for ${mediaId}`)
    }
  }

  @InstagramResourceType('media')
  @Get(':mediaId/comments/:type')
  async getMediaComments(
    @Param('mediaId') mediaId: string,
    @Param('type') type: string,
  ) {
    try {
      // Call the new generic service method
      // type : {inquiry, positive, negative, potential_buyers, tagged_comment, tagged_comment_dm}
      const comments = await this.instagramAccountService.getCommentsFromAnalyticsTable(mediaId, `${type}`);
      return comments;
    } catch (error) {
      console.log(`Failed to fetch ${type} comments for ${mediaId}:`, (error as Error).message);
      throw new Error(`Failed to fetch ${type} comments for ${mediaId}`);
    }
  }

  @InstagramResourceType('media')
  @Get(':mediaId/comment-timeseries')
  async getCommentTimeSeries(
    @Param('mediaId') mediaId: string,
  ) {
    try {
      const result = await this.instagramAccountService.getCommentTimeSeriesByIntervals(mediaId);
      return result;
    } catch (error) {
      console.error(`Error fetching time series for  comments on media ${mediaId}:`, error);
      throw new Error(`Error fetching time series for  comments on media`);
    }
  }

  @InstagramResourceType('account')
  @Delete(':accountId/delete-account')
  async deleteAccount(@Param('accountId') accountId: string) {
    try {
      // delete the instagram account attached to the user
      return await this.instagramAccountService.deleteInstagramAccount(accountId);
    } catch (error) {
      console.log(`Failed to delete the account ${accountId}:`, (error as Error).message);
      throw new Error(`Failed to delete the account ${accountId}`);
    }
  }

  //  STORY Api
  @InstagramResourceType('account')
  @Put(':accountId/update-story')
  async updateAccountStory(@Param('accountId') accountId: string) {
    try{
        return await this.instagramAccountService.updateAccountStoryOnTable(accountId);
        } catch (error) {
            console.log("Failed to update the story-table with recent media:", (error as Error).message);
            throw new Error('Failed to update the story-table with recent media.')
            }

    }

    // get all the story given the accountId
    @InstagramResourceType('account')
    @Get(':accountId/get-story')
    async getAccountStory(@Param('accountId') accountId: string) {

      try {
        return await this.instagramAccountService.getInstagramStoryFromTable(accountId);
      } catch (error) {
        console.log('Failed to get STORY from dynamodb table:', (error as Error).message);
        throw new Error('Failed to get STORY from dynamodb table');
      }  
    }

    @InstagramResourceType('story')
    @Get(':storyId/story-details')
    async getStoryDetails(@Param('storyId') mediaId:  string) {
      try {
            return await this.instagramAccountService.getStoryDetailsFromTable(mediaId);
      } catch (error) {
            console.log("Failed to get the STORY details:", (error as Error).message);
            throw new Error('Failed to get ther STORY details.')
      }
    }

    @InstagramResourceType('story')
    @Put(':storyId/apply-automation-story')
      async putStoryAutomation(
        @Param('storyId') storyId: string,
        @Body() input: Record<string, any>
      ) {
        try {
          // // Convert input to JSON string
          // const jsonInput = JSON.stringify(input);
          
          // Pass the JSON string to the service method
          return await this.instagramAccountService.addInstagramStoryAutomation(storyId, input);
        } catch (error) {
          console.log('Failed to apply automation:', (error as Error).message);
          throw new Error('Failed to apply automation');
        }
      }
      
      @InstagramResourceType('story')
      @Get(':storyId/story-analytics')
      async getStoryAnalytics(@Param('storyId') storyId: string) {
        try {
          return await this.instagramAccountService.getStoryStatsFromTable(storyId);
        } catch (error) {
          console.log('Failed to get story analytics :', (error as Error).message);
          throw new Error('Failed to get story analytics');
        }
      }

      // dm categarization
      @InstagramResourceType('account')
      @Get(':accountId/dm-categorization')
      async getDMCategorization(@Param('accountId') accountId: string) {
        try {
              return await this.instagramAccountService.getDMCategorization(accountId);
        }
        catch (error) {
          console.log('Failed to get DM categorization :', (error as Error).message);
          throw new Error('Failed to get DM categorization');
        }
      }

      // conversation
      @InstagramResourceType('conversation')
      @Get(':conversationId/get-conversation')
      async getDMConversation(@Param('conversationId') conversationId: string) {
        try {
          return await this.instagramAccountService.getDMConversation(conversationId);
        }
        catch (error) {
          console.log('Failed to get DM conversation :', (error as Error).message);
          throw new Error('Failed to get DM conversation');
        }
      }

      // update conversation category
      @InstagramResourceType('conversation')
      @Put(':conversationId/dm-category')
      async updateDMCategory(@Param('conversationId') conversationId: string, @Body() input: Record<string, any>) {
        try {
          return await this.instagramAccountService.updateDMCategory(conversationId, input);
        } catch (error) {
          console.log('Failed to PUT DM category :', (error as Error).message);
          throw new Error('Failed to PUT DM category');
        }
      }


      // summary
      @InstagramResourceType('media')
      @Get(':mediaId/summaries')
      async getSummaries(@Param('mediaId') mediaId: string) {
        try {
          return await this.instagramAccountService.getSummaries(mediaId)
        } catch (error) {
          console.log('Failed to fetch summaries :', (error as Error).message);
          throw new Error('Failed to fetch summaries');
        }
      }

      // Ads api
      @InstagramResourceType('account')
      @Get(':accountId/get-ads')
      async getAds(@Param('accountId') accountId: string) {
        try {
            return await this.instagramAccountService.getAdsFromTable(accountId);
        } catch (error) {
          console.log("Failed to get the ads from the account: ", accountId);
          throw new Error('Failed to get the ads for the account from the instagram_ads_repository table');
        }
      }


      // Ads api
      @InstagramResourceType('account')
      @Post(':accountId/update-ads')
      async updateAdsStory(@Param('accountId') accountId: string, @Body() input: Record<string, any>) {

        return this.instagramAccountService.updateAdsOnTable(accountId, input);
        // try{
        //     return await this.instagramAccountService.updateAdsOnTable(accountId, input);
        //     } catch (error) {
        //         console.log("Failed to update the ads-table with recent media:", (error as Error).message);
        //         throw new Error('Failed to update the ads-table with recent media.')
        //     }

        }

      @InstagramResourceType('account')
      @Get(':accountId/is_facebook_linked')
      async isFacebookLinked(@Param('accountId') accountId: string) {

          try {
            return await this.instagramAccountService.isFacebookLinked(accountId);
          } catch (error) {
            console.log("Failed to fetch the wether the Facebook account being added or not!");
            throw new Error('Failed to fetch the wether the Facebook account being added or not!')
          }
      }

      @InstagramResourceType('ad')
      @Get(':adId/get-ad')
      async getAdDetails(@Param('adId') adId: string) {
        try {
          return await this.instagramAccountService.getAdDetails(adId);
        } catch (error) {
          console.log(`Failed to fetch the ad details given adID: ${adId}`);
          throw new Error('Failed to fetch the ad details given adID');
        }
      }

      @InstagramResourceType('ad')
      @Put(':adId/apply-automation-ad')
      async putAutomationAd(
        @Param('adId') mediaId: string,
        @Body() input: Record<string, any>
      ) {
        try {
          // Pass the JSON string to the service method
          return await this.instagramAccountService.addInstagramAdAutomation(mediaId, input);
        } catch (error) {
          console.log('Failed to apply automation:', (error as Error).message);
          throw new Error('Failed to apply automation');
        }
      }

      @InstagramResourceType('ad')
      @Get(':adId/ad-analytics')
      async getAdStats(@Param('adId') adId: string) {
        try {
          return await this.instagramAccountService.getAdStatsFromTable(adId);
        } catch (error) {
          console.log(`Failed to get the analytics stats for ${adId}:`, (error as Error).message);
          throw new Error(`Failed to get the analttics stats for ${adId}`)
        }
      }

      @InstagramResourceType('ad')
      @Get(':adId/ad-comments/:type')
      async getAdComments(@Param('adId') adId: string, @Param('type') type: "positive" | "negative" | "potential_buyers" | "inquiry") {
        try {
          const comments = await this.instagramAccountService.getCommentsFromAdAnalyticsTable(adId, `${type}`);
          return comments;

        } catch (error) {
          console.log(`Failed to fetch ${type} comments for ad ${adId}:`, (error as Error).message);
          throw new Error(`Failed to fetch ${type} comments for ${adId}`);
        }
      }


      // @InstagramResourceType('ad')
      // @Post(':accountId/insights')
      // async getAdsInsights(@Param)


      @InstagramResourceType('account')
      @Post(':accountId/dm-reply')
      async getDmComment(@Param('accountId') accountId: string, @Body() input: { type: 'text' | 'image' | 'video' | 'audio'; recipientId: string; content: string }) {
        try {
          return await this.instagramAccountService.dmReply(accountId, input);
        } catch (error) {
          console.log(`Failed to reply for ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to reply for  ${accountId}`);
        }
      }

      //////////////////////////////////////////////////////////////////////////////////////////////////////
      /////////////////////////////////// ACCOUNT LEVEL ANALYTICS //////////////////////////////////////////
      //////////////////////////////////////////////////////////////////////////////////////////////////////

      @InstagramResourceType('account')
      @Get(':accountId/account-level-analytics')
      async getAccountLevelAnalytics(@Param('accountId') accountId: string) {
        try {
          return await this.instagramAccountService.getAccountLevelAnalytics(accountId);
        } catch (error) {
          console.log(`Failed to get account level analytics for ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get account level analytics for ${accountId}`);
        }
      }

      //////////////////////////////////////////////////////////////////////////////////////////////////////
      /////////////////////////////////// DM LEVEL ANALYTICS ///////////////////////////////////////////////
      //////////////////////////////////////////////////////////////////////////////////////////////////////

      @InstagramResourceType('account')
      @Get(':accountId/dm/analytics-summary')
      async getDMSummaryAnalytics(@Param('accountId') accountId: string) {
        try {
          return await this.instagramAccountService.getDMSummaryAnalytics(accountId);
        } catch (error) {
          console.log(`Failed to get DM summary analytics for ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get DM summary analytics for ${accountId}`);
        }
      }

      @InstagramResourceType('account')
      @Get(':accountId/dm/conversations')
      async getDMConversations(@Param('accountId') accountId: string) {
        try {
          return await this.instagramAccountService.getDMConversations(accountId);
        } catch (error) {
          console.log(`Failed to get DM conversations for ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get DM conversations for ${accountId}`);
        }
      }

      @InstagramResourceType('account')
      @Get(':accountId/dm/conversations/:conversationId')
      async getDMConversationDetails(@Param('accountId') accountId: string, @Param('conversationId') conversationId: string) {
        try {
          return await this.instagramAccountService.getDMConversationDetails(accountId, conversationId);
        } catch (error) {
          console.log(`Failed to get DM conversation details for ${conversationId} in account ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get DM conversation details for ${conversationId} in account ${accountId}`);
        }
      }

      //////////////////////////////////////////////////////////////////////////////////////////////////////
      /////////////////////////////////// COMMENT LEVEL ANALYTICS ///////////////////////////////////////////////
      //////////////////////////////////////////////////////////////////////////////////////////////////////

      ///////////////////////////////////// MEDIA ///////////////////////////////////////////////////////////

      @InstagramResourceType('account')
      @Get(':accountId/media/analytics-summary')
      async getMediaAnalytics(@Param('accountId') accountId: string) {
        try {
          return await this.instagramAccountService.getMediaAnalytics(accountId);
        } catch (error) {
          console.log(`Failed to get media analytics for ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get media analytics for ${accountId}`);
        }
      }

      @InstagramResourceType('account')
      @Get(':accountId/media/:mediaId/all-comments')
      async getMediaAnalyticsById(@Param('accountId') accountId: string, @Param('mediaId') mediaId: string) {
        try {
          return await this.instagramAccountService.getMediaAnalyticsById(accountId, mediaId);
        } catch (error) {
          console.log(`Failed to get media analytics for ${mediaId} in account ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get media analytics for ${mediaId} in account ${accountId}`);
        }
      }

      @InstagramResourceType('account')
      @Get(':accountId/media/:mediaId/category/:category')
      async getMediaCommentsByCategory(
        @Param('accountId') accountId: string, 
        @Param('mediaId') mediaId: string,
        @Param('category') category: string
      ) {
        try {
          // Valid categories: positive, negative, potential_buyers, inquiry, others
          return await this.instagramAccountService.getMediaCommentsByCategory(accountId, mediaId, category);
        } catch (error) {
          console.log(`Failed to get """${category}""" comments for media ${mediaId} in account ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get ${category} comments for media ${mediaId} in account ${accountId}`);
        }
      }

      @InstagramResourceType('account')
      @Get(':accountId/media/comment-stats')
      async getMediaCommentCounts(@Param('accountId') accountId: string) {
        try {
          // This should call a service method that fetches all media for the account
          // and returns an array of objects with mediaId and comment_counts
          return await this.instagramAccountService.getMediaCommentCounts(accountId);
        } catch (error) {
          console.log(`Failed to get comment counts for media in account ${accountId}:`, (error as Error).message);
          throw new Error(`Failed to get comment counts for media in account ${accountId}`);
        }
      }
      

    ///////////////////////////////////// Ads ////////////////////////////////////////////////////////////

    @InstagramResourceType('account')
    @Get(':accountId/ads/analytics-summary')
    async getAdsAnalytics(@Param('accountId') accountId: string) {
      try {
        return await this.instagramAccountService.getAdsAnalytics(accountId);
      } catch (error) {
        console.log(`Failed to get ads analytics for ${accountId}:`, (error as Error).message);
        throw new Error(`Failed to get ads analytics for ${accountId}`);
      }
    }

    @InstagramResourceType('account')
    @Get(':accountId/ads/:adId/all-comments')
    async getAdsAnalyticsById(@Param('accountId') accountId: string, @Param('adId') adId: string) {
      try {
        return await this.instagramAccountService.getAdAnalyticsById(accountId, adId);
      } catch (error) {
        console.log(`Failed to get media analytics for ${adId} in account ${accountId}:`, (error as Error).message);
        throw new Error(`Failed to get media analytics for ${adId} in account ${accountId}`);
      }
    }

    @InstagramResourceType('account')
    @Get(':accountId/ads/comment-stats')
    async getAdCommentCounts(@Param('accountId') accountId: string) {
      try {
        // This should call a service method that fetches all ads for the account
        // and returns an array of objects with adId and comment_counts
        return await this.instagramAccountService.getAdCommentCounts(accountId);
      } catch (error) {
        console.log(`Failed to get comment counts for ads in account ${accountId}:`, (error as Error).message);
        throw new Error(`Failed to get comment counts for ads in account ${accountId}`);
      }
    }

}

