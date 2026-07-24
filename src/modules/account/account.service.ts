import { AccountByUserId, GetAccountResponse } from '@lib/dto';
import { Injectable } from '@nestjs/common';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { InstagramAccountLinkingRepositoryService } from '@database/dynamodb/repository-services/instagram.account.linking.service';
import { InstagramAccountRepositoryDTO, OmitInstagramAccountRepositoryDTO } from '@database/dto/instagram.account.repository.dto';

@Injectable()
export class AccountService {
  constructor(
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
    private readonly instagramAccountLinkingRepository: InstagramAccountLinkingRepositoryService,
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

  // async getInstagramAccount(userId: string) {
  //   const instagramAccount =
  //     await this.instagramAccountRepositoryService.getAccountDetailsByUserId(
  //       userId,
  //     );  
  //   if (instagramAccount.length > 0) {
  //     return instagramAccount.map(({ access_token, ...rest }) => ({
  //       ...rest,
  //       platformName: 'instagram',
  //     }));
  //   }
  
  //   return [];
  // }


async getInstagramAccount(userId: string): Promise<OmitInstagramAccountRepositoryDTO[]> {
  // Accounts where this user is the primary owner
  const directAccounts =
    await this.instagramAccountRepositoryService.getAccountDetailsByUserId(userId);

  // Accounts this user was linked to via a secondary connection
  const linkedIds = await this.instagramAccountLinkingRepository.getLinkedAccountIds(userId);
  const linkedAccounts = await Promise.all(
    linkedIds.map((id) => this.instagramAccountRepositoryService.getAccount(id)),
  );

  const allAccounts = [
    ...directAccounts,
    ...linkedAccounts.filter(Boolean) as InstagramAccountRepositoryDTO[],
  ];

  // Deduplicate by account id (in case user somehow appears in both lists)
  const seen = new Set<string>();
  const unique = allAccounts.filter((account) => {
    if (seen.has(account.id)) return false;
    seen.add(account.id);
    return true;
  });

  return unique.map((account) => ({
    ...account,
    platformName: 'instagram',
  }));
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
