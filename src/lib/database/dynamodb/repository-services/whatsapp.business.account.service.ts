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
 * Repository for connected WhatsApp Business accounts, treated as first-class
 * accounts exactly like Facebook Pages and Instagram accounts — owned by an
 * influex user, NOT hung off an Instagram account.
 *
 * Persists to `whatsapp_business_account_repository`. One row per WhatsApp
 * phone number (the sending identity, the analogue of a Facebook Page):
 *   - `id`      = phone_number_id
 *   - `waba_id` = the parent WhatsApp Business Account
 *   - `user_id` = the influex user, indexed by `user_id_index`
 *
 * This supersedes `WhatsappConnectionsRepositoryService`
 * (`whatsapp_account_repository`), which keyed connections by Instagram
 * account id and therefore could not exist without Instagram.
 */
@Injectable()
export class WhatsappBusinessAccountRepositoryService {
  private readonly tableName = 'whatsapp_business_account_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  createAccount(accountDetails: {
    id: string;
    user_id: string;
    waba_id: string;
    access_token: string;
    display_phone_number?: string;
    verified_name?: string;
    business_name?: string;
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
      console.error('Error fetching WhatsApp account:', error);
      throw new Error('Failed to fetch WhatsApp account');
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
      console.error(
        `Error fetching WhatsApp accounts by userId ${user_id}:`,
        error,
      );
      throw new Error('Failed to fetch WhatsApp accounts');
    }
  }

  /**
   * All phone-number rows that belong to one WABA. Used on disconnect so the
   * app is only unsubscribed from the WABA once its last number is removed.
   * Requires the `waba_id_index` GSI.
   */
  async getAccountsByWabaId(waba_id: string): Promise<Record<string, any>[]> {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'waba_id_index',
      KeyConditionExpression: 'waba_id = :waba_id',
      ExpressionAttributeValues: { ':waba_id': waba_id },
    });

    try {
      const response =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      return (response.Items as Record<string, any>[]) ?? [];
    } catch (error) {
      console.error(`Error fetching WhatsApp accounts for WABA ${waba_id}:`, error);
      return [];
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

  /**
   * Partial upsert — re-connecting must never wipe fields the connect flow
   * doesn't send (e.g. `is_registered`).
   */
  async updateAccountDetails(accountDetails: Record<string, any>) {
    try {
      const { id: account_id, ...updateFields } = accountDetails;

      if (!account_id) {
        throw new Error('account_id is required to update account');
      }

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

      expressionAttributeValues[':updated_time'] = new Date().toISOString();
      expressionAttributeNames['#updated_time'] = 'updated_time';
      updateExpression.push('#updated_time = :updated_time');

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

      return result.Attributes;
    } catch (error) {
      console.error('Error updating WhatsApp account:', error);
      throw new Error('Failed to update WhatsApp account');
    }
  }
}
