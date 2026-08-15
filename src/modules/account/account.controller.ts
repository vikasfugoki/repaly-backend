import { Controller, Get, Query, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AccountService } from './account.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InstagramAccountRepositoryDTO, OmitInstagramAccountRepositoryDTO } from '../../lib/database/dto/instagram.account.repository.dto';
import { LinkedUsersResponseDTO } from '@lib/dto';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';

@ApiTags('Account')
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService,
    private readonly userDetailsService: UserRepositoryService
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'Returns a list of user accounts for different platforms.',
    type: [OmitInstagramAccountRepositoryDTO]
  })
  async getAccount(@Req() req): Promise<OmitInstagramAccountRepositoryDTO[]> {
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
