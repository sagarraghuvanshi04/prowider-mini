# Prowider Mini — Lead Distribution System

## Prerequisites

- Node.js 18+
- MongoDB Atlas account (or a local MongoDB replica set — transactions require a replica set)

---

## Setup & Run

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd prowider-mini
```

### 2. Backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```env
MONGO_URI=<your-mongodb-atlas-connection-string>
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

Seed the database (run once — inserts 3 services and 8 providers):

```bash
npm run seed
```

Start the server:

```bash
npm start
```

Server runs on **http://localhost:4000**

### 3. Frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file inside `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Start the dev server:

```bash
npm run dev
```

Frontend runs on **http://localhost:3000**

---

## Pages

| Route | Description |
|---|---|
| `/request-service` | Public customer enquiry form |
| `/dashboard` | Provider dashboard with real-time updates |
| `/test-tools` | Payment gateway simulator — webhook & concurrency testing |

---

## Project Structure

```
backend/
├── models/
│   ├── Service.js        # Service 1, 2, 3
│   ├── Provider.js       # 8 providers — quota, leadsReceived, rrCounters
│   ├── Lead.js           # Unique index on (phone, serviceId)
│   └── WebhookEvent.js   # Idempotency store — unique index on eventId
├── lib/
│   ├── allocator.js      # Core allocation logic (mandatory + round-robin)
│   └── sse.js            # Server-Sent Events broadcaster
├── routes/
│   ├── services.js       # GET /api/services
│   ├── leads.js          # POST /api/leads, GET /api/leads, PATCH /api/leads/:id/status
│   ├── providers.js      # GET /api/providers, GET /api/providers/:id/leads
│   ├── webhook.js        # POST /api/webhook/reset-quota, POST /api/webhook/bulk-leads
│   ├── events.js         # GET /api/events (SSE stream)
│   └── stats.js          # GET /api/stats
├── seed.js
└── server.js

frontend/
├── app/
│   ├── components/
│   │   └── Navbar.tsx
│   ├── request-service/page.tsx
│   ├── dashboard/page.tsx
│   ├── test-tools/page.tsx
│   └── page.tsx
└── lib/
    └── config.ts
```

---

## Allocation Algorithm

Every new lead is assigned to **exactly 3 providers** using a two-step process:

### Step 1 — Mandatory Assignment

Each service has one or two providers that must always receive the lead (if their quota is available):

| Service | Mandatory Provider(s) |
|---|---|
| Service 1 | Provider 1 |
| Service 2 | Provider 5 |
| Service 3 | Provider 1 and Provider 4 |

These are assigned first, before any pool selection. If a mandatory provider's quota is full, that slot falls to the pool.

### Step 2 — Fair Pool Fill (Round-Robin)

After mandatory slots are filled, remaining slots are filled from a service-specific pool:

| Service | Pool Providers |
|---|---|
| Service 1 | Providers 2, 3, 4 |
| Service 2 | Providers 6, 7, 8 |
| Service 3 | Providers 2, 3, 5, 6, 7, 8 |

Pool providers are selected by sorting on `rrCounters[serviceId]` ascending — the provider with the **lowest assignment count goes first**. Ties are broken alphabetically by name (deterministic, never random).

After each assignment, the selected provider's `rrCounter` is incremented via `$inc` directly in MongoDB. This means:
- The rotation state **persists across server restarts** — it lives in the database, not in memory
- Over time, every pool provider receives an equal share of leads
- The same provider is never favoured repeatedly

**Example rotation for Service 1 pool (P2, P3, P4), all starting at 0:**

| Lead | Counters before | Selected | Counters after |
|---|---|---|---|
| Lead 1 | P2=0, P3=0, P4=0 | P2 (tie → name) | P2=1, P3=0, P4=0 |
| Lead 2 | P2=1, P3=0, P4=0 | P3 (lowest) | P2=1, P3=1, P4=0 |
| Lead 3 | P2=1, P3=1, P4=0 | P4 (lowest) | P2=1, P3=1, P4=1 |
| Lead 4 | P2=1, P3=1, P4=1 | P2 (tie → name) | P2=2, P3=1, P4=1 |

---

## How Concurrency Was Handled

Concurrency is handled with two independent layers that work together:

### Layer 1 — MongoDB Transaction

Every lead creation wraps all operations in a single atomic transaction:

```
session.withTransaction(async () => {
  1. Check for duplicate lead (phone + serviceId)
  2. Run assignProviders — reads provider state, selects providers
  3. Lead.create — saves the lead with assigned providers
})
```

If any step fails, the entire transaction rolls back. A lead cannot exist in the database without its providers already assigned, and no partial state is ever committed.

### Layer 2 — Atomic Quota Guard

Inside `assignProviders`, every provider increment uses `findOneAndUpdate` with a `$lt` condition:

```js
Provider.findOneAndUpdate(
  { _id: p._id, leadsReceived: { $lt: p.monthlyQuota } },
  { $inc: { leadsReceived: 1 } },
  { session }
)
```

This is the critical safety net. Even if 10 simultaneous requests all read `leadsReceived: 9` at the same time, MongoDB evaluates the `$lt: 10` condition atomically at the storage level. Only the correct number of increments succeed. The rest return `null` and that provider is skipped. **A provider's quota cannot overflow under any concurrent load.**

These two layers together mean:
- No two transactions can assign the same provider past its quota
- No lead can be saved without a valid assignment
- The system behaves correctly whether 1 or 100 requests arrive simultaneously

---

## How Webhook Idempotency Is Ensured

The `POST /api/webhook/reset-quota` endpoint requires an `eventId` in the request body. This simulates how real payment gateways attach a unique event ID to every webhook call.

### Mechanism

On every call, the server attempts to insert the `eventId` into the `WebhookEvent` collection:

```js
await WebhookEvent.create({ eventId });
```

The `WebhookEvent` schema has a **unique index on `eventId`**:

```js
eventId: { type: String, required: true, unique: true }
```

- **First call** — insert succeeds → quota reset runs → `200 { message: 'Quota reset successful' }`
- **Any repeat call with the same `eventId`** — insert throws MongoDB error code `11000` (duplicate key) → handler returns immediately → `200 { idempotent: true }`

The `updateMany` that resets provider quotas **never runs** on a duplicate call.

### Why this is correct

The idempotency check is enforced at the **database level**, not just in application logic. This means:
- Even if two identical webhook calls arrive at exactly the same time, only one insert can succeed
- There is no TOCTOU (time-of-check-time-of-use) race condition that a `findOne → create` pattern would have
- The system is safe against network retries, duplicate deliveries, and manual re-triggers

---

## Testing Scenarios

### Duplicate lead
Submit the same phone number + service twice from `/request-service`. The second submission returns `409 Conflict`.

### Concurrency
On `/test-tools`, click **"Generate 10 Leads"** — fires 10 simultaneous transactions. Check `/dashboard` to verify all providers stay within their quota of 10.

### Webhook idempotency
On `/test-tools`, click **"Confirm Payment"** once, then click **"Retry Webhook"** multiple times. Only the first call resets quota. All subsequent calls return `idempotent: true`.

### Real-time updates
Open `/dashboard` in one tab. Submit a new lead from `/request-service` in another tab. The dashboard updates automatically within seconds — no page refresh needed.
