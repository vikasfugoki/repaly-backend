import { Injectable } from '@nestjs/common';
import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';


@Injectable()
export class InstagramQuickReplyRepositoryService {
    private readonly tableName = 'instagram_quick_reply_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async getQuickReply(quick_reply_id: string) {
        const params = new GetCommand({
          TableName: this.tableName,
          Key: { id: quick_reply_id },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }

    async addQuickReply(quickReplyDetails: Record<string, any>) {
        try {
            if (!quickReplyDetails.id) {
                throw new Error('id is required to insert quick reply details');
            }
            const params = new PutCommand({
                TableName: this.tableName,
                Item: quickReplyDetails,
            });
            return this.dynamoDbService.dynamoDBDocumentClient.send(params);
        } catch (error) {
            console.error('Error inserting quick reply details:', error);
            throw new Error('Error inserting quick reply details');
        }
    }

    async getQuickReplyByAccountId(accountId: string) {
        try{
            const params = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'accountId-index',
                KeyConditionExpression: 'accountId = :id',
                ExpressionAttributeValues: { ':id': accountId },
              });
              return this.dynamoDbService.dynamoDBDocumentClient.send(params);
        } catch (error) {
            console.error(`Error fetching quick reply details fro given accountId:`, error);
            throw new Error('Error fetching quick reply details fro given accountId');
          }
    }

    async deleteQuickReply(quick_reply_id: string) {
        try {
            const params = new DeleteCommand({
                TableName: this.tableName,
                Key: { id: quick_reply_id },
            });
            return this.dynamoDbService.dynamoDBDocumentClient.send(params);
        } catch (error) {
            console.error(`Error deleting quick reply for given id:`, error);
            throw new Error('Error deleting quick reply for given id');
        }
    }

    async deleteAccount(accountId: string) {
        try {
            // Step 1: Query the table using "accountId-index" to get all items associated with accountId
            const queryParams = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'accountId-index',
                KeyConditionExpression: 'accountId = :accountId',
                ExpressionAttributeValues: { ':accountId': accountId },
            });

            const queryResult = await this.dynamoDbService.dynamoDBDocumentClient.send(queryParams);
            console.log('No of records:', queryResult.Items?.length || 0);

            if (!queryResult.Items || queryResult.Items.length === 0) {
                console.log(`No records found for accountId: ${accountId}`);
                return { message: `No records found for accountId: ${accountId}` };
            }

            // Step 2: Delete each entry found
            const deletePromises = queryResult.Items.map((item) => {
                const deleteParams = new DeleteCommand({
                    TableName: this.tableName,
                    Key: { id: item.id },
                });

                return this.dynamoDbService.dynamoDBDocumentClient.send(deleteParams);
            });

            await Promise.all(deletePromises);
            console.log(`Deleted ${deletePromises.length} records for accountId: ${accountId}`);
            return { message: `Deleted ${deletePromises.length} records for accountId: ${accountId}` };
        } catch (error) {
            console.error('Error during deleteAccount:', error);
            throw new Error('Error deleting account quick replies');
        }
    }

}