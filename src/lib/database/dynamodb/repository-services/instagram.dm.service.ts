import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramDMService {
    private readonly tableName = 'instagram_dm_categorization_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  getConversations(id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id: id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  getConversationsByAccountId(account_id: string) {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'accountId-index',
      KeyConditionExpression: 'accountId = :id',
      ExpressionAttributeValues: { ':id': account_id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  // delete the all conversations for given accountId
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
          id: item.id, // Primary key
        },
      });

      return this.dynamoDbService.dynamoDBDocumentClient.send(deleteParams);
    });

    await Promise.all(deletePromises);
    return { message: `Deleted ${deletePromises.length} records for accountId: ${accountId} from 'instagram_dm_repository' table` };
  } catch (error) {
    console.error(`Error deleting for accountId ${accountId} from 'instagram_dm_repository' table:`, error);
    throw new Error(`Failed to delete all media for ${accountId} from 'instagram_dm_repository' table.`);
  } 
  }

  async updateConversationDetails(conversationDetails: Record<string, any>) {
    try {

      const { id, ...updateFields } = conversationDetails; // Extract id and other fields separately
  
      if (!conversationDetails.id) {
          throw new Error('id is required to insert or update conversation details in Conversation table');
        }
  
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
        Key: { id }, // Assuming 'id' is the primary key
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
  //       ReturnValues: ``, // Correct ReturnValues value
      };
  
      // Execute the update operation using UpdateCommand
      const result = await this.dynamoDbService.dynamoDBDocumentClient.send(new UpdateCommand(params));
  
      // Return the updated item (result.Attributes contains the updated item)
      console.log(`Conversation details updated in Conversation table:`, result);  // Ensure result has Attributes
      return { success: true, message: 'Conversation details updated successfully in Conversation Table' };
    } catch (error) {
      console.error(`Error inserting conversation details in Conversation table:`, error);
      throw new Error('Failed to insert conversation details in Conversation table');
    }
  }

  



}