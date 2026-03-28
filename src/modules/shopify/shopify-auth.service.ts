import { Injectable, ConflictException, HttpException, HttpStatus, ConsoleLogger } from '@nestjs/common';
import { ShopifyAuthController } from './shopify-auth.controller';
import { ShopifyConnectionsRepositoryService } from '@database/dynamodb/repository-services/shopify.connection.service';
import { ShopifyAuthRequest, ShopifyCallbackDto } from '@database/dto/shopify.account.repository.dto';


@Injectable()
export class ShopifyAuthService {

  constructor(
    private readonly shopifyConnectionsRepositoryService: ShopifyConnectionsRepositoryService
  ){}

    async initiateAuth(input: ShopifyAuthRequest & { userId: string }) {
  const { shop, instagramAccountId } = input;

  // validate domain
  this.validateShopDomain(shop);

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=read_orders,read_customers,read_products` +
    `&redirect_uri=${process.env.SHOPIFY_REDIRECT_URI}` +
    `&state=${instagramAccountId}`;        // carries IG account to callback

  return { url: authUrl };
}

private validateShopDomain(shop: string): void {
  const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  if (!shopRegex.test(shop)) {
    throw new HttpException('Invalid Shopify store domain', HttpStatus.BAD_REQUEST);
  }
}

async handleCallback(input: ShopifyCallbackDto): Promise<{ success: boolean }> {
  const { code, shop, state: instagramAccountId, hmac } = input;

  // Step 1 — verify HMAC (security)
//   this.verifyHmac({ code, shop, state: instagramAccountId }, hmac);

  // Step 2 — exchange code for access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  const { access_token } = await tokenResponse.json();
  console.log("access_token:", access_token);

  // Step 3 — fetch shop details + scopes in parallel
  const [shopResponse, scopesResponse] = await Promise.all([
    fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    }).then((r) => r.json()),

    fetch(`https://${shop}/admin/oauth/access_scopes.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    }).then((r) => r.json()),
  ]);

  const scopes = scopesResponse.access_scopes
    .map((s: { handle: string }) => s.handle)
    .join(',');

    console.log("shop_id:", String(shopResponse.shop.id));
    console.log("shop name:", shopResponse.shop.name);

  // Step 4 — save to DynamoDB
  await this.shopifyConnectionsRepositoryService.add_shopify_connection({
    instagram_account_id: instagramAccountId,
    shopify_shop_id: String(shopResponse.shop.id),
    shopify_domain: shopResponse.shop.myshopify_domain,
    shop_name: shopResponse.shop.name,
    access_token: access_token,
    scopes,
    token_status: 'active',
  });

  return { success: true };
}

}