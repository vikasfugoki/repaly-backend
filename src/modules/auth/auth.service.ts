import { Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { GoogleApiService } from '../utils/google/api.service';
import { FacebookApiService } from '../utils/facebook/api.service';
import { GoogleUserRepositoryService } from '@database/dynamodb/repository-services/google.user.service';
import { FacebookUserRepositoryService } from '@database/dynamodb/repository-services/facebook.user.service';
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
    private readonly facebookApiService: FacebookApiService,
    private readonly googleUserRepository: GoogleUserRepositoryService,
    private readonly facebookUserRepository: FacebookUserRepositoryService,
    private readonly businessDetailsRepositoryService: BusinessDetailsRepositoryService,
    private readonly userService:  UserService,
    private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
    private readonly instagramMediaRepositoryService: InstagramMediaRepositoryService,
    private readonly instagramStoryRepositoryService: InstagramStoryRepositoryService,
    private readonly jwtService: JwtService
  ) {
    this.jwtService = new JwtService({
      secret: process.env.JWT_SECRET || 'vikas',
      signOptions: { expiresIn: '1h' },
    });
  }


  generateJwt(user: any, source: 'google' | 'facebook' | 'in-house') {
    const payload = {
      sub: user.id || user.sub,     // Google: `sub`, Facebook: `id`, in-house: `id`
      email: user.email,
      name: user.name,
      loginSource: source,
    };
  
    return this.jwtService.sign(payload);
  }

  async validateToken(token: string): Promise<{ user: any; source: string }> {
    try {
      const payload = this.jwtService.verify(token); // or your public key
      const user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        loginSource: payload.loginSource,
      };
      return {
        user: user,
        source: 'jwt',
      };
    } catch (err) {
      console.error('[AuthService] JWT verification failed:', err);
      throw new UnauthorizedException('Invalid token');
    }
  }

  
  
  // async loginWithFacebook(accessToken: string) {
  //   const { user } = await this.validateFacebookToken(accessToken);
  //   const jwt = this.generateJwt(user, 'facebook');
  //   return { token: jwt };
  // }

  // async loginWithCredentials(email: string, password: string) {
  //   const user = await this.usersService.findByEmail(email);
  //   if (!user || !(await bcrypt.compare(password, user.hashedPassword))) {
  //     throw new UnauthorizedException('Invalid credentials');
  //   }
  
  //   const jwt = this.generateJwt(user, 'in-house');
  //   return { token: jwt };
  // }

  // async validateFacebookToken(accessToken: string): Promise<{ message: string; user: any }> {
  //   try {
  //     const response = await axios.get('https://graph.facebook.com/me', {
  //       params: {
  //         access_token: accessToken,
  //         fields: 'id,name,email,picture',
  //       },
  //     });
  
  //     const data = response.data;
  //     const normalizedUser = {
  //       id: data.id,
  //       name: data.name,
  //       email: data.email,
  //       picture: data.picture?.data?.url,
  //       provider: 'facebook',
  //     };
  
  //     return {
  //       message: 'Token is valid',
  //       user: normalizedUser,
  //     };
  //   } catch (error) {
  //     throw new UnauthorizedException('Invalid or expired Facebook token');
  //   }
  // }
  
  // async validateJwtToken(token: string): Promise<{ message: string; user: any }> {
  //   try {
  //     const payload = this.jwtService.verify(token);
  //     return {
  //       message: 'Token is valid',
  //       user: {
  //         id: payload.id,
  //         name: payload.name,
  //         email: payload.email,
  //         picture: payload.picture,
  //         provider: 'in-house',
  //       },
  //     };
  //   } catch (error) {
  //     throw new UnauthorizedException('Invalid or expired JWT token');
  //   }
  // } 

  // async validateGoogleToken(idToken: string) {
  //   try {
  //     const payload = await this.googleApiService.verifyIdToken(idToken);
  //     return {
  //       message: 'Token is valid',
  //       user: payload,
  //     };
  //   } catch (error) {
  //     throw new Error('Invalid or expired token');
  //   }
  // }

  async getGooglePayload(idToken: string): Promise<{ message: string; user: any }> {
    try {
      const payload = await this.googleApiService.verifyIdToken(idToken);
  
      const normalizedUser = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        provider: 'google',
      };
  
      return {
        message: 'Token is valid',
        user: normalizedUser,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async loginWithGoogleCode(code: string) {
    const {
      userId,
      isBusinessDetailsFilled,
      token
    } = await this.getGoogleAccessToken(code); // This is your existing function
  
    return {
      token,
      isBusinessDetailsFilled,
    };
  }

  private async getGoogleAccessToken(
    code: string,
  ): Promise<GetAccessTokenResponse> {
    const { access_token, id_token } =
      await this.googleApiService.getAccessToken(code);

     // Validate the ID token
    // const payload = await this.googleApiService.verifyIdToken(id_token);
    const payload = await this.getGooglePayload(id_token);

    // Now you can safely trust the payload
    // const { id, email, name, picture } = payload;
    const {id, name, email, picture, provider} = payload.user;
    
    // const { sub, email, name, picture } =
    //   await this.googleApiService.getUserDetails(access_token);
    // const user = await this.googleUserRepository.getGoogleUser(sub);
    const user = await this.googleUserRepository.getGoogleUser(id);
    if (!user.Item) {
      const user_id = uuidv4();
      const userRepositoryObject = {
        id: user_id,
        platform_name: 'google',
        // platform_id: sub,
        platform_id: id
      };
      await this.userRepository.createUser(userRepositoryObject);
      const userDetails = {
        // id: sub,
        id: id,
        user_id: user_id,
        email: email ?? '',
        name: name ?? '',
        picture: picture ?? '',
      };

      // create the jwt out of google payload
      const jwt_token = this.generateJwt(userDetails, 'google');
      

      await this.googleUserRepository.createGoogleUser(userDetails);
      return {
        userId: user_id,
        token: jwt_token,
        isBusinessDetailsFilled: false,
      };
    }
    const businessDetails =
      await this.businessDetailsRepositoryService.getBusinessDetailsByUserId(
        user?.Item?.user_id as string,
      );

    // create the jwt out of google payload
    const jwt_token = this.generateJwt(user?.Item, 'google');

    return {
      userId: user?.Item?.user_id as string,
      token: jwt_token,
      isBusinessDetailsFilled: businessDetails.Item ? true : false,
    };
  }

  // async getAccessToken(
  //   input: GetAccessTokenRequest,
  // ): Promise<GetAccessTokenResponse> {
  //   const { platformName, code } = input;
  //   if (platformName === 'google') {
  //     return await this.getGoogleAccessToken(code);
  //   } else {
  //     throw new Error(`Platform name is incorrect: ${platformName}`);
  //   }
  // }

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


  // facebook login
  async getFacebookPayload(accessToken: string): Promise<{ message: string; user: any }> {
    try {
      const userDetails = await this.facebookApiService.getUserDetails(accessToken); // Make sure the FacebookApiService fetches the correct user info
      const normalizedUser = {
        id: userDetails.id,
        name: userDetails.name,
        email: userDetails.email,
        picture: userDetails.picture,
        provider: 'facebook',
      };
  
      return {
        message: 'Token is valid',
        user: normalizedUser,
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async loginWithFacebookCode(code: string) {
    const {
      userId,
      isBusinessDetailsFilled,
      token,
    } = await this.getFacebookAccessToken(code); // Get the Facebook access token and user details
    
    return {
      token,
      isBusinessDetailsFilled,
    };
  }

  private async getFacebookAccessToken(
    code: string,
  ): Promise<GetAccessTokenResponse> {
    const { access_token } = await this.facebookApiService.getAccessToken(code);
  
    // Validate the access token
    const payload = await this.getFacebookPayload(access_token);
  
    const { id, name, email, picture, provider } = payload.user;
  
    // Check if the user exists
    const user = await this.facebookUserRepository.getFacebookUser(id);
    if (!user.Item) {
      const user_id = uuidv4();
      const userRepositoryObject = {
        id: user_id,
        platform_name: 'facebook',
        platform_id: id,
      };
      await this.userRepository.createUser(userRepositoryObject);
  
      const userDetails = {
        id: id,
        user_id: user_id,
        email: email ?? '',
        name: name ?? '',
        picture: picture ?? '',
      };
  
      // Create the JWT token
      const jwt_token = this.generateJwt(userDetails, 'facebook');
  
      await this.facebookUserRepository.createFacebookUser(userDetails);
      return {
        userId: user_id,
        token: jwt_token,
        isBusinessDetailsFilled: false,
      };
    }
  
    const businessDetails = await this.businessDetailsRepositoryService.getBusinessDetailsByUserId(
      user?.Item?.user_id as string,
    );
  
    // Create the JWT token
    const jwt_token = this.generateJwt(user?.Item, 'facebook');
  
    return {
      userId: user?.Item?.user_id as string,
      token: jwt_token,
      isBusinessDetailsFilled: businessDetails.Item ? true : false,
    };
  }
}
