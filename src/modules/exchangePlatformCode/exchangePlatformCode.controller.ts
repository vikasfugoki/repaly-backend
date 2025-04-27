import { Body, Controller, Post, Param, HttpCode, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ExchangePlatformCodeService } from './exchangePlatformCode.service';
import { ApiTags } from '@nestjs/swagger';
import { ExchangePlatformCodeRequest } from '@lib/dto';
import { InstagramApiService } from '../utils/instagram/api.service';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';

@ApiTags('Exchange Platform Code')
@Controller('exchange-code')
export class ExchangePlatformCodeController {
  constructor(
    private readonly exchangePlatformCodeService: ExchangePlatformCodeService,
    private readonly instagramApiService: InstagramApiService,
    private readonly userDetailsService: UserRepositoryService
  ) {}
  @Post()
  @HttpCode(200)
  async exchangeInstagramCode(@Body() input: ExchangePlatformCodeRequest, @Req() req) {
    try{
      const platformId = req.user.user.sub;
      const userItem = await this.userDetailsService.getUserByPlatformId(platformId);
      if (!userItem) {
            throw new HttpException('User is not allowed to make this request', HttpStatus.FORBIDDEN);
        }
            // const influexId = (await this.userService.getUserProfileInfo(userId)).id;
      const influexId = userItem.id ?? "";

      const updatedInput = {
        ...input,
        userId: influexId,
      };
      return await this.exchangePlatformCodeService.exchangeInstagramCode(input);
    } catch (error) {
      console.log((error as Error).message);
      throw new Error('Error: Failed to exchange code.');
    }
    
  }

//   @Post(':accountId/subscribe-webhook')
//    async subscribeWebhook(@Param ('accountId') accountId: string) {
//         try {
//                 return await this.instagramApiService.subscribeWebhookOfInstagram(body.accountId)
//             } catch (error) {
//                 console.log('Failed to subscribe to webhook', (error as Error).message);
//                 throw new Error('Failed to subscribe to webhook ')
//                 }
//        }
}
