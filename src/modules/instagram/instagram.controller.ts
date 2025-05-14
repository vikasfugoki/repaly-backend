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

}

