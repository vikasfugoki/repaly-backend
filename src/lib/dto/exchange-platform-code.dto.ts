import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ExchangePlatformCodeRequest {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  platformName!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  instagramAccountId?: string;
}