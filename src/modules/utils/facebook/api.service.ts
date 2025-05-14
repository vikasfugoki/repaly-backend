import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { FacebookAccessTokenResponse, FacebookUserInfoResponse } from '@lib/dto'; // You'll need to define these DTOs.
import { FacebookUrlService } from './url.service'; // A service to manage Facebook URL related methods
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class FacebookApiService {

    constructor (
        private readonly urlService: FacebookUrlService,
        private readonly environmentService: EnvironmentService,
    ) {}  // need to remove the console

    async getUserDetails(access_token: string): Promise<FacebookUserInfoResponse> {
         
        try {
          const response = await axios.get<any>(this.environmentService.getEnvVariable('FACEBOOK_API_URL'), {
            params: {
              access_token,
              fields: 'id,name,email,picture', // Fields to fetch
            },
          });
    
          console.log('Facebook user details:', response.data);
          return response.data; // Returns the user details
        } catch (error) {
          console.error('Error getting Facebook user details:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve Facebook user details');
        }
      }

    async getAccessToken(code: string): Promise<{ access_token: string }> {
        try {
          
            const tokenResponse = await axios.get<FacebookAccessTokenResponse>(this.environmentService.getEnvVariable('FACEBOOK_OAUTH_URL'), {
                params: {
                  client_id: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_ID'),
                  client_secret: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_SECRET'),
                  redirect_uri: this.environmentService.getEnvVariable('FACEBOOK_REDIRECT_URL'),
                  code: code,  // Authorization code received from the user
                },
              });

              console.log('facebook token response:', tokenResponse);
              return {"access_token": tokenResponse.data.access_token};
          
        } catch (error) {
          console.error('Error getting Facebook access token:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve Facebook access token');
        }
      }

      



}