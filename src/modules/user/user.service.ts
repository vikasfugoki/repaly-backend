import { AddBusinessDetailsRequest } from '@lib/dto';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessDetailsRepositoryService } from '@database/dynamodb/repository-services/businessDetails.service';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';
import {GoogleUserRepositoryService} from  '@database/dynamodb/repository-services/google.user.service';

@Injectable()
export class UserService {
  constructor(
    private readonly businessDetailsService: BusinessDetailsRepositoryService,
    private readonly userDetailsService: UserRepositoryService,
    private readonly googleUserDetailsService: GoogleUserRepositoryService
  ) {}

  addBusinessDetails(input: AddBusinessDetailsRequest) {
    const { user_id, queries } = input;
    const businessDetailsObject = {
      user_id,
      queries: JSON.stringify(queries),
    };
    return this.businessDetailsService.addBusinessDetails(
      businessDetailsObject,
    );
  }

  async getUserProfileInfo(user_id: string) {
    console.log(user_id);
  
    const userItem = await this.userDetailsService.getUserByPlatformId(user_id);
    console.log('user item:', JSON.stringify(userItem, null, 2)); // ✅ Proper logging
  
    if (!userItem) {
      throw new HttpException('User is not allowed to make this request', HttpStatus.FORBIDDEN);
    }
  
    const platform_name = userItem.platform_name ?? "";
    const platform_id = userItem.platform_id ?? "";
  
    if (platform_name === "google") {
      const googleItem = await this.googleUserDetailsService.getGoogleUser(platform_id);
      return {
        id: googleItem?.Item?.id ?? "",
        email: googleItem?.Item?.email ?? "",
        picture: googleItem?.Item?.picture ?? "",
        name: googleItem?.Item?.name ?? "",
      };
    }
  
    return {};
  }



}
