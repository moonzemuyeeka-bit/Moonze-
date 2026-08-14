# Regional360 — AI Regional Manager Operating System

Regional360 is an **AI decision-support and execution system** for regional sales
managers. It is deliberately *not* a CRM with AI bolted on. Traditional software
tells you *what happened*; Regional360 helps you understand **what happened → why
it happened → what to do next → whether it worked**.

The product enforces one loop everywhere:

> **Observe → Diagnose → Decide → Act → Measure**

Every metric surfaces its value, target, trend, an AI diagnosis and a next
action. Every AI recommendation is transparent — it carries its **Why**,
**Supporting Data**, **Confidence** and a **Suggested Action**.

---

## Quick start

```bash
cd regional360
npm install
npm run dev
# open http://localhost:3000 and click "Enter Demo Mode"
```

**No environment variables are required.** The app runs entirely on a
deterministic in-memory demo dataset, so there are no external services, API
keys, or databases to configure.

Other scripts:

```bash
npm run build   # production build
npm run lint    # eslint
npx tsc --noEmit
```

---

## Environment variables (all optional)

Copy `.env.example` to `.env` only if you want to connect real services.

| Variable | Purpose | Default |
| --- | --- | --- |
| `AI_PROVIDER` | `demo` (deterministic, no key) or `openai` | `demo` |
| `OPENAI_API_KEY` | Used only when `AI_PROVIDER=openai`; **server-side only** | — |
| `OPENAI_MODEL` | Model name for the OpenAI provider | `gpt-4o-mini` |
| `AUTH_SECRET` | Reserved for signing sessions when SSO is added | dev default |
| `DATABASE_URL` | Managed PostgreSQL connection (Phase 3) | — |

The AI key is read **only on the server** (Copilot route / provider). It is
never sent to the browser.

---

## Architecture

```
regional360/
├─ prisma/schema.prisma        # full production data model (Postgres), Phase 3
├─ prisma.config.ts            # Prisma 7 config (connection URL lives here)
└─ src/
   ├─ app/
   │  ├─ login/                # demo login (server action)
   │  ├─ (app)/                # authenticated shell (sidebar + topbar + Copilot)
   │  │  ├─ briefing/          # Daily AI Briefing → "Start My Day"
   │  │  ├─ dashboard/         # Executive Dashboard
   │  │  ├─ performance/       # Diagnosis + Sales Funnel + Sales Cycle
   │  │  ├─ pipeline/          # Kanban + table
   │  │  ├─ team/              # Command Centre + AI coaching
   │  │  ├─ accounts/[id]/     # Health, retention risk, cross-sell
   │  │  ├─ market/            # Opportunity Radar (demo data)
   │  │  ├─ campaigns/         # Campaign → revenue funnel
   │  │  ├─ actions/           # Action Centre
   │  │  ├─ copilot/           # AI Copilot console
   │  │  ├─ reports/           # Weekly Business Review
   │  │  └─ settings/          # Thresholds, demo mode, CSV import
   │  └─ api/copilot/          # server-only AI endpoint (keys stay server-side)
   ├─ lib/
   │  ├─ demo/                 # deterministic seeded dataset generator
   │  ├─ repositories/         # single swap point: demo now, Prisma later
   │  ├─ services/             # pure analytics: KPIs, funnel, cycle,
   │  │                        #   diagnostics, team, accounts, actions, report
   │  ├─ ai/                   # AIProvider interface + demo/openai providers
   │  ├─ auth/                 # cookie session abstraction (SSO-ready)
   │  └─ config.ts             # configurable status thresholds
   ├─ components/
   │  ├─ ui/                   # shadcn-style primitives
   │  ├─ charts/               # Recharts wrappers
   │  ├─ layout/               # sidebar, topbar, Copilot drawer
   │  ├─ providers/            # theme, action store, Copilot state
   │  └─ shared/               # MetricCard, AiAnswerCard, status pills, …
   └─ proxy.ts                 # route protection (Next 16 proxy convention)
```

### Key design decisions

- **Demo-first, DB-ready.** The MVP runs on a deterministic dataset generated
  by a seeded RNG (stable across restarts). All data access goes through
  `src/lib/repositories`, which is the single place to swap in a Prisma-backed
  implementation later. The Prisma schema for the full data model is already
  authored in `prisma/schema.prisma`.
- **Provider-agnostic AI.** `src/lib/ai` defines an `AIProvider` interface. The
  default `DemoProvider` is rule-based and reasons deterministically over the
  same computed metrics the UI shows (so answers always match the screens). An
  optional `OpenAIProvider` is enabled with `AI_PROVIDER=openai` and falls back
  to the demo provider if no key is present.
- **Transparent AI.** Every answer returns `{ recommendation, why,
  supportingData, confidence, suggestedAction }`. Demo/market data is clearly
  labelled, and diagnostic scores are described as AI assessments, not
  validated predictions.
- **Threshold-driven statuses.** Performance and health classifications derive
  from configurable thresholds (`src/lib/config.ts`, editable in Settings) —
  never arbitrary.

---

## The demo narrative

The dataset is crafted so the diagnostic loop tells a coherent story:

- Regional revenue lands around **87% of target** (a real gap to diagnose).
- **David Chen** is the lowest-performing rep (skill-driven model).
- The **approval** stage is a widening process bottleneck lengthening the cycle.
- **ABC Manufacturing** is an at-risk flagship account (declining revenue,
  open complaints, near-term renewal).

Ask the Copilot "Why are we behind target?" and it will diagnose coverage,
conversion and the approval bottleneck with the supporting numbers.

---

## Remaining work (Phase 2/3)

- **Persistence:** wire the repository layer to Prisma/PostgreSQL and seed real
  data; add server-side persistence for actions and coaching progress (today
  they use `localStorage`).
- **Auth:** replace the demo cookie session with enterprise SSO behind the same
  `src/lib/auth` abstraction.
- **CSV import:** the Settings importer validates and maps client-side; wire it
  to real ingestion + storage.
- **Reports:** richer export (server-rendered PDF) beyond the browser print flow.
- **Live AI:** production hardening of the OpenAI provider (streaming, rate
  limiting, caching) and additional providers.
- **Thresholds:** apply Settings thresholds to server-side computation (they are
  stored locally in the MVP).
