import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExchangePlatformCodeService } from './modules/exchangePlatformCode/exchangePlatformCode.service';
import { ExchangePlatformCodeController } from './modules/exchangePlatformCode/exchangePlatformCode.controller';
import { InstagramAccountRepositoryService } from './lib/database/dynamodb/repository-services/instagram.account.service';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { GoogleApiService } from './modules/utils/google/api.service';
import { FacebookApiService } from './modules/utils/facebook/api.service';
import { FacebookUrlService } from './modules/utils/facebook/url.service';
import { GoogleUrlService } from './modules/utils/google/url.service';
import { UserRepositoryService } from './lib/database/dynamodb/repository-services/user.service';
import { GoogleUserRepositoryService } from './lib/database/dynamodb/repository-services/google.user.service';
import { BusinessDetailsRepositoryService } from './lib/database/dynamodb/repository-services/businessDetails.service';
import { UserController } from './modules/user/user.controller';
import { UserService } from './modules/user/user.service';
import { InstagramMediaRepositoryService } from '@database/dynamodb/repository-services/instagram.media.service';
import { InstagramStoryRepositoryService } from '@database/dynamodb/repository-services/instagram.story.service';
import { InstagramAccountService } from './modules/instagram/instagram.service';
import { InstagramAccountController } from './modules/instagram/instagram.controller';
import { AccountController } from './modules/account/account.controller';
import { AccountService } from './modules/account/account.service';
import { InstagramMediaAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.mediaAnalytics.service';
import { envValidationSchema } from './modules/utils/validation/env.validation';
import { InstagramApiService } from './modules/utils/instagram/api.service';
import { InstagramUrlService } from './modules/utils/instagram/url.service';
import { EnvironmentService } from './modules/utils/environment/environment.service';
import { DynamoDBService } from '@database/dynamodb/dynamodb.service';
import { AIController } from './modules/aiModel/aiModel.contorller';
import { AIServices } from './modules/aiModel/aiModel.service';
import { InstagramStoryAnalyticsRepositoryService } from '@database/dynamodb/repository-services/instagram.storyAnalytics.service';

// Import the JwtModule
import { JwtModule } from '@nestjs/jwt';
import { FacebookUserRepositoryService } from '@database/dynamodb/repository-services/facebook.user.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // Add JwtModule here
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecret', // or any secret you use
      signOptions: { expiresIn: '1h' },  // JWT expiration time
    }),
  ],
  controllers: [
    AppController,
    AuthController,
    UserController,
    AccountController,
    ExchangePlatformCodeController,
    InstagramAccountController,
    AIController,
  ],
  providers: [
    AppService,
    AuthService,
    AccountService,
    BusinessDetailsRepositoryService,
    DynamoDBService,
    EnvironmentService,
    UserService,
    ExchangePlatformCodeService,
    InstagramAccountService,
    InstagramApiService,
    InstagramUrlService,
    InstagramAccountRepositoryService,
    InstagramMediaAnalyticsRepositoryService,
    GoogleUserRepositoryService,
    GoogleApiService,
    GoogleUrlService,
    FacebookApiService,
    FacebookUrlService,
    FacebookUserRepositoryService,
    UserRepositoryService,
    InstagramMediaRepositoryService,
    InstagramStoryRepositoryService,
    InstagramStoryAnalyticsRepositoryService,
    AIServices,
  ],
  exports: [DynamoDBService],
})
export class AppModule {}
