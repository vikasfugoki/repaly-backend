// instagram-section.decorator.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Dashboard sections an account admin can block for a linked user
 * (stored per user in `access_restrictions` on the Instagram account record).
 */
export const INSTAGRAM_SECTIONS = ['media', 'stories', 'dm_automation', 'ads'] as const;
export type InstagramSectionName = (typeof INSTAGRAM_SECTIONS)[number];

/**
 * Tags a route with the section(s) it belongs to. InstagramOwnershipGuard rejects
 * the request with 403 if the caller has any of these sections blocked.
 */
export const InstagramSection = (...sections: InstagramSectionName[]) =>
  SetMetadata('instagramSection', sections);
