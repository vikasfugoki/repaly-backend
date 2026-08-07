import { Injectable, ConflictException, HttpException, HttpStatus, ConsoleLogger } from '@nestjs/common';
import { InstagramApiService } from '../utils/instagram/api.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { InstagramAccountLinkingRepositoryService } from '@database/dynamodb/repository-services/instagram.account.linking.service';
import { ExchangePlatformCodeRequest } from '@lib/dto';

@Injectable()
export class ExchangePlatformCodeService {
  constructor(
    private readonly api: InstagramApiService,
    private readonly instagramRepository: InstagramAccountRepositoryService,
    private readonly instagramAccountLinkingRepository: InstagramAccountLinkingRepositoryService,
  ) {}
  async exchangeInstagramCode(input: ExchangePlatformCodeRequest) {
    const { userId, platformName, code } = input;

    console.log(`here are we:`, userId, platformName, code);

    // if (platformName !== 'instagram') {
    //   throw new HttpException(
    //     `No services for platform: ${platformName}`,
    //     HttpStatus.BAD_REQUEST
    //   );
    // }

    if (platformName === 'instagram') {
      try {
        const { user_id, access_token } =
          await this.api.getShortLivedAccessToken(code);
        if (!access_token) throw new Error('Exchange Code Error');
        const response = await this.api.getLongLivedAccessToken(access_token);
        const longLivedToken = response?.access_token;
        const { user_id: pro_user_id, username, name, biography, profile_picture_url, media_count } =
          await this.api.getUserDetails(longLivedToken);
        const accountDetails = {
          id: user_id.toString(),
          pro_user_id: pro_user_id,
          access_token: longLivedToken,
          user_id: userId,
          username,
          name,
          biography,
          profile_picture_url,
          media_count,
        };

        

        const existingAccount = await this.instagramRepository.getAccount(accountDetails.id);

        if (existingAccount && existingAccount.id === accountDetails.id) {
          // Instagram account already exists — link this user to it instead of rejecting
          await this.instagramAccountLinkingRepository.addLink(userId, accountDetails.id);
          // Refresh the access token on the canonical record so it stays up to date
          await this.instagramRepository.updateAccountDetails({
            id: accountDetails.id,
            access_token: accountDetails.access_token,
          });
          await this.api.subscribeWebhookOfInstagram(accountDetails.id, accountDetails.access_token);
          console.log(`Linked user ${userId} to existing Instagram account ${accountDetails.id}`);
          return { msg: 'Successfully linked to existing Instagram account' };
        }

        console.log("account details from longlived token:", accountDetails);
        await this.instagramRepository.createAccount(accountDetails);
        // subscribe to webhook
        await this.api.subscribeWebhookOfInstagram(accountDetails.id, accountDetails.access_token);

        return { msg: 'Successfully Created Account and Webhook subscribed' };
      } catch (error) {

      console.error('Error:', error);

      console.error('Error:', error);
      if (error instanceof HttpException) {
        throw error; // Ensure we properly propagate HttpException (409, 400, etc.)
      }

      throw new HttpException(
        `Failed to add new account: ${(error as Error).message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
      }
    }
    
    else {
      throw new Error(`No services for platform: ${platformName}`);
    }
  }
}
