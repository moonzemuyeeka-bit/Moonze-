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
