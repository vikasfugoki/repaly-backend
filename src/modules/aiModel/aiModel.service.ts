import { Injectable, ConflictException, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { InstagramUrlService } from '../utils/instagram/url.service';


@Injectable()
export class AIServices{

    constructor(
        private readonly api: InstagramUrlService
    ) {}


    async suggestTagReplyGpt(body: Record<string, any>) {
        const GPT_KEY = this.api.getGptKey();
        console.log('GPT API Key:', GPT_KEY);

        const mode = body?.mode ?? '';
        const responseTarget = body?.responseTarget ?? '';
        const captions = body?.captions ?? '';
        const inquiries = body?. inquiries ?? '';
        const tags = body?. tags ?? [];

        if (!body.tags || !Array.isArray(body.tags) || body.tags.length === 0) {
            throw new BadRequestException('tag must be a non-empty array of strings');
          }

        switch(mode) {
            
            case 'comment':
                if (responseTarget == "comment") {
                const prompt = `You are an assistant managing replies for an Instagram seller account.

                      Generate a short, friendly, and helpful comment reply to a user's inquiry based on the following:

                      - Caption: "${captions}"
                      - Tags: ${tags.join(", ")}
                      - Product Details: ${inquiries?.product_details ?? ""}
                      - Mobile Number: ${inquiries?.mobile_no ?? ""}
                      - Website URL: ${inquiries?.website_url ?? ""}

                      Use the tags to decide what information to include. For example:
                      - If the tag includes "price", and a price is available in the product details, mention it.
                      - If the tag includes "available", confirm availability if known.
                      - If the tag includes "color", "size", or similar, provide options if available.
                      - If contact info is requested (e.g., "dm", "whatsapp", "contact"), include the mobile number or website.

                      Avoid emojis, hashtags, or promotional language. Write a natural-sounding, friendly sentence that directly answers the comment. Return only the reply string — no bullet points, formatting, or extra output.
                      `

                return await this.callGpt(prompt);
                }
                else {
                    throw new BadRequestException(`unsupported responseTarget: ${responseTarget} for comment mode.`);
                }
                break;

            case 'comment_dm':
                if (responseTarget == 'comment') {
                    const prompt = `Create a comment reply for the Instagram post with caption: "${captions}", inquiry: "${inquiries}, and tags: ${tags.join(", ")}". Indicate that a DM has been sent. Return only a single string message without formatting it as a list or bullet points.`;
                    return await this.callGpt(prompt);
                }
                else if (responseTarget == 'dm') {
                    const prompt = `You are an Instagram seller assistant. Generate a direct message (DM) reply for a customer interested in a product.
                                        Here is the caption of the Instagram post: 
                                        ${captions}
                                        
                                        Here are the inquiry details:
                                        mobile_no: ${inquiries?.mobile_no ?? ""}
                                        product_details: ${inquiries?.product_details ?? ""}
                                        website: ${inquiries?.website_url ?? ""}

                                        
                                        Write a polite and concise message that:
                                        1. Thanks the user for their interest.
                                        2. Briefly summarizes the product info.
                                        3. Shares the website and contact info.

                                        
                                        Avoid using hashtags, emojis, or placeholder names like [Your Name]. Return only a single string message without formatting it as a list or bullet points.`;
                    return await this.callGpt(prompt);
                }
                else {
                    throw new BadRequestException(`unsupported responseTarget: ${responseTarget} for comment_dm mode.`);
                }
                break;

            default:
                throw new BadRequestException(`unsupported mode: ${mode}`);
        }
    }

    async callGpt(prompt: string): Promise<string[]> {
        const GPT_KEY = this.api.getGptKey();
        console.log('GPT API Key:', GPT_KEY);

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GPT_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              temperature: 0.7,
            }),
          });
      
          const data = await response.json();
          console.log('API response:', data);
      
          const content = data?.choices?.[0]?.message?.content || '';
          console.log('Content from GPT:', content);
      
          // Split by commas or newlines, clean each tag
          const tags = content
            .split(/[,|\n]/)
            .map(tag => tag.trim().replace(/^#/, ''))
            .filter(tag => tag.length > 0);
      
          return tags;
      
        } catch (error) {
          console.error('Error calling GPT API:', error);
          throw new Error('Failed to generate tags from caption');
        }
      }
      
}