import {
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

/**
 * Shopify connections for Facebook Pages.
 * Faithful mirror of `ShopifyConnectionsRepositoryService`, but the table is
 * keyed by `facebook_account_id` (Facebook Page id) instead of
 * `instagram_account_id`.
 */
@Injectable()
export class FacebookShopifyConnectionsRepositoryService {
  private readonly tableName = 'facebook_shopify_connection_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async add_shopify_connection(connectionDetails: {
    facebook_account_id: string;
    shopify_shop_id: string;
    shopify_domain: string;
    shop_name: string;
    access_token: string;
    scopes: string;
    token_status: string;
  }) {
    const timestamp = new Date().toISOString();
    const params = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...connectionDetails,
        created_time: timestamp,
        updated_time: timestamp,
      },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getShopifyConnection(facebook_account_id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: {
        facebook_account_id,
      },
    });
    const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return result.Item ?? null; // explicit null instead of undefined
  }
}
