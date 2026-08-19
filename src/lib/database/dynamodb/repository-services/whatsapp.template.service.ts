import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';
import uuid from 'uuid';

@Injectable()
export class WhatsappTemplateRepositoryService {
  private readonly tableName = 'whatsapp_template_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

 async addTemplate(instagram_account_id: string, waba_id: string, template_id: string, template: any) {
    const params = new PutCommand({
        TableName: this.tableName,
        Item: {
            id: template_id,
            instagram_account_id,
        waba_id,
        template,
        },
    });
    await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    }

async getTemplates(instagram_account_id: string) {
    const params = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'instagram_account_id',
        KeyConditionExpression: 'instagram_account_id = :instagram_account_id',
        ExpressionAttributeValues: {
            ':instagram_account_id': instagram_account_id,
        },
    });
    const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return result.Items ?? [];
  }

  async getTemplateById(template_id: string) {
    const params = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'id = :id',
        ExpressionAttributeValues: {
        ':id': template_id,
        },
    });
    const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return result.Items?.[0] ?? null;
    }

    async deleteTemplate(template_id: string) {
        // first fetch to get the SK (instagram_account_id)
        const item = await this.getTemplateById(template_id);
        if (!item) throw new Error(`Template ${template_id} not found`);

        const params = new DeleteCommand({
            TableName: this.tableName,
            Key: {
            id: template_id,
            instagram_account_id: item.instagram_account_id,
            },
        });
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
        }

}