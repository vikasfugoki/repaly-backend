import { Injectable } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { GoogleUrlService } from './url.service';
import axios from 'axios';
import { GoogleAccessTokenResponse, GoogleUserInfoResponse } from '@lib/dto';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class GoogleApiService {
  
  private client: OAuth2Client;

  constructor(
    private readonly urlService: GoogleUrlService,
    private readonly environmentService: EnvironmentService,
    // private client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  ) {
    this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  

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

  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('Invalid token payload');
    return payload;
  }
}
