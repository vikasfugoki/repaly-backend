import { AccountByUserId, GetAccountResponse, LinkedUserDTO, LinkedUsersResponseDTO } from '@lib/dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { InstagramAccountLinkingRepositoryService } from '@database/dynamodb/repository-services/instagram.account.linking.service';
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

  return unique.map((account) => ({
    ...account,
    platformName: 'instagram',
  }));
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
