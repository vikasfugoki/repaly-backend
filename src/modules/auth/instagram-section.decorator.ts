// instagram-section.decorator.ts
import { SetMetadata } from '@nestjs/common';

/**
 * Dashboard sections hidden from linked users who don't have full access
 * on an account that has a `full_access_users` list.
 */
export const INSTAGRAM_SECTIONS = ['media', 'stories', 'dm_automation', 'ads'] as const;
export type InstagramSectionName = (typeof INSTAGRAM_SECTIONS)[number];

/**
 * Tags a route with the section(s) it belongs to. InstagramOwnershipGuard rejects
 * the request with 403 if any of these sections is blocked for the caller.
 */
export const InstagramSection = (...sections: InstagramSectionName[]) =>
  SetMetadata('instagramSection', sections);

/**
 * Sections blocked for a user on an account. Accounts without a `full_access_users`
 * list are unrestricted; otherwise only the admin and the listed users get full access.
 */
export function getBlockedSections(
  account: { user_id: string; full_access_users?: Record<string, unknown> } | undefined,
  userId: string | undefined,
): InstagramSectionName[] {
  if (!account?.full_access_users) return [];
  if (userId && (account.user_id === userId || account.full_access_users[userId])) return [];
  return [...INSTAGRAM_SECTIONS];
}
