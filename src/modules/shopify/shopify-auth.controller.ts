// import { Body, Controller, Post, Param, HttpCode, Req, HttpException, HttpStatus, Query, Get,Res, UseGuards } from '@nestjs/common';
import { Body, Controller, Post, HttpCode, Req, HttpException, HttpStatus, Query, Get, Res, Headers as NestHeaders, RawBodyRequest } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import {UserRepositoryService} from '@database/dynamodb/repository-services/user.service';
import { ShopifyAuthService } from './shopify-auth.service';
import { ShopifyAuthRequest } from '@database/dto/shopify.account.repository.dto';
import { InstagramOwnershipGuard } from '../auth/instagram-ownership.guard';
import * as crypto from 'crypto';
import { Request } from 'express';

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
@Public()
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

// ---- GDPR Webhooks ----

  verifyShopifyHmac(rawBody: Buffer, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_API_SECRET!;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');
  return hash === hmacHeader;
}

// ---- GDPR Webhooks ----

@Post('webhooks/customers/data_request')
@Public()
@HttpCode(200)
async customersDataRequest(
  @NestHeaders('x-shopify-hmac-sha256') hmac: string,
  @Req() req: RawBodyRequest<Request>
){
  if (!req.rawBody || !this.verifyShopifyHmac(req.rawBody, hmac)) {
  throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
  }
  return { status: 'ok' };
}

@Post('webhooks/customers/redact')
@Public()
@HttpCode(200)
async customersRedact(
  @NestHeaders('x-shopify-hmac-sha256') hmac: string,
  @Req() req: RawBodyRequest<Request>
) {
  if (!req.rawBody || !this.verifyShopifyHmac(req.rawBody, hmac)) {
    throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
  }
  return { status: 'ok' };
}

@Post('webhooks/shop/redact')
@Public()
@HttpCode(200)
async shopRedact(
  @NestHeaders('x-shopify-hmac-sha256') hmac: string,
  @Req() req: RawBodyRequest<Request>
) {
  if (!req.rawBody || !this.verifyShopifyHmac(req.rawBody, hmac)) {
    throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
  }
  return { status: 'ok' };
}

}