import { Injectable } from '@nestjs/common';
import {
  BatchWriteCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

export interface WhatsappBroadcastRecipient {
  batch_id: string;
  number: string;
  name: string;
  status: 'pending' | 'sent' | 'failed';
  message_id?: string | null;
  error?: string | null;
  sent_at?: string | null;
}

const DYNAMODB_WRITE_LIMIT = 25; // the most items one BatchWrite can take
const MAX_WRITE_ATTEMPTS = 5;

/**
 * One row per number of a batch, holding that number's own status. The worker
 * Lambda (AWS console) writes `sent` or `failed` here after calling Meta.
 *   - `batch_id` (partition key)
 *   - `number`   (sort key) = digits with country code, e.g. "919876543210"
 */
@Injectable()
export class WhatsappBroadcastRecipientRepositoryService {
  private readonly tableName = 'whatsapp_broadcast_recipients';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async saveRecipients(recipients: WhatsappBroadcastRecipient[]) {
    for (let i = 0; i < recipients.length; i += DYNAMODB_WRITE_LIMIT) {
      await this.writeChunk(recipients.slice(i, i + DYNAMODB_WRITE_LIMIT));
    }
  }

  async getRecipients(batch_id: string): Promise<WhatsappBroadcastRecipient[]> {
    const recipients: WhatsappBroadcastRecipient[] = [];
    let lastKey: Record<string, any> | undefined;

    do {
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'batch_id = :batch_id',
          ExpressionAttributeValues: { ':batch_id': batch_id },
          ExclusiveStartKey: lastKey,
        }),
      );
      recipients.push(
        ...((response.Items as WhatsappBroadcastRecipient[]) ?? []),
      );
      lastKey = response.LastEvaluatedKey;
    } while (lastKey);

    return recipients;
  }

  /** Returns false if the number was already marked, so it is not counted twice. */
  async markFailed(
    batch_id: string,
    number: string,
    error: string,
  ): Promise<boolean> {
    try {
      await this.dynamoDbService.dynamoDBDocumentClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { batch_id, number },
          UpdateExpression: 'SET #status = :failed, #error = :error',
          ConditionExpression: '#status = :pending',
          ExpressionAttributeNames: { '#status': 'status', '#error': 'error' },
          ExpressionAttributeValues: {
            ':failed': 'failed',
            ':pending': 'pending',
            ':error': error,
          },
        }),
      );
      return true;
    } catch (err) {
      if ((err as Error)?.name === 'ConditionalCheckFailedException') {
        return false;
      }
      throw err;
    }
  }

  // DynamoDB may hand back some items as "unprocessed", so write those again.
  private async writeChunk(recipients: WhatsappBroadcastRecipient[]) {
    let requests: any[] = recipients.map((Item) => ({ PutRequest: { Item } }));

    for (let attempt = 1; requests.length > 0; attempt++) {
      if (attempt > MAX_WRITE_ATTEMPTS) {
        throw new Error('Failed to save all broadcast recipients');
      }
      const response = await this.dynamoDbService.dynamoDBDocumentClient.send(
        new BatchWriteCommand({
          RequestItems: { [this.tableName]: requests },
        }),
      );
      requests = response.UnprocessedItems?.[this.tableName] ?? [];
      if (requests.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 200));
      }
    }
  }
}
