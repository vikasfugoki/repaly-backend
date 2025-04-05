import { InstagramAccountRepositoryDTO } from '@database/dto/instagram.account.repository.dto';

export class AccountByUserId {
  platformName: string;
  platformAccount: InstagramAccountRepositoryDTO[];
}

export class GetAccountResponse extends Array<AccountByUserId> {}
