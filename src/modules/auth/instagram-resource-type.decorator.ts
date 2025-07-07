// instagram-resource-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const InstagramResourceType = (type: 'ad' | 'conversation' | 'media' | 'story' | 'account') =>
  SetMetadata('instagramResourceType', type);
