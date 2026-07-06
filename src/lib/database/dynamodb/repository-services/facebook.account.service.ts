import { Injectable } from '@nestjs/common';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

/**
 * Repository for connected Facebook Pages (the Facebook equivalent of an
 * Instagram business account). Mirrors InstagramAccountRepositoryService but
 * persists to `facebook_account_repository`. Keyed by `id` (the Facebook Page
 * id); `user_id` (the influex user) is indexed by `user_id_index`.
 *
 * Account-level post automation defaults (`ai_enabled`, `tag_and_value_pair`)
 * live on this record.
 */
@Injectable()
export class FacebookAccountRepositoryService {
  private readonly tableName = 'facebook_account_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  createAccount(accountDetails: {
    id: string;
    user_id: string;
    access_token: string;
    name: string;
    category?: string;
    picture?: string;
  }) {
    const timestamp = new Date().toISOString();
    const params = new PutCommand({
      TableName: this.tableName,
      Item: {
        ...accountDetails,
        created_time: timestamp,
        updated_time: timestamp,
      },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async getAccount(id: string): Promise<Record<string, any> | undefined> {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id },
    });
    try {
      const response =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      return (response.Item as Record<string, any>) ?? undefined;
    } catch (error) {
      console.error('Error fetching Facebook account:', error);
      throw new Error('Failed to fetch Facebook accounts');
    }
  }

  async getAccountDetailsByUserId(
    user_id: string,
  ): Promise<Record<string, any>[]> {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'user_id_index',
      KeyConditionExpression: 'user_id = :user_id',
      ExpressionAttributeValues: { ':user_id': user_id },
    });

    try {
      const response =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      return (response.Items as Record<string, any>[]) ?? [];
    } catch (error) {
      console.error(`user_id: ${user_id}`);
      console.error(
        `Error fetching Facebook account by userId ${user_id}:`,
        error,
      );
      throw new Error('Failed to fetch Facebook accounts');
    }
  }

  getAllAccount() {
    const params = new ScanCommand({
      TableName: this.tableName,
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  deleteAccount(id: string) {
    const params = new DeleteCommand({
      TableName: this.tableName,
      Key: { id },
    });

    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async updateAccountDetails(accountDetails: Record<string, any>) {
    try {
      const { id: account_id, ...updateFields } = accountDetails;

      if (!account_id) {
        throw new Error('account_id is required to update account');
      }

      // Prevent overwriting immutable fields
      delete updateFields.id;
      delete updateFields.created_time;

      const updateExpression: string[] = [];
      const expressionAttributeValues: Record<string, any> = {};
      const expressionAttributeNames: Record<string, string> = {};

      for (const [key, value] of Object.entries(updateFields)) {
        const nameKey = `#${key}`;
        const valueKey = `:${key}`;

        expressionAttributeNames[nameKey] = key;
        expressionAttributeValues[valueKey] = value;
        updateExpression.push(`${nameKey} = ${valueKey}`);
      }

      // always update timestamp
      expressionAttributeValues[':updated_time'] = new Date().toISOString();
      expressionAttributeNames['#updated_time'] = 'updated_time';
      updateExpression.push('#updated_time = :updated_time');

      if (updateExpression.length === 0) {
        throw new Error('No valid fields to update');
      }

      const params = new UpdateCommand({
        TableName: this.tableName,
        Key: { id: account_id },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);

      console.log('Account updated:', result.Attributes);

      return result.Attributes;
    } catch (error) {
      console.error('Error updating account:', error);
      throw new Error('Failed to update account');
    }
  }
}
