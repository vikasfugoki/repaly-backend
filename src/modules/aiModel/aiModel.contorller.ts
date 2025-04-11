import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBody, ApiParam} from '@nestjs/swagger';
import { AIServices } from './aiModel.service';
import { string } from 'joi';


@ApiTags('AI Services')
@Controller('ai-services')
export class AIController {
    constructor(
        private readonly aiServices: AIServices
      ) {}

    @Post('generate-tags')
    async generateTags(@Body() body: { captions: string }){
        try {
            const prompt = `Given the following Instagram caption: "${body.captions}". Generate a clean list of 10 relevant hashtags (without # symbol), separated by commas. Example: sunset, travel, vacation`;
            return await this.aiServices.callGpt(prompt);
        } catch (error) {
            console.error('Error generating tags:', error);
            throw new Error('Error generatings tags');
          }
    }

    @Post('suggest-reply')
    async suggestReply(@Body() body: {mode: string, responseTarget: string, tags: string[],  captions: string, inquiries: Record<string, any>}) {
        // try {
        //     return await this.aiServices.suggestTagReplyGpt(body);
        // } catch (error) {
        //     console.error('Error suggesting reply:', error);
        //     throw new Error('Error suggesting reply');
        //   }
        return await this.aiServices.suggestTagReplyGpt(body);
    }
}