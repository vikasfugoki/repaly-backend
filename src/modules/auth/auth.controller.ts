import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GetAccessTokenRequest } from '@lib/dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('get-access-token')
  async getAccessToken(@Body() input: GetAccessTokenRequest) {
    const response = await this.authService.getAccessToken(input);
    return response;
  }

  @Post('validate-token')
  @HttpCode(HttpStatus.OK)
  validateToken() {
    return { message: 'Token is valid' };
  }
}
