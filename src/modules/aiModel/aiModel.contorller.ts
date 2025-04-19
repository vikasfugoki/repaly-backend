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
            const prompt = `
                The following Instagram caption is about a product: "${body.captions}"

                Generate a list of 10 short phrases (1–2 words each) that users are likely to comment on this post. These should reflect common customer questions or tags like: price, pp, size, color, available, how much, cod, dm, etc. Do NOT include hashtags or emojis. Return as a comma-separated list.
                `;
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