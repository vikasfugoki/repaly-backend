import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CommentAnalyticsQueryDto {
  // Accepts an epoch (seconds or milliseconds) or an ISO 8601 date string.
  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;

  @IsOptional()
  @IsIn(['hour', 'day'])
  granularity?: 'hour' | 'day' = 'day';
}

export class CommentsListQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  cursor?: string; // Base64 encoded DynamoDB LastEvaluatedKey

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
