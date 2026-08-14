# Moonze Repository

This repository hosts **two independent projects** that share no code:

| Project | What it is | Where it lives |
| --- | --- | --- |
| **Flawless** | WhatsApp & Web AI beauty concierge for salons & spas (Node.js + TypeScript) | `src/`, `public/`, `tests/`, root `package.json` |
| **Zatu** | Smart mobile-money lending platform (FastAPI backend + React frontend) | `backend/`, `frontend/`, `docs/` |

Each project's full documentation is included below.

---

# Flawless — WhatsApp & Web AI Beauty Concierge for Salons & Spas

Flawless is an intelligent assistant for salons and beauty spas. It lets customers
(primarily women looking for a specific hairdo) **discover salons, see available
times, book appointments, get transparent pricing, unlock discounts, receive
review-based recommendations, and arrange transport** — all through WhatsApp or
an embeddable website chat widget.

It ships with a built-in **rule-based conversation engine** so everything works
end-to-end with **zero external dependencies**, and a single, clean seam to
**embed OpenAI** for richer natural-language replies in the future.

## What it can do

- **Find salons for a hairdo** — "find knotless braids near me" returns the best
  salons offering that style, sorted by proximity (when location is shared) or by
  a blended rating/review score.
- **Availability & booking** — shows open time slots based on salon hours and
  service duration, then books the appointment (with double-booking protection).
- **Mobile / come-to-you service** — a stylist can meet the customer at home or
  work; Flawless quotes the exact **mobile markup**.
- **Smart discounts** — **pre-booking discount** for booking ahead, and a
  **verified student discount** unlocked on proof (student ID or `.edu` / `.ac.*`
  email). Discounts are shown as transparent line items.
- **Review-based recommendations** — suggests other salons that do "almost the
  same good job" for the same service.
- **Transport / ride-hailing** — for customers without personal transport, Flawless
  surfaces partnered ride-hailing apps (Uber / Bolt / Little) with discount codes,
  one-tap deep links, and whether a **covered late-night return** ride is offered
  for appointments finishing late.
- **Two channels, one brain** — the same assistant powers a **WhatsApp Cloud API**
  webhook and an **embeddable web widget** (also usable in a salon's own site chat).

## Architecture

```
src/
  config.ts              # env-driven config (OpenAI + WhatsApp optional)
  app.ts / index.ts      # Express app + server bootstrap
  data/seed.ts           # sample salons + service catalog
  domain/
    types.ts             # domain models
    pricing.ts           # markup / pre-booking / student discount engine
    salonService.ts      # service matching, nearest search, recommendations
    booking.ts           # availability slotting + appointment store
    transport.ts         # ride-hailing plan + deep links + late return
  ai/
    nlu.ts               # rule-based intent + slot extraction
    assistant.ts         # stateful conversation orchestrator (+ OpenAI augment)
    openai.ts            # optional OpenAI Chat Completions wrapper (the "future" seam)
  channels/
    whatsapp.ts          # Meta WhatsApp Cloud API webhook + sender
    webchat.ts           # REST endpoint for the web widget
public/
  widget.js              # drop-in embeddable chat widget
  demo.html              # demo salon storefront with the widget embedded
tests/                   # Jest unit + API tests
```

## Getting started

```bash
npm install
cp .env.example .env       # optional: add OpenAI / WhatsApp credentials
npm test                   # run the test suite
npm run dev                # start on http://localhost:3000
```

Then open `http://localhost:3000/demo.html` and click the 💇🏽‍♀️ bubble.

## Embedding the widget on any salon site

```html
<script src="https://YOUR_HOST/widget.js" data-flawless-api="https://YOUR_HOST"></script>
```

## HTTP endpoints

- `GET  /health` — status + whether OpenAI is enabled
- `GET  /api/salons`, `GET /api/services` — catalogs for site integrations
- `POST /api/chat` — `{ sessionId, message, location?, name?, phone? }` → assistant reply
- `POST /api/reset` — `{ sessionId }` clears a conversation
- `GET/POST /webhook/whatsapp` — WhatsApp Cloud API verification + inbound messages

## Enabling OpenAI (future)

Set `OPENAI_API_KEY` in `.env`. When present, Flawless keeps all deterministic
business logic (pricing, availability, bookings) intact but rewrites replies
through OpenAI for a warmer, more natural tone. Without a key, the rule-based
engine handles everything.

## Enabling WhatsApp

Set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, and
`WHATSAPP_PHONE_NUMBER_ID`, then point your Meta app's webhook at
`/webhook/whatsapp`. Without credentials, outbound replies are logged so the
flow is still fully testable.

## Tech

Node.js + TypeScript + Express, Jest + Supertest for tests, no database (in-memory
stores that can be swapped for a real DB in production).

---

# Zatu — Smart Mobile-Money Lending Platform

Zatu is an MVP micro-lending platform for a Zambian fintech. It turns a
customer's **mobile-money behaviour** into an instant, explainable credit
decision, runs them through **KYC (NRC + T-PIN + Face ID)**, screens for
**fraud**, disburses and collects through a **pay-way**, and gives the business
an **intelligence layer** (portfolio KPIs, segment performance, repayment
nudges) to build a pipeline of good customers.

> This is a working reference implementation, not a production system. It ships
> a **mock payment provider** and **simulated KYC/biometrics** so the whole
> journey runs end-to-end locally. See "Going to production" below.

---

## What it does (mapped to the brief)

| Requirement | Where it lives |
| --- | --- |
| Onboard with mobile number, NRC, T-PIN | `backend/app/routers/onboarding.py`, `models/customer.py` |
| Face-ID onboarding (front + back of ID + selfie) | KYC step in `onboarding.py` (`face_match_score`, capture flags) |
| Read default risk from mobile-money activity | `services/credit_scoring.py` |
| Read financial capacity from top-ups / inflow | `credit_scoring.py` (income proxy, net cash-flow, affordability limit) |
| Qualify via financial history from KYC-provided platform | `services/loan_service.py` (`check_eligibility`) |
| Detect existing loans & flag eligibility | `loan_service.py` (`existing_exposure`, debt-to-income headroom) |
| Pay-way: disburse loans + receive money in | `services/payments.py` (`disburse` / `collect`) |
| Engaging, easy-to-use interface | `frontend/` (React onboarding wizard + dashboard) |
| Intelligence: performance by segment, payment rate | `services/intelligence.py`, dashboard |
| Warning a week before due date + repayment nudges | `intelligence.py` (`upcoming_due`, `generate_nudges`) |
| Risk frame against digital-loan fraud | `services/risk_engine.py` |

---

## Architecture

```
frontend (React + Vite + TS)  ──HTTP──▶  backend (FastAPI)
                                              │
        ┌─────────────────────────────────────┼───────────────────────────────┐
        │              │              │        │            │                   │
   credit_scoring   risk_engine   loan_service │       intelligence        payments
   (score/PD/limit) (fraud rules) (eligibility │      (KPIs, segments,   (disburse/
                                   + lifecycle) │       nudges)            collect)
                                              SQLAlchemy ── SQLite/Postgres
```

- **Backend:** FastAPI + SQLAlchemy 2.0, SQLite by default (swap `ZATU_DATABASE_URL` for Postgres).
- **Frontend:** React 18 + TypeScript + Vite + Recharts, dark modern UI.
- **Tests:** 34 pytest tests across scoring, risk, loan lifecycle, intelligence and the API.

---

## Running locally

### Backend

```bash
cd backend
pip install -r requirements.txt          # or use a virtualenv
python -m app.seed                        # optional: seed demo customers & loans
python -m uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)
```

### Frontend

```bash
cd frontend
npm install
npm run dev                               # http://localhost:5173 (proxies /api -> :8000)
```

### Tests

```bash
cd backend && python -m pytest
```

---

## The credit engine (how mobile money → a decision)

`credit_scoring.assess()` produces a **300–850 score**, a **risk band (A–E)**, a
**probability of default**, and a **recommended limit** — every point traced to a
named, explainable factor:

- **Account tenure** — older wallets repay better.
- **Income proxy** — average monthly inflow (top-ups + transfers received).
- **Liquidity** — average wallet balance held.
- **Engagement** — monthly transaction count.
- **Financial discipline** — recurring bill payments.
- **Cash-out ratio** — heavy pass-through behaviour is penalised.
- **Airtime regularity** — small, consistent recurring behaviour.

The **recommended limit is anchored to affordability** (a multiple of net
monthly cash-flow, scaled by band), then `loan_service` further caps it by the
debt-to-income headroom after subtracting **existing loan exposure** — so we
never lend more than a customer can repay, and we detect over-indebtedness.

---

## Risk & fraud framework

`risk_engine.evaluate()` runs a battery of rules and returns a verdict; any
`CRITICAL` signal blocks lending outright.

- **Identity integrity** — KYC completeness, Face-ID/selfie match strength.
- **Duplication** — same NRC / shared device across accounts (fraud rings, synthetic IDs).
- **Account takeover** — recent SIM swap on the funding wallet.
- **Behavioural** — brand-new pass-through wallets.
- **Velocity** — bursts of loan applications in 24h.
- **Credit history** — active overdue / defaulted loans.

See [`docs/RISK_AND_MITIGATION.md`](docs/RISK_AND_MITIGATION.md) for the full
playbook, including how FairMoney / Tala / Branch-style lenders manage risk and
what to add before going live.

---

## Intelligence layer

- **Portfolio KPIs:** outstanding book, on-time payment rate, PAR (portfolio at risk), default rate.
- **Segment performance:** the same KPIs sliced by risk band, MNO or region — so acquisition can be steered toward the best-performing segments ("a pipeline of good customers").
- **Repayment radar:** loans due within a configurable window (default **7 days**) or already overdue, with auto-generated SMS **nudges** that fire *before* the due date.

---

## Going to production (what's mocked)

- **Payments:** replace `MockPaymentProvider` with a real aggregator (Flutterwave, Lenco, Broadpay) or direct MNO integrations (Airtel Money, MTN MoMo, Zamtel Kwacha). The `PaymentProvider` protocol is the only touch-point.
- **KYC/biometrics:** wire NRC OCR + liveness/face-match to a provider (e.g. Smile ID, Premier Credit, ZamPay eKYC) and store artefacts in secure object storage; feed the real match score into the risk engine.
- **Mobile-money data:** pull consented statements via the MNO / an aggregator and compute the `MobileMoneyProfile` features from raw transactions.
- **Auth, audit, encryption, rate limiting, and a real scheduler** for the nudge/overdue jobs (e.g. Celery/APScheduler) are out of scope for this MVP.
