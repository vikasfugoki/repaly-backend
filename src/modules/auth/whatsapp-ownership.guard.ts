// whatsapp-ownership.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

/**
 * Mirror of FacebookOwnershipGuard for WhatsApp accounts. The route param
 * `accountId` is a WhatsApp phone_number_id; ownership is checked against the
 * rows the authenticated user owns in `whatsapp_business_account_repository`.
 */
@Injectable()
export class WhatsappOwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.ALLOW_ALL_AUTH === 'true') {
      return true;
    }

    const handler = context.getHandler();
    const resourceType = this.reflector.get<'account' | 'user'>(
      'whatsappResourceType',
      handler,
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user.id;
    const loginSource = request.user.loginSource;
    const params = request.params;

    // `user`-scoped routes (connect / list) act only on the authenticated
    // user's own data; identity is already verified by the global JwtAuthGuard.
    if (resourceType === 'user') {
      return true;
    }

    const resourceId = params.accountId || params.id;
    if (!resourceId) {
      throw new UnauthorizedException('Unknown resource type');
    }

    const ownsResource = await this.authService.checkWhatsappOwnership(
      user,
      resourceId,
      loginSource,
    );

    if (!ownsResource) {
      throw new UnauthorizedException('You do not own this resource');
    }

    return true;
  }
}
