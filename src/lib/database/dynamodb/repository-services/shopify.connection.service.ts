import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class ShopifyConnectionsRepositoryService {
    private readonly tableName = 'shopify_connection_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async add_shopify_connection(connectionDetails: {
        instagram_account_id: string;
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

  async getShopifyConnection(instagram_account_id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: {
        instagram_account_id,
      },
    });
    const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return result.Item ?? null;  // explicit null instead of undefined
  }
}


