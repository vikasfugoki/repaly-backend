import { Injectable } from '@nestjs/common';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { InstagramAccountRepositoryDTO } from '../../dto/instagram.account.repository.dto';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramAccountRepositoryService {
  private readonly tableName = 'instagram_account_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  createAccount(accountDetails: {
    id: string;
    pro_user_id: string;
    access_token: string;
    user_id: string;
    username: string;
    name: string;
    profile_picture_url: string;
    media_count: number;
    biography: string;
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

  async getAccount(
    id: string,
  ): Promise<InstagramAccountRepositoryDTO | undefined> {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id },
    });
    try {
      const response =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      return (response.Item as InstagramAccountRepositoryDTO) ?? undefined;
    } catch (error) {
      console.error('Error fetching Instagram account:', error);
      throw new Error('Failed to fetch Instagram accounts');
    }
  }

  async getAccountDetailsByUserId(
    user_id: string,
  ): Promise<InstagramAccountRepositoryDTO[]> {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'user_id_index',
      KeyConditionExpression: 'user_id = :user_id',
      ExpressionAttributeValues: { ':user_id': user_id },
    });

    try {
      const response =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      return (response.Items as InstagramAccountRepositoryDTO[]) ?? [];
    } catch (error) {
      console.error(`user_id: ${user_id}`);
      console.error(`Error fetching Instagram account by userId ${user_id}:`, error);
      throw new Error('Failed to fetch Instagram accounts');
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
