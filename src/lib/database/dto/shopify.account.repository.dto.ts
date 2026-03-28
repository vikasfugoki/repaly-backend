
export class ShopifyAuthRequest {
  shop: string;                  // "repaly-store.myshopify.com"
  instagramAccountId: string;    // "2324930430231"
}

export class ShopifyCallbackDto {
  code: string;       // auth code from Shopify to exchange for access token
  shop: string;       // repaly-store.myshopify.com
  state: string;      // instagramAccountId — carried from initiateAuth
  hmac: string;       // signature to verify request is from Shopify
}