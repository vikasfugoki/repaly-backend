import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class FacebookUserRepositoryService {
    private readonly tableName = 'google_user_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async createFacebookUser(userDetails: {
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

      async getFacebookUser(id: string) {
        const params = new GetCommand({
          TableName: this.tableName,
          Key: { id },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }

      getFacebookUserByUserId(user_id: string) {
        const params = new GetCommand({
          TableName: this.tableName,
          Key: { user_id },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }

      async getAllFacebookUsers() {
        const params = new ScanCommand({
          TableName: this.tableName,
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }
}