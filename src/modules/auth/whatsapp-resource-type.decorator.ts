// whatsapp-resource-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const WhatsappResourceType = (type: 'account' | 'user') =>
  SetMetadata('whatsappResourceType', type);
