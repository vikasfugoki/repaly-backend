import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { FacebookAccessTokenResponse, FacebookUserInfoResponse } from '@lib/dto'; // You'll need to define these DTOs.
import { FacebookUrlService } from './url.service'; // A service to manage Facebook URL related methods
import { EnvironmentService } from '../environment/environment.service';
import { FacebookAdAccountResponse, FacebookAdAccount } from '@lib/dto/facebook.dto'

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

      async getAdAccounts(access_token: string): Promise<FacebookAdAccount[]> {
        const allAccounts: FacebookAdAccount[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status&access_token=${access_token}`;
      
        try {
          while (nextUrl) {
            const response = await axios.get<FacebookAdAccountResponse>(nextUrl);
            const { data, paging } = response.data;
      
            allAccounts.push(...data);
            nextUrl = paging?.next || null;
          }
      
          console.log('All Facebook ad accounts:', allAccounts);
          return allAccounts;
        } catch (error) {
          console.error('Error fetching ad accounts:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve Facebook ad accounts');
        }
      }

      async getAdCreatives(adAccountId: string, accessToken: string): Promise<any> {
        const allCreatives: any[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/v23.0/${adAccountId}/adcreatives?fields=id,name,object_story_id,object_story_spec,image_url,instagram_user_id,effective_instagram_media_id,source_instagram_media_id,instagram_destination_id&access_token=${accessToken}`;
      
        try {
          while (nextUrl) {
            const response = await axios.get<any>(nextUrl);
            const { data, paging } = response.data;
      
            allCreatives.push(...data);
            nextUrl = paging?.next || null;
          }
      
          return allCreatives;
        } catch (error) {
          console.error('Error fetching ad creatives:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve ad creatives');
        }
      }

      async getAdsWithCreatives(adAccountId: string, accessToken: string): Promise<any[]> {
        const allAds: any[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/v23.0/${adAccountId}/ads?fields=id,name,creative{id,name,object_story_spec,image_url,thumbnail_url,effective_instagram_media_id}&access_token=${accessToken}`;
      
        try {
          while (nextUrl) {
            const response = await axios.get<any>(nextUrl);
            const { data, paging } = response.data;
      
            allAds.push(...data);
            nextUrl = paging?.next || null;
          }
      
          return allAds;
        } catch (error) {
          console.error('Error fetching ads with creatives:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve ads with creatives');
        }
      }



      async getAdCreativesViaAdsAPI(adAccountId: string, accessToken: string): Promise<any[]> {
        const allAds: any[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/v21.0/${adAccountId}/ads?fields=id,name,creative{id},effective_status&effective_status=["ACTIVE"]&access_token=${accessToken}`;
      
        try {
          // Step 1: Fetch all ACTIVE ads with creative IDs using pagination
          while (nextUrl) {
            const response = await axios.get<any>(nextUrl);
            const { data, paging } = response.data;
            allAds.push(...data);
            nextUrl = paging?.next || null;
          }
      
          // Step 2: Collect all creative IDs
          const creativeIds = allAds
            .map(ad => ad?.creative?.id)
            .filter((id): id is string => !!id);
      
          if (creativeIds.length === 0) return [];
      
          // Step 3: Fetch all creatives in batches of 50 (Graph API limit for `ids`)
          const batchSize = 50;
          const allCreatives: any[] = [];
          for (let i = 0; i < creativeIds.length; i += batchSize) {
            const batchIds = creativeIds.slice(i, i + batchSize).join(',');
            const creativesResponse = await axios.get('https://graph.facebook.com/v21.0', {
              params: {
                ids: batchIds,
                fields: 'id,name,image_url,instagram_user_id,effective_instagram_media_id,object_story_spec',
                access_token: accessToken,
              },
            });
      
            const creativesMap = creativesResponse.data;
            allCreatives.push(...Object.values(creativesMap));
          }
      
          return allCreatives;
        } catch (error: any) {
          console.error('Error fetching creatives from /ads:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve creatives via ads API');
        }
      }

      async getAdsWithCreativesAndInsights(adAccountId: string, accessToken: string): Promise<any[]> {
        const allAds: any[] = [];
        let nextUrl: string | null = `https://graph.facebook.com/v23.0/${adAccountId}/ads?fields=id,name,status,creative{id,name,object_story_spec,image_url,thumbnail_url,effective_instagram_media_id}&access_token=${accessToken}`;
      
        try {
          while (nextUrl && allAds.length < 5) {
        const response = await axios.get<any>(nextUrl);
        const { data, paging } = response.data;
      
        for (const ad of data) {
          if (allAds.length >= 5) break;
          const insights = await this.getAdInsights(ad.id, accessToken);
      
          allAds.push({
            ad_id: ad.id,
            ad_name: ad.name,
            status: ad.status,
            creative_id: ad.creative?.id || null,
            creative_name: ad.creative?.name || null,
            image_url: ad.creative?.image_url || ad.creative?.thumbnail_url || null,
            object_story_spec: ad.creative?.object_story_spec || null,
            effective_instagram_media_id: ad.creative?.effective_instagram_media_id || null,
            insights: insights,
          });
        }
      
        nextUrl = paging?.next || null;
          }
      
          return allAds;
        } catch (error) {
          console.error('Error fetching ads or creatives:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve ads with creatives and insights');
        }
      }


      // Helper function to get insights for an ad
      async getAdInsights(adId: string, accessToken: string): Promise<any> {
        const url = `https://graph.facebook.com/v23.0/${adId}/insights?fields=impressions,clicks,spend,cpm,ctr,reach&date_preset=maximum&access_token=${accessToken}`;
      
        try {
          const response = await axios.get<any>(url);
          const insights = response.data?.data?.[0] || {};
          console.log('Insights response:', insights);
          return insights;
        } catch (error) {
          console.warn(`Failed to fetch insights for ad ${adId}:`, error?.response?.data || error.message);
          return {};
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

              console.log('facebook token response:', tokenResponse.data);
              return {"access_token": tokenResponse.data.access_token};
          
        } catch (error) {
          console.error('Error getting Facebook access token:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve Facebook access token');
        }
      }

      async getAccessTokenAds(code: string): Promise<{ access_token: string }> {
        try {
          
            const tokenResponse = await axios.get<FacebookAccessTokenResponse>(this.environmentService.getEnvVariable('FACEBOOK_OAUTH_URL'), {
                params: {
                  client_id: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_ID'),
                  client_secret: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_SECRET'),
                  redirect_uri: this.environmentService.getEnvVariable('FACEBOOK_ADS_REDIRECT_URL'),
                  code: code,  // Authorization code received from the user
                },
              });

              console.log('facebook token response:', tokenResponse.data);
              return {"access_token": tokenResponse.data.access_token};
          
        } catch (error) {
          console.error('Error getting Facebook access token:', error?.response?.data || error.message);
          throw new InternalServerErrorException('Failed to retrieve Facebook access token');
        }
      }

}