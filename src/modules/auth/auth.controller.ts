import { Body, Controller, HttpCode, HttpStatus, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetAccessTokenRequest } from '@lib/dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('get-access-token')
  async getAccessToken(@Body() input: GetAccessTokenRequest) {
    const response = await this.authService.getAccessToken(input);
    return response;
  }

  // @Post('validate-token')
  // @HttpCode(HttpStatus.OK)
  // validateToken() {
  //   return { message: 'Token is valid' };
  // }

  @ApiBearerAuth()
  @Post('validate-token')
  @HttpCode(HttpStatus.OK)
  async validateToken(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    return await this.authService.validateGoogleToken(token);
  }
}
