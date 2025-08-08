import { Injectable } from '@nestjs/common';
import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramAccountLevelAnalyticsRepositoryService {
    private readonly tableName = 'instagram_account_analytics_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}
    
    // Method to get account level analytics by ID
    async getAccountLevelAnalytics(id: string) {    
        const params = new GetCommand({
            TableName: this.tableName,
            Key: { id: id },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
    }

    // Method to get account level analytics by account ID
    async getAccountLevelAnalyticsByAccountId(accountId: string) {
        const params = new QueryCommand({
            TableName: this.tableName,
            IndexName: 'accountId-index',
            KeyConditionExpression: 'accountId = :id',
            ExpressionAttributeValues: { ':id': accountId },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
    }

    // Method to delete account level analytics by account ID
    async deleteAccount(accountId: string) {
        try {
            // Step 1: Query the table to get all items associated with accountId
            const queryParams = new QueryCommand({
                TableName: this.tableName,
                IndexName: "accountId-index",
                KeyConditionExpression: "accountId = :accountId",
                ExpressionAttributeValues: {
                    ":accountId": accountId,
                },
            });
        
            const queryResult = await this.dynamoDbService.dynamoDBDocumentClient.send(queryParams);
            console.log("No of records:", queryResult.Items?.length || 0);
        
            if (!queryResult.Items || queryResult.Items.length === 0) {
                console.log(`No records found for accountId: ${accountId}`);
                return { message: `No records found for accountId: ${accountId}` };
            }
        
            // Step 2: Delete each entry found
            const deletePromises = queryResult.Items.map((item) => {
                const deleteParams = new DeleteCommand({
                    TableName: this.tableName,
                    Key: {
                        id: item.id,
                    },
                });
        
                return this.dynamoDbService.dynamoDBDocumentClient.send(deleteParams);
            });
        
            await Promise.all(deletePromises);
            return { message: `Successfully deleted all records for accountId: ${accountId}` };
        } catch (error) {
            console.error("Error deleting account level analytics:", error);
            throw error;
        }
    }
}