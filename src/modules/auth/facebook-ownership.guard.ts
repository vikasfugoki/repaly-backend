// facebook-ownership.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

/**
 * Mirror of InstagramOwnershipGuard for Facebook resources. Resolves the
 * resource id from the route param (post id for `media`, page id for `account`)
 * and verifies the authenticated user owns the underlying Facebook Page.
 */
@Injectable()
export class FacebookOwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.ALLOW_ALL_AUTH === 'true') {
      return true;
    }

    const handler = context.getHandler();
    const resourceType = this.reflector.get<'media' | 'account' | 'user'>(
      'facebookResourceType',
      handler,
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user.id;
    const loginSource = request.user.loginSource;
    const params = request.params;

    // `user`-scoped routes (e.g. connect / list-pages) act only on the
    // authenticated user's own data; identity is already verified by the global
    // JwtAuthGuard, so there is no per-resource ownership to check.
    if (resourceType === 'user') {
      return true;
    }

    let resourceId: string;
    switch (resourceType) {
      case 'media':
        resourceId = params.mediaId || params.id;
        break;
      case 'account':
        resourceId = params.accountId || params.id;
        break;
      default:
        throw new UnauthorizedException('Unknown resource type');
    }

    console.log(user, resourceId, resourceType);

    const ownsResource = await this.authService.checkFacebookOwnership(
      user,
      resourceId,
      resourceType,
      loginSource,
    );

    if (!ownsResource) {
      throw new UnauthorizedException('You do not own this resource');
    }

    return true;
  }
}
