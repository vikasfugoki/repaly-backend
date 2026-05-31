import { Injectable, ConflictException, HttpException, HttpStatus, ConsoleLogger } from '@nestjs/common';
import { EnvironmentService } from '../utils/environment/environment.service';
import { InstagramAccountRepositoryService } from '@database/dynamodb/repository-services/instagram.account.service';
import { WhatsappConnectionsRepositoryService } from '@database/dynamodb/repository-services/whatsapp.account.service';

@Injectable()
export class WhatsappAuthService {
    constructor(
        private readonly whatsappConnectionsRepositoryService: WhatsappConnectionsRepositoryService,
        private readonly instagramAccountRepositoryService: InstagramAccountRepositoryService,
        private readonly environmentService: EnvironmentService,
    ){}

    async initiateAuth(input: { code: string; userId: string; waba_id: string; phone_number_id: string, instagram_account_id: string }) {
    const { code, userId, waba_id, phone_number_id, instagram_account_id} = input;

    console.log('Initiating WhatsApp auth with input:', JSON.stringify({ code, userId, waba_id, phone_number_id, instagram_account_id }));

    try {
        // Step 1 — exchange code for access token
        const params = new URLSearchParams({
            client_id: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_ID'),
            client_secret: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_SECRET'),
            grant_type: 'authorization_code',
            code
            // redirect_uri: this.environmentService.getEnvVariable('WHATSAPP_REDIRECT_URI'),
        });

        console.log('Exchanging code for access token...');
        const tokenResponse = await fetch(
            `https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`,
            { method: 'GET' }
        );
        const tokenData = await tokenResponse.json();
        console.log('Token response:', JSON.stringify(tokenData));

        const { access_token } = tokenData;
        if (!access_token) {
            console.error('No access_token in token response. Full response:', JSON.stringify(tokenData));
            throw new HttpException('Failed to get access token from Facebook', HttpStatus.BAD_REQUEST);
        }
        console.log('Access token received successfully');

        // Step 2 — fetch business name using waba_id from callback
        console.log('Fetching business name for waba_id:', waba_id);
        const wabaResponse = await fetch(
            `https://graph.facebook.com/v23.0/${waba_id}?fields=name&access_token=${access_token}`
        );
        const wabaData = await wabaResponse.json();
        console.log('WABA response:', JSON.stringify(wabaData));

        const business_name = wabaData.name;
        if (!business_name) {
            console.error('No business_name in WABA response. Full response:', JSON.stringify(wabaData));
        }
        console.log('Business name:', business_name);

        // Step 3 (docs) — Subscribe to webhooks on the customer's WABA
        const wabaSubscribeResponse = await fetch(
            `https://graph.facebook.com/v23.0/${waba_id}/subscribed_apps`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${access_token}` }
            }
        );

        const wabaSubscribeData = await wabaSubscribeResponse.json();
        console.log('WABA webhook subscription:', JSON.stringify(wabaSubscribeData));
        if (!wabaSubscribeData.success) {
            throw new HttpException('Failed to subscribe to WABA webhooks', HttpStatus.BAD_GATEWAY);
        }

        // Step 4 (docs) — Register the phone number with a PIN
        const pin = this.environmentService.getEnvVariable('432165'); // 6-digit
        const registerResponse = await fetch(
            `https://graph.facebook.com/v23.0/${phone_number_id}/register`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    pin
                })
            }
        );
        const registerData = await registerResponse.json();
        console.log('Phone number registration:', JSON.stringify(registerData));
        if (!registerData.success) {
            throw new HttpException(
                `Failed to register phone number: ${JSON.stringify(registerData)}`,
                HttpStatus.BAD_GATEWAY
            );
        }

        // Step 3 — store in DynamoDB
        console.log('Saving WhatsApp connection to DynamoDB:', JSON.stringify({ userId, waba_id, phone_number_id, business_name }));
        await this.whatsappConnectionsRepositoryService.add_whatsapp_connection({
            id: instagram_account_id,  // Use Instagram account ID as the primary key for WhatsApp connections
            access_token,
            phone_number_id,
            waba_id,
            business_name,
            connected_at: new Date().toISOString(),
        });
        console.log('WhatsApp connection saved successfully');

        // Step 4 — mark whatsapp as connected on instagram account
        console.log('Updating instagram account is_whatsapp_connected for:', instagram_account_id);
        await this.instagramAccountRepositoryService.updateAccountDetails({
            id: instagram_account_id,
            is_whatsapp_connected: true,
        });
        console.log('Instagram account updated successfully');

        return { success: true };

    } catch (error) {
        console.error('Error during WhatsApp auth:', error);
        if (error instanceof HttpException) throw error;
        throw new HttpException(
            'Error: Failed to complete WhatsApp OAuth.',
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
    }
}