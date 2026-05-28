# 🛒 Smart Supermarket API

AI-powered supermarket recommendation backend — NestJS + Prisma + PostgreSQL + LM Studio + Firebase FCM.

---

## ⚡ Quick Start (5 steps)

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env and set your DATABASE_URL at minimum
```

Minimum required `.env`:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/smart_supermarket"
```

### 3. Set up database
```bash
# Create the database first (in psql or pgAdmin)
# Then run:
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Seed mock data
```bash
npx ts-node prisma/seed.ts
```

### 5. Start the server
```bash
npm run start:dev
```

API is running at: `http://localhost:3000`

---

## 📬 Testing with Postman

Import `SmartSupermarket.postman_collection.json` into Postman.

### Recommended test order:

1. **GET /users** — confirm seed data loaded
2. **GET /stores/nearby?lat=47.9185&lon=106.9177** — verify geofence works
3. **GET /discounts/active** — confirm active discounts
4. **GET /users/1/history** — see John's purchase history
5. **POST /recommendations/generate** — the main endpoint (see body below)
6. **POST /notifications/send** — test notification (mock mode if no Firebase)

### Key request — Generate Recommendations:
```json
POST /recommendations/generate
{
  "userId": 1,
  "latitude": 47.9185,
  "longitude": 106.9177,
  "currentBasket": []
}
```

---

## 🤖 Optional: LM Studio Setup

1. Download LM Studio: https://lmstudio.ai
2. Download a model (recommended: `mistral-7b-instruct` or `phi-3-mini`)
3. Start the local server in LM Studio (port 1234)
4. Add to `.env`:
```env
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=mistral-7b-instruct
```

Without LM Studio, the system works fine — it falls back to rule-based reasons automatically.

---

## 🔥 Optional: Firebase FCM Setup

1. Go to Firebase Console → New Project
2. Project Settings → Service Accounts → Generate New Private Key
3. Add to `.env`:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Without Firebase, notifications are logged to console only (mock mode).

---

## 📡 All Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /users | Create user |
| GET | /users | List all users |
| GET | /users/:id | Get user + orders |
| PATCH | /users/:id/location | Update GPS location |
| GET | /users/:id/history | Purchase frequency |
| GET | /products | List products |
| GET | /products?category=Drinks | Filter by category |
| POST | /products | Create product |
| GET | /stores | List stores |
| GET | /stores/nearby?lat=&lon=&radius= | Nearby stores |
| GET | /discounts | All discounts |
| GET | /discounts/active | Active discounts |
| GET | /discounts/active?storeId=1 | By store |
| POST | /discounts | Create discount |
| POST | /recommendations/generate | Generate recommendations |
| POST | /notifications/send | Send FCM notification |
| POST | /ai/recommend | Direct AI call |

---

## 🏗 Project Structure

```
src/
├── main.ts                   # Entry point
├── app.module.ts             # Root module
├── prisma/                   # Database service
├── common/utils/haversine    # Distance calculation
├── users/                    # User CRUD + purchase history
├── products/                 # Product CRUD
├── stores/                   # Store CRUD + nearby detection
├── discounts/                # Discount CRUD + active filter
├── recommendations/          # Scoring engine + AI orchestration
├── ai/                       # LM Studio integration
├── notifications/            # Firebase FCM
└── geofence/                 # Scheduler + location trigger
```

---

## 🔄 Geofence Auto-Scheduler

Runs every 2 minutes automatically. For every user with a saved location:
1. Finds nearby stores
2. Checks active discounts
3. Scores products
4. Sends FCM notification if score ≥ threshold

To trigger manually, just call `POST /recommendations/generate` with a user's coordinates.
