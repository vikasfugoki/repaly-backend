import { AccountByUserId, GetAccountResponse } from '@lib/dto';
import { Injectable } from '@nestjs/common';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';

import { InstagramAccountRepositoryDTO } from '@database/dto/instagram.account.repository.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService
  ) {}

  private readonly account: GetAccountResponse;
  private readonly accountDTO: InstagramAccountRepositoryDTO[];

  async getInstagramAccount(userId: string) {
    const instagramAccount =
      await this.instagramAccountRepositoryService.getAccountDetailsByUserId(
        userId,
      );
    if (instagramAccount.length > 0) {
      // return {
      //   platformName: 'instagram',
      //   platformAccount: instagramAccount,
      // } as AccountByUserId;
      return instagramAccount.map((account) => ({
        ...account,
        platformName: 'instagram',
      }));
    }
  }

  async getAccount(userId: string): Promise<InstagramAccountRepositoryDTO[]> {
    const accountResponse: GetAccountResponse = [];

    const instagramAccount = await this.getInstagramAccount(userId);
    if (instagramAccount) {
      return instagramAccount;
    } else {
      return [];
    } 
  }
}
