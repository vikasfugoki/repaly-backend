import { Injectable, ConflictException, HttpException, HttpStatus, ConsoleLogger } from '@nestjs/common';
import { InstagramApiService } from '../utils/instagram/api.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { ExchangePlatformCodeRequest } from '@lib/dto';

@Injectable()
export class ExchangePlatformCodeService {
  constructor(
    private readonly api: InstagramApiService,
    private readonly instagramRepository: InstagramAccountRepositoryService,
  ) {}
  async exchangeInstagramCode(input: ExchangePlatformCodeRequest) {
    const { userId, platformName, code } = input;

    console.log(`here are we:`, userId, platformName, code);

    if (platformName !== 'instagram') {
      throw new HttpException(
        `No services for platform: ${platformName}`,
        HttpStatus.BAD_REQUEST
      );
    }

    if (platformName === 'instagram') {
      try {
        const { user_id, access_token } =
          await this.api.getShortLivedAccessToken(code);
        if (!access_token) throw new Error('Exchange Code Error');
        const response = await this.api.getLongLivedAccessToken(access_token);
        const longLivedToken = response?.access_token;
        const { username, name, biography, profile_picture_url, media_count } =
          await this.api.getUserDetails(longLivedToken);
        const accountDetails = {
          id: user_id.toString(),
          access_token: longLivedToken,
          user_id: userId,
          username,
          name,
          biography,
          profile_picture_url,
          media_count,
        };

        let returnMessage = { msg: 'Successfully Created Account and Webhook subscribed' };

        const result = await this.instagramRepository.getAccount(accountDetails.id);
        if (result && result.id === accountDetails.id) {
          accountDetails.user_id = result.user_id;
          returnMessage = { msg: 'Account already attached to another user.' };
        }

        await this.instagramRepository.createAccount(accountDetails);
        // subscribe to webhook
        
        await this.api.subscribeWebhookOfInstagram(accountDetails.id, accountDetails.access_token);
        console.log(returnMessage);

        // return error-code 409, when account already being existed
        if (result && result.id == accountDetails.id) {
          throw new HttpException(
            'Account already attached to another user.',
            HttpStatus.CONFLICT
          );
        }

        return returnMessage;
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
    } else {
      throw new Error(`No services for platform: ${platformName}`);
    }
  }
}
