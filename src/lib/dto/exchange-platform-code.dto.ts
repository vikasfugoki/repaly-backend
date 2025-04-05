import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangePlatformCodeRequest {
  @ApiProperty()
  @IsNotEmpty()
  userId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  platformName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  code: string;
}
