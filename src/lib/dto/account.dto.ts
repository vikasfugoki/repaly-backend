import { InstagramAccountRepositoryDTO } from '@database/dto/instagram.account.repository.dto';

export class AccountByUserId {
  platformName: string;
  platformAccount: InstagramAccountRepositoryDTO[];
}

export class GetAccountResponse extends Array<AccountByUserId> {}

export class LinkedUserDTO {
  user_id: string;
  email: string;
  name: string;
}

export class LinkedUsersResponseDTO {
  admin: LinkedUserDTO;
  users: LinkedUserDTO[];
}
