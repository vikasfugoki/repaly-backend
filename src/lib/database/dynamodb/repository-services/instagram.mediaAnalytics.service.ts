import { GetCommand, UpdateCommand, DeleteCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { InstagramMediaAnalyticsRepositoryDTO } from '../../dto/instagram.mediaAnalytics.dto';
import { DynamoDBService } from '../dynamodb.service';

@Injectable()
export class InstagramMediaAnalyticsRepositoryService {
  private readonly tableName = 'instagram_analytics_repository';

  constructor(private readonly dynamoDbService: DynamoDBService) {}

  async createMediaAnalytics(mediaId: string, tagAndValuePair: string) {
    const params = new UpdateCommand({
      TableName: this.tableName,
      Key: { id: mediaId },
      UpdateExpression: 'SET #tag_and_value_pair = :tag_and_value_pair',
      ExpressionAttributeNames: {
        '#tag_and_value_pair': 'tag_and_value_pair',
      },
      ExpressionAttributeValues: {
        ':tag_and_value_pair': tagAndValuePair,
      },
      ReturnValues: 'ALL_NEW',
    });
    try {
      const response =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      return response.Attributes;
    } catch (error) {
      console.log('Failed to add new pair', (error as Error).message);
      throw new Error('Failed to add new pair');
    }
  }

  async getMediaAnalytics(
    id: string,
  ): Promise<InstagramMediaAnalyticsRepositoryDTO | undefined> {
    const params = new GetCommand({
      TableName: this.tableName,
      Key: { id },
    });
    try {
      const response =
        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
      return (
        (response.Item as InstagramMediaAnalyticsRepositoryDTO) ?? undefined
      );
    } catch (error) {
      console.log('Failed to fetch media analytics', (error as Error).message);
      throw new Error('Failed to fetch media analytics');
    }
  }


  // // delete the all media for given accountId
  // async deleteAccount(accountId: string) {
  //   try {
  //     // Step 1: Query the table using "account_id-index" to get all items associated with accountId
  //     const queryParams = new QueryCommand({
  //       TableName: this.tableName,
  //       IndexName: "account_id-index", // Corrected index name
  //       KeyConditionExpression: "account_id = :accountId", // Ensure correct attribute name
  //       ExpressionAttributeValues: {
  //         ":accountId": accountId,
  //       },
  //     });
  
  //     const queryResult = await this.dynamoDbService.dynamoDBDocumentClient.send(queryParams);
  
  //     if (!queryResult.Items || queryResult.Items.length === 0) {
  //       throw new Error(`No records found for account_id: ${accountId}`);
  //     }
  
  //     // Step 2: Delete each entry found
  //     const deletePromises = queryResult.Items.map((item) => {
  //       const deleteParams = new DeleteCommand({
  //         TableName: this.tableName,
  //         Key: {
  //           id: item.id, // Primary key (assuming 'id' is the partition key)
  //         },
  //       });
  
  //       return this.dynamoDbService.dynamoDBDocumentClient.send(deleteParams);
  //     });
  
  //     await Promise.all(deletePromises);
  //     return { message: `Deleted ${deletePromises.length} records for account_id from 'instagram_analytics_repository' table: ${accountId}` };
  //   } catch (error) {
  //     console.error(`Error deleting for account_id ${accountId} from 'instagram_analytics_repository' table:`, error);
  //     throw new Error(`Failed to delete all media for account_id ${accountId} from 'instagram_analytics_repository' table`);
  //   }
  // }

  deleteMedia(id: string) {
    const params = new DeleteCommand({
      TableName: this.tableName,
      Key: { id },
    });
  
    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

  addMedia(mediaDetails: Record<string, any>) {
    const params = new PutCommand({
      TableName:  this.tableName,
      Item: { id: mediaDetails.id, accountId: mediaDetails.accountId }
    });

    return this.dynamoDbService.dynamoDBDocumentClient.send(params);
  }

}
