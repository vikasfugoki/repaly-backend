import {
  NormalizedMedia,
  NormalizedMediaType,
  toCount,
  toNormalizedMediaType,
  toUrl,
} from '@lib/dto/media.dto';

/**
 * Instagram's Graph `media_type` is already the canonical vocabulary
 * (`IMAGE` / `VIDEO` / `CAROUSEL_ALBUM`); this only guards against casing drift
 * and unknown values so the response can never disagree with Facebook's.
 */
export function normalizeInstagramMediaType(media: any): NormalizedMediaType {
  return (
    toNormalizedMediaType(media?.media_type) ??
    (toUrl(media?.thumbnail_url) ? 'VIDEO' : 'IMAGE')
  );
}

/**
 * Normalize a raw Instagram Graph media item (already merged with its insights)
 * into the shared media shape — the same one `normalizeFacebookPost` produces.
 * Insight metrics and any other extras on `media` are preserved.
 */
export function normalizeInstagramMedia(
  media: any,
  accountId: string,
): Record<string, any> & NormalizedMedia {
  const media_type = normalizeInstagramMediaType(media);

  return {
    ...media,
    id: media.id,
    accountId,
    caption: media.caption ?? '',
    media_type,
    media_url: toUrl(media.media_url),
    // Instagram only exposes a poster frame for videos; mirror that rule
    // explicitly so the field is always present rather than sometimes missing.
    thumbnail_url: media_type === 'VIDEO' ? toUrl(media.thumbnail_url) : null,
    permalink: toUrl(media.permalink),
    timestamp: toUrl(media.timestamp),
    like_count: toCount(media.like_count),
    comments_count: toCount(media.comments_count),
    // Instagram reports shares as an insight metric; expose it under the same
    // name Facebook posts use so the frontend reads one field on both.
    shares_count: toCount(media.shares_count ?? media.shares),
  };
}

/**
 * Read path: coerce a stored `instagram_media_repository` record into the
 * canonical shape before it goes out over the wire. Records written before the
 * shape was unified are missing `caption` / `thumbnail_url` / `shares_count`
 * entirely; everything else on the record passes through untouched.
 */
export function presentInstagramMedia<T extends Record<string, any>>(
  item: T,
): T & Partial<NormalizedMedia> {
  if (!item) return item;
  return normalizeInstagramMedia(item, item.accountId) as T & NormalizedMedia;
}
