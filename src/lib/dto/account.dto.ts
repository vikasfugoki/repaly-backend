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
  admin: LinkedUserDTO | null;
  users: LinkedUserDTO[];
}

export class AccessRestrictedUserDTO extends LinkedUserDTO {
  access_level: 'full' | 'limited';
  added_by: string | null;
  added_time: string | null;
}

export class AccessRestrictionsResponseDTO {
  account_id: string;
  username: string;
  restricted: boolean; // false = every linked user has full access
  limited_sections: string[]; // sections hidden from limited users
  admin: LinkedUserDTO | null;
  users: AccessRestrictedUserDTO[];
}

export class SetFullAccessUsersRequestDTO {
  accountId?: string;
  instagramUsername?: string;
  fullAccessEmails: string[];
}
