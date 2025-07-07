import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FacebookAdAccount {
    id: string;
    name: string;
    account_status: number;
  }
  
export class FacebookAdAccountResponse {
    data: FacebookAdAccount[];
    paging?: {
        next?: string;
      };
  }