import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramDmMessagesService {
    private readonly tableName = 'instagram_messages';

    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async deleteConversation(account_id: string, limit: number = 25, lastEvaluatedKey?: Record<string, any>) {
        let deletedCount = 0;
        let lastKey = lastEvaluatedKey;

        try {
            do {
                const params = new QueryCommand({
                    TableName: this.tableName,
                    IndexName: 'account_id-index',
                    KeyConditionExpression: 'account_id = :account_id',
                    ExpressionAttributeValues: { ':account_id': account_id },
                    Limit: limit,
                    ExclusiveStartKey: lastKey,
                });

                const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
                const items = result.Items ?? [];

                if (items.length === 0) {
                    break;
                }

                const deleteRequests = items.map(item => ({
                    DeleteRequest: {
                        Key: { id: item.id },
                    },
                }));

                const batchWriteParams = new BatchWriteCommand({
                    RequestItems: {
                        [this.tableName]: deleteRequests,
                    },
                });

                await this.dynamoDbService.dynamoDBDocumentClient.send(batchWriteParams);
                deletedCount += items.length;
                lastKey = result.LastEvaluatedKey;
            } while (lastKey);

            return { message: `Deleted ${deletedCount} conversations successfully.` };
        } catch (error) {
            // Log error if you have a logger, or rethrow with more context
            throw new Error(`Failed to delete conversations: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async getConversationById(conversationId: string) {
        const params = new GetCommand({
            TableName: this.tableName,
            Key: { id: conversationId },
        });

        const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
        return result.Item ?? null;
    }
}