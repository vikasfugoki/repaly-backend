import { AccessRestrictionsResponseDTO, AccountByUserId, GetAccountResponse, LinkedUserDTO, LinkedUsersResponseDTO } from '@lib/dto';
import { INSTAGRAM_SECTIONS, getBlockedSections } from '../auth/instagram-section.decorator';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { InstagramAccountLinkingRepositoryService } from '@database/dynamodb/repository-services/instagram.account.linking.service';
import { FacebookAccountRepositoryService } from '@database/dynamodb/repository-services/facebook.account.service';
import { FacebookAccountLinkingRepositoryService } from '@database/dynamodb/repository-services/facebook.account.linking.service';
import { InstagramAccountRepositoryDTO, OmitInstagramAccountRepositoryDTO } from '@database/dto/instagram.account.repository.dto';
import { UserRepositoryService } from '@database/dynamodb/repository-services/user.service';
import { GoogleUserRepositoryService } from '@database/dynamodb/repository-services/google.user.service';
import { FacebookUserRepositoryService } from '@database/dynamodb/repository-services/facebook.user.service';
import { WhatsappAccountService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
    private readonly instagramAccountLinkingRepository: InstagramAccountLinkingRepositoryService,
    private readonly facebookAccountRepositoryService: FacebookAccountRepositoryService,
    private readonly facebookAccountLinkingRepository: FacebookAccountLinkingRepositoryService,
    private readonly userRepositoryService: UserRepositoryService,
    private readonly googleUserRepository: GoogleUserRepositoryService,
    private readonly facebookUserRepository: FacebookUserRepositoryService,
    private readonly whatsappAccountService: WhatsappAccountService,
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

  // Expose only this user's own access, never the account's full-access list.
  return unique.map(({ full_access_users, ...account }) => {
    const blocked_sections = getBlockedSections({ ...account, full_access_users }, userId);
    return {
      ...account,
      blocked_sections,
      access_level: blocked_sections.length ? ('limited' as const) : ('full' as const),
      platformName: 'instagram',
    };
  });
  }
  

  /**
   * WhatsApp accounts owned by this user, in the same envelope as the Instagram
   * entries (`platformName` discriminates them). WhatsApp is a standalone
   * account here — it is not attached to any Instagram account.
   */
  async getWhatsappAccount(userId: string): Promise<Record<string, any>[]> {
    try {
      return await this.whatsappAccountService.getAccountsByInfluexUserId(userId);
    } catch (error) {
      // A WhatsApp lookup failure must not take down the whole account list.
      console.error(`Failed to fetch WhatsApp accounts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * The unified connected-account list. Every entry carries `platformName`;
   * the frontend switches on it to decide how to render the row.
   */
  async getAccount(userId: string): Promise<Record<string, any>[]> {
    const [instagram, whatsapp] = await Promise.all([
      this.getInstagramAccount(userId),
      this.getWhatsappAccount(userId),
    ]);

    return [...instagram, ...whatsapp];
  }

  /**
   * Given an account id, returns the admin email (the owning user) and the
   * emails of all linked secondary users. Auto-detects whether the id is an
   * Instagram account or a Facebook Page so callers don't need to specify
   * the platform.
   */
  async getLinkedUsersForAnyAccount(accountId: string): Promise<LinkedUsersResponseDTO> {
    const instagramAccount = await this.instagramAccountRepositoryService.getAccount(accountId);
    if (instagramAccount) {
      return this.getLinkedUsersForAccount(accountId);
    }

    const facebookAccount = await this.facebookAccountRepositoryService.getAccount(accountId);
    if (facebookAccount) {
      return this.getLinkedUsersForFacebookAccount(accountId);
    }

    throw new NotFoundException(`Account ${accountId} not found`);
  }

  /**
   * Given an Instagram account ID, returns the admin email (the user who owns
   * the account in instagram_account_repository) and the emails of all linked
   * secondary users (from instagram_account_user_mapping).
   */
  async getLinkedUsersForAccount(instagramAccountId: string): Promise<LinkedUsersResponseDTO> {
    const account = await this.instagramAccountRepositoryService.getAccount(instagramAccountId);
    if (!account) {
      throw new NotFoundException(`Instagram account ${instagramAccountId} not found`);
    }

    const adminUserId = account.user_id;
    const linkedUserIds = await this.instagramAccountLinkingRepository.getUserIdsForAccount(instagramAccountId);

    const [admin, ...resolvedUsers] = await Promise.all([
      this.resolveEmailByInfluexUserId(adminUserId),
      ...linkedUserIds
        .filter((uid) => uid !== adminUserId)
        .map((uid) => this.resolveEmailByInfluexUserId(uid)),
    ]);

    return {
      admin,
      users: resolvedUsers.filter(Boolean) as LinkedUserDTO[],
    };
  }

  /**
   * Facebook equivalent of getLinkedUsersForAccount — given a Facebook Page
   * id, returns the admin email (the user who owns the Page in
   * facebook_account_repository) and the emails of all linked secondary
   * users (from facebook_account_user_mapping).
   */
  async getLinkedUsersForFacebookAccount(facebookAccountId: string): Promise<LinkedUsersResponseDTO> {
    const account = await this.facebookAccountRepositoryService.getAccount(facebookAccountId);
    if (!account) {
      throw new NotFoundException(`Facebook page ${facebookAccountId} not found`);
    }

    const adminUserId = account.user_id;
    const linkedUserIds = await this.facebookAccountLinkingRepository.getUserIdsForAccount(facebookAccountId);

    const [admin, ...resolvedUsers] = await Promise.all([
      this.resolveEmailByInfluexUserId(adminUserId),
      ...linkedUserIds
        .filter((uid) => uid !== adminUserId)
        .map((uid) => this.resolveEmailByInfluexUserId(uid)),
    ]);

    return {
      admin,
      users: resolvedUsers.filter(Boolean) as LinkedUserDTO[],
    };
  }

  /**
   * Admin-only: lists every linked user of an Instagram account with their access
   * level. The account can be given by id or username.
   */
  async getAccessRestrictions(
    callerUserId: string,
    ref: { accountId?: string; instagramUsername?: string },
  ): Promise<AccessRestrictionsResponseDTO> {
    const account = await this.resolveInstagramAccountAsAdmin(callerUserId, ref);
    const { admin, users } = await this.getLinkedUsersForAccount(account.id);

    return {
      account_id: account.id,
      username: account.username,
      restricted: !!account.full_access_users,
      limited_sections: [...INSTAGRAM_SECTIONS],
      admin,
      users: users.map((user) => {
        const entry = account.full_access_users?.[user.user_id];
        return {
          ...user,
          access_level: getBlockedSections(account, user.user_id).length ? 'limited' : 'full',
          added_by: entry?.added_by ?? null,
          added_time: entry?.added_time ?? null,
        };
      }),
    };
  }

  /**
   * Admin-only: replaces the account's full-access list with these linked users
   * (by email) and turns restrictions on. Everyone else except the admin is limited.
   */
  async setFullAccessUsers(
    callerUserId: string,
    ref: { accountId?: string; instagramUsername?: string },
    fullAccessEmails: string[],
  ): Promise<AccessRestrictionsResponseDTO> {
    if (!Array.isArray(fullAccessEmails)) {
      throw new BadRequestException('fullAccessEmails must be an array (empty = only the admin has full access)');
    }

    const account = await this.resolveInstagramAccountAsAdmin(callerUserId, ref);
    const { admin, users } = await this.getLinkedUsersForAccount(account.id);

    // The admin always has full access, so they don't need to be on the list.
    const adminEmail = admin?.email.toLowerCase();
    const normalizedEmails = [
      ...new Set(fullAccessEmails.map((email) => email.trim().toLowerCase())),
    ].filter((email) => email !== adminEmail);
    const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
    const unknownEmails = normalizedEmails.filter((email) => !usersByEmail.has(email));
    if (unknownEmails.length > 0) {
      throw new BadRequestException(
        `Not linked to @${account.username}: ${unknownEmails.join(', ')}`,
      );
    }

    // Keep who/when for users already on the list; stamp newly added ones.
    const now = new Date().toISOString();
    const fullAccessUsers: Record<string, { added_by: string; added_time: string }> = {};
    for (const email of normalizedEmails) {
      const userId = usersByEmail.get(email)!.user_id;
      fullAccessUsers[userId] = account.full_access_users?.[userId] ?? {
        added_by: admin?.email ?? callerUserId,
        added_time: now,
      };
    }
    await this.instagramAccountRepositoryService.setFullAccessUsers(account.id, fullAccessUsers);

    return this.getAccessRestrictions(callerUserId, { accountId: account.id });
  }

  /** Admin-only: turns restrictions off for the account (every linked user gets full access). */
  async clearFullAccessUsers(
    callerUserId: string,
    ref: { accountId?: string; instagramUsername?: string },
  ): Promise<AccessRestrictionsResponseDTO> {
    const account = await this.resolveInstagramAccountAsAdmin(callerUserId, ref);
    await this.instagramAccountRepositoryService.setFullAccessUsers(account.id, null);
    return this.getAccessRestrictions(callerUserId, { accountId: account.id });
  }

  private async resolveInstagramAccountAsAdmin(
    callerUserId: string,
    ref: { accountId?: string; instagramUsername?: string },
  ): Promise<InstagramAccountRepositoryDTO> {
    const username = ref.instagramUsername?.trim().replace(/^@/, '').toLowerCase();
    if (!ref.accountId && !username) {
      throw new BadRequestException('accountId or instagramUsername is required');
    }

    const account = ref.accountId
      ? await this.instagramAccountRepositoryService.getAccount(ref.accountId)
      : await this.instagramAccountRepositoryService.getAccountByUsername(username!);
    if (!account) {
      throw new NotFoundException(`Instagram account ${ref.accountId ?? '@' + username} not found`);
    }
    if (account.user_id !== callerUserId) {
      throw new ForbiddenException('Only the account admin can manage access');
    }
    return account;
  }

  private async resolveEmailByInfluexUserId(userId: string): Promise<LinkedUserDTO | null> {
    const userRecord = await this.userRepositoryService.getUser(userId);
    if (!userRecord.Item) return null;

    const platformId = userRecord.Item.platform_id as string;
    const platformName = userRecord.Item.platform_name as string;

    if (platformName === 'google') {
      const googleUser = await this.googleUserRepository.getGoogleUser(platformId);
      return {
        user_id: userId,
        email: (googleUser.Item?.email as string) ?? '',
        name: (googleUser.Item?.name as string) ?? '',
      };
    } else if (platformName === 'facebook') {
      const facebookUser = await this.facebookUserRepository.getFacebookUser(platformId);
      return {
        user_id: userId,
        email: (facebookUser.Item?.email as string) ?? '',
        name: (facebookUser.Item?.name as string) ?? '',
      };
    }

    return null;
  }
}
