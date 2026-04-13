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
export class InstagramTemplatesRepositoryService {
    private readonly tableName = 'instagram_templates_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async add_template(templateDetails:Record<string, any>) {
        const timestamp = new Date().toISOString();
        const params = new PutCommand({
        TableName: this.tableName,
        Item: {
            ...templateDetails,
            created_time: timestamp,
            updated_time: timestamp,
        },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

 async get_template(instagram_account_id: string, type?: 'media' | 'story') {
  const params = new QueryCommand({
    TableName: this.tableName,
    IndexName: 'type',
    KeyConditionExpression: 'accountId = :accountId',
    ExpressionAttributeValues: {
      ':accountId': instagram_account_id,
      ...(type && { ':type': type }),
    },
    ...(type && {
      FilterExpression: '#type = :type',
      ExpressionAttributeNames: { '#type': 'type' },
    }),
  });

  const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  return result.Items ?? [];
}
}