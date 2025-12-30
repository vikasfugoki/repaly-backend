import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string; // Base64 encoded cursor for both Instagram and DynamoDB

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 15;
}

export interface PaginationMetadata {
  nextCursor?: string;
  hasMore: boolean;
  count: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}
