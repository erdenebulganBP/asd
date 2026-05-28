# Project Status: Smart Supermarket (NestJS + AI)

This document summarizes the current state of the project for hand-off to other agents or developers.

---

## ✅ What is Working

### Core Backend
- **Database:** Prisma with Neon (PostgreSQL). Tables: `User`, `Product`, `Store`, `Discount`, `Order`, `OrderItem`.
- **Health Check:** `GET /health` verifies server and DB connectivity.
- **Validation:** All DTOs use `class-validator` decorators.
- **Error Handling:** Global `AllExceptionsFilter` returns clean JSON errors.
- **Scheduled Tasks:** `GeofenceService` runs every 2 minutes to check user proximity to stores.

### Scoring Engine (Rule-Based — Always Works)
- `POST /recommendations/generate` scores products using a weighted formula:
  - Purchase frequency (40%), Discount size (30%), Distance (20%), Category affinity (10%)
- Returns `scoredProducts` sorted by score with rule-based reasons as fallback.
- Geofence filtering: only shows discounts from stores within `GEOFENCE_RADIUS_METERS` (default 500m).

### AI Integration (LM Studio)
- **Recommendation AI:** Enhances scored products with AI-generated reasons.
- **Chatbot:** Multi-turn Mongolian conversation. Analyzes intent (party, dinner) and suggests products.
- **Bilingual:** System prompts tell the AI that product data is English but user may speak Mongolian.
- **JSON Repair:** Auto-repairs truncated JSON from local LLMs.
- **Reasoning Model Support:** Handles models (Gemma, DeepSeek) that return `reasoning_content` instead of `content`.
- **Graceful Fallback:** If LM Studio is offline, recommendations still work (rule-based only).

### Frontend (`public/index.html`)
- Single-file HTML with Tailwind CSS.
- Product listing, basket management, AI chatbot with clickable suggestion buttons.
- Recommendations section updates when basket changes.

### Notifications
- Firebase FCM support. Falls back to mock mode (console logging) if credentials are missing.

---

## ⚠️ Known Issues & Limitations

### 1. AI Model Compatibility (CRITICAL)
**Problem:** The project currently uses `google/gemma-4-e4b` which is a "thinking" model. It spends most of its token budget on internal `reasoning_content` and often returns **empty `content`** or gets truncated (`finish_reason: "length"`).

**Current Mitigations Applied:**
- `max_tokens` increased to 2048 for both chat and recommendations.
- Code now checks `reasoning_content` when `content` is empty and extracts JSON from it.
- `<think>` and `<thought>` blocks are stripped from responses.

**Recommended Fix:** Switch to a non-reasoning model in LM Studio:
- ✅ `mistral-7b-instruct` — best balance of speed and quality
- ✅ `phi-3-mini` — fast, good at following JSON format
- ✅ `llama-3-8b-instruct` — good Mongolian support
- ❌ `gemma-4-e4b` — uses reasoning tokens, often returns empty content

Set in `.env`:
```env
LM_STUDIO_MODEL=mistral-7b-instruct
```

### 2. Discount Context Format (FIXED)
**Was:** The `/recommendations/generate` endpoint sent discount names to AI without product IDs:
```
Coca-Cola 2L 22% off at Emart Ulaanbaatar
```
**Now:** Sends explicit IDs and categories:
```
[ID: 1] Coca-Cola 2L (Drinks) 22% off at Emart Ulaanbaatar
```
This allows the AI to return correct `productId` values in its JSON response.

### 3. Authentication
- No auth system. Frontend is hardcoded to `userId: 1`.

### 4. Firebase
- Real push notifications require valid `FIREBASE_PRIVATE_KEY` in `.env`. Currently runs in mock mode.

### 5. Seed Data Expiry
- Discounts in `prisma/seed.ts` are set to expire 7 days after seeding. Re-run `npx ts-node prisma/seed.ts` if discounts appear empty.

---

## 🏗 Architecture Flow

```
User Request (lat/lon/basket)
    │
    ▼
RecommendationsService.generate()
    │
    ├── 1. Load user purchase history
    ├── 2. Find active discounts within radius (Haversine)
    ├── 3. Score each product (frequency × discount × distance × category)
    ├── 4. Call AiService.getRecommendations() for enhanced reasons
    │       └── Sends: [ID: #] ProductName (Category) X% off at StoreName
    │       └── Expects: { recommendedProducts: [{ productId, reason }] }
    ├── 5. Merge AI reasons into scored products
    └── 6. Return sorted results
```

```
Chat Request (userId, message, basket)
    │
    ▼
AiController.chat()
    │
    ├── 1. Load user + purchase history from DB
    ├── 2. Load active discounts with [ID: #] format
    ├── 3. Call AiService.chat() with Mongolian system prompt
    │       └── AI responds in Mongolian + appends [IDS: 1, 2, 3]
    ├── 4. Parse product IDs from response
    ├── 5. Fetch suggested products from DB
    └── 6. Return { response, suggestedProducts }
```

---

## 🛠️ Execution Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript |
| `npm run start:dev` | Run with hot-reload |
| `npx prisma db push` | Sync schema to DB |
| `npx ts-node prisma/seed.ts` | Seed test data (25 products, 10 discounts) |
| `npx prisma studio` | Visual DB browser |

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `src/ai/ai.service.ts` | Core AI logic — recommendations + chat + JSON repair |
| `src/ai/ai.controller.ts` | Chat endpoint — loads context from DB, formats discounts |
| `src/recommendations/recommendations.service.ts` | Scoring engine + AI orchestration |
| `public/index.html` | Entire frontend (single file) |
| `src/common/filters/http-exception.filter.ts` | Global error handler |
| `src/geofence/geofence.service.ts` | Auto-scheduler (every 2 min) |
| `prisma/seed.ts` | Test data (products, stores, discounts, orders) |

---

## 🔧 Environment Variables

```env
# Required
DATABASE_URL=postgresql://...

# Optional (AI)
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=mistral-7b-instruct    # ← Change this to match your loaded model

# Optional (Notifications)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."

# Optional (Tuning)
GEOFENCE_RADIUS_METERS=500
RECOMMENDATION_SCORE_THRESHOLD=0.3
```

---

## 📝 What Needs Work Next

1. **Test with a proper instruct model** — Switch from Gemma reasoning model to Mistral/Phi/Llama instruct.
2. **Multi-turn chat memory** — Currently each chat message is stateless (no conversation history sent to AI).
3. **Authentication** — Add JWT or session-based auth.
4. **Product search endpoint** — Add `GET /products/search?q=` with bilingual fuzzy matching.
5. **Better JSON extraction** — For reasoning models, consider a two-pass approach (let model think, then ask for JSON only).
