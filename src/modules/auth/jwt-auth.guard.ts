// auth/jwt-auth.guard.ts
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
      private reflector: Reflector,
    ) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
  
      if (isPublic) {
        return true;
      }
  
      const request = context.switchToHttp().getRequest<Request>();
      const authHeader = request.headers['authorization'];
  
      if (!authHeader) {
        throw new UnauthorizedException('Missing Authorization header');
      }
  
      const token = authHeader.split(' ')[1];
      if (!token) {
        throw new UnauthorizedException('Invalid token format');
      }
  
      try {
        const user = await this.authService.validateGoogleToken(token);
        request['user'] = user;
        return true;
      } catch (error) {
        throw new UnauthorizedException('Invalid token');
      }
    }
  }
  