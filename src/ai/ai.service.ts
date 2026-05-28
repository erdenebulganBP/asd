import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiRecommendation {
  productId: number;
  reason: string;
}

export interface AiRecommendationResponse {
  recommendedProducts: AiRecommendation[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private config: ConfigService) {}

  async getRecommendations(
    purchaseHistory: string[],
    currentBasket: string[],
    nearbyDiscounts: string[],
  ): Promise<AiRecommendationResponse> {
    let baseUrl = this.config.get('LM_STUDIO_BASE_URL') || 'http://localhost:1234/v1';
    if (!baseUrl.endsWith('/v1')) {
      baseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
    }
    const model = this.config.get('LM_STUDIO_MODEL') || 'mistral-7b-instruct';

    const payload = {
      history: purchaseHistory,
      basket: currentBasket,
      discounts: nearbyDiscounts,
    };

    const systemPrompt = `You are a supermarket recommendation AI.
Analyze the user's purchase history, current basket, and nearby discounts.
The data contains product names in English, but you should understand them even if the user asks in Mongolian.

Return ONLY valid JSON — no explanation, no markdown, no extra text.

Return this exact format:
{
  "recommendedProducts": [
    {
      "productId": <number>,
      "reason": "<why this product is recommended>"
    }
  ]
}

Rules:
- Prioritize discounted products the user has bought before
- Suggest complementary products (chips + drinks, noodles + drinks)
- Keep reasons short and specific (1 sentence)
- Only recommend products from the discounts list using the explicit [ID: #] provided in the list.`;

    const userMessage = JSON.stringify(payload);

    try {
      this.logger.log(`Calling LM Studio for recommendations at ${baseUrl}`);
      this.logger.debug(`Payload: ${userMessage}`);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          temperature: 0.3,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio responded with ${response.status}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message;
      let text = message?.content || '';

      // Some models (Gemma, DeepSeek) put the actual answer in reasoning_content
      // If content is empty but reasoning_content has data, extract JSON from it
      if (!text && message?.reasoning_content) {
        this.logger.warn('AI returned empty content, checking reasoning_content...');
        const reasoning = message.reasoning_content;
        // Try to extract JSON from reasoning
        const jsonMatch = reasoning.match(/\{[\s\S]*"recommendedProducts"[\s\S]*\}/);
        if (jsonMatch) {
          text = jsonMatch[0];
          this.logger.log('Extracted JSON from reasoning_content');
        }
      }

      this.logger.debug(`AI raw response: ${text}`);
      this.logger.log(`AI raw response length: ${text.length}`);

      // Check if the response was truncated (finish_reason: "length")
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === 'length') {
        this.logger.warn('AI response was truncated (finish_reason: length)');
      }

      // 1. Remove "thinking" or reasoning blocks if present (common in models like Gemma/DeepSeek)
      let clean = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
      clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      clean = clean.replace(/```json|```/g, '').trim();


      // 2. Simple JSON Repair: If it ends abruptly, try to close the brackets
      if (clean.startsWith('{') && !clean.endsWith('}')) {
        this.logger.warn('AI response truncated, attempting repair...');
        if (clean.includes('"recommendedProducts": [')) {
          clean = clean.split('}').slice(0, -1).join('}') + '}]}';
        } else {
          clean += '"}'; 
        }
      }

      const parsed: AiRecommendationResponse = JSON.parse(clean);
      return parsed;
    } catch (err) {
      this.logger.warn(`LM Studio unavailable or error: ${err.message}`);
      return { recommendedProducts: [] };
    }
  }

  async chat(
    userId: number,
    message: string,
    purchaseHistory: string[],
    currentBasket: string[],
    nearbyDiscounts: string[],
  ): Promise<{ response: string; suggestedProductIds: number[] }> {
    let baseUrl = this.config.get('LM_STUDIO_BASE_URL') || 'http://localhost:1234/v1';
    if (!baseUrl.endsWith('/v1')) {
      baseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
    }
    const model = this.config.get('LM_STUDIO_MODEL') || 'mistral-7b-instruct';

    const systemPrompt = `Та бол ухаалаг супермаркетын туслах AI байна. 
Хэрэглэгчийн мессеж, худалдан авалтын түүх, сагсанд байгаа бараа болон ойр орчимд байгаа хямдралуудад үндэслэн тусламж үзүүлнэ үү.

ДҮРЭМ:
1. ЗӨВХӨН Монгол хэлээр хариулна уу.
2. Хэрэглэгчийн зорилгыг (үдэшлэг, амралт, оройн хоол гэх мэт) тодорхойлж, тохирох барааг санал болгоно.
3. Хямдралтай барааг онцолж "Одоо хямдралтай байна" гэж хэлээрэй.
4. Төсөв болон бусад сонголтын талаар (согтууруулах ундаа, ундаа гэх мэт) асуулт асууж яриаг үргэлжлүүлнэ үү.
5. САНАЛ БОЛГОЖ БУЙ БАРААНЫ ID-Г ЗААВАЛ ХАРИУЛТЫН ТӨГСГӨЛД [IDS: 1, 2, 3] ХЭЛБЭРЭЭР ОРУУЛНА УУ. Энэ формат маш чухал!
- Санал болгож буй бараануудын нийт үнийг тооцоолж хэлээрэй.

Одоогийн нөхцөл байдал:
- Түүх: ${purchaseHistory.join(', ')}
- Сагс: ${currentBasket.join(', ')}
- Хямдралууд: ${nearbyDiscounts.join(', ')}`;

    try {
      this.logger.log(`Calling LM Studio for chat at ${baseUrl}`);
      this.logger.debug(`User Message: ${message}`);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
        }),
      });

      if (!response.ok) throw new Error(`AI error: ${response.status}`);

      const data = await response.json();
      const chatMsg = data.choices?.[0]?.message;
      let text = chatMsg?.content || '';

      // Handle models that put response in reasoning_content (Gemma, etc.)
      if (!text && chatMsg?.reasoning_content) {
        this.logger.warn('Chat: empty content, extracting from reasoning_content');
        text = chatMsg.reasoning_content;
      }

      this.logger.debug(`Chat raw response: ${text}`);

      // Remove thinking blocks if present
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

      // Extract IDs from text like [IDS: 1, 2, 3]
      const idMatch = text.match(/\[IDS:\s*([\d,\s]+)\]/);
      const suggestedProductIds = idMatch
        ? idMatch[1].split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id))
        : [];

      // Remove the [IDS: ...] part from display text
      const cleanResponse = text.replace(/\[IDS:.*?\]/g, '').trim();

      return { response: cleanResponse, suggestedProductIds };
    } catch (err) {
      this.logger.error(`Chat AI failed: ${err.message}`);
      return {
        response: 'Уучлаарай, системд алдаа гарлаа. Та дахин оролдоно уу.',
        suggestedProductIds: [],
      };
    }
  }
}
