// instagram-ownership.guard.ts
import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { AuthService } from './auth.service';
  
  @Injectable()
  export class InstagramOwnershipGuard implements CanActivate {
    constructor(private reflector: Reflector,
        private readonly authService: AuthService
    ) {}
    
  
    async canActivate(context: ExecutionContext): Promise<boolean> {

      if (process.env.ALLOW_ALL_AUTH === 'true') {
        return true;
      }

      const handler = context.getHandler();
      const resourceType = this.reflector.get<'media' | 'story' | 'account'>(
        'instagramResourceType',
        handler,
      );
      
      const request = context.switchToHttp().getRequest();
      const user = request.user.user.sub; // assumes you've authenticated and attached user
      const params = request.params;

      let resourceId: string;
      switch (resourceType) {
        case 'media':
          resourceId = params.mediaId || params.id;
          break;
        case 'story':
          resourceId = params.storyId || params.id;
          break;
        case 'account':
          resourceId = params.accountId || params.id;
          break;
        default:
          throw new UnauthorizedException('Unknown resource type');
      }

      console.log(user, resourceId, resourceType);
  
      const ownsResource = await this.authService.checkOwnership(user, resourceId, resourceType);
  
      if (!ownsResource) {
        throw new UnauthorizedException('You do not own this resource');
      }
  
      return true;
    }
}
  