import { Injectable } from '@nestjs/common';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

export interface WhatsappBroadcastBatch {
  batch_id: string;
  account_id: string; // phone_number_id that owns this batch
  template_name: string;
  language: string;
  has_variable: boolean;
  variable_name: string | null; // only for named variables, e.g. {{customer}}
  total: number;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'sending' | 'completed' | 'cancelled';
  created_at: string;
}

/**
 * One row per uploaded Excel file, holding the status of the whole batch.
 * The worker Lambda (AWS console) also updates the counts and the status.
 *   - `batch_id` (partition key)
 */
@Injectable()
export class WhatsappBroadcastBatchRepositoryService {
  private readonly tableName = 'whatsapp_broadcast_batches';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async createBatch(batch: WhatsappBroadcastBatch) {
    await this.dynamoDbService.dynamoDBDocumentClient.send(
      new PutCommand({ TableName: this.tableName, Item: batch }),
    );
  }

  async getBatch(
    batch_id: string,
  ): Promise<WhatsappBroadcastBatch | undefined> {
    const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
      new GetCommand({ TableName: this.tableName, Key: { batch_id } }),
    );
    return response.Item as WhatsappBroadcastBatch | undefined;
  }

  /** Returns false if the batch is no longer a draft, e.g. on a double click. */
  markSending(batch_id: string): Promise<boolean> {
    return this.setStatus(batch_id, 'sending', '#status = :draft', {
      ':draft': 'draft',
    });
  }

  /** Returns false if the batch has already completed or been cancelled. */
  cancel(batch_id: string): Promise<boolean> {
    return this.setStatus(
      batch_id,
      'cancelled',
      '#status IN (:draft, :sending)',
      {
        ':draft': 'draft',
        ':sending': 'sending',
      },
    );
  }

  /** Counts numbers that could not be queued, completing the batch if none are left. */
  async addFailed(batch_id: string, count: number) {
    const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { batch_id },
        UpdateExpression: 'ADD failed_count :count',
        ExpressionAttributeValues: { ':count': count },
        ReturnValues: 'ALL_NEW',
      }),
    );

    const batch = response.Attributes as WhatsappBroadcastBatch;
    if (batch.sent_count + batch.failed_count >= batch.total) {
      await this.setStatus(batch_id, 'completed', '#status = :sending', {
        ':sending': 'sending',
      });
    }
  }

  private async setStatus(
    batch_id: string,
    status: WhatsappBroadcastBatch['status'],
    condition: string,
    conditionValues: Record<string, string>,
  ): Promise<boolean> {
    try {
      await this.dynamoDbService.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { batch_id },
          UpdateExpression: 'SET #status = :status',
          ConditionExpression: condition,
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': status, ...conditionValues },
        }),
      );
      return true;
    } catch (error) {
      if ((error as Error)?.name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw error;
    }
  }
}
