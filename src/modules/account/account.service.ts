import { AccountByUserId, GetAccountResponse } from '@lib/dto';
import { Injectable } from '@nestjs/common';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';

import { InstagramAccountRepositoryDTO, OmitInstagramAccountRepositoryDTO } from '@database/dto/instagram.account.repository.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService
  ) {}

  private readonly account: GetAccountResponse;
  // private readonly accountDTO: InstagramAccountRepositoryDTO[];
  private readonly accountDTO: OmitInstagramAccountRepositoryDTO[]; // no access token in response

  // async getInstagramAccount(userId: string) {
  //   const instagramAccount =
  //     await this.instagramAccountRepositoryService.getAccountDetailsByUserId(
  //       userId,
  //     );
  //   if (instagramAccount.length > 0) {
  //     // return {
  //     //   platformName: 'instagram',
  //     //   platformAccount: instagramAccount,
  //     // } as AccountByUserId;
  //     return instagramAccount.map((account) => ({
  //       ...account,
  //       platformName: 'instagram',
  //     }));
  //   }
  // }

  async getInstagramAccount(userId: string) {
    const instagramAccount =
      await this.instagramAccountRepositoryService.getAccountDetailsByUserId(
        userId,
      );  
    if (instagramAccount.length > 0) {
      return instagramAccount.map(({ access_token, ...rest }) => ({
        ...rest,
        platformName: 'instagram',
      }));
    }
  
    return [];
  }

async getAccount(userId: string): Promise<OmitInstagramAccountRepositoryDTO[]> {
    // const accountResponse: GetAccountResponse = [];

    // const instagramAccount = await this.getInstagramAccount(userId);
    // if (instagramAccount) {
    //   return instagramAccount;
    // } else {
    //   return [];
    // } 
    return await this.getInstagramAccount(userId); 
  }
}
