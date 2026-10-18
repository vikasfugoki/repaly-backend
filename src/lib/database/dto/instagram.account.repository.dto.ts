export class InstagramAccountRepositoryDTO {
  id: string;
  access_token: string;
  user_id: string;
  username: string;
  name: string;
  profile_picture_url: string;
  media_count: number;
  biography: string;
  created_time: string;
  updated_time: string;
  platformName: string;
  pro_user_id: string;
  tag_and_value_pair?: object;
  ai_enabled?: object;
  // When present, only the admin and these users (keyed by influex user_id) get full access.
  full_access_users?: Record<string, InstagramFullAccessEntryDTO>;
}

export class InstagramFullAccessEntryDTO {
  added_by: string;
  added_time: string;
}

export class OmitInstagramAccountRepositoryDTO {
  id: string;
  user_id: string;
  username: string;
  name: string;
  profile_picture_url: string;
  media_count: number;
  biography: string;
  created_time: string;
  updated_time: string;
  platformName: string;
  access_token: string;
  blocked_sections?: string[]; // sections blocked for the requesting user
  access_level?: 'full' | 'limited';
}
