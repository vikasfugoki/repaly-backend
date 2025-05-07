import { Injectable } from '@nestjs/common';
import { EnvironmentService } from 'src/modules/utils/environment/environment.service';


@Injectable()
export class FacebookUrlService {
    constructor(private readonly environmentService: EnvironmentService) {}

    getFacebookOauthURL() {
        return this.environmentService.getEnvVariable('FACEBOOK_OAUTH_URL');
      }
    
      getFacebookRedirectURL() {
        return this.environmentService.getEnvVariable('FACEBOOK_REDIRECT_URL');
      }
    
    
}

