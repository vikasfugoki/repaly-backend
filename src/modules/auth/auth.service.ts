import { Injectable } from '@nestjs/common';
import { GoogleApiService } from '../utils/google/api.service';
import { GoogleUserRepositoryService } from '@database/dynamodb/repository-services/google.user.service';
import { UserRepositoryService } from '@database/dynamodb/repository-services/user.service';
import { v4 as uuidv4 } from 'uuid';
import { BusinessDetailsRepositoryService } from '@database/dynamodb/repository-services/businessDetails.service';
import { GetAccessTokenRequest, GetAccessTokenResponse } from '@lib/dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepositoryService,
    private readonly googleApiService: GoogleApiService,
    private readonly googleUserRepository: GoogleUserRepositoryService,
    private readonly businessDetailsRepositoryService: BusinessDetailsRepositoryService,
  ) {}

  private async getGoogleAccessToken(
    code: string,
  ): Promise<GetAccessTokenResponse> {
    const { access_token, id_token } =
      await this.googleApiService.getAccessToken(code);
    const { sub, email, name, picture } =
      await this.googleApiService.getUserDetails(access_token);
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
        email: email,
        name: name,
        picture: picture,
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
}
