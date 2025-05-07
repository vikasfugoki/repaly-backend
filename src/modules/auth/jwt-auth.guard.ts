// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';

// import { Reflector } from '@nestjs/core';
// import { Request } from 'express';
// import { AuthService } from './auth.service';
// import { IS_PUBLIC_KEY } from './public.decorator';

// @Injectable()
// export class JwtAuthGuard implements CanActivate {
//   constructor(
//     private readonly authService: AuthService,
//     private reflector: Reflector,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest<Request>();

//     // if (request.method === 'OPTIONS') {
//     //   console.log("passing through");
//     //   return true;
//     // }

//     const authHeader = request.headers['authorization'];

//     // Allow all auth for testing / verification (e.g., Meta)
//     if (process.env.ALLOW_ALL_AUTH === 'true') {
//       const token = authHeader?.split(' ')[1];

//       if (token) {
//         try {
//           const user = await this.authService.validateGoogleToken(token);
//           request['user'] = user;
//           console.log(`[AUTH] Bypass enabled. Valid token used. User: ${user?.user?.sub}`);
//         } catch (error) {
//           console.warn(`[AUTH] Bypass enabled. Invalid token provided.`);
//           throw new UnauthorizedException('Invalid token even under bypass mode.');
//         }

//         return true;
//       }

//       return false;
//     }

//     // Handle public routes
//     const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
//       context.getHandler(),
//       context.getClass(),
//     ]);
//     if (isPublic) {
//       console.log(`[AUTH] Public route. No authentication required.`);
//       return true;
//     }

//     // Standard JWT token auth flow
//     if (!authHeader) {
//       console.warn(`[AUTH] Missing Authorization header`);
//       throw new UnauthorizedException('Missing Authorization header');
//     }

//     const token = authHeader.split(' ')[1];
//     if (!token) {
//       console.warn(`[AUTH] Invalid token format`);
//       throw new UnauthorizedException('Invalid token format');
//     }

//     try {
//       const user = await this.authService.validateGoogleToken(token);
//       request['user'] = user;
//       console.log(`[AUTH] User authenticated. User: ${user?.user?.sub}`);
//       return true;
//     } catch (error) {
//       console.warn(`[AUTH] Token validation failed`);
//       throw new UnauthorizedException('Invalid token');
//     }
//   }
// }


import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    // Allow all auth for testing / verification (e.g., Meta)
    if (process.env.ALLOW_ALL_AUTH === 'true') {
      const token = authHeader?.split(' ')[1];

      if (token) {
        try {
          const { user, source } = await this.authService.validateToken(token);
          request['user'] = user;
          console.log(`[AUTH] Bypass enabled. Valid token from ${source}. User ID: ${user?.id}`);
        } catch (error) {
          console.warn(`[AUTH] Bypass enabled. Invalid token provided.`);
          throw new UnauthorizedException('Invalid token even under bypass mode.');
        }

        return true;
      }

      return false;
    }

    // Handle public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      console.log(`[AUTH] Public route. No authentication required.`);
      return true;
    }

    // Standard auth flow
    if (!authHeader) {
      console.warn(`[AUTH] Missing Authorization header`);
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.warn(`[AUTH] Invalid token format`);
      throw new UnauthorizedException('Invalid token format');
    }

    try {
      const { user, source } = await this.authService.validateToken(token);
      request['user'] = user;
      // console.log("request in jst-auth:", request);
      console.log(`[AUTH] Authenticated via ${source}. User ID: ${user?.id}`);
      return true;
    } catch (error) {
      console.warn(`[AUTH] Token validation failed`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
