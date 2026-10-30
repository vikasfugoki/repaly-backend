import { Injectable } from '@nestjs/common';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBService } from '../dynamodb.service';

/**
 * Read-only repository for the saved contacts (WhatsApp Business app address
 * book) of coexistence numbers.
 *
 * Persists to `wa_contacts`, which this backend never writes: the whatsapp
 * webhook Lambdas fill it from Meta's `smb_app_state_sync` webhooks.
 *   - `phone_number_id` (partition key) = the business number
 *   - `phone`           (sort key)      = the contact, digits only with country
 *                                         code, e.g. "919876543210"
 *   - `removed`                         = true once the contact is deleted from
 *                                         the address book (the row is kept)
 */
@Injectable()
export class WhatsappContactRepositoryService {
  private readonly tableName = 'wa_contacts';
  constructor(private readonly dynamoDbService: DynamoDBService) {}

  /** Every contact of one number still in its address book, across all pages. */
  async getContactsByPhoneNumberId(
    phone_number_id: string,
  ): Promise<Record<string, any>[]> {
    const contacts: Record<string, any>[] = [];
    let lastKey: Record<string, any> | undefined;

    try {
      do {
        const params = new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: '#pnid = :pnid',
          FilterExpression: 'attribute_not_exists(#removed) OR #removed = :false',
          ProjectionExpression: '#phone, #full_name, #first_name',
          ExpressionAttributeNames: {
            '#pnid': 'phone_number_id',
            '#removed': 'removed',
            '#phone': 'phone',
            '#full_name': 'full_name',
            '#first_name': 'first_name',
          },
          ExpressionAttributeValues: { ':pnid': phone_number_id, ':false': false },
          ExclusiveStartKey: lastKey,
        });
        const response =
          await this.dynamoDbService.dynamoDBDocumentClient.send(params);
        contacts.push(...((response.Items as Record<string, any>[]) ?? []));
        lastKey = response.LastEvaluatedKey;
      } while (lastKey);

      return contacts;
    } catch (error) {
      console.error(
        `Error fetching WhatsApp contacts for ${phone_number_id}:`,
        error,
      );
      throw new Error('Failed to fetch WhatsApp contacts');
    }
  }
}
