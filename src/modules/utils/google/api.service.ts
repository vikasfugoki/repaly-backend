import { Injectable } from '@nestjs/common';
import { GoogleUrlService } from './url.service';
import axios from 'axios';
import { GoogleAccessTokenResponse, GoogleUserInfoResponse } from '@lib/dto';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class GoogleApiService {
  constructor(
    private readonly urlService: GoogleUrlService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async getUserDetails(access_token: string): Promise<GoogleUserInfoResponse> {
    const url = this.urlService.getGoogleUserUrl();
    try {
      const response = await axios.get<GoogleUserInfoResponse>(url, {
        params: { access_token },
      });
      return response.data;
    } catch (error) {
      console.log('Failed to get Google user info.', (error as Error).message);
      throw new Error('Failed to get Google user info.');
    }
  }
  async getAccessToken(code: string): Promise<GoogleAccessTokenResponse> {
    const oAuthUrl = this.urlService.getGoogleOauthURL();
    const client_id =
      this.environmentService.getEnvVariable('GOOGLE_CLIENT_ID');
    const client_secret = this.environmentService.getEnvVariable(
      'GOOGLE_CLIENT_SECRET',
    );
    const redirect_uri = this.urlService.getGoogleRedirectURL();
    const grant_type = 'authorization_code';

    const data = new URLSearchParams({
      client_id: client_id,
      client_secret: client_secret,
      grant_type: grant_type,
      redirect_uri: redirect_uri,
      code: code,
    });

    try {
      const response = await axios.post<GoogleAccessTokenResponse>(
        oAuthUrl,
        data,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      return response.data;
    } catch (error) {
      console.log(
        'Failed to exchange Google token via code',
        (error as Error).message,
      );
      throw new Error('Failed to exchange Google token via code');
    }
  }
}
