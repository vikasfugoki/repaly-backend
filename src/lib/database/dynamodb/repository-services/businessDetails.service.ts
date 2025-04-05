import { Injectable } from '@nestjs/common';
import { PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class BusinessDetailsRepositoryService {
  constructor(private readonly dynamoDBService: DynamoDBService) {}
  private readonly tableName = 'business_details_repository';

  async addBusinessDetails(businessDetailsObject: {
    user_id: string;
    queries: string;
  }) {
    const timestamp = new Date().toISOString();
    const params = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...businessDetailsObject,
        created_time: timestamp,
        updated_time: timestamp,
      },
    });
    return await this.dynamoDBService.dynamoDBDocumentClient.send(params);
  }

  async getBusinessDetailsByUserId(user_id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { user_id },
    });
    return await this.dynamoDBService.dynamoDBDocumentClient.send(params);
  }

  async getAllUserBusinessDetails() {
    const params = new ScanCommand({
      TableName: this.tableName,
    });
    return await this.dynamoDBService.dynamoDBDocumentClient.send(params);
  }
}
