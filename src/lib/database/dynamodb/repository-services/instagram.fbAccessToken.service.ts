import { GetCommand, QueryCommand, PutCommand, BatchWriteCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../dynamodb.service';


@Injectable()
export class InstagramFbAccessTokenService {

    private readonly tableName = 'facebook_access_token_repository';
    constructor(private readonly dynamoDbService: DynamoDBService) {}

    // get the details using the id(primary-key ::  instagram account-id)
    async getFacebookDetails(id: string) {
        const params = new GetCommand({
          TableName: this.tableName,
          Key: { id: id },
        });
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }

    async insertFacebookDetails(facebookDetails: Record<string, any>) {
    try {
        const params = new PutCommand({
        TableName: this.tableName,
        Item: facebookDetails,
        });

        await this.dynamoDbService.dynamoDBDocumentClient.send(params);
        console.log(`Facebook details inserted:`, facebookDetails);
        return { success: true, message: 'Facebook details stored successfully' };
    } catch (error) {
        console.error(`Error inserting facebook details:`, error);
        throw new Error('Failed to insert facebook details');
        }
    }

    // Check whether an ID exists in the table
    async isIdPresent(id: string): Promise<boolean> {
        try {
        const result = await this.getFacebookDetails(id);
        return !!result?.Item; // true if Item exists, false otherwise
        } catch (error) {
        console.error(`Error checking ID presence for: ${id}`, error);
        return false;
        }
    }

    async deleteAccount(id: string) {
        const params = new DeleteCommand({
          TableName: this.tableName,
          Key: { id },
        });
      
        return this.dynamoDbService.dynamoDBDocumentClient.send(params);
      }
}