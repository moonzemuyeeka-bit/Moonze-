# Risk & Fraud Mitigation Playbook

How Moonze keeps losses low, and what to add as the book grows. It draws on how
digital micro-lenders such as **FairMoney**, **Tala** and **Branch** operate,
adapted to the Zambian mobile-money context (Airtel Money, MTN MoMo, Zamtel
Kwacha; NRC + T-PIN identity).

## 1. The lending funnel = a series of gates

Each application passes through gates in order; failing an earlier gate stops the
rest. This keeps the *pipeline of good customers* clean.

```
KYC verified ─▶ Fraud/risk clear ─▶ Credit score ≥ policy ─▶ Affordable (DTI) ─▶ Offer
```

Implemented in `risk_engine.evaluate()` (gate 1–2) and
`loan_service.check_eligibility()` (gate 3–5).

## 2. Identity & KYC (stop fraud at the door)

- **Multi-factor identity:** mobile number + NRC + T-PIN + Face-ID (front & back of NRC + selfie/liveness). Never rely on a single identifier.
- **Biometric match:** a face-match/liveness score below 0.75 is auto-held for review; below 0.5 is blocked. This is the primary defence against impersonation and stolen-ID fraud.
- **Duplicate detection:** the same NRC or device fingerprint across accounts is a classic synthetic-identity / fraud-ring signal — block on duplicate NRC, flag shared devices.
- **SIM-swap watch:** a recent SIM swap on the funding wallet is a strong account-takeover indicator; hold or step-up verify.

## 3. Credit risk (lend only what can be repaid)

- **Alternative-data scorecard (like FairMoney):** combine many weak mobile-money signals into one explainable score rather than trusting any single feature. Explainability matters for regulators and for customer trust.
- **Affordability first:** anchor the limit to demonstrated net cash-flow, not just the score. Cap total debt service at a debt-to-income ceiling (default 45%).
- **Over-indebtedness check:** subtract existing outstanding exposure before making a new offer; decline when headroom is exhausted.
- **Start small, grow on behaviour:** new/thin-file customers get small starter limits (band D) and earn larger limits by repaying on time — the single most effective way to build a good book.

## 4. Behavioural & velocity controls

- **Application velocity:** cap applications per customer per day to stop bots and desperation-borrowing spirals.
- **Pass-through wallets:** brand-new wallets that cash out ~all inflow have no buffer and repay poorly — score and flag them.
- **Cash-out ratio:** high pass-through behaviour lowers the score even for established wallets.

## 5. Collections & early-warning (the intelligence layer)

- **Pre-due nudges:** SMS/push reminders fire a configurable number of days (default 7) *before* the due date — the cheapest way to lift on-time repayment.
- **Escalating cadence:** reminder at T-7, at T-0 (due today), then overdue follow-ups. Moonze generates a distinct nudge per `days_to_due` and is idempotent so customers aren't spammed.
- **PAR monitoring:** watch Portfolio-at-Risk and default rate by segment; tighten policy on segments that deteriorate.

## 6. Portfolio steering

- **Segment performance** (by risk band / MNO / region) shows which cohorts repay best. Steer marketing spend and limit generosity toward high-payment-rate, low-PAR segments to compound a healthy book.

## 7. What to add before scale

- Device intelligence / fingerprinting SDK and IP/geo-velocity checks.
- Shared credit bureau / cross-lender exposure data (e.g. TransUnion Zambia) to catch loan stacking across apps.
- Rules + ML fraud model with a manual-review queue and case management.
- Real-time transaction monitoring and AML/sanctions screening.
- Encryption at rest for PII/biometrics, full audit trails, and least-privilege access.
- A hardship / restructure path so short-term stress doesn't become default.
