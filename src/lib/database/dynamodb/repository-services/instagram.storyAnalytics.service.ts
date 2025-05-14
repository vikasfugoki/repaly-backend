import { Injectable } from '@nestjs/common';
import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramStoryAnalyticsRepositoryService {
    private readonly tableName = 'instagram_story_analytics_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async getStoryAnalytics(story_id: string) {
        const params = new GetCommand({
          TableName: this.tableName,
          Key: { story_id: story_id },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }

    
      async deleteAccount(accountId: string) {
        try{
        // Step 1: Query the table to get all items associated with accountId
        const queryParams = new QueryCommand({
          TableName: this.tableName,
          IndexName: "account_id-index",
          KeyConditionExpression: "account_id = :accountId",
          ExpressionAttributeValues: {
            ":accountId": accountId,
          },
        });
    
        const queryResult = await this.dynamoDbService.dynamoDBDocumentClient.send(queryParams);
    
        if (!queryResult.Items || queryResult.Items.length === 0) {
          throw new Error(`No records found for accountId: ${accountId}`);
        }
    
        // Step 2: Delete each entry found
        const deletePromises = queryResult.Items.map((item) => {
          const deleteParams = new DeleteCommand({
            TableName: this.tableName,
            Key: {
              story_id: item.story_id,
            },
          });
    
          return this.dynamoDbService.dynamoDBDocumentClient.send(deleteParams);
        });
    
        await Promise.all(deletePromises);
        return { message: `Deleted ${deletePromises.length} records for accountId: ${accountId} from 'instagram_story_repository' table` };
      } catch (error) {
        console.error(`Error deleting for accountId ${accountId} from 'instagram_story_repository' table:`, error);
        throw new Error(`Failed to delete all story for ${accountId} from 'instagram_story_repository' table.`);
      } 
      }

      async updateStoryAnalytics(storyDetails: Record<string, any>) {
        try {
          const { id, ...rest } = storyDetails; // Extract id and other fields separately
      
          if (!id) {
            throw new Error('id is required to insert or update story details');
          }

          const story_id = id; // Rename for DynamoDB compatibility
          const updateFields = { ...rest };
      
          // Construct the UpdateExpression and ExpressionAttributeValues for dynamic fields
          const updateExpression: string[] = [];
          const expressionAttributeValues: Record<string, any> = {};
          const expressionAttributeNames: Record<string, string> = {};
      
          // Loop through fields to create the update expression
          for (const [key, value] of Object.entries(updateFields)) {
            const placeholder = `#${key}`;
            expressionAttributeNames[placeholder] = key;
            expressionAttributeValues[`:${key}`] = value;
            updateExpression.push(`${placeholder} = :${key}`);
          }
      
          if (updateExpression.length === 0) {
            throw new Error('No valid fields to update');
          }
      
          // Define the update parameters for DynamoDB UpdateItem
          const params = {
            TableName: this.tableName,
            Key: { story_id }, // Assuming 'id' is the primary key
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
      //       ReturnValues: ``, // Correct ReturnValues value
          };
      
          // Execute the update operation using UpdateCommand
          const result = await this.dynamoDbService.dynamoDBDocumentClient.send(new UpdateCommand(params));
      
          // Return the updated item (result.Attributes contains the updated item)
          console.log(`Story analytics updated:`, result);  // Ensure result has Attributes
          return { success: true, message: 'Story analytics updated successfully' };
        } catch (error) {
          console.error(`Error inserting stroy details:`, error);
          throw new Error('Failed to insert story details');
        }
      }

    

}