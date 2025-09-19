import { Injectable } from '@nestjs/common';
import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramStoryRepositoryService {
    private readonly tableName = 'instagram_story_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    async getStory(story_id: string) {
        const params = new GetCommand({
          TableName: this.tableName,
          Key: { story_id: story_id },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }

    async getStoryByAccountId(accountId: string) {
        try{
            const params = new QueryCommand({
                TableName: this.tableName,
                IndexName: 'accountId-index',
                KeyConditionExpression: 'accountId = :id',
                ExpressionAttributeValues: { ':id': accountId },
              });
              return this.dynamoDbService.dynamoDBDocumentClient.send(params);
        } catch (error) {
            console.error(`Error fetching stroy details fro given accountId:`, error);
            throw new Error('Error fetching stroy details fro given accountId');
          }
    }

    async updateStoryDetails(storyDetails: Record<string, any>) {
        try {
          const { id, story_id, ...rest } = storyDetails; // Extract both

          // Normalize: prefer id, fallback to story_id
          const finalStoryId = id || story_id;

          if (!finalStoryId) {
            throw new Error("id or story_id is required to insert or update story details");
          }

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
            Key: { story_id: finalStoryId }, // Assuming 'id' is the primary key
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
      //       ReturnValues: ``, // Correct ReturnValues value
          };
      
          // Execute the update operation using UpdateCommand
          const result = await this.dynamoDbService.dynamoDBDocumentClient.send(new UpdateCommand(params));
      
          // Return the updated item (result.Attributes contains the updated item)
          console.log(`Story details updated:`, result);  // Ensure result has Attributes
          return { success: true, message: 'Story details updated successfully' };
        } catch (error) {
          console.error(`Error inserting stroy details:`, error);
          throw new Error('Failed to insert story details');
        }
      }

      // delete the all media for given accountId
  async deleteAccount(accountId: string) {
    try{
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
}