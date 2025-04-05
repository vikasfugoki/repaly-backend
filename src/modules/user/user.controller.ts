import { Body, Controller, Post, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { AddBusinessDetailsRequest } from '@lib/dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('business-details')
  async addBusinessDetails(@Body() input: AddBusinessDetailsRequest) {
    try {
      await this.userService.addBusinessDetails(input);
      return { msg: 'Successfully added business details.' };
    } catch (error) {
      console.log((error as Error).message);
      throw new Error('Error: Failed to add business details.');
    }
  }

  @Get(':userId/profile')
  async getUserProfile(@Param('userId') userId: string){
      try {
            return await this.userService.getUserProfileInfo(userId);
          } catch (error) {
              console.log("Failed to get profile information:", (error as Error).message);
              throw new Error('Failed to get profile information');
    }
      }
}
