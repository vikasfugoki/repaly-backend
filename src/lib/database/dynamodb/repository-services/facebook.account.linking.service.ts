import { Injectable } from '@nestjs/common';
import {
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';
import { FacebookAccountLinkingRepositoryDTO } from '../../dto/facebook.account.linking.repository.dto';

/**
 * Manages the `facebook_account_user_mapping` DynamoDB table.
 *
 * Table schema:
 *   - user_id            (Partition Key, String)
 *   - facebook_account_id (Sort Key, String)
 *   - created_time        (String)
 *
 * Mirror of InstagramAccountLinkingRepositoryService — allows multiple influex
 * users (e.g. connected via different gmail/facebook logins) to share access
 * to the same Facebook Page without changing the primary
 * `facebook_account_repository` record (which keeps the original owner).
 */
@Injectable()
export class FacebookAccountLinkingRepositoryService {
  private readonly tableName = 'facebook_account_user_mapping';

  constructor(private readonly dynamoDbService: DynamoDBService) {}

  /** Link a user to an existing Facebook Page. Idempotent — safe to call multiple times. */
  addLink(userId: string, facebookAccountId: string): Promise<any> {
    const timestamp = new Date().toISOString();
    const params = new PutCommand({
      TableName: this.tableName,
      Item: {
        user_id: userId,
        facebook_account_id: facebookAccountId,
        created_time: timestamp,
      },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  /** Get all Facebook Page IDs linked to a user via the mapping table. */
  async getLinkedAccountIds(userId: string): Promise<string[]> {
    const params = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'user_id = :user_id',
      ExpressionAttributeValues: { ':user_id': userId },
    });

    try {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      const items = (response.Items as FacebookAccountLinkingRepositoryDTO[]) ?? [];
      return items.map((item) => item.facebook_account_id);
    } catch (error) {
      console.error(`Error fetching linked Facebook pages for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get all influex user_ids linked to a given Facebook Page.
   * Requires a GSI named `facebook_account_id-index` on the table with
   * facebook_account_id as the partition key.
   */
  async getUserIdsForAccount(facebookAccountId: string): Promise<string[]> {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'facebook_account_id-index',
      KeyConditionExpression: 'facebook_account_id = :account_id',
      ExpressionAttributeValues: { ':account_id': facebookAccountId },
    });

    try {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      const items = (response.Items as FacebookAccountLinkingRepositoryDTO[]) ?? [];
      return items.map((item) => item.user_id);
    } catch (error) {
      console.error(`Error fetching users for Facebook page ${facebookAccountId}:`, error);
      return [];
    }
  }

  /** Remove a link between a user and a Facebook Page. */
  removeLink(userId: string, facebookAccountId: string): Promise<any> {
    const params = new DeleteCommand({
      TableName: this.tableName,
      Key: {
        user_id: userId,
        facebook_account_id: facebookAccountId,
      },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }
}
