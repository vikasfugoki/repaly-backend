import { Injectable } from '@nestjs/common';
import { PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class UserRepositoryService {
  private readonly tableName = 'user_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async createUser(userObject: {
    id: string;
    platform_name: string;
    platform_id: string;
  }) {
    const timestamp = new Date().toISOString();
    const params = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...userObject,
        created_time: timestamp,
        updated_time: timestamp,
      },
    });
    return await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getUser(id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id },
    });
    return await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getUserByPlatformId(platform_id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { platform_id },
    });
    return await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getAllUsers() {
    const params = new ScanCommand({
      TableName: this.tableName,
    });
    return await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }
}
