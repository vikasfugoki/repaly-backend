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
      

      async getExtractFields(goal: string): Promise<any[]> {
        const GPT_KEY = this.api.getGptKey();
        console.log("GPT API Key:", GPT_KEY ? "Present" : "Missing");
      
        if (!goal || goal.trim().length === 0) {
          throw new Error("Goal is required to generate extraction fields.");
        }
      
        if (!GPT_KEY) {
          throw new Error("GPT API Key is not configured.");
        }
      
        const systemPrompt = `You are an AI assistant that generates structured 'extraction_fields' JSON based on the provided goal.
      
      CRITICAL RULES:
      - Return ONLY a valid JSON array, nothing else
      - NO markdown code blocks (no \`\`\`json)
      - NO explanations or additional text
      - ONLY the raw JSON array
      
      Each element MUST follow this exact format:
      {
        "field_name": "<lowercase_with_underscores>",
        "response_type": "text|number|phone_no|email|pincode|url|date|boolean",
        "required": true|false,
        "prompt_hint": "<brief description for user>",
        "value": null
      }
      
      Example output for goal "Collect customer contact info":
      [
        {
          "field_name": "customer_name",
          "response_type": "text",
          "required": true,
          "prompt_hint": "your full name",
          "value": null
        },
        {
          "field_name": "email_address",
          "response_type": "email",
          "required": true,
          "prompt_hint": "email for order confirmation",
          "value": null
        },
        {
          "field_name": "phone_number",
          "response_type": "phone_no",
          "required": true,
          "prompt_hint": "contact number",
          "value": null
        }
      ]`;
      
        const userPrompt = `Goal: "${goal}"
      
      Generate the extraction_fields JSON array based on this goal. Return ONLY the JSON array.`;
      
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${GPT_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini", // Changed to gpt-4o-mini - faster and cheaper for this task
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              temperature: 0.1, // Lower temperature for more consistent output
              max_tokens: 500, // Increased for more fields
            }),
          });
      
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("OpenAI API Error:", errorData);
            throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
          }
      
          const data = await response.json();
          console.log("ExtractFields API Response:", data);
      
          const raw = data?.choices?.[0]?.message?.content || "";
          console.log("Raw GPT Response:", raw);
      
          if (!raw) {
            throw new Error("GPT returned empty response.");
          }
      
          // Clean up response - remove markdown code blocks if present
          let cleanedJson = raw.trim();
          
          // Remove ```json and ``` if present
          cleanedJson = cleanedJson.replace(/^```json\s*/i, '');
          cleanedJson = cleanedJson.replace(/^```\s*/i, '');
          cleanedJson = cleanedJson.replace(/\s*```$/i, '');
          cleanedJson = cleanedJson.trim();
      
          // Try parsing JSON
          let extractionJson: any[];
          try {
            extractionJson = JSON.parse(cleanedJson);
          } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            console.error("Attempted to parse:", cleanedJson);
            throw new Error("GPT returned invalid JSON format. Please try again.");
          }
      
          // Validate it's an array
          if (!Array.isArray(extractionJson)) {
            console.error("Expected array, got:", typeof extractionJson);
            throw new Error("GPT returned non-array JSON. Expected an array of fields.");
          }
      
          // Validate array is not empty
          if (extractionJson.length === 0) {
            throw new Error("GPT returned empty array. No fields generated from goal.");
          }
      
          // Validate each field has required properties
          const validatedFields = extractionJson.map((field, index) => {
            if (!field.field_name || typeof field.field_name !== 'string') {
              throw new Error(`Field at index ${index} is missing 'field_name' property.`);
            }
      
            if (!field.response_type || typeof field.response_type !== 'string') {
              throw new Error(`Field '${field.field_name}' is missing 'response_type' property.`);
            }
      
            const validTypes = ['text', 'number', 'phone_no', 'email', 'pincode', 'url', 'date', 'boolean'];
            if (!validTypes.includes(field.response_type)) {
              throw new Error(`Field '${field.field_name}' has invalid response_type: ${field.response_type}`);
            }
      
            // Ensure required field exists (default to true if missing)
            if (typeof field.required !== 'boolean') {
              field.required = true;
            }
      
            // Ensure value is null
            field.value = null;
      
            // Add prompt_hint if missing
            if (!field.prompt_hint) {
              field.prompt_hint = field.field_name.replace(/_/g, ' ');
            }
      
            return field;
          });
      
          console.log("✓ Successfully generated", validatedFields.length, "extraction fields");
          return validatedFields;
      
        } catch (error: any) {
          console.error("Error in getExtractFields:", error);
          
          // Provide more helpful error messages
          if (error.message?.includes("API request failed")) {
            throw new Error(`Failed to connect to OpenAI API: ${error.message}`);
          } else if (error.message?.includes("invalid JSON")) {
            throw new Error("GPT returned malformed data. Please try again or simplify your goal.");
          } else {
            throw new Error(`Failed to generate extraction fields: ${error.message || 'Unknown error'}`);
          }
        }
      }
      
}