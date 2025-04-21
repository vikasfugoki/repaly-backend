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

// export class InstagramMediaAnalyticsRepositoryDTO {
//   all_positive_comments: Array<[string, string | null]>; // Array of tuples with comment and reply
//   all_negative_comments: Array<[string, string | null]>; // Array of tuples with comment and reply
//   comment_by_us: number;
//   potential_buyers: number;
//   DMs_by_us: number;
//   account_id: string | null;
//   all_leads: Array<[string, string | null]>; // List of leads and their replies
//   tagged: number;
//   lead_generated: number;
//   negative_comments: number;
//   all_tagged: Array<[string, string | null]>; // Array of tag-value pairs
//   id: string;
//   all_potential_buyers: Array<[string, string | null]>; // List of potential buyers and their replies
//   positive_comments: number;
// }

type StandardComment = [number, string, string, string, number]; // [timestamp, username, comment, reply, reply_timestamp]
type TaggedCommentDM = [number, string, string, string, string, number]; // [timestamp, username, comment, reply, dm_sent, timestamp]

export interface CommentsByType {
  inquiry?: StandardComment[];
  positive?: StandardComment[];
  negative?: StandardComment[];
  potential_buyers?: StandardComment[];
  tagged_comment?: StandardComment[];
  tagged_comment_dm?: TaggedCommentDM[];
}

export interface CommentCounts {
  inquiry: number;
  positive: number;
  negative: number;
  potential_buyers: number;
  tagged_comment: number;
  tagged_comment_dm: number;
}

export interface CommentTimeSeriesEntry {
  count: number;
  ts: number;
}

export interface CommentTimeSeries {
  inquiry?: CommentTimeSeriesEntry[];
  positive?: CommentTimeSeriesEntry[];
  negative?: CommentTimeSeriesEntry[];
  potential_buyers?: CommentTimeSeriesEntry[];
  tagged_comment?: CommentTimeSeriesEntry[];
  tagged_comment_dm?: CommentTimeSeriesEntry[];
}

export class InstagramMediaAnalyticsRepositoryDTO {
  id: string;
  account_id: string;
  business_account_id: string;

  comments_by_type: CommentsByType;

  comment_counts: CommentCounts;

  comment_timeseries: CommentTimeSeries;
}
