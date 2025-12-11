import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramDmFlowAnalyticsService {
    private readonly tableName = 'dm_flow_analytics';
  constructor(private readonly dynamoDbService: DynamoDBService) {}


  getAnalyticsByBlockId(block_node_id: string) {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'block_node_id-index',
      KeyConditionExpression: 'block_node_id = :id',
      ExpressionAttributeValues: { ':id': block_node_id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }
}