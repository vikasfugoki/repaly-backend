import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EnvironmentService } from '../utils/environment/environment.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { WhatsappConnectionsRepositoryService } from '@database/dynamodb/repository-services/whatsapp.account.service';

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
    data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>;
    error?: { message?: string };
}

@Injectable()
export class WhatsappAuthService {
    constructor(
        private readonly whatsappConnectionsRepositoryService: WhatsappConnectionsRepositoryService,
        private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
        private readonly environmentService: EnvironmentService,
    ) {}

    /**
     * Connects a WhatsApp Business Account from the redirect-based OAuth flow.
     *
     * The frontend redirect flow only delivers the authorization `code` — it cannot
     * send `waba_id` / `phone_number_id` (those only arrive via the JS-SDK popup's
     * postMessage). So we resolve them server-side from the code:
     *   1. exchange code -> user access token   (redirect_uri must match the frontend's)
     *   2. upgrade to a long-lived (~60 day) token so templates keep working
     *   3. resolve waba_id from the token's granted scopes (debug_token)
     *   4. resolve phone_number_id (+ display number / verified name) from the WABA
     *   5. subscribe our app to the WABA for webhooks (non-fatal)
     *   6. register the phone number for Cloud API sending (non-fatal — sending is handled later)
     *   7. persist the connection and flag the Instagram account as WhatsApp-connected
     */
    async initiateAuth(input: { code: string; userId: string; instagram_account_id: string }) {
        const { code, userId, instagram_account_id } = input;

        if (!instagram_account_id) {
            throw new HttpException(
                'Missing Instagram account to link WhatsApp to.',
                HttpStatus.BAD_REQUEST,
            );
        }

        console.log('Initiating WhatsApp auth:', JSON.stringify({ userId, instagram_account_id }));

        try {
            const clientId = this.environmentService.getEnvVariable('FACEBOOK_CLIENT_ID');
            const clientSecret = this.environmentService.getEnvVariable('FACEBOOK_CLIENT_SECRET');
            // Must be byte-for-byte identical to the redirect_uri the frontend used in the
            // auth link, and whitelisted in Meta App -> Facebook Login -> Valid OAuth Redirect URIs.
            const redirectUri = this.environmentService.getEnvVariable('WHATSAPP_REDIRECT_URL');

            // Step 1 — exchange the authorization code for a (short-lived) user access token.
            const tokenParams = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code,
            });
            const tokenData = await this.graphGet<GraphTokenResponse>(
                `${GRAPH_BASE}/oauth/access_token?${tokenParams.toString()}`,
            );
            let accessToken = tokenData.access_token;
            if (!accessToken) {
                // Expired/used code OR a redirect_uri mismatch both surface here. The latter is a
                // config issue (not the user's fault) — log it so it's debuggable, show the user a retry message.
                console.error('WhatsApp token exchange failed:', JSON.stringify(tokenData));
                throw new HttpException(
                    'Authorization expired, please try connecting again.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Step 2 — upgrade to a long-lived (~60 day) token. The Template APIs reuse this token
            // for every Graph call, so storing the short-lived one would silently break them within
            // hours. If the swap fails we fail the whole connect (loud + retryable) rather than
            // persist a token that's already a time-bomb.
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

            // Step 3 — resolve waba_id from the token's granted scopes. Debug the token with an
            // app access token (`{app_id}|{app_secret}`) and read granular_scopes.
            const debugParams = new URLSearchParams({
                input_token: accessToken,
                access_token: `${clientId}|${clientSecret}`,
            });
            const debugData = await this.graphGet<DebugTokenResponse>(
                `${GRAPH_BASE}/debug_token?${debugParams.toString()}`,
            );
            const granularScopes = debugData.data?.granular_scopes ?? [];
            const wabaScope = granularScopes.find((s) => s.scope === 'whatsapp_business_management');
            const waba_id = wabaScope?.target_ids?.[0];
            if (!waba_id) {
                console.error('No WABA in granular_scopes:', JSON.stringify(debugData));
                throw new HttpException(
                    'No WhatsApp Business Account was selected.',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Step 4 — resolve the phone number on the WABA (and its display number / verified name).
            const phoneParams = new URLSearchParams({ access_token: accessToken });
            const phoneData = await this.graphGet<PhoneNumbersResponse>(
                `${GRAPH_BASE}/${waba_id}/phone_numbers?${phoneParams.toString()}`,
            );
            const phone = phoneData.data?.[0];
            if (!phone?.id) {
                console.error('No phone numbers on WABA:', JSON.stringify(phoneData));
                throw new HttpException(
                    'No phone number found on the WhatsApp Business Account.',
                    HttpStatus.BAD_REQUEST,
                );
            }
            const phone_number_id = phone.id;
            const display_phone_number = phone.display_phone_number ?? '';
            const verified_name = phone.verified_name ?? '';

            // Business name for display. Prefer the WABA's name; fall back to the phone's verified name.
            let business_name = verified_name;
            try {
                const wabaInfo = await this.graphGet<{ name?: string }>(
                    `${GRAPH_BASE}/${waba_id}?fields=name&access_token=${encodeURIComponent(accessToken)}`,
                );
                if (wabaInfo.name) business_name = wabaInfo.name;
            } catch (e) {
                console.warn('Failed to fetch WABA name; using verified_name.', e);
            }

            // Step 5 — subscribe our app to the WABA so we receive message/status webhooks.
            // Non-fatal: a transient failure here shouldn't block an otherwise-good connection.
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

            // Step 6 — register the phone number for Cloud API sending. Non-fatal: this only matters
            // for *sending* messages (handled later), and it fails for numbers that are already
            // registered or have their own 2-step PIN. We never let it break the connect.
            try {
                const pin = this.environmentService.getEnvVariable('WHATSAPP_REGISTRATION_PIN');
                const regRes = await fetch(`${GRAPH_BASE}/${phone_number_id}/register`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
                });
                const regData = await regRes.json();
                if (!regData?.success) {
                    console.warn('Phone number registration did not succeed (non-fatal):', JSON.stringify(regData));
                }
            } catch (e) {
                console.warn('Phone number registration threw (non-fatal):', e);
            }

            // Step 7 — persist the connection, keyed by the Instagram account id.
            await this.whatsappConnectionsRepositoryService.add_whatsapp_connection({
                id: instagram_account_id,
                access_token: accessToken,
                phone_number_id,
                waba_id,
                business_name,
                display_phone_number,
                verified_name,
                connected_at: new Date().toISOString(),
            });

            // Flag the Instagram account so the frontend shows the "WhatsApp Connected" badge
            // and the sidebar "Templates" item.
            await this.instagramAccountRepositoryService.updateAccountDetails({
                id: instagram_account_id,
                is_whatsapp_connected: true,
            });

            console.log('WhatsApp connected for account:', instagram_account_id);
            return { success: true };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('Error during WhatsApp auth:', error);
            throw new HttpException(
                'Failed to complete WhatsApp connection. Please try again.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private async graphGet<T>(url: string): Promise<T> {
        const res = await fetch(url, { method: 'GET' });
        const text = await res.text();
        try {
            return (text ? JSON.parse(text) : {}) as T;
        } catch {
            // Non-JSON body (e.g. a gateway HTML error page on a 5xx). Surface it loudly
            // instead of letting JSON.parse throw an opaque SyntaxError mid-flow. Log only the
            // path (the query string carries the access_token / client_secret).
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
