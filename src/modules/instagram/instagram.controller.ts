import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags, ApiBody, ApiParam} from '@nestjs/swagger';
import { InstagramAccountService } from './instagram.service';


@ApiTags('Instagram Account')
@Controller('instagram')
export class InstagramAccountController {
  constructor(
    private readonly instagramAccountService: InstagramAccountService,
  ) {}

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
      

    @Get(':accountId/get-media')
    async getAccountMediaFromTable(@Param('accountId') accountId: string) {
      try {
        return await this.instagramAccountService.getInstagramMediaFromTable(accountId);
      } catch (error) {
        console.log('Failed to get media from dynamodb table:', (error as Error).message);
        throw new Error('Failed to get media from dynamodb table');
      }
    }

  @Put(':accountId/update-media')
  async updateAccountMedia(@Param('accountId') accountId: string) {
        try{
            return await this.instagramAccountService.updateAccountMediaOnTable(accountId);
            } catch (error) {
                console.log("Failed to update the media-table with recent media:", (error as Error).message);
                throw new Error('Failed to update the media-table with recent media.')
                }

        }

   @Get(':mediaId/tag-value')
   async getTagAndValueFromTable(@Param('mediaId') mediaId: string) {
       try {
            return await this.instagramAccountService.getTagAndValuePairFromTable(mediaId);
           }catch (error) {
                console.log("Failed to get the tag_and_value for given media:", (error as Error).message);
                throw new Error('Failed to get the tag_and_value for given media.')
                }
       }

   @Get(':mediaId/ai-enabled')
   async getAIEnabledFromTable(@Param('mediaId') mediaId: string) {
       try {
           return await this.instagramAccountService.getAIEnabledInfoFromTable(mediaId);
           }catch (error) {
                console.log("Failed to get the ai_enabled information for given media:", (error as Error).message);
                throw new Error('Failed to get the ai_enabled information for given media.')
                }
       }

  @Get(':mediaId/analytics-stats')
  async getMediaStats(@Param('mediaId') mediaId: string) {
    try {
      return await this.instagramAccountService.mediaStatsFromTable(mediaId);
    } catch (error) {
      console.log(`Failed to get the numerical stats (positive comments, leads, etc.) for ${mediaId}:`, (error as Error).message);
      throw new Error(`Failed to get the numerical stats (positive comments, leads, etc.) for ${mediaId}`)
    }
  }

  @Get(':mediaId/comments/:type')
  async getMediaComments(
    @Param('mediaId') mediaId: string,
    @Param('type') type: string,
  ) {
    try {
      // Call the new generic service method
      // type : {all_positive_comments, all_negative_comments, all_potential_buyers, all_leads, all_tagged}
      const comments = await this.instagramAccountService.getCommentsFromAnalyticsTable(mediaId, `all_${type}`);
      return comments;
    } catch (error) {
      console.log(`Failed to fetch ${type} comments for ${mediaId}:`, (error as Error).message);
      throw new Error(`Failed to fetch ${type} comments for ${mediaId}`);
    }
  }

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


}

