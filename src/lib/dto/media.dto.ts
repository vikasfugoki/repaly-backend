/**
 * Canonical media shape returned by every platform's post-listing endpoint
 * (`GET /instagram/:accountId/get-media`, `GET /facebook/:accountId/get-media`,
 * `POST /:accountId/media`, `GET /:mediaId/media-details`).
 *
 * Instagram's Graph enum is the canonical vocabulary because it was here first
 * and the UI already speaks it; Facebook's lowercase attachment types are
 * mapped onto it so the frontend never branches per platform.
 */
export type NormalizedMediaType =
  | 'IMAGE'
  | 'VIDEO'
  | 'CAROUSEL_ALBUM'
  | 'LINK'
  | 'STATUS';

/**
 * Fields guaranteed on every media item of every platform. Platform specific
 * extras (Instagram insights, Facebook `story`, automation settings such as
 * `ai_enabled` / `tag_and_value_pair` / `is_automated`) ride along on top.
 */
export interface NormalizedMedia {
  id: string;
  accountId: string;
  /** Never undefined — an empty string when the post carries no text. */
  caption: string;
  media_type: NormalizedMediaType;
  /** Full-size asset: the image for IMAGE/CAROUSEL_ALBUM/LINK, the playable file for VIDEO. */
  media_url: string | null;
  /** Poster frame. Set for VIDEO whenever the platform exposes one, `null` otherwise. */
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  like_count: number;
  comments_count: number;
  shares_count: number;
}

const MEDIA_TYPES: NormalizedMediaType[] = [
  'IMAGE',
  'VIDEO',
  'CAROUSEL_ALBUM',
  'LINK',
  'STATUS',
];

/** True when `value` is already one of the canonical types (case-insensitively). */
export function toNormalizedMediaType(
  value: unknown,
): NormalizedMediaType | null {
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  return (MEDIA_TYPES as string[]).includes(upper)
    ? (upper as NormalizedMediaType)
    : null;
}

/** Coerce a possibly-missing counter to a number (DynamoDB stores these as numbers). */
export function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize an optional URL-ish field to `string | null` (never `undefined` — DynamoDB rejects it). */
export function toUrl(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
