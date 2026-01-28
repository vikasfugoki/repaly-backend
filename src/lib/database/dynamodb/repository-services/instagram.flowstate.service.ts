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
export class InstagramFlowstateRepositoryService {
  private readonly tableName = 'flow_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async getFlowstate(id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id: id },
    });
    const result =
      await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return result.Item?.flow || null;
  }

  async deleteFlowstate(id: string) {
    const params = new DeleteCommand({
      TableName: this.tableName,
      Key: { id: id },
    });
    await this.dynamoDbService.dynamoDBDocumentClient.send(params);
    return {
      success: true,
      message: 'Flowstate deleted successfully',
    };
  }

  async getFlowstatesByAccountId(accountId: string) {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'accountId-index', // your GSI name
      KeyConditionExpression: 'accountId = :accountId',
      ExpressionAttributeValues: {
        ':accountId': accountId,
      },
      ProjectionExpression: '#flow',
      ExpressionAttributeNames: {
        '#flow': 'flow',
      },
    });

    const result =
      await this.dynamoDbService.dynamoDBDocumentClient.send(params);

    return result.Items?.map((item) => item.flow) || [];
  }

  async insertFlowstateDetails(flowstateDetails: Record<string, any>) {
    try {
      const params = new PutCommand({
        TableName: this.tableName,
        Item: flowstateDetails,
      });

      await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      console.log(`Flowstate details inserted:`, flowstateDetails);
      return {
        success: true,
        message: 'Flowstate details stored successfully',
      };
    } catch (error) {
      console.error(`Error inserting flowstate details:`, error);
      throw new Error('Failed to insert flowstate details');
    }
  }

  async activateFlowstate(flowstateId: string, accountId: string) {
    await this.dynamoDbService.dynamoDBDocumentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: flowstateId },
        UpdateExpression:
          'SET isActiveAutomation = :true, #flow.isActiveAutomation = :true',
        ExpressionAttributeNames: {
          '#flow': 'flow',
        },
        ExpressionAttributeValues: {
          ':true': true,
        },
      }),
    );

    return {
      success: true,
      message: 'Flowstate activation updated successfully',
    };
  }
}
