export type MediaType = 'IMAGE' | 'VIDEO';
export class InstagramOauthResponse {
  access_token: string;
  user_id: string;
}

export class InstagramAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class InstagramUserInfoResponse {
  id: number;
  username: string;
  name: string;
  biography: string;
  profile_picture_url: string;
  media_count: number;
}

export class InstagramMedia {
  id: string;
  caption: string;
  media_type: MediaType;
  media_url: string;
  timestamp: string;
  like_count: number;
  thumbnail_url?: string;
  comments_count: number;
}

export class InstagramMediaResponse {
  data: InstagramMedia[];
}

export class MediaInsightValuesDTO {
  value: number;
}
export class InstagramMediaInsight {
  name: string;
  period: string;
  values: MediaInsightValuesDTO[];
  title: string;
  description: string;
  id: string;
}

export class InstagramMediaInsightResponse {
  data: InstagramMediaInsight[];
}

export class InstagramAccountResponse {
  id: string;
  caption: string;
  media_type: MediaType;
  media_url: string;
  timestamp: string;
  like_count: number;
  thumbnail_url?: string;
  comments_count: number;
  reach?: number;
  shares?: number;
  comments?: number;
  likes?: number;
  saved?: number;
  ig_reels_avg_watch_time?: number;
  ig_reels_video_view_total_time?: number;
}

export class TagAndValuePair {
  tag: string;
  value: string;
}

export class InstagramAddTagAndValueRequest {
  tagAndValuePair: TagAndValuePair[];
}

export class InstagramStoryResponse {
  id: string;
  media_type: string;
  media_url: string;
  timestamp: string;
}

export class InstagramStoriesResponse {
  data:  InstagramStoryResponse[];
}
