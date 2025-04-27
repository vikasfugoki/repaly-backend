import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class QueryDto {
  @ApiProperty()
  @IsNotEmpty()
  question: string;

  @ApiProperty()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsNotEmpty()
  answer: string;
}

export class AddBusinessDetailsRequest {
  @ApiProperty()
  // @IsNotEmpty()
  user_id: string;

  @ApiProperty({ type: [QueryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryDto)
  queries: QueryDto[];
}
