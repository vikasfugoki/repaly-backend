import { Injectable } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class InstagramUrlService {
  constructor(private readonly environmentService: EnvironmentService) {}
  private getInstagramBaseURL() {
    return this.environmentService.getEnvVariable('INSTAGRAM_BASE_URL');
  }

  getInstagramOauthURL() {
    return this.environmentService.getEnvVariable('INSTAGRAM_OAUTH_URL');
  }

  getInstagramRedirectURL() {
    return this.environmentService.getEnvVariable('INSTAGRAM_REDIRECT_URL');
  }

  getMediaUrl(userId: string) {
    const baseURL = this.getInstagramBaseURL();
    const url = baseURL + `/${userId}` + '/media';
    return url;
  }

  getMediaInsightUrl(mediaId: string) {
    const baseURL = this.getInstagramBaseURL();
    const url = baseURL + `/${mediaId}` + '/insights';
    return url;
  }

  getExchangeTokenUrl() {
    const baseURL = this.getInstagramBaseURL();
    const url = baseURL + '/access_token';
    return url;
  }

  getMe() {
    const baseURL = this.getInstagramBaseURL();
    const url = baseURL + '/me';
    return url;
  }

  getInstagramWebhookSubscribeURL(userId: string) {
    const baseURL = this.getInstagramBaseURL();
    const url = baseURL + `/${userId}` + '/subscribed_apps';
    return url;
    }
}
