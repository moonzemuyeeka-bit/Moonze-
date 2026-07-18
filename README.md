# Moonze — Smart Mobile-Money Lending Platform

Moonze is an MVP micro-lending platform for a Zambian fintech. It turns a
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

- **Backend:** FastAPI + SQLAlchemy 2.0, SQLite by default (swap `MOONZE_DATABASE_URL` for Postgres).
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
