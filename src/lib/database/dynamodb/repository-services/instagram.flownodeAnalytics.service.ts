import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramNodeFlowAnalyticsService {
    private readonly tableName = 'flow_node_analytics_repository';

    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async getAnalyticsByNodeId(node_id: string) {
    const params = new GetCommand({
        TableName: this.tableName,
        Key: { node_id },
    });

    const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return result.Item ?? null;
    }

    async getAnalyticsByFlowId(flow_id: string) {
  const params = new QueryCommand({
    TableName: this.tableName,
    IndexName: 'flow_id-index',
    KeyConditionExpression: 'flow_id = :flow_id',
    ExpressionAttributeValues: {
      ':flow_id': flow_id,
    },
  });

  const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
  return result.Items ?? [];
}


}