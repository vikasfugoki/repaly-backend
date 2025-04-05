export class TagAndValues {
  tag: string;
  value: string;
}
// export class InstagramMediaAnalyticsRepositoryDTO {
//   service: number;
//   service_metrics: {
//     negative_comments: boolean;
//     inquiries: boolean;
//     potential_buyers: boolean;
//     leads: boolean;
//     positive_comments: boolean;
//   };
//   instagram_user_id: number;
//   added_at: string;
//   id: string;
//   analytics: {
//     negative_comments: number;
//     potential_buyers: number;
//     comments: number;
//     leads: number;
//     positive_comments: number;
//   };
//   tag_and_value_pair: TagAndValues[];
// }

export class InstagramMediaAnalyticsRepositoryDTO {
  all_positive_comments: Array<[string, string | null]>; // Array of tuples with comment and reply
  all_negative_comments: Array<[string, string | null]>; // Array of tuples with comment and reply
  comment_by_us: number;
  potential_buyers: number;
  DMs_by_us: number;
  account_id: string | null;
  all_leads: Array<[string, string | null]>; // List of leads and their replies
  tagged: number;
  lead_generated: number;
  negative_comments: number;
  all_tagged: Array<[string, string | null]>; // Array of tag-value pairs
  id: string;
  all_potential_buyers: Array<[string, string | null]>; // List of potential buyers and their replies
  positive_comments: number;
}
