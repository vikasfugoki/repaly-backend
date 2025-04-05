// import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramMediaRepositoryService {
  private readonly tableName = 'instagram_media_repository';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  getMedia(id: string) {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id: id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  getMediaByAccountId(account_id: string) {
    const params = new QueryCommand({
      TableName: this.tableName,
      IndexName: 'accountId-index',
      KeyConditionExpression: 'accountId = :id',
      ExpressionAttributeValues: { ':id': account_id },
    });
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  async insertMediaDetails(mediaDetails: Record<string, any>) {
    try {
      const params = new PutCommand({
        TableName: this.tableName,
        Item: mediaDetails,
      });

      await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      console.log(`Media details inserted:`, mediaDetails);
      return { success: true, message: 'Media details stored successfully' };
    } catch (error) {
      console.error(`Error inserting media details:`, error);
      throw new Error('Failed to insert media details');
    }
  }

  /** Insert multiple media details */
  async insertMultipleMediaDetails(mediaDetailsList: Record<string, any>[]) {
    if (!mediaDetailsList || mediaDetailsList.length === 0) {
      throw new Error('Media details list cannot be empty');
    }

    try {
      const batchItems = mediaDetailsList.map((media) => ({
        PutRequest: { Item: media },
      }));

      const params = new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: batchItems,
        },
      });

      await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      console.log(`Inserted ${mediaDetailsList.length} media items successfully`);
      return { success: true, message: 'Media details batch stored successfully' };
    } catch (error) {
      console.error(`Error inserting multiple media details:`, error);
      throw new Error('Failed to insert multiple media details');
    }
  }

async updateMediaDetails(mediaDetails: Record<string, any>) {
  try {
    const { id, ...updateFields } = mediaDetails; // Extract id and other fields separately

    if (!id) {
      throw new Error('id is required to insert or update media details');
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
    console.log(`Media details updated:`, result);  // Ensure result has Attributes
    return { success: true, message: 'Media details updated successfully' };
  } catch (error) {
    console.error(`Error inserting media details:`, error);
    throw new Error('Failed to insert media details');
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

    if (!queryResult.Items || queryResult.Items.length === 0) {
      throw new Error(`No records found for accountId: ${accountId}`);
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
    return { message: `Deleted ${deletePromises.length} records for accountId: ${accountId} from 'instagram_media_repository' table` };
  } catch (error) {
    console.error(`Error deleting for accountId ${accountId} from 'instagram_media_repository' table:`, error);
    throw new Error(`Failed to delete all media for ${accountId} from 'instagram_media_repository' table.`);
  } 
  }

  async getMediaIdsByAccountId(accountId: string): Promise<string[]> {
    try {
      // Query the table to get all mediaId values for the given accountId
      const queryParams = new QueryCommand({
        TableName: this.tableName,
        IndexName: "accountId-index", // Using secondary index
        KeyConditionExpression: "accountId = :accountId",
        ExpressionAttributeValues: {
          ":accountId": accountId,
        },
        ProjectionExpression: "id", // Fetch only mediaId to optimize performance
      });
  
      const queryResult = await this.dynamoDbService.dynamoDBDocumentClient.send(queryParams);
  
      if (!queryResult.Items || queryResult.Items.length === 0) {
        throw new Error(`No media found for accountId: ${accountId}`);
      }
  
      // Extract and return the list of mediaId values
      return queryResult.Items.map((item) => item.id);
    } catch (error) {
      console.error(`Error fetching media IDs for accountId ${accountId}:`, error);
      throw new Error(`Failed to fetch media IDs for accountId: ${accountId}`);
    }
  }

}
