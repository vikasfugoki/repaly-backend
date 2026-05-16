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

    async initiateAuth(input: { code: string; instagramAccountId: string }) {
        const { code, instagramAccountId } = input;
        
        console.log('Initiating WhatsApp auth with code:', code, 'and Instagram Account ID:', instagramAccountId);
        try {
        // Step 1 — exchange code for access token
        const tokenResponse = await fetch(
            `https://graph.facebook.com/v23.0/oauth/access_token`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_ID'),
                    client_secret: this.environmentService.getEnvVariable('FACEBOOK_CLIENT_SECRET'),
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: this.environmentService.getEnvVariable('WHATSAPP_REDIRECT_URI'),
                }),
            }
        );
        const { access_token } = await tokenResponse.json();

        console.log('Received access token from Facebook:', access_token);

        const debugRes = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${access_token}&access_token=${access_token}`
        );
        console.log(await debugRes.json());
    
        // Step 2 — fetch WABA ID + business name
        const wabaResponse = await fetch(
            `https://graph.facebook.com/v23.0/me/whatsapp_business_accounts?access_token=${access_token}`
        );

        const  wabaresponse = await wabaResponse.json();
        console.log("WABA API response:", JSON.stringify(wabaresponse, null, 2));
        const { id: waba_id, name: business_name } = wabaresponse

        // Step 2 — fetch WABA ID
        // const wabaResponse = await fetch(
        //     `https://graph.facebook.com/v23.0/me/whatsapp_business_accounts?access_token=${access_token}`
        // );
        // const wabaData = await wabaResponse.json();
        // console.log("WABA API response:", JSON.stringify(wabaData, null, 2));
        // const waba_id = wabaData.data?.[0]?.id;
        // const business_name = wabaData.data?.[0]?.name;

        console.log('WABA ID:', waba_id, 'Business Name:', business_name);

        if (!waba_id) {
            throw new HttpException(
                'No WhatsApp Business Account found for this user.',
                HttpStatus.BAD_REQUEST
            );
        }

        // Step 3 — fetch phone number ID
        const phoneResponse = await fetch(
            `https://graph.facebook.com/v23.0/${waba_id}/phone_numbers?access_token=${access_token}`
        );
        const phoneData = await phoneResponse.json();
        const phone_number_id = phoneData.data?.[0]?.id;

        // Step 4 — store in DynamoDB
        await this.whatsappConnectionsRepositoryService.add_whatsapp_connection({
        id: instagramAccountId,
        access_token,
        phone_number_id,
        waba_id,
        business_name,
        connected_at: new Date().toISOString(),
        });

        // step 5 - save to instagram account's connected platforms (TODO)
        this.instagramAccountRepositoryService.updateAccountDetails({
            id: instagramAccountId,
            is_whatsapp_connected: true,
        });

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