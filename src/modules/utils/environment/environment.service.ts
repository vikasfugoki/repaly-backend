import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvironmentService {
  constructor(private readonly configService: ConfigService) {}

  getEnvVariable(variableName: string): string {
    const value = this.configService.get<string>(variableName);
    if (!value) {
      throw new Error(`${variableName} is not set.`);
    }
    return value;
  }
}
