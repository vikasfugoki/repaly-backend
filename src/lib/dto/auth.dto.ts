import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetAccessTokenRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  platformName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  code: string;
}

export class GetAccessTokenResponse {
  userId: string;
  token: string;
  isBusinessDetailsFilled: boolean;
}

// [TBD]: Validate response and fix response dto
export class GoogleAccessTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
}

export class FacebookAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// [TBD]: Validate response and fix response dto
export class GoogleUserInfoResponse {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email: string;
  email_verified: boolean;
  locale: string;
}

export class FacebookUserInfoResponse {
  id: string;
  name: string;
  email: string;
  picture: string;
}


