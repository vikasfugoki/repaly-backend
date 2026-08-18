import {
  NormalizedMedia,
  NormalizedMediaType,
  toCount,
  toNormalizedMediaType,
  toUrl,
} from '@lib/dto/media.dto';

/**
 * Facebook attachment `media_type` values (lowercase, and open-ended) mapped
 * onto the canonical UPPERCASE vocabulary shared with Instagram.
 * See https://developers.facebook.com/docs/graph-api/reference/attachment/
 */
const FACEBOOK_MEDIA_TYPE_MAP: Record<string, NormalizedMediaType> = {
  photo: 'IMAGE',
  profile_media: 'IMAGE',
  cover_photo: 'IMAGE',
  album: 'CAROUSEL_ALBUM',
  new_album: 'CAROUSEL_ALBUM',
  video: 'VIDEO',
  video_inline: 'VIDEO',
  video_autoplay: 'VIDEO',
  animated_image_video: 'VIDEO',
  animated_image_share: 'VIDEO',
  link: 'LINK',
  share: 'LINK',
  event: 'LINK',
  music: 'LINK',
  note: 'LINK',
  status: 'STATUS',
};

/**
 * Canonical media type for a Facebook post. Falls back to the attachment shape
 * when Facebook sends a `media_type` we don't know: several sub-attachments is
 * a carousel, a playable `source` is a video, an image is a photo, and a post
 * with no attachment at all is a plain text status.
 */
export function normalizeFacebookMediaType(post: any): NormalizedMediaType {
  const attachment = post?.attachments?.data?.[0];
  const mapped = FACEBOOK_MEDIA_TYPE_MAP[attachment?.media_type];
  if (mapped) return mapped;

  if ((attachment?.subattachments?.data?.length ?? 0) > 1) {
    return 'CAROUSEL_ALBUM';
  }
  if (attachment?.media?.source) return 'VIDEO';
  if (attachment?.media?.image?.src || post?.full_picture) return 'IMAGE';
  return 'STATUS';
}

/**
 * Normalize a raw Facebook Graph `/posts` item into the flat media shape we
 * persist in `facebook_media_repository` — the same shape Instagram media is
 * returned in (see `NormalizedMedia`). Only descriptive fields are returned so
 * that a partial DynamoDB update never clobbers automation settings
 * (`ai_enabled` / `tag_and_value_pair`) already on the record.
 */
export function normalizeFacebookPost(
  post: any,
  accountId: string,
): NormalizedMedia {
  const attachment = post?.attachments?.data?.[0];
  const media_type = normalizeFacebookMediaType(post);

  // `full_picture` and `media.image.src` are always still images: for a video
  // post that is the poster frame, not the asset itself. Keeping them apart is
  // what gives Facebook videos the `thumbnail_url` Instagram videos always had.
  const poster =
    toUrl(post?.full_picture) ?? toUrl(attachment?.media?.image?.src);
  const isVideo = media_type === 'VIDEO';

  return {
    id: post.id,
    accountId,
    caption: post.message ?? post.story ?? '',
    media_type,
    media_url: isVideo ? toUrl(attachment?.media?.source) : poster,
    thumbnail_url: isVideo ? poster : null,
    permalink: toUrl(post?.permalink_url),
    timestamp: toUrl(post?.created_time),
    like_count: toCount(post?.likes?.summary?.total_count),
    comments_count: toCount(post?.comments?.summary?.total_count),
    shares_count: toCount(post?.shares?.count),
  };
}

/**
 * Read path: coerce a stored `facebook_media_repository` record into the
 * canonical shape before it goes out over the wire. Records written before the
 * shape was unified still carry a lowercase `media_type` and no
 * `thumbnail_url` (with the poster image sitting in `media_url`), so both are
 * repaired here. Automation fields and anything else on the record pass
 * through untouched.
 */
export function presentFacebookMedia<T extends Record<string, any>>(
  item: T,
): T & Partial<NormalizedMedia> {
  if (!item) return item;

  const media_type =
    toNormalizedMediaType(item.media_type) ??
    FACEBOOK_MEDIA_TYPE_MAP[item.media_type] ??
    'STATUS';
  const media_url = toUrl(item.media_url);
  const thumbnail_url = toUrl(item.thumbnail_url);
  const isVideo = media_type === 'VIDEO';

  return {
    ...item,
    caption: item.caption ?? '',
    media_type,
    // Legacy video records stored the poster frame in `media_url`; move it to
    // `thumbnail_url` so the frontend's "video -> use the thumbnail" rule holds.
    media_url: isVideo && !thumbnail_url ? null : media_url,
    thumbnail_url: isVideo ? (thumbnail_url ?? media_url) : null,
    permalink: toUrl(item.permalink),
    timestamp: toUrl(item.timestamp),
    like_count: toCount(item.like_count),
    comments_count: toCount(item.comments_count),
    shares_count: toCount(item.shares_count),
  };
}
