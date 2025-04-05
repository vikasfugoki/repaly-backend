import { AddBusinessDetailsRequest } from '@lib/dto';
import { Injectable } from '@nestjs/common';
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
    const userItem = await this.userDetailsService.getUser(user_id); // Add 'await'

    const platform_name = userItem?.Item?.platform_name ?? "";
    const platform_id = userItem?.Item?.platform_id ?? "";

    if (platform_name === "google") { // Use '===' for comparison
        const googleItem = await this.googleUserDetailsService.getGoogleUser(platform_id); // Add 'await'
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
