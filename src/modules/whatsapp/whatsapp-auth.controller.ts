import { Body, Controller, Post, HttpCode, Req, HttpException, HttpStatus, Query, Get, Res, Headers as NestHeaders, RawBodyRequest } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';
import {WhatsappAuthService} from './whatsapp-auth.service';

@Controller('whatsapp')
export class WhatsappAuthController {
  constructor(
    private readonly userDetailsService: UserRepositoryService,
    private readonly whatsappAuthService: WhatsappAuthService,
  ) {}

  @Post('auth')
  @HttpCode(200)
  async initiateWhatsappAuth(@Body() input, @Req() req) {
    try {
      const platformId = req.user.id;
      const userItem = await this.userDetailsService.getUserByPlatformId(platformId);
      if (!userItem) {
        throw new HttpException('User is not allowed to make this request', HttpStatus.FORBIDDEN);
      }

      const updatedInput = {
        ...input,
        userId: userItem.id ?? '',
      };

      return await this.whatsappAuthService.initiateAuth(updatedInput);
    } catch (error) {
      console.error(error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Error: Failed to initiate Whatsapp auth.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

}