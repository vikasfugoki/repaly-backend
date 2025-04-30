import { Controller, Get, Query, Req, HttpException, HttpStatus } from '@nestjs/common';
import { AccountService } from './account.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
// import { GetAccountResponse } from '@lib/dto';
import { InstagramAccountRepositoryDTO, OmitInstagramAccountRepositoryDTO } from '../../lib/database/dto/instagram.account.repository.dto';
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
    // type: GetAccountResponse,
    type: [OmitInstagramAccountRepositoryDTO]
  })
  async getAccount(@Req() req): Promise<OmitInstagramAccountRepositoryDTO[]> {
    try {
      const platformId = req.user.user.sub; // googel user id
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
}
