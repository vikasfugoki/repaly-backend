import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramDmMessageDetailsService {

    private readonly tableName = 'instagram_messages_details';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async deleteConversationDetails(account_id: string, pageSize: number = 25) {
        let lastEvaluatedKey: any = undefined;
        let totalDeleted = 0;

        do {
            const params = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'account_id-index',
                KeyConditionExpression: 'account_id = :id',
                ExpressionAttributeValues: { ':id': account_id },
                Limit: pageSize,
                ExclusiveStartKey: lastEvaluatedKey,
            });

            const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
            const items = result.Items ?? [];

            if (items.length === 0 && !lastEvaluatedKey) {
                return { message: 'No conversation details found for the provided account ID.' };
            }

            const deleteRequests = items.map(item => ({
                DeleteRequest: {
                    Key: { id: item.id, account_id: item.account_id },
                },
            }));

            if (deleteRequests.length > 0) {
                const batchWriteParams = new BatchWriteCommand({
                    RequestItems: {
                        [this.tableName]: deleteRequests,
                    },
                });
                await this.dynamoDbService.dynamoDBDocumentClient.send(batchWriteParams);
                totalDeleted += deleteRequests.length;
            }

            lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return { message: `Conversation details deleted successfully. Total deleted: ${totalDeleted}` };
    }

    async getConversationDetails(account_id: string, pageSize: number = 25, lastEvaluatedKey?: any) {
        const params = new QueryCommand({
            TableName: this.tableName,
            IndexName: 'account_id-index',
            KeyConditionExpression: 'account_id = :id',
            ExpressionAttributeValues: { ':id': account_id },
            Limit: pageSize,
            ExclusiveStartKey: lastEvaluatedKey,
        });

        const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
        return {
            items: result.Items ?? [],
            lastEvaluatedKey: result.LastEvaluatedKey ?? null,
        };
    }

    async getConversationDetailsById(conversationId: string) {
        const params = new GetCommand({
            TableName: this.tableName,
            Key: { id: conversationId },
        });

        const result = await this.dynamoDbService.dynamoDBDocumentClient.send(params);
        return result.Item ?? null;
    }
}