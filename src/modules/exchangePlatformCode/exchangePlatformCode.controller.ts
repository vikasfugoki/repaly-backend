import { Body, Controller, Post, Param, HttpCode } from '@nestjs/common';
import { ExchangePlatformCodeService } from './exchangePlatformCode.service';
import { ApiTags } from '@nestjs/swagger';
import { ExchangePlatformCodeRequest } from '@lib/dto';
import { InstagramApiService } from '../utils/instagram/api.service';

@ApiTags('Exchange Platform Code')
@Controller('exchange-code')
export class ExchangePlatformCodeController {
  constructor(
    private readonly exchangePlatformCodeService: ExchangePlatformCodeService,
    private readonly instagramApiService: InstagramApiService
  ) {}
  @Post()
  @HttpCode(200)
  async exchangeInstagramCode(@Body() input: ExchangePlatformCodeRequest) {
    return await this.exchangePlatformCodeService.exchangeInstagramCode(input);
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
