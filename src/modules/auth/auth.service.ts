import { Injectable, ForbiddenException } from '@nestjs/common';
import { GoogleApiService } from '../utils/google/api.service';
import { GoogleUserRepositoryService } from '@database/dynamodb/repository-services/google.user.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { UserRepositoryService } from '@database/dynamodb/repository-services/user.service';
import { v4 as uuidv4 } from 'uuid';
import { BusinessDetailsRepositoryService } from '@database/dynamodb/repository-services/businessDetails.service';
import { GetAccessTokenRequest, GetAccessTokenResponse } from '@lib/dto';
import { UserService } from '../user/user.service'
import { request } from 'http';
import { InstagramMediaRepositoryService } from '@database/dynamodb/repository-services/instagram.media.service';
import { InstagramStoryRepositoryService } from '@database/dynamodb/repository-services/instagram.story.service';


@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepositoryService,
    private readonly googleApiService: GoogleApiService,
    private readonly googleUserRepository: GoogleUserRepositoryService,
    private readonly businessDetailsRepositoryService: BusinessDetailsRepositoryService,
    private readonly userService:  UserService,
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
    private readonly instagramMediaRepositoryService: InstagramMediaRepositoryService,
    private readonly instagramStoryRepositoryService: InstagramStoryRepositoryService
  ) {}

  async validateGoogleToken(idToken: string) {
    try {
      const payload = await this.googleApiService.verifyIdToken(idToken);
      return {
        message: 'Token is valid',
        user: payload,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  private async getGoogleAccessToken(
    code: string,
  ): Promise<GetAccessTokenResponse> {
    const { access_token, id_token } =
      await this.googleApiService.getAccessToken(code);

     // Validate the ID token
    const payload = await this.googleApiService.verifyIdToken(id_token);

    // Now you can safely trust the payload
    const { sub, email, name, picture } = payload;
    
    // const { sub, email, name, picture } =
    //   await this.googleApiService.getUserDetails(access_token);
    const user = await this.googleUserRepository.getGoogleUser(sub);
    if (!user.Item) {
      const user_id = uuidv4();
      const userRepositoryObject = {
        id: user_id,
        platform_name: 'google',
        platform_id: sub,
      };
      await this.userRepository.createUser(userRepositoryObject);
      const userDetails = {
        id: sub,
        user_id: user_id,
        email: email ?? '',
        name: name ?? '',
        picture: picture ?? '',
      };
      await this.googleUserRepository.createGoogleUser(userDetails);
      return {
        userId: user_id,
        token: id_token,
        isBusinessDetailsFilled: false,
      };
    }
    const businessDetails =
      await this.businessDetailsRepositoryService.getBusinessDetailsByUserId(
        user?.Item?.user_id as string,
      );
    return {
      userId: user?.Item?.user_id as string,
      token: id_token,
      isBusinessDetailsFilled: businessDetails.Item ? true : false,
    };
  }

  async getAccessToken(
    input: GetAccessTokenRequest,
  ): Promise<GetAccessTokenResponse> {
    const { platformName, code } = input;
    if (platformName === 'google') {
      return await this.getGoogleAccessToken(code);
    } else {
      throw new Error(`Platform name is incorrect: ${platformName}`);
    }
  }

  async checkOwnership(
    userId: string, resourceId: string,
    type: 'media' | 'story' | 'account',
  ): Promise<boolean>  {

    const linkedInstagramAccountIds = await this.getInstagramAccountIdFromGoogleUserId(userId);
    let targetInstagramAccountId: string | null = null;

    console.log(`linked instagram accounts: ${linkedInstagramAccountIds}`);

    switch (type) {
      case 'account':
        targetInstagramAccountId = resourceId;
        console.log(`inside account`);
        break;

      case 'media':
        const mediaResult = await this.instagramMediaRepositoryService.getMedia(resourceId);
        targetInstagramAccountId = mediaResult?.Item?.accountId;
        console.log(`inside media`);
        break;

      case 'story':
        const storyResult = await this.instagramStoryRepositoryService.getStory(resourceId);
        targetInstagramAccountId = storyResult?.Item?.accountId;
        console.log(`inside story`);
      
      default:
        throw new Error(`Unsupported resource type: ${type}`);
    }

    console.log(`target instagram account: ${targetInstagramAccountId}`);

    if (!targetInstagramAccountId || !linkedInstagramAccountIds.includes(targetInstagramAccountId)) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    

  
    return true;

  }

  async getInstagramAccountIdFromGoogleUserId(userId: string): Promise<string[]> {
    
      // get attached instagram account_id with the GoogleUserId
      const influex_user_id = (await this.googleUserRepository.getGoogleUser(userId)).Item?.user_id;
      console.log(`getting influex user id: ${influex_user_id}`);
      if (!influex_user_id) return [];
      const accounts = await this.instagramAccountRepositoryService.getAccountDetailsByUserId(influex_user_id);
      const instagram_account_ids = accounts.map(account => account.id);
      console.log(`accounts ids: ${instagram_account_ids}`);
      return instagram_account_ids;

  }
}
