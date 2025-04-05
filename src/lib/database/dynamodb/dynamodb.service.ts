import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';
import { EnvironmentService } from 'src/modules/utils/environment/environment.service';

@Injectable()
export class DynamoDBService {
  public readonly dynamoDBDocumentClient: DynamoDBDocumentClient;
  constructor(private readonly environmentService: EnvironmentService) {
    const region = this.environmentService.getEnvVariable('AWS_REGION');
    const accessKeyId = this.environmentService.getEnvVariable('AWS_ACCESS_ID');
    const secretAccessKey =
      this.environmentService.getEnvVariable('AWS_SECRET_KEY');

    const dynamoDBClient = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient);
  }
}
