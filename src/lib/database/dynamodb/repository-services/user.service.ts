import { Injectable } from '@nestjs/common';
import { PutCommand, GetCommand, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
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

  // async getUserByPlatformId(platform_id: string) {
  //   const params = new GetCommand({
  //     TableName: this.tableName,
  //     Key: { platform_id },
  //   });
  //   return await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  // }

  async getUserByPlatformId(platform_id: string) {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'platform_id-index',  // <--- specify the secondary index
      KeyConditionExpression: 'platform_id = :platform_id',
      ExpressionAttributeValues: {
        ':platform_id': platform_id,
      },
      Limit: 1, // optional, if you expect only one user
    });
    
    const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return result.Items?.[0]; // return the first matching user, or undefined
  }

  async getAllUsers() {
    const params = new ScanCommand({
      TableName: this.tableName,
    });
    return await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }
}
