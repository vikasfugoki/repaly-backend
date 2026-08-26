import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WhatsappAccountService } from './whatsapp.service';
import { WhatsappOwnershipGuard } from '../auth/whatsapp-ownership.guard';
import { WhatsappResourceType } from '../auth/whatsapp-resource-type.decorator';

/**
 * WhatsApp Business accounts as standalone connected accounts — the direct
 * analogue of `/facebook/pages`. `:accountId` is always a WhatsApp
 * phone_number_id. No Instagram account is involved anywhere in this file.
 */
@ApiTags('WhatsApp Account')
@Controller('whatsapp')
@UseGuards(WhatsappOwnershipGuard)
export class WhatsappController {
  constructor(private readonly whatsappAccountService: WhatsappAccountService) {}

  // ---------------------------------------------------------------------------
  // Connection (onboarding) — user-scoped
  // ---------------------------------------------------------------------------

  @WhatsappResourceType('user')
  @Post('accounts/connect')
  async connectAccounts(
    @Req() req: any,
    @Body() input: { code: string; waba_id?: string; phone_number_id?: string },
  ) {
    try {
      return await this.whatsappAccountService.connectAccounts(
        req.user.id,
        req.user.loginSource,
        input,
      );
    } catch (error) {
      throw this.toHttpException(error, 'Failed to connect WhatsApp account');
    }
  }

  // NOTE: there is no `GET /whatsapp/accounts`. Connected WhatsApp accounts are
  // returned by the unified `GET /account` list, alongside Instagram.

  @WhatsappResourceType('account')
  @Get(':accountId')
  async getAccount(@Param('accountId') accountId: string) {
    try {
      return await this.whatsappAccountService.getAccount(accountId);
    } catch (error) {
      throw this.toHttpException(error, 'Failed to get WhatsApp account');
    }
  }

  @WhatsappResourceType('account')
  @Delete(':accountId/disconnect')
  async disconnectAccount(@Param('accountId') accountId: string) {
    try {
      return await this.whatsappAccountService.disconnectAccount(accountId);
    } catch (error) {
      throw this.toHttpException(error, 'Failed to disconnect WhatsApp account');
    }
  }

  @WhatsappResourceType('account')
  @Post(':accountId/register')
  async registerPhoneNumber(
    @Param('accountId') accountId: string,
    @Body() body: { pin: string },
  ) {
    try {
      return await this.whatsappAccountService.registerPhoneNumber(accountId, body?.pin);
    } catch (error) {
      throw this.toHttpException(error, 'Failed to register WhatsApp phone number');
    }
  }

  // ---------------------------------------------------------------------------
  // Message templates
  // ---------------------------------------------------------------------------

  @WhatsappResourceType('account')
  @Get(':accountId/templates')
  async getTemplates(@Param('accountId') accountId: string) {
    try {
      return await this.whatsappAccountService.getTemplates(accountId);
    } catch (error) {
      throw this.toHttpException(error, 'Failed to get WhatsApp templates');
    }
  }

  @WhatsappResourceType('account')
  @Get(':accountId/templates/:templateId')
  async getTemplate(
    @Param('accountId') accountId: string,
    @Param('templateId') templateId: string,
  ) {
    try {
      return await this.whatsappAccountService.getTemplate(accountId, templateId);
    } catch (error) {
      throw this.toHttpException(error, 'Failed to get WhatsApp template');
    }
  }

  @WhatsappResourceType('account')
  @Post(':accountId/templates')
  async createTemplate(
    @Param('accountId') accountId: string,
    @Body() template: any,
  ) {
    try {
      return await this.whatsappAccountService.createTemplate(accountId, template);
    } catch (error) {
      throw this.toHttpException(error, 'Failed to create WhatsApp template');
    }
  }

  @WhatsappResourceType('account')
  @Delete(':accountId/templates/:templateId')
  async deleteTemplate(
    @Param('accountId') accountId: string,
    @Param('templateId') templateId: string,
    @Query('name') templateName: string,
  ) {
    try {
      return await this.whatsappAccountService.deleteTemplate(
        accountId,
        templateId,
        templateName,
      );
    } catch (error) {
      throw this.toHttpException(error, 'Failed to delete WhatsApp template');
    }
  }

  @WhatsappResourceType('account')
  @Post(':accountId/templates/send')
  async sendTemplate(
    @Param('accountId') accountId: string,
    @Body() body: { to: string; templateName: string; language: string; components?: any[] },
  ) {
    try {
      return await this.whatsappAccountService.sendTemplate(accountId, body);
    } catch (error) {
      throw this.toHttpException(error, 'Failed to send WhatsApp template');
    }
  }

  /**
   * Map the service's tagged errors onto HTTP statuses so the frontend gets a
   * usable message instead of a blanket 500. Meta's own error message is passed
   * through — it is what tells the user *why* a template was rejected.
   */
  private toHttpException(error: unknown, fallback: string): HttpException {
    if (error instanceof HttpException) return error;

    const code = (error as any)?.code;
    const message = (error as Error)?.message ?? fallback;

    if (code === 'WHATSAPP_NOT_CONNECTED') {
      return new HttpException('WhatsApp is not connected', HttpStatus.BAD_REQUEST);
    }
    if (code === 'BAD_REQUEST') {
      return new HttpException(message, HttpStatus.BAD_REQUEST);
    }
    if (code === 'META_API_ERROR') {
      return new HttpException(
        { message, details: (error as any)?.details ?? null },
        HttpStatus.BAD_GATEWAY,
      );
    }

    console.error(`${fallback}:`, error);
    return new HttpException(fallback, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
