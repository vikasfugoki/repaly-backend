import { Injectable } from '@nestjs/common';
import { InstagramUrlService } from './url.service';
import axios from 'axios';
import {
  InstagramAccessTokenResponse,
  InstagramMediaInsightResponse,
  InstagramMediaResponse,
  InstagramOauthResponse,
  InstagramUserInfoResponse,
} from '@lib/dto';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class InstagramApiService {
  constructor(
    private readonly urlService: InstagramUrlService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async getShortLivedAccessToken(
    code: string,
  ): Promise<InstagramOauthResponse> {
    const client_id = this.environmentService.getEnvVariable(
      'INSTAGRAM_CLIENT_ID',
    );
    const client_secret = this.environmentService.getEnvVariable(
      'INSTAGRAM_CLIENT_SECRET',
    );
    const grant_type = 'authorization_code';
    const redirect_uri = this.urlService.getInstagramRedirectURL();
    const url = this.urlService.getInstagramOauthURL();
    const data = new URLSearchParams({
      client_id: client_id,
      client_secret: client_secret,
      grant_type: grant_type,
      redirect_uri: redirect_uri,
      code: code,
    });
    try {
      const response = await axios.post<InstagramOauthResponse>(url, data, {
        transformResponse: (res) =>
          JSON.parse(res.replace(/"user_id":\s*(\d+)/, '"user_id":"$1"')),
      });

      return response.data;
    } catch (error) {
      console.log(
        'Failed to exchange Instagram code',
        (error as Error).message,
      );
      throw new Error('Failed to exchange Instagram code');
    }
  }

  async getLongLivedAccessToken(
    access_token: string,
  ): Promise<InstagramAccessTokenResponse> {
    const client_secret = this.environmentService.getEnvVariable(
      'INSTAGRAM_CLIENT_SECRET',
    );
    const grant_type = 'ig_exchange_token';
    const params = {
      client_secret,
      grant_type,
      access_token,
    };
    const url = this.urlService.getExchangeTokenUrl();
    try {
      const response = await axios.get<InstagramAccessTokenResponse>(url, {
        params,
      });
      return response.data;
    } catch (error) {
      console.log(
        'Failed to get Instagram access token',
        (error as Error).message,
      );
      throw new Error('Failed to get Instagram access token');
    }
  }

  async getMedia(userId: string, access_token: string) {
    const url = this.urlService.getMediaUrl(userId);
    const params = {
      fields:
        'id,caption,media_type,media_url,timestamp,like_count,thumbnail_url,comments_count',
      access_token,
      limit: 15, // limit the response to a maximum of 15 media items
    };
    try {
      const response = await axios.get<InstagramMediaResponse>(url, {
        params,
      });
      return response.data.data;
    } catch (error) {
      console.log('Failed to fetch media', (error as Error).message);
      throw new Error('Failed to fetch media');
    }
  }

  async getMediaInsight(
    mediaId: string,
    access_token: string,
    media_type?: string,
  ) {
    const url = this.urlService.getMediaInsightUrl(mediaId);
    const metric =
      'reach,shares,comments,likes,saved' +
      (media_type === 'VIDEO'
        ? ',ig_reels_avg_watch_time,ig_reels_video_view_total_time'
        : '');
    const params = {
      metric,
      access_token,
    };
    try {
      const response = await axios.get<InstagramMediaInsightResponse>(url, {
        params,
      });
      return response.data.data;
    } catch (error) {
      console.log('Failed to get media insights', (error as Error).message);
    }
  }

  async getUserDetails(
    access_token: string,
  ): Promise<InstagramUserInfoResponse> {
    const url = this.urlService.getMe();
    const params = {
      fields: 'username,name,biography,profile_picture_url,media_count',
      access_token,
    };
    try {
      const response = await axios.get<InstagramUserInfoResponse>(url, {
        params,
      });
      return response.data;
    } catch (error) {
      console.log('Failed to get user details.', (error as Error).message);
      throw new Error('Failed to get user details.');
    }
  }

  async subscribeWebhookOfInstagram(userInstaId: string, accessToken: string): Promise<any> {
    const url = this.urlService.getInstagramWebhookSubscribeURL(userInstaId);
    console.log('url', url)
    const params = {
      subscribed_fields: 'messages,messaging_postbacks,messaging_seen,messaging_handover,messaging_referral,messaging_optins,message_reactions,standby,comments,live_comments,mentions,story_insights,creator_marketplace_projects,creator_marketplace_invited_creator_onboarding,delta,story_reactions',
      access_token: accessToken,
    };

    try {
      const response = await axios.post(url, null, { params });
      return response.data;
    } catch (error) {
      console.log('Failed to subscribe webhook.', (error as Error).message);
      throw new Error('Failed to subscribe webhook.');
    }
  }
  
}
