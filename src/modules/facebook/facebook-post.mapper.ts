/**
 * Normalize a raw Facebook Graph `/posts` item into the flat media shape we
 * persist in `facebook_media_repository`. Only descriptive fields are returned
 * so that a partial DynamoDB update never clobbers automation settings
 * (`ai_enabled` / `tag_and_value_pair`) already on the record.
 */
export function normalizeFacebookPost(
  post: any,
  accountId: string,
): Record<string, any> {
  const attachment = post?.attachments?.data?.[0];

  return {
    id: post.id,
    accountId,
    caption: post.message ?? post.story ?? '',
    media_type: attachment?.media_type ?? 'status',
    media_url: post.full_picture ?? attachment?.media?.image?.src ?? null,
    permalink: post.permalink_url ?? null,
    timestamp: post.created_time ?? null,
    like_count: post?.likes?.summary?.total_count ?? 0,
    comments_count: post?.comments?.summary?.total_count ?? 0,
    shares_count: post?.shares?.count ?? 0,
  };
}
