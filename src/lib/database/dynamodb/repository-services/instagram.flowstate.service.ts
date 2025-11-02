import {
  GetCommand,
  QueryCommand,
  PutCommand,
  ScanCommand,
  BatchWriteCommand,
  UpdateCommand,
  DeleteCommand,
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
    return result.Item || null;
  }

  async getFlowstatesByAccountId(accountId: string) {
    const params = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'accountId = :accountId',
      ExpressionAttributeValues: { ':accountId': accountId },
      ProjectionExpression: 'flow',
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
    // Step 1️⃣ — get all flowstates for that account
    const scanParams = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: 'accountId = :accountId',
      ExpressionAttributeValues: { ':accountId': accountId },
      ProjectionExpression: 'id',
    });

    const result =
      await this.dynamoDbService.dynamoDBDocumentClient.send(scanParams);
    const flowstates = result.Items || [];

    // Step 2️⃣ — update each one (except the active one)
    const updatePromises = flowstates.map((flowstate) => {
      const shouldBeActive = flowstate.id === flowstateId;

      const updateParams = new UpdateCommand({
        TableName: this.tableName,
        Key: { id: flowstate.id },
        UpdateExpression: 'SET isActiveAutomation = :isActiveAutomation',
        ExpressionAttributeValues: {
          ':isActiveAutomation': shouldBeActive,
        },
      });

      return this.dynamoDbService.dynamoDBDocumentClient.send(updateParams);
    });

    await Promise.all(updatePromises);

    return {
      success: true,
      message: 'Flowstate activation updated successfully',
    };
  }

  async deleteFlowstate(flowstateId: string) {
    try {
      const deleteParams = new DeleteCommand({
        TableName: this.tableName,
        Key: { id: flowstateId },
      });

      await this.dynamoDbService.dynamoDBDocumentClient.send(deleteParams);
      return {
        success: true,
        message: `Flowstate with id ${flowstateId} deleted successfully`,
      };
    } catch (error) {
      console.error(
        `Error deleting flowstate with id ${flowstateId}:`,
        error,
      );
      throw new Error('Failed to delete flowstate');
    }
  }
}
