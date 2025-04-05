import { Controller, Get, Query } from '@nestjs/common';
import { AccountService } from './account.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
// import { GetAccountResponse } from '@lib/dto';
import { InstagramAccountRepositoryDTO } from '../../lib/database/dto/instagram.account.repository.dto';

@ApiTags('Account')
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOkResponse({
    description: 'Returns a list of user accounts for different platforms.',
    // type: GetAccountResponse,
    type: [InstagramAccountRepositoryDTO]
  })
  async getAccount(
    @Query('userId') userId: string,
  ): Promise<InstagramAccountRepositoryDTO[]> {
    try {
      const response = await this.accountService.getAccount(userId);
      return response;
    } catch (error) {
      console.error('Error fetching media:', error);
      throw new Error('Failed to fetch accounts.');
    }
  }
}
