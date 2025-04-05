import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class GoogleUserRepositoryService {
  private readonly tableName = 'google_user_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async createGoogleUser(userDetails: {
    id: string;
    user_id: string;
    email: string;
    name: string;
    picture: string;
  }) {
    const timestamp = new Date().toISOString();
    const params = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...userDetails,
        created_time: timestamp,
        updated_time: timestamp,
      },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getGoogleUser(id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  getGoogleUserByUserId(user_id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { user_id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getAllGoogleUsers() {
    const params = new ScanCommand({
      TableName: this.tableName,
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }
}
