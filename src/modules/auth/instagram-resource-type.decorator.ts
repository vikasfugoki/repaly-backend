// instagram-resource-type.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const InstagramResourceType = (type: 'media' | 'story' | 'account') =>
  SetMetadata('instagramResourceType', type);
