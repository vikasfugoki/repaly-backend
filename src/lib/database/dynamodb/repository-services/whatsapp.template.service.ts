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

 async addTemplate(instagram_account_id: string, waba_id: string, template: any) {
    const params = new PutCommand({
        TableName: this.tableName,
        Item: {
            id: uuid.v4(),
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

async deleteTemplate(template_id: string) {
    const params = new DeleteCommand({
        TableName: this.tableName,
        Key: {
            id: template_id,
        },
    });
    await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

}