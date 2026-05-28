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
    availableProducts: string[] = [],
  ): Promise<{ response: string; suggestedProductIds: number[] }> {
    let baseUrl = this.config.get('LM_STUDIO_BASE_URL') || 'http://localhost:1234/v1';
    if (!baseUrl.endsWith('/v1')) {
      baseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
    }
    const model = this.config.get('LM_STUDIO_MODEL') || 'mistral-7b-instruct';

    // ─── STEP 1: Ask AI what categories are needed ───
    const categorizationPrompt = `You are a shopping assistant. The user wants to buy or cook something.
Determine which product CATEGORIES they need. Return ONLY a JSON array of category names.

Available categories: Drinks, Snacks, Instant Food, Alcohol, Household, Dairy, Meat, Bakery, Vegetables, Frozen, Cooking, Sauce

Examples:
- "банштай шөл хиймээр" → ["Meat", "Cooking", "Vegetables"]
- "fried chicken" → ["Meat", "Cooking", "Dairy"]
- "party хийх гэж байна" → ["Drinks", "Snacks", "Alcohol"]
- "цуйван хиймээр" → ["Meat", "Cooking", "Vegetables"]
- "зүгээр л snack авмаар" → ["Snacks", "Drinks"]
- "архи уумаар" or "arhi uumaar" → ["Alcohol", "Drinks", "Snacks"]
- "пиво авмаар" or "beer" → ["Alcohol", "Drinks", "Snacks"]
- "ундаа авмаар" → ["Drinks"]
- "өглөөний хоол" → ["Dairy", "Bakery", "Cooking"]
- "оройн хоол хийх" → ["Meat", "Vegetables", "Cooking"]

IMPORTANT: Understand Mongolian in both Cyrillic AND Latin transliteration.
"arhi" = "архи" = alcohol. "uumaar" = "уумаар" = want to drink.
"idmeer" = "идмээр" = want to eat.

Return ONLY the JSON array, nothing else.`;

    let relevantCategories: string[] = [];
    try {
      this.logger.log('Step 1: Determining needed categories...');
      const catResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          max_tokens: 256,
          temperature: 0.1,
          messages: [
            { role: 'system', content: categorizationPrompt },
            { role: 'user', content: message },
          ],
        }),
      });

      if (catResponse.ok) {
        const catData = await catResponse.json();
        const catMsg = catData.choices?.[0]?.message;
        let catText = catMsg?.content || '';
        if (!catText && catMsg?.reasoning_content) {
          const match = catMsg.reasoning_content.match(/\[[\s\S]*?\]/);
          catText = match ? match[0] : '';
        }
        // Clean and parse
        catText = catText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        catText = catText.replace(/```json|```/g, '').trim();
        const arrMatch = catText.match(/\[[\s\S]*?\]/);
        if (arrMatch) {
          relevantCategories = JSON.parse(arrMatch[0]);
          this.logger.log(`Categories identified: ${relevantCategories.join(', ')}`);
        }
      }
    } catch (e) {
      this.logger.warn(`Category detection failed: ${e.message}, using all products`);
    }

    // ─── STEP 2: Filter products by relevant categories ───
    const filteredProducts = relevantCategories.length > 0
      ? availableProducts.filter(p => {
          const lower = p.toLowerCase();
          return relevantCategories.some(cat => lower.includes(`(${cat.toLowerCase()})`));
        })
      : availableProducts.slice(0, 15); // fallback: send first 15

    this.logger.log(`Sending ${filteredProducts.length} relevant products to AI (from ${availableProducts.length} total)`);

    // ─── STEP 3: Final response with only relevant products ───
    const systemPrompt = `Та бол супермаркетын туслах. БОГИНО, ТОДОРХОЙ хариулна уу.

ДҮРЭМ:
- Монгол хэлээр хариулна (Кирилл болон латин аль алинаар ойлгоно).
- Хариулт 3-6 мөрөөс ХЭТРЭХГҮЙ.
- Хэрэглэгч хоол хийх гэж байвал тухайн хоолны ОРЦУУДЫГ бодож, доорх жагсаалтаас тохирохыг санал болго.
- Монгол хоолны мэдлэг:
  • Банш/Бууз/Хуушуур = Гурил + Үхрийн мах/Хонины мах + Сонгино + Давс
  • Цуйван = Гоймон + Үхрийн мах/Хонины мах + Төмс + Сонгино + Лууван + Тос
  • Шарсан тахиа = Тахианы мах + Гурил + Өндөг + Тос + Давс
- Хэрэв бэлэн хоол (frozen) болон гараар хийх орц ХОЁУЛАА байвал, хоёуланг нь санал болго.
- Хэрэв хэрэглэгчийн хүссэн бараа БАЙХГҮЙ бол шударгаар хэл.
- Бараа бүрийг: "• Нэр - Үнэ₮" форматаар бич.
- Нийт үнийг бүхэл тоогоор хэл.
- ЧУХАЛ: Санал болгосон БҮХ барааны ID-г [IDS: ...] дотор оруул. Нэг ч бараа орхигдуулахгүй!
  Жишээ: 5 бараа санал болговол → [IDS: 16, 28, 15, 26, 27] (5 ID байх ёстой)

Боломжит бараа:
${filteredProducts.join('\n')}

Нөхцөл:
- Түүх: ${purchaseHistory.join(', ')}
- Сагс: ${currentBasket.join(', ')}
- Хямдрал: ${nearbyDiscounts.join(', ')}`;

    try {
      this.logger.log(`Step 3: Calling LM Studio for final chat response`);
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
