import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramFlowstateRepositoryService {
  private readonly tableName = 'flow_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async getFlowstate(id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id: id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getFlowstatesByProId(pro_user_id: string) {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'pro_user_id-index',
      KeyConditionExpression: 'pro_user_id = :id',
      ExpressionAttributeValues: { ':id': pro_user_id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async insertFlowstateDetails(flowstateDetails: Record<string, any>) {
    try {
      const params = new PutCommand({
        TableName: this.tableName,
        Item: flowstateDetails,
      });

      await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      console.log(`Flowstate details inserted:`, flowstateDetails);
      return { success: true, message: 'Flowstate details stored successfully' };
    } catch (error) {
      console.error(`Error inserting flowstate details:`, error);
      throw new Error('Failed to insert flowstate details');
    }
  }

}