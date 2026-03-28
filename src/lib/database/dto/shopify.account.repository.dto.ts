import { IsString } from 'class-validator';

export class ShopifyAuthRequest {
  @IsString()
  shop: string;

  @IsString()
  instagramAccountId: string;
}

export class ShopifyCallbackDto {
  @IsString()
  code: string;

  @IsString()
  shop: string;

  @IsString()
  state: string;

  @IsString()
  hmac: string;
}