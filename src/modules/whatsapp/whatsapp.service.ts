import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EnvironmentService } from '../utils/environment/environment.service';
import { WhatsappBusinessAccountRepositoryService } from '@database/dynamodb/repository-services/whatsapp.business.account.service';
import { GoogleUserRepositoryService } from '@database/dynamodb/repository-services/google.user.service';
import { FacebookUserRepositoryService } from '@database/dynamodb/repository-services/facebook.user.service';

const GRAPH_VERSION = 'v23.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

interface GraphTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; type?: string; code?: number };
}

interface DebugTokenResponse {
  data?: {
    granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
  };
  error?: { message?: string };
}

interface PhoneNumbersResponse {
  data?: Array<{
    id: string;
    display_phone_number?: string;
    verified_name?: string;
    quality_rating?: string;
    code_verification_status?: string;
  }>;
  error?: { message?: string };
}

/**
 * WhatsApp Business accounts as first-class connected accounts — owned by the
 * influex user, with no dependency on any Instagram account. This mirrors
 * `FacebookAccountService` (Pages): connect once from the Embedded Signup
 * popup, then every phone number on the WABA becomes its own account row keyed
 * by `phone_number_id`.
 *
 * Supersedes `WhatsappAuthService`, which keyed a single connection by
 * Instagram account id.
 */
@Injectable()
export class WhatsappAccountService {
  constructor(
    private readonly whatsappBusinessAccountRepositoryService: WhatsappBusinessAccountRepositoryService,
    private readonly googleUserRepository: GoogleUserRepositoryService,
    private readonly facebookUserRepository: FacebookUserRepositoryService,
    private readonly environmentService: EnvironmentService,
  ) {}

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Connect WhatsApp from the JS-SDK Embedded Signup popup flow.
   *
   * The `code` always comes from the popup (never a browser redirect), so it is
   * exchanged WITHOUT a redirect_uri — passing one fails with a redirect_uri
   * mismatch. `waba_id` / `phone_number_id` arrive via the popup's postMessage
   * when Meta supplies them; when present they are authoritative, otherwise we
   * resolve them server-side:
   *   1. exchange code -> user access token (no redirect_uri)
   *   2. upgrade to a long-lived (~60 day) token so the Graph calls keep working
   *   3. waba_id: supplied -> resolved from phone_number_id -> derived from the
   *      token's granular scopes (debug_token)
   *   4. list every phone number on the WABA and upsert one account row each
   *   5. subscribe our app to the WABA for webhooks (non-fatal)
   */
  async connectAccounts(
    providerUserId: string,
    loginSource: 'google' | 'facebook',
    input: { code: string; waba_id?: string; phone_number_id?: string },
  ) {
    const { code } = input;

    if (!code) {
      throw new HttpException(
        'code is required to connect WhatsApp.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const influexUserId = await this.resolveInfluexUserId(
      providerUserId,
      loginSource,
    );
    if (!influexUserId) {
      throw new HttpException('User not found', HttpStatus.FORBIDDEN);
    }

    console.log(`[whatsapp connect] START — influexUserId=${influexUserId}`);

    const clientId = this.environmentService.getEnvVariable('FACEBOOK_CLIENT_ID');
    const clientSecret = this.environmentService.getEnvVariable('FACEBOOK_CLIENT_SECRET');

    // Step 1 — exchange the popup's authorization code for a short-lived token.
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    });
    const tokenData = await this.graphGet<GraphTokenResponse>(
      `${GRAPH_BASE}/oauth/access_token?${tokenParams.toString()}`,
    );
    let accessToken = tokenData.access_token;
    if (!accessToken) {
      // Popup codes are single-use and short-lived.
      console.error('WhatsApp token exchange failed:', JSON.stringify(tokenData));
      throw new HttpException(
        'Authorization expired, please try connecting again.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Step 2 — upgrade to a long-lived (~60 day) token. Every later Graph call
    // (templates, sending) reuses this token, so persisting the short-lived one
    // would silently break them within hours.
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: accessToken,
    });
    const longLived = await this.graphGet<GraphTokenResponse>(
      `${GRAPH_BASE}/oauth/access_token?${longLivedParams.toString()}`,
    );
    if (!longLived.access_token) {
      console.error(
        'Long-lived token exchange returned no token. Response:',
        JSON.stringify(longLived),
      );
      throw new HttpException(
        'Could not finalize WhatsApp authorization, please try connecting again.',
        HttpStatus.BAD_GATEWAY,
      );
    }
    accessToken = longLived.access_token;
    const tokenExpiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null;

    // Step 3 — resolve the WABA id.
    const waba_id = await this.resolveWabaId(accessToken, input, clientId, clientSecret);

    // Step 4 — list every phone number on the WABA. Each becomes its own
    // account row, the same way each Facebook Page becomes its own row.
    const phoneData = await this.graphGet<PhoneNumbersResponse>(
      `${GRAPH_BASE}/${waba_id}/phone_numbers` +
        `?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status` +
        `&access_token=${encodeURIComponent(accessToken)}`,
    );
    const phoneNumbers = (phoneData.data ?? []).filter((p) => p?.id);
    if (phoneNumbers.length === 0) {
      console.error('No phone numbers on WABA:', JSON.stringify(phoneData));
      throw new HttpException(
        'No phone number found on the WhatsApp Business Account.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Business name for display. Prefer the WABA's name.
    let business_name = '';
    try {
      const wabaInfo = await this.graphGet<{ name?: string }>(
        `${GRAPH_BASE}/${waba_id}?fields=name&access_token=${encodeURIComponent(accessToken)}`,
      );
      business_name = wabaInfo.name ?? '';
    } catch (e) {
      console.warn('Failed to fetch WABA name (non-fatal):', e);
    }

    const connected: Array<Record<string, any>> = [];
    for (const phone of phoneNumbers) {
      // Partial update so re-connecting never wipes fields the connect flow
      // does not send (e.g. `is_registered`).
      await this.whatsappBusinessAccountRepositoryService.updateAccountDetails({
        id: phone.id,
        user_id: influexUserId,
        waba_id,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        token_status: 'active',
        display_phone_number: phone.display_phone_number ?? null,
        verified_name: phone.verified_name ?? null,
        business_name: business_name || phone.verified_name || null,
        quality_rating: phone.quality_rating ?? null,
        code_verification_status: phone.code_verification_status ?? null,
        connected_at: new Date().toISOString(),
      });

      connected.push({
        id: phone.id,
        waba_id,
        display_phone_number: phone.display_phone_number ?? null,
        verified_name: phone.verified_name ?? null,
        business_name: business_name || phone.verified_name || null,
      });
    }

    // Step 5 — subscribe our app to the WABA so Meta delivers message/status
    // webhooks. Non-fatal: a transient failure must not break a good connect.
    try {
      const subRes = await fetch(`${GRAPH_BASE}/${waba_id}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const subData = await subRes.json();
      if (!subData?.success) {
        console.warn('WABA subscribed_apps did not return success:', JSON.stringify(subData));
      }
    } catch (e) {
      console.warn('Failed to subscribe app to WABA webhooks (non-fatal):', e);
    }

    console.log(
      `[whatsapp connect] DONE — connected ${connected.length} number(s):`,
      connected.map((c) => c.id),
    );
    return { success: true, count: connected.length, accounts: connected };
  }

  /**
   * List the WhatsApp accounts owned by an influex user. Tokens stripped.
   * Consumed by `AccountService` so WhatsApp appears in the unified
   * `GET /account` list alongside Instagram — there is deliberately no
   * separate WhatsApp listing endpoint.
   */
  async getAccountsByInfluexUserId(influexUserId: string) {
    if (!influexUserId) return [];

    const accounts =
      await this.whatsappBusinessAccountRepositoryService.getAccountDetailsByUserId(
        influexUserId,
      );

    return accounts.map((a) => this.toPublicAccount(a));
  }

  /** Single connected WhatsApp account. Token stripped. */
  async getAccount(accountId: string) {
    const account =
      await this.whatsappBusinessAccountRepositoryService.getAccount(accountId);
    if (!account) {
      throw Object.assign(
        new Error(`WhatsApp account ${accountId} is not connected`),
        { code: 'WHATSAPP_NOT_CONNECTED' },
      );
    }
    return this.toPublicAccount(account);
  }

  /**
   * Disconnect one WhatsApp number. The app is unsubscribed from the WABA only
   * when the last number of that WABA is removed, so disconnecting one number
   * never kills webhooks for its siblings.
   */
  async disconnectAccount(accountId: string) {
    const account =
      await this.whatsappBusinessAccountRepositoryService.getAccount(accountId);
    if (!account) {
      return { success: true, connected: false, message: 'WhatsApp is already disconnected' };
    }

    const siblings = account.waba_id
      ? await this.whatsappBusinessAccountRepositoryService.getAccountsByWabaId(
          account.waba_id,
        )
      : [];
    const isLastNumberOfWaba = siblings.filter((s) => s.id !== accountId).length === 0;

    if (isLastNumberOfWaba && account.waba_id && account.access_token) {
      try {
        const res = await fetch(`${GRAPH_BASE}/${account.waba_id}/subscribed_apps`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${account.access_token}` },
        });
        const body = await res.json();
        if (!body?.success) {
          console.warn('WABA unsubscribe did not return success:', JSON.stringify(body));
        }
      } catch (e) {
        console.warn('Failed to unsubscribe app from WABA webhooks (non-fatal):', e);
      }
    }

    await this.whatsappBusinessAccountRepositoryService.deleteAccount(accountId);

    console.log('WhatsApp disconnected for account:', accountId);
    return { success: true, connected: false, message: 'WhatsApp disconnected successfully' };
  }

  /**
   * Register the phone number for Cloud API sending (2-step verification PIN).
   * Kept as an explicit endpoint rather than part of connect, because it fails
   * for numbers that are already registered or carry their own PIN.
   */
  async registerPhoneNumber(accountId: string, pin: string) {
    const { accessToken } = await this.requireConnection(accountId);

    if (!pin) {
      throw Object.assign(new Error('pin is required.'), { code: 'BAD_REQUEST' });
    }

    const res = await fetch(`${GRAPH_BASE}/${accountId}/register`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    });
    const data = await res.json();
    console.log('Phone number registration response:', JSON.stringify(data));

    if (!res.ok || !data?.success) {
      throw Object.assign(
        new Error(data?.error?.message || 'Failed to register phone number'),
        { code: 'META_API_ERROR', details: data?.error },
      );
    }

    await this.whatsappBusinessAccountRepositoryService.updateAccountDetails({
      id: accountId,
      is_registered: true,
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Message templates — sourced statelessly from Meta, nothing mirrored in DDB
  // ---------------------------------------------------------------------------

  // NOTE: the rejection field is `rejected_reason` (singular) on the Graph node.
  private readonly TEMPLATE_FIELDS =
    'id,name,language,status,category,components,quality_score,rejected_reason';

  async getTemplates(accountId: string) {
    const { accessToken, wabaId } = await this.requireConnection(accountId);

    const url =
      `${GRAPH_BASE}/${wabaId}/message_templates` +
      `?fields=${this.TEMPLATE_FIELDS}&limit=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json();

    if (!res.ok) {
      throw Object.assign(
        new Error(body?.error?.message || 'Failed to fetch templates from WhatsApp'),
        { code: 'META_API_ERROR', details: body?.error },
      );
    }

    return { success: true, templates: body?.data ?? [] };
  }

  async getTemplate(accountId: string, templateId: string) {
    const { accessToken } = await this.requireConnection(accountId);

    const url = `${GRAPH_BASE}/${templateId}?fields=${this.TEMPLATE_FIELDS}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await res.json();

    if (!res.ok) {
      throw Object.assign(
        new Error(body?.error?.message || 'Failed to fetch template from WhatsApp'),
        { code: 'META_API_ERROR', details: body?.error },
      );
    }

    return { success: true, template: body };
  }

  async createTemplate(accountId: string, templateData: any) {
    const { accessToken, wabaId } = await this.requireConnection(accountId);

    if (!templateData?.name || !templateData?.language || !templateData?.category) {
      throw Object.assign(
        new Error('name, language and category are required to create a template.'),
        { code: 'BAD_REQUEST' },
      );
    }

    const res = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templateData),
    });
    const result = await res.json();

    if (!res.ok) {
      throw Object.assign(
        new Error(result?.error?.message || 'Failed to create template on WhatsApp'),
        { code: 'META_API_ERROR', details: result?.error },
      );
    }

    return { success: true, template: result };
  }

  async deleteTemplate(accountId: string, templateId: string, templateName: string) {
    const { accessToken, wabaId } = await this.requireConnection(accountId);

    if (!templateName) {
      throw Object.assign(
        new Error('templateName is required to delete a template.'),
        { code: 'BAD_REQUEST' },
      );
    }

    // Meta deletes by name; hsm_id narrows it to a single language version.
    const params = new URLSearchParams({ name: templateName });
    if (templateId) params.set('hsm_id', templateId);

    const res = await fetch(
      `${GRAPH_BASE}/${wabaId}/message_templates?${params.toString()}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const result = await res.json();

    if (!res.ok) {
      throw Object.assign(
        new Error(result?.error?.message || 'Failed to delete template from WhatsApp'),
        { code: 'META_API_ERROR', details: result?.error },
      );
    }

    return { success: true };
  }

  /**
   * Send an approved template to a recipient. The template is verified against
   * Meta first (exists + language matches + APPROVED) so the frontend cannot
   * fire an arbitrary or unapproved template.
   */
  async sendTemplate(
    accountId: string,
    body: { to: string; templateName: string; language: string; components?: any[] },
  ) {
    const { accessToken, wabaId } = await this.requireConnection(accountId);

    const to = (body?.to ?? '').toString().trim();
    if (!to) {
      throw Object.assign(new Error('Recipient "to" phone number is required.'), {
        code: 'BAD_REQUEST',
      });
    }
    if (!body?.templateName || !body?.language) {
      throw Object.assign(new Error('templateName and language are required.'), {
        code: 'BAD_REQUEST',
      });
    }

    const verifyUrl =
      `${GRAPH_BASE}/${wabaId}/message_templates` +
      `?name=${encodeURIComponent(body.templateName)}&fields=name,language,status&limit=100`;
    const verifyRes = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const verifyBody = await verifyRes.json();
    if (!verifyRes.ok) {
      throw Object.assign(
        new Error(verifyBody?.error?.message || 'Failed to verify template on WhatsApp'),
        { code: 'META_API_ERROR', details: verifyBody?.error },
      );
    }

    // `name=` matches loosely, so confirm an exact name + language match here.
    const match = (verifyBody?.data ?? []).find(
      (t: any) => t?.name === body.templateName && t?.language === body.language,
    );
    if (!match) {
      throw Object.assign(
        new Error(`Template "${body.templateName}" (${body.language}) was not found.`),
        { code: 'BAD_REQUEST' },
      );
    }
    if (String(match.status).toUpperCase() !== 'APPROVED') {
      throw Object.assign(
        new Error(
          `Template "${body.templateName}" (${body.language}) is not approved (status: ${String(match.status).toLowerCase()}).`,
        ),
        { code: 'BAD_REQUEST' },
      );
    }

    const templatePayload: Record<string, any> = {
      name: body.templateName,
      language: { code: body.language },
    };
    if (Array.isArray(body?.components) && body.components.length > 0) {
      templatePayload.components = body.components;
    }

    const res = await fetch(`${GRAPH_BASE}/${accountId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: templatePayload,
      }),
    });
    const result = await res.json();
    console.log('Meta template send response:', JSON.stringify(result));

    if (!res.ok) {
      throw Object.assign(
        new Error(result?.error?.message || 'Failed to send WhatsApp template'),
        { code: 'META_API_ERROR', details: result?.error },
      );
    }

    return {
      success: true,
      message_id: result?.messages?.[0]?.id ?? null,
      to: result?.contacts?.[0]?.wa_id ?? to,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Resolve the influex user id behind a provider (google/facebook) login. */
  private async resolveInfluexUserId(
    providerUserId: string,
    loginSource: 'google' | 'facebook',
  ): Promise<string | undefined> {
    if (loginSource === 'google') {
      return (await this.googleUserRepository.getGoogleUser(providerUserId)).Item
        ?.user_id;
    }
    if (loginSource === 'facebook') {
      return (await this.facebookUserRepository.getFacebookUser(providerUserId))
        .Item?.user_id;
    }
    return undefined;
  }

  /** Load an account row and assert it carries what the Graph calls need. */
  private async requireConnection(accountId: string) {
    const account =
      await this.whatsappBusinessAccountRepositoryService.getAccount(accountId);
    const accessToken = account?.access_token;
    const wabaId = account?.waba_id;

    if (!accessToken || !wabaId) {
      throw Object.assign(
        new Error(`WhatsApp account ${accountId} is not connected`),
        { code: 'WHATSAPP_NOT_CONNECTED' },
      );
    }

    return { account, accessToken: accessToken as string, wabaId: wabaId as string };
  }

  /**
   * Prefer the WABA id supplied by the Embedded Signup popup (authoritative).
   * Otherwise resolve the parent WABA of the supplied phone number, and only as
   * a last resort derive it from the token's granular scopes.
   */
  private async resolveWabaId(
    accessToken: string,
    input: { waba_id?: string; phone_number_id?: string },
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    if (input.waba_id) return input.waba_id;

    if (input.phone_number_id) {
      try {
        const phoneWaba = await this.graphGet<{ whatsapp_business_account?: { id?: string } }>(
          `${GRAPH_BASE}/${input.phone_number_id}?fields=whatsapp_business_account` +
            `&access_token=${encodeURIComponent(accessToken)}`,
        );
        if (phoneWaba.whatsapp_business_account?.id) {
          return phoneWaba.whatsapp_business_account.id;
        }
      } catch (e) {
        console.warn('Could not resolve WABA from phone_number_id; falling back to token scopes.', e);
      }
    }

    const debugParams = new URLSearchParams({
      input_token: accessToken,
      access_token: `${clientId}|${clientSecret}`,
    });
    const debugData = await this.graphGet<DebugTokenResponse>(
      `${GRAPH_BASE}/debug_token?${debugParams.toString()}`,
    );
    const wabaScope = (debugData.data?.granular_scopes ?? []).find(
      (s) => s.scope === 'whatsapp_business_management',
    );
    const waba_id = wabaScope?.target_ids?.[0];
    if (!waba_id) {
      console.error('No WABA in granular_scopes:', JSON.stringify(debugData));
      throw new HttpException(
        'No WhatsApp Business Account was selected.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return waba_id;
  }

  /**
   * Strip the access token before returning to the client, and carry the same
   * generic keys the Instagram entries use (`name` / `username` /
   * `profile_picture_url` / timestamps) so the unified `GET /account` list can
   * render every platform through one component.
   */
  private toPublicAccount(a: Record<string, any>) {
    return {
      id: a.id,
      user_id: a.user_id ?? null,
      // Generic keys, mirrored from the Instagram shape:
      name: a.business_name ?? a.verified_name ?? null,
      username: a.display_phone_number ?? null,
      profile_picture_url: null,
      created_time: a.created_time ?? null,
      updated_time: a.updated_time ?? null,
      // WhatsApp-specific:
      waba_id: a.waba_id ?? null,
      display_phone_number: a.display_phone_number ?? null,
      verified_name: a.verified_name ?? null,
      business_name: a.business_name ?? null,
      quality_rating: a.quality_rating ?? null,
      code_verification_status: a.code_verification_status ?? null,
      is_registered: a.is_registered ?? false,
      token_status: a.token_status ?? 'active',
      needs_reconnect: (a.token_status ?? 'active') === 'expired',
      connected_at: a.connected_at ?? a.created_time ?? null,
      platformName: 'whatsapp',
    };
  }

  private async graphGet<T>(url: string): Promise<T> {
    const res = await fetch(url, { method: 'GET' });
    const text = await res.text();
    try {
      return (text ? JSON.parse(text) : {}) as T;
    } catch {
      // Non-JSON body (e.g. a gateway HTML error page on a 5xx). Log only the
      // path — the query string carries the access_token / client_secret.
      console.error(
        `Graph API non-JSON response (HTTP ${res.status}) for ${url.split('?')[0]}:`,
        text?.slice(0, 500),
      );
      throw new HttpException(
        'WhatsApp service is temporarily unavailable, please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
