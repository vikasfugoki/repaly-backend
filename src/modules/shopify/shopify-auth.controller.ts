import { Body, Controller, Post, Param, HttpCode, Req, HttpException, HttpStatus, Query, Get,Res, UseGuards } from '@nestjs/common';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopifyAuthRequest } from '@database/dto/shopify.account.repository.dto';
import { InstagramOwnershipGuard } from '../auth/instagram-ownership.guard';

@Controller('shopify')
export class ShopifyAuthController {
    constructor(
    private readonly shopifyAuthService: ShopifyAuthService,
    private readonly userDetailsService: UserRepositoryService
  ) {}


  @Post('auth')
@HttpCode(200)
async initiateShopifyAuth(@Body() input: ShopifyAuthRequest, @Req() req) {
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

    return await this.shopifyAuthService.initiateAuth(updatedInput);
  } catch (error) {
    console.error(error);
    if (error instanceof HttpException) throw error;
    throw new HttpException('Error: Failed to initiate Shopify auth.', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

@Get('callback')
async shopifyCallback(
  @Query('code') code: string,
  @Query('shop') shop: string,
  @Query('state') state: string,
  @Query('hmac') hmac: string,
  @Res() res
) {
  try {
    await this.shopifyAuthService.handleCallback({ code, shop, state, hmac });
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?shopify=connected`);
  } catch (error) {
    console.error(error);
    if (error instanceof HttpException) throw error;
    throw new HttpException('Error: Failed to complete Shopify OAuth.', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

}