import { Body, Controller, Post, Get, Req, HttpException, HttpStatus, Res } from '@nestjs/common';
import { UserService } from './user.service';
import { AddBusinessDetailsRequest } from '@lib/dto';
import { ApiTags } from '@nestjs/swagger';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService,
    private readonly userDetailsService: UserRepositoryService
  ) {}

  @Post('business-details')
  async addBusinessDetails(@Body() input: AddBusinessDetailsRequest, @Req() req) {
    try {
      // const platformId = req.user.user.sub;
      const platformId = req.user.id;
      const userItem = await this.userDetailsService.getUserByPlatformId(platformId);
      if (!userItem) {
            throw new HttpException('User is not allowed to make this request', HttpStatus.FORBIDDEN);
          }
      // const influexId = (await this.userService.getUserProfileInfo(userId)).id;
      const influexId = userItem.id ?? "";

      console.log(platformId, influexId);

      await this.userService.addBusinessDetails({
        ...input,
        user_id: influexId,
      });

      return { msg: 'Successfully added business details.' };
    } catch (error) {
      console.log((error as Error).message);
      throw new Error('Error: Failed to add business details.');
    }
  }

  @Get('business-details')
  async getBusinessDetails(@Req() req) {
    try {
      const platformId = req.user.id;
      const userItem = await this.userDetailsService.getUserByPlatformId(platformId);
      if (!userItem) {
        throw new HttpException(
          'User is not allowed to make this request',
          HttpStatus.FORBIDDEN,
        );
      }

      const influexId = userItem.id ?? "";
      const businessDetails = await this.userService.getBusinessDetails(influexId);

      if (
        !businessDetails ||
        !businessDetails.Item ||
        !businessDetails.Item.queries
      ) {
        throw new HttpException(
          'Business details not found',
          HttpStatus.NOT_FOUND,
        );
      }

      // Parse the queries field (which is a JSON string)
      let queries;
      try {
        queries = JSON.parse(businessDetails.Item.queries);
      } catch {
        throw new HttpException(
          'Invalid business details format',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Find the question: "Please provide your contact details."
      const contactQuestion = queries.find(
        (q: any) =>
          q.question &&
          q.question.trim().toLowerCase() === 'please provide your contact details.'
      );

      // Return the answer as contact_no (even if it's not a number)
      let contact_no = null;
      if (contactQuestion && contactQuestion.answer !== 'skipped') {
        contact_no = contactQuestion.answer;
      }

      return { "contact_no": contact_no };
    } catch (error) {
      console.log((error as Error).message);
      throw new Error('Error: Failed to fetch business details.');
    }
  }

  @Get('profile')
  async getUserProfile(@Req() req){
      try {
            console.log("i ma inside the profile api");
            console.log(req);
            // const userId = req.user.user.sub; // googel user id
            const userId = req.user.id;
            console.log(`userId: ${userId}`);
            return await this.userService.getUserProfileInfo(userId);
          } catch (error) {
              console.log("Failed to get profile information:", (error as Error).message);
              throw new Error('Failed to get profile information');
    }
      }

//   @Get('profile')
// async getUserProfile(@Req() req, @Res() res) {
//   try {
//     const userId = req.user.user.sub;
//     const profile = await this.userService.getUserProfileInfo(userId);

//     res.set({
//       'Access-Control-Allow-Origin': '*', // or your frontend URL
//       'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//     });

//     return res.status(200).json(profile);
//   } catch (error) {
//     return res.status(500).json({ error: 'Failed to get profile information' });
//   }
// }
}
