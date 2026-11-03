import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { WhatsappBroadcastBatchRepositoryService } from '@database/dynamodb/repository-services/whatsapp.broadcast.batch.service';
import { WhatsappBroadcastRecipientRepositoryService } from '@database/dynamodb/repository-services/whatsapp.broadcast.recipient.service';
import { EnvironmentService } from '../utils/environment/environment.service';
import { WhatsappAccountService } from './whatsapp.service';
import { parseBroadcastExcel } from './whatsapp-broadcast.excel';

const NUMBERS_PER_SQS_MESSAGE = 50;
const VARIABLE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function badRequest(message: string) {
  return Object.assign(new Error(message), { code: 'BAD_REQUEST' });
}

/**
 * Checks that the worker can send this template. Only a text or no header, and
 * at most one variable in the body, are supported.
 */
export function readBroadcastTemplate(template: any) {
  const components: any[] = template?.components ?? [];
  const bodyText: string =
    components.find((c) => String(c?.type).toUpperCase() === 'BODY')?.text ??
    '';
  const others = components.filter(
    (c) => String(c?.type).toUpperCase() !== 'BODY',
  );

  const header = others.find((c) => String(c?.type).toUpperCase() === 'HEADER');
  if (header && String(header.format).toUpperCase() !== 'TEXT') {
    throw badRequest(
      `Templates with ${String(header.format).toLowerCase()} headers are not supported.`,
    );
  }
  if (JSON.stringify(others).includes('{{')) {
    throw badRequest(
      'Variables are only supported in the template body, not in the header or buttons.',
    );
  }

  const variables = [
    ...new Set(
      [...bodyText.matchAll(VARIABLE_PATTERN)].map((match) => match[1]),
    ),
  ];
  if (variables.length > 1) {
    throw badRequest(
      'Templates with more than one variable are not supported.',
    );
  }

  const hasVariable = variables.length === 1;
  return {
    bodyText,
    hasVariable,
    // {{1}} is positional. {{customer}} is named, and Meta needs that name when sending.
    variableName:
      hasVariable && !/^\d+$/.test(variables[0]) ? variables[0] : null,
  };
}

/**
 * Bulk template sending from an Excel file. This backend only prepares the batch
 * and queues it; the worker Lambda in the AWS console does the actual sending and
 * writes each result to DynamoDB.
 */
@Injectable()
export class WhatsappBroadcastService {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly whatsappAccountService: WhatsappAccountService,
    private readonly batchRepository: WhatsappBroadcastBatchRepositoryService,
    private readonly recipientRepository: WhatsappBroadcastRecipientRepositoryService,
    private readonly environmentService: EnvironmentService,
  ) {
    this.sqsClient = new SQSClient({
      region: this.environmentService.getEnvVariable('AWS_REGION'),
      credentials: {
        accessKeyId: this.environmentService.getEnvVariable('AWS_ACCESS_ID'),
        secretAccessKey:
          this.environmentService.getEnvVariable('AWS_SECRET_KEY'),
      },
    });
  }

  /** Checks the template and Excel, then saves a draft. Nothing is sent here. */
  async preview(
    accountId: string,
    body: { templateName: string; language: string; fileBase64: string },
  ) {
    if (!body?.templateName || !body?.language) {
      throw badRequest('templateName and language are required.');
    }

    const template = await this.whatsappAccountService.getApprovedTemplate(
      accountId,
      body.templateName,
      body.language,
    );
    const { bodyText, hasVariable, variableName } =
      readBroadcastTemplate(template);
    const { valid, invalid } = await parseBroadcastExcel(
      body.fileBase64,
      hasVariable,
    );

    const batch_id = randomUUID();

    // Numbers first: if this fails midway, no batch exists that could be sent.
    await this.recipientRepository.saveRecipients(
      valid.map(({ number, name }) => ({
        batch_id,
        number,
        name,
        status: 'pending',
      })),
    );
    await this.batchRepository.createBatch({
      batch_id,
      account_id: accountId,
      template_name: body.templateName,
      language: body.language,
      has_variable: hasVariable,
      variable_name: variableName,
      total: valid.length,
      sent_count: 0,
      failed_count: 0,
      status: 'draft',
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      batchId: batch_id,
      validCount: valid.length,
      invalidCount: invalid.length,
      invalidRows: invalid,
      sampleMessage: bodyText.replace(VARIABLE_PATTERN, () => valid[0].name),
      template: {
        name: template.name,
        language: template.language,
        components: template.components,
      },
    };
  }

  /** Splits the numbers into SQS messages. The worker Lambda picks them up from there. */
  async send(accountId: string, batchId: string) {
    const batch = await this.getOwnedBatch(accountId, batchId);
    if (batch.status !== 'draft') {
      throw badRequest(`This batch is already ${batch.status}.`);
    }

    // Read these before changing the status, so a failure here leaves a usable draft.
    const queueUrl = this.environmentService.getEnvVariable(
      'WHATSAPP_BROADCAST_QUEUE_URL',
    );
    const recipients = await this.recipientRepository.getRecipients(batchId);

    if (!(await this.batchRepository.markSending(batchId))) {
      throw badRequest('This batch was already sent or cancelled.');
    }

    let failed = 0;
    for (let i = 0; i < recipients.length; i += NUMBERS_PER_SQS_MESSAGE) {
      const chunk = recipients.slice(i, i + NUMBERS_PER_SQS_MESSAGE);
      try {
        await this.sqsClient.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({
              batchId,
              accountId,
              templateName: batch.template_name,
              language: batch.language,
              hasVariable: batch.has_variable,
              variableName: batch.variable_name,
              recipients: chunk.map(({ number, name }) => ({ number, name })),
            }),
          }),
        );
      } catch (error) {
        // Earlier messages may already be sending, so this cannot go back to draft.
        // Mark these numbers failed so the batch does not stay in `sending` forever.
        console.error(`Failed to queue a message for batch ${batchId}:`, error);
        for (const { number } of chunk) {
          const marked = await this.recipientRepository.markFailed(
            batchId,
            number,
            'Could not queue this number for sending',
          );
          if (marked) failed++;
        }
      }
    }
    if (failed > 0) {
      await this.batchRepository.addFailed(batchId, failed);
    }

    return {
      success: true,
      batchId,
      queuedCount: recipients.length - failed,
      failedCount: failed,
    };
  }

  async getBatch(accountId: string, batchId: string) {
    return {
      success: true,
      batch: await this.getOwnedBatch(accountId, batchId),
    };
  }

  async getRecipients(accountId: string, batchId: string) {
    await this.getOwnedBatch(accountId, batchId);
    return {
      success: true,
      recipients: await this.recipientRepository.getRecipients(batchId),
    };
  }

  async cancel(accountId: string, batchId: string) {
    await this.getOwnedBatch(accountId, batchId);
    if (!(await this.batchRepository.cancel(batchId))) {
      throw badRequest('This batch has already finished.');
    }
    return { success: true, batchId, status: 'cancelled' };
  }

  // The ownership guard only checks `accountId`, so also check the batch belongs to it.
  private async getOwnedBatch(accountId: string, batchId: string) {
    const batch = await this.batchRepository.getBatch(batchId);
    if (!batch || batch.account_id !== accountId) {
      throw new NotFoundException('Broadcast batch not found');
    }
    return batch;
  }
}
