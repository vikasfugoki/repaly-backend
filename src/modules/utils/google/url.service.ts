import { Injectable } from '@nestjs/common';
import { EnvironmentService } from 'src/modules/utils/environment/environment.service';

@Injectable()
export class GoogleUrlService {
  constructor(private readonly environmentService: EnvironmentService) {}

  getGoogleOauthURL() {
    return this.environmentService.getEnvVariable('GOOGLE_OAUTH_URL');
  }

  getGoogleApiUrl() {
    return this.environmentService.getEnvVariable('GOOGLE_API_URL');
  }

  getGoogleRedirectURL() {
    return this.environmentService.getEnvVariable('GOOGLE_REDIRECT_URL');
  }

  getGoogleUserUrl() {
    return this.getGoogleApiUrl() + '/userinfo';
  }
}
