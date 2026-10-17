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
  blocked_sections: string[];
  updated_by: string | null;
  updated_time: string | null;
}

export class AccessRestrictionsResponseDTO {
  account_id: string;
  username: string;
  available_sections: string[];
  users: AccessRestrictedUserDTO[];
}

export class SetAccessRestrictionsRequestDTO {
  accountId?: string;
  instagramUsername?: string;
  emails: string[];
  blockedSections: string[];
}
