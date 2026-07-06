import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FacebookAccountService } from './facebook.service';
import { FacebookMediaPaginationService } from './facebook-media-pagination.service';
import { FacebookOwnershipGuard } from '../auth/facebook-ownership.guard';
import { FacebookResourceType } from '../auth/facebook-resource-type.decorator';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '@database/dto/pagination.dto';

/**
 * Facebook post automation settings — get/store.
 * Faithful mirror of the Instagram post-automation routes
 * (apply-automation / media-details / response-type / tag-value / ai-enabled /
 * post-account-automation) under the `/facebook` base path.
 */
@ApiTags('Facebook Account')
@Controller('facebook')
@UseGuards(FacebookOwnershipGuard)
export class FacebookController {
  constructor(
    private readonly facebookAccountService: FacebookAccountService,
    private readonly facebookMediaPaginationService: FacebookMediaPaginationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Page connection (onboarding) — user-scoped
  // ---------------------------------------------------------------------------

  @FacebookResourceType('user')
  @Post('pages/connect')
  async connectPages(
    @Req() req: any,
    @Body() input: Record<string, any>,
  ) {
    try {
      return await this.facebookAccountService.connectPages(
        req.user.id,
        req.user.loginSource,
        input.access_token,
      );
    } catch (error) {
      console.log('Failed to connect facebook pages:', (error as Error).message);
      throw new Error('Failed to connect facebook pages');
    }
  }

  @FacebookResourceType('user')
  @Get('pages')
  async getPages(@Req() req: any) {
    try {
      return await this.facebookAccountService.getConnectedPages(
        req.user.id,
        req.user.loginSource,
      );
    } catch (error) {
      console.log('Failed to list facebook pages:', (error as Error).message);
      throw new Error('Failed to list facebook pages');
    }
  }

  // ---------------------------------------------------------------------------
  // Post list + ingestion
  // ---------------------------------------------------------------------------

  @FacebookResourceType('account')
  @Put(':accountId/update-media')
  async updateAccountMedia(@Param('accountId') accountId: string) {
    try {
      return await this.facebookAccountService.updateAccountMediaOnTable(
        accountId,
      );
    } catch (error) {
      console.log(
        'Failed to update the media-table with recent media:',
        (error as Error).message,
      );
      throw new Error('Failed to update the media-table with recent media.');
    }
  }

  @FacebookResourceType('account')
  @Get(':accountId/get-media')
  async getAccountMediaPaginated(
    @Param('accountId') accountId: string,
    @Query() paginationDto: PaginationQueryDto,
  ): Promise<PaginatedResponse<any>> {
    return await this.facebookMediaPaginationService.getMediaWithPagination(
      accountId,
      paginationDto,
    );
  }

  @FacebookResourceType('account')
  @Post(':accountId/media')
  async getAccountMedia(@Param('accountId') accountId: string) {
    try {
      return await this.facebookAccountService.getFacebookMediaFromTable(
        accountId,
      );
    } catch (error) {
      console.log('Failed to get Media', (error as Error).message);
      throw new Error('Failed to get Media');
    }
  }

  @FacebookResourceType('account')
  @Delete(':accountId/disconnect')
  async disconnectPage(@Param('accountId') accountId: string) {
    try {
      return await this.facebookAccountService.disconnectPage(accountId);
    } catch (error) {
      console.log(
        `Failed to disconnect facebook page ${accountId}:`,
        (error as Error).message,
      );
      throw new Error(`Failed to disconnect facebook page ${accountId}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Per-post (media) automation
  // ---------------------------------------------------------------------------

  @FacebookResourceType('media')
  @Put(':mediaId/apply-automation')
  async putAutomation(
    @Param('mediaId') mediaId: string,
    @Body() input: Record<string, any>,
  ) {
    try {
      return await this.facebookAccountService.addFacebookMediaAutomation(
        mediaId,
        input,
      );
    } catch (error) {
      console.log('Failed to apply automation:', (error as Error).message);
      throw new Error('Failed to apply automation');
    }
  }

  @FacebookResourceType('media')
  @Put(':mediaId/response-type')
  async updateMediaResponseType(
    @Param('mediaId') mediaId: string,
    @Body() input: Record<string, any>,
  ) {
    try {
      return await this.facebookAccountService.updateMediaResponseTypeOnTable(
        mediaId,
        input,
      );
    } catch (error) {
      console.log(
        'Failed to update the table with media response type:',
        (error as Error).message,
      );
      throw new Error('Failed to update the table with media response type.');
    }
  }

  @FacebookResourceType('media')
  @Get(':mediaId/media-details')
  async getMediaResponseType(@Param('mediaId') mediaId: string) {
    try {
      return await this.facebookAccountService.getMediaResponseTypeFromTable(
        mediaId,
      );
    } catch (error) {
      console.log('Failed to get the media details:', (error as Error).message);
      throw new Error('Failed to get the media details.');
    }
  }

  @FacebookResourceType('media')
  @Get(':mediaId/tag-value')
  async getTagAndValueFromTable(@Param('mediaId') mediaId: string) {
    try {
      return await this.facebookAccountService.getTagAndValuePairFromTable(
        mediaId,
      );
    } catch (error) {
      console.log(
        'Failed to get the tag_and_value for given media:',
        (error as Error).message,
      );
      throw new Error('Failed to get the tag_and_value for given media.');
    }
  }

  @FacebookResourceType('media')
  @Get(':mediaId/ai-enabled')
  async getAIEnabledFromTable(@Param('mediaId') mediaId: string) {
    try {
      return await this.facebookAccountService.getAIEnabledInfoFromTable(
        mediaId,
      );
    } catch (error) {
      console.log(
        'Failed to get the ai_enabled information for given media:',
        (error as Error).message,
      );
      throw new Error(
        'Failed to get the ai_enabled information for given media.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Account-level (Facebook Page) automation defaults
  // ---------------------------------------------------------------------------

  @FacebookResourceType('account')
  @Put(':accountId/post-account-automation')
  async putPostAccountAutomation(
    @Param('accountId') accountId: string,
    @Body() input: Record<string, any>,
  ) {
    try {
      return await this.facebookAccountService.putAccountPostAutomation(
        accountId,
        input,
      );
    } catch (error) {
      console.log(
        `Failed PUT the facebook level post automation: ${accountId}:`,
        (error as Error).message,
      );
      throw new Error(
        `Failed PUT the facebook level post automation: ${accountId}`,
      );
    }
  }

  @FacebookResourceType('account')
  @Get(':accountId/post-account-automation')
  async getPostAccountAutomation(@Param('accountId') accountId: string) {
    try {
      return await this.facebookAccountService.getAccountPostAutomation(
        accountId,
      );
    } catch (error) {
      console.log(
        `Failed GET the facebook level post automation: ${accountId}:`,
        (error as Error).message,
      );
      throw new Error(
        `Failed GET the facebook level post automation: ${accountId}`,
      );
    }
  }
}
