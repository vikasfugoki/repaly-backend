// facebook-resource-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const FacebookResourceType = (type: 'media' | 'account' | 'user') =>
  SetMetadata('facebookResourceType', type);
