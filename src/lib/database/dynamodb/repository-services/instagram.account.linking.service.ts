import { Injectable } from '@nestjs/common';
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';
import { InstagramAccountLinkingRepositoryDTO } from '../../dto/instagram.account.linking.repository.dto';

/**
 * Manages the `instagram_account_user_mapping` DynamoDB table.
 *
 * Table schema:
 *   - user_id              (Partition Key, String)
 *   - instagram_account_id (Sort Key, String)
 *   - created_time         (String)
 *
 * This allows multiple influex users to share access to the same Instagram account
 * without changing the primary `instagram_account_repository` table.
 */
@Injectable()
export class InstagramAccountLinkingRepositoryService {
  private readonly tableName = 'instagram_account_user_mapping';

  constructor(private readonly dynamoDbService: DynamoDBService) {}

  /** Link a user to an existing Instagram account. Idempotent — safe to call multiple times. */
  addLink(userId: string, instagramAccountId: string): Promise<any> {
    const timestamp = new Date().toISOString();
    const params = new PutCommand({
      TableName: this.tableName,
      Item: {
        user_id: userId,
        instagram_account_id: instagramAccountId,
        created_time: timestamp,
      },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  /** Get all Instagram account IDs linked to a user via the mapping table. */
  async getLinkedAccountIds(userId: string): Promise<string[]> {
    const params = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'user_id = :user_id',
      ExpressionAttributeValues: { ':user_id': userId },
    });

    try {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      const items = (response.Items as InstagramAccountLinkingRepositoryDTO[]) ?? [];
      return items.map((item) => item.instagram_account_id);
    } catch (error) {
      console.error(`Error fetching linked Instagram accounts for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get all influex user_ids linked to a given Instagram account.
   * Requires a GSI named `instagram_account_id-index` on the table with
   * instagram_account_id as the partition key.
   */
  async getUserIdsForAccount(instagramAccountId: string): Promise<string[]> {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'instagram_account_id-index',
      KeyConditionExpression: 'instagram_account_id = :account_id',
      ExpressionAttributeValues: { ':account_id': instagramAccountId },
    });

    try {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      const items = (response.Items as InstagramAccountLinkingRepositoryDTO[]) ?? [];
      return items.map((item) => item.user_id);
    } catch (error) {
      console.error(`Error fetching users for Instagram account ${instagramAccountId}:`, error);
      return [];
    }
  }

  /** Remove a link between a user and an Instagram account. */
  removeLink(userId: string, instagramAccountId: string): Promise<any> {
    const params = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        user_id: userId,
        instagram_account_id: instagramAccountId,
      },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }
}
