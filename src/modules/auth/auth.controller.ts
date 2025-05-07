import { Body, Controller, HttpCode, HttpStatus, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { GetAccessTokenRequest } from '@lib/dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Public()
  // @Post('get-access-token')
  // async getAccessToken(@Body() input: GetAccessTokenRequest) {
  //   const response = await this.authService.getAccessToken(input);
  //   return response;
  // }

  // @Post('validate-token')
  // @HttpCode(HttpStatus.OK)
  // validateToken() {
  //   return { message: 'Token is valid' };
  // }


  // @Public()
  // @ApiBearerAuth()
  // @Post('validate-token')
  // @HttpCode(HttpStatus.OK)
  // async validateToken(@Headers('authorization') authHeader: string) {
  //   const token = authHeader?.replace('Bearer ', '');
  //   if (!token) {
  //     throw new UnauthorizedException('No token provided');
  //   }
  //   return await this.authService.validateGoogleToken(token);
  // }

@Public()
@ApiBearerAuth()
@Post('validate-token')
@HttpCode(HttpStatus.OK)
async validateToken(@Headers('authorization') authHeader: string) {
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    throw new UnauthorizedException('No token provided');
  }

  try {
    const result = await this.authService.validateToken(token);
    return {
      status: 'success',
      source: result.source,  // 'jwt', 'google', or 'facebook'
      user: result.user,
    };
  } catch (err) {
    throw new UnauthorizedException('Invalid token');
  }
}

@Public()
@Post('google-login')
async loginGoogle(@Body() input: GetAccessTokenRequest) {
  const result = await this.authService.loginWithGoogleCode(input?.code);
  return result;
}

@Public()
@Post('facebook-login')
async loginFacebook(@Body() input: GetAccessTokenRequest) {
  const result = await this.authService.loginWithFacebookCode(input?.code);
  return result;
}

  // @Public()
  // @Post('login/facebook')
  // async loginFacebook(@Body('token') token: string) {
  //   return this.authService.loginWithFacebook(token);
  // }

  // @Public()
  // @Post('login')
  // async login(@Body() body: { email: string; password: string }) {
  //   return this.authService.loginWithCredentials(body.email, body.password);
  // }

  @Post('user-login')
  async loginUsingPassword(@Body() input: Record<string, any>) {
    const username = input['username'];
    const password = input['password'];

    if (username === 'test_user' && password === 'test_password') {
      return { success: true };
    }

    return { success: false };
  }

}
