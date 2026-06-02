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
export class WhatsappConnectionsRepositoryService{
    private readonly tableName = 'whatsapp_account_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async add_whatsapp_connection(connectionDetails: {
        id: string;
        access_token: string;
        phone_number_id: string;
        waba_id: string;
        business_name: string;
        connected_at: string;
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

    async getWhatsappConnection(instagram_account_id: string) {
        const params = new GetCommand({
          TableName: this.tableName,
          Key: {
            id: instagram_account_id,
          },
        });
        const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
        return result.Item ?? null;  // explicit null instead of undefined
      }
}