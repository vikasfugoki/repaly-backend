import { Body, Controller, Get, Put, Query, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AccountService } from './account.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InstagramAccountRepositoryDTO, OmitInstagramAccountRepositoryDTO } from '../../lib/database/dto/instagram.account.repository.dto';
import { AccessRestrictionsResponseDTO, LinkedUsersResponseDTO, SetAccessRestrictionsRequestDTO } from '@lib/dto';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';

@ApiTags('Account')
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService,
    private readonly userDetailsService: UserRepositoryService
  ) {}

  @Get()
  @ApiOkResponse({
    description:
      'Returns every connected account for the user across platforms (Instagram + WhatsApp). ' +
      'Entries are discriminated by `platformName`.',
    type: [OmitInstagramAccountRepositoryDTO]
  })
  async getAccount(@Req() req): Promise<Record<string, any>[]> {
    try {
      const platformId = req.user.id;
      const userItem = await this.userDetailsService.getUserByPlatformId(platformId);
            if (!userItem) {
                  throw new HttpException('User is not allowed to make this request', HttpStatus.FORBIDDEN);
                }

      const influexId = userItem.id ?? "";
      console.log(`influex id: ${influexId}`);
      const response = await this.accountService.getAccount(influexId);
      return response;
    } catch (error) {
      console.error('Error fetching media:', error);
      throw new Error('Failed to fetch accounts.');
    }
  }

  @Get('linked-users')
  @ApiOkResponse({
    description: 'Returns the admin and linked user emails for a given Instagram account or Facebook Page.',
    type: LinkedUsersResponseDTO,
  })
  async getLinkedUsers(@Query('accountId') accountId: string): Promise<LinkedUsersResponseDTO> {
    if (!accountId) {
      throw new HttpException('accountId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    return this.accountService.getLinkedUsersForAnyAccount(accountId);
  }

  @Get('access-restrictions')
  @ApiOkResponse({
    description:
      'Admin only. Lists linked users of an Instagram account (by accountId or instagramUsername) ' +
      'with the dashboard sections blocked for each.',
    type: AccessRestrictionsResponseDTO,
  })
  async getAccessRestrictions(
    @Req() req,
    @Query('accountId') accountId?: string,
    @Query('instagramUsername') instagramUsername?: string,
  ): Promise<AccessRestrictionsResponseDTO> {
    const callerUserId = await this.getInfluexUserId(req);
    return this.accountService.getAccessRestrictions(callerUserId, { accountId, instagramUsername });
  }

  @Put('access-restrictions')
  @ApiOkResponse({
    description:
      'Admin only. Sets the blocked sections (media, stories, dm_automation, ads) for the given ' +
      'linked users of an Instagram account. An empty blockedSections unblocks them.',
    type: AccessRestrictionsResponseDTO,
  })
  async setAccessRestrictions(
    @Req() req,
    @Body() body: SetAccessRestrictionsRequestDTO,
  ): Promise<AccessRestrictionsResponseDTO> {
    const callerUserId = await this.getInfluexUserId(req);
    return this.accountService.setAccessRestrictions(
      callerUserId,
      { accountId: body?.accountId, instagramUsername: body?.instagramUsername },
      body?.emails,
      body?.blockedSections,
    );
  }

  private async getInfluexUserId(req): Promise<string> {
    const userItem = await this.userDetailsService.getUserByPlatformId(req.user.id);
    if (!userItem?.id) {
      throw new HttpException('User is not allowed to make this request', HttpStatus.FORBIDDEN);
    }
    return userItem.id;
  }

  @Get('facebook/linked-users')
  @ApiOkResponse({
    description: 'Returns the admin and linked user emails for a given Facebook Page.',
    type: LinkedUsersResponseDTO,
  })
  async getFacebookLinkedUsers(@Query('accountId') accountId: string): Promise<LinkedUsersResponseDTO> {
    if (!accountId) {
      throw new HttpException('accountId query parameter is required', HttpStatus.BAD_REQUEST);
    }
    return this.accountService.getLinkedUsersForFacebookAccount(accountId);
  }
}
