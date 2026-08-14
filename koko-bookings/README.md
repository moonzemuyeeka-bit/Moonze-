# Koko's Bookings

A mobile-first appointment booking platform for a Zambian lash studio. Customers
pick a service, choose a time, accept the deposit policy and secure the slot with
a **K50 deposit** paid by Mobile Money or bank card. The owner runs the diary,
prices, availability, policies and reporting from an admin area that works just
as well on a phone.

> The payment gateway shipped here is a **sandbox provider**. It behaves like a
> real gateway — asynchronous authorisation, status polling, signed webhooks —
> but moves no money, and nothing is ever reported as paid unless the sandbox
> authorises it. See [Connecting a real payment provider](#connecting-a-real-payment-provider).

---

## Contents

- [Stack](#stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Demo data](#demo-data)
- [How booking works](#how-booking-works)
- [How payments work](#how-payments-work)
- [Notifications and reminders](#notifications-and-reminders)
- [Admin area](#admin-area)
- [Security](#security)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Scheduled jobs](#scheduled-jobs)
- [Connecting a real payment provider](#connecting-a-real-payment-provider)
- [Deployment notes](#deployment-notes)

---

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript strict mode |
| Styling | Tailwind CSS v4 with a custom design system in `src/app/globals.css` |
| UI primitives | Hand-built, shadcn/ui conventions, Radix for dialog & checkbox |
| Database | PostgreSQL + Prisma |
| Validation | Zod schemas shared by the browser and the server |
| Forms | React Hook Form |
| Tests | Vitest (unit + database-backed integration) |
| Money | Integer **ngwee** (1 kwacha = 100 ngwee), displayed as `K280` |
| Time | Calendar dates plus `HH:mm` in `Africa/Lusaka`; instants stored in UTC |

---

## Getting started

You need Node 20+ and a PostgreSQL 14+ server.

```bash
cd koko-bookings
npm install

cp .env.example .env          # then edit DATABASE_URL and the secrets
createdb koko_bookings        # and koko_bookings_test if you want to run tests

npm run db:migrate            # apply the schema
npm run db:seed               # realistic demo data, including an admin account
npm run dev                   # http://localhost:3000
```

Sign in to the admin area at `/admin` with the `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from your `.env` (the seed creates that account).

Useful scripts:

```bash
npm run dev         # development server
npm run build       # production build
npm run start       # run the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
npm run db:seed     # re-seed demo data
npm run db:reset    # drop, re-migrate and re-seed (development only)
```

---

## Environment variables

Copy `.env.example` to `.env`. Nothing secret is committed, and no secret is ever
exposed to the browser — only `NEXT_PUBLIC_*` values reach the client bundle.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate database used by `npm test`; the suite refuses to run if it matches `DATABASE_URL` |
| `SESSION_SECRET` | Signs the admin session cookie (32+ characters) |
| `PAYMENT_WEBHOOK_SECRET` | Verifies payment-provider webhook signatures |
| `PAYMENT_PROVIDER` | `mock`, or the id of a registered real provider |
| `DEMO_MODE` | Shows the sandbox payment simulator and the login hint. **Must be `false` in production** |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Only read by `npm run db:seed` |
| `NEXT_PUBLIC_SITE_URL` | Used for metadata and share links |
| `CRON_SECRET` | Shared secret for the `/api/cron` maintenance endpoint |

Business *rules* — deposit amount, slot interval, buffer, booking window,
minimum notice, reservation window, daily cap, policies, working hours,
notification preferences — are **not** environment variables. They live in the
`business_settings` and `working_hours` tables and are editable at
**Admin → Settings**. `src/lib/config.ts` only holds deployment configuration and
the defaults used to seed a fresh database.

---

## Demo data

`npm run db:seed` creates an immediately usable studio:

- the seven services from the brief (`Classic Lashes` K280 … `Refills` from K280)
- six customers with realistic Zambian numbers and booking history
- sixteen bookings spread across the past, today and the coming weeks, in every
  status — completed, confirmed, cancelled, no-show and a live reservation
- matching payment records and payment-event audit trails
- two blocked dates and one hand-crafted Saturday of custom time slots
- an admin account

---

## How booking works

The customer journey is one client component (`components/booking/booking-flow.tsx`)
driving five steps: **Service → Date & Time → Details → Policy & Payment → Confirmed**.
Going back never loses a valid earlier choice.

### The availability engine

`lib/booking/slots.ts` is deliberately pure. Given the shape of a day and what is
already booked, it decides which start times may be picked. Every availability
question in the product — calendar colours, the time grid, and the final
server-side re-check before payment — is answered by the same function, so they
cannot disagree.

It accounts for:

- weekly working hours, and per-date overrides (blocked or reopened dates)
- hand-crafted time slots, which replace the generated grid for that date
- service duration plus the configurable **buffer** between clients
- the daily booking cap, the booking window and minimum notice
- reservations that still hold a slot, and those whose payment window lapsed

Calendar days are reported as `AVAILABLE`, `LIMITED`, `FULL`, `UNAVAILABLE` or
`PAST`, and each disabled time carries a reason (`Booked`, `Too soon`, `Closed`,
`Day fully booked`) so the interface never relies on colour alone.

### Double-booking protection

Three layers, because this is the failure that costs a real business money:

1. **Availability re-check inside the transaction.** The slot the customer chose
   is recomputed from scratch at reservation time, not trusted from the client.
2. **A Postgres advisory lock per calendar day** (`pg_advisory_xact_lock`), so two
   customers checking out for the same day are serialised and the re-check above
   is trustworthy.
3. **A partial unique index** on `(appointmentDate, startTime)` for bookings in
   `PENDING_PAYMENT`, `CONFIRMED` or `COMPLETED`. Even a bug elsewhere cannot
   produce two live appointments at one start time; the violation is translated
   into "This appointment was just booked by another customer."

### Temporary reservation

Reaching payment creates the booking as `PENDING_PAYMENT` with a
`reservationExpiresAt` (10 minutes by default, configurable). That reservation
occupies the slot but is **not** an appointment. A countdown is shown while the
customer pays. Once the window closes the booking becomes `EXPIRED`, any in-flight
payment attempt is expired with it, and the time is offered to everyone again —
released lazily on the next availability query and eagerly by the cron sweeper.

### Booking references

`KOKO-8F42A1`: six characters from Crockford's base32 alphabet (no `I`, `L`, `O`
or `U`), drawn randomly and checked for collisions. Internal database ids are
never exposed as a reference, and nothing about order volume leaks.

### Customer self-service

`/my-booking` finds a booking from its reference plus the phone number used to
book. A wrong phone number and an unknown reference return the *same* vague
message, so references cannot be enumerated by guessing. From there a customer can
review everything and cancel.

---

## How payments work

Booking logic never talks to a gateway directly — only to the `PaymentProvider`
interface in `lib/payments/types.ts`:

```ts
interface PaymentProvider {
  supports(method): boolean;
  createPayment(input): Promise<PaymentIntent>;
  checkPaymentStatus(providerReference): Promise<PaymentStatusResult>;
  handleWebhook(request): Promise<WebhookResult>;
  refundPayment(providerReference, amountNgwee): Promise<RefundResult>;
}
```

### The state machine

```
PENDING ──▶ PROCESSING ──▶ SUCCESSFUL ──▶ REFUNDED
   │            │
   └────────────┴──▶ FAILED | CANCELLED | EXPIRED   (terminal)
```

`lib/payments/payment-service.ts` is the only place a payment changes state.
Transitions are validated, re-read inside a transaction so two webhooks cannot
both confirm, and every change is appended to `payment_events` with its source
(`api`, `webhook`, `poll`, `sweeper`, `admin`).

**A booking becomes `CONFIRMED` only when a payment reaches `SUCCESSFUL`.**
Reaching the payment page does nothing. If money lands after the reservation has
already lapsed, the successful payment is kept on record for the owner to refund
or reschedule and **no appointment is invented**.

### The deposit is stated before the payment action

The policy card and the breakdown — *Total Service K500 · Deposit Today K50 ·
Balance After Deposit K450* — appear before any payment method is chosen, and the
customer must actively tick **"I have read and agree to the booking policy"** to
continue. The accepted policy text is snapshotted onto the booking, so later edits
never rewrite what a customer agreed to.

### Card data

No card number, CVV or PIN is ever accepted, transmitted or stored. The card path
uses provider tokens; the database keeps only the brand and last four digits for
display. In the sandbox, `SANDBOX_TEST_CARDS` offers approving and declining
tokens.

### Sandbox controls

When `DEMO_MODE=true`, the checkout shows simulator buttons that stand in for the
customer approving a wallet prompt. They travel back through the same
**signed-webhook path** a real provider would use, so no code path exists that
"just confirms" a booking. Unsigned or unknown webhooks are rejected.

---

## Notifications and reminders

`lib/notifications` renders a message per event and hands it to a channel adapter:

| Event | Sent when |
| --- | --- |
| `BOOKING_CREATED` | A slot is reserved |
| `PAYMENT_SUCCESSFUL` | The deposit is captured |
| `BOOKING_CONFIRMED` | The appointment is confirmed |
| `BOOKING_CANCELLED` | Cancelled by the customer or the salon |
| `APPOINTMENT_REMINDER` | 24 hours before, and N hours before |
| `APPOINTMENT_COMPLETED` | Marked completed |

WhatsApp, SMS and email adapters report `isConfigured() === false` until their
credentials exist, so **nothing pretends to have been delivered**. Until then the
console adapter logs the exact message that would have been sent, and every
attempt — sent, failed or skipped — is recorded in `notifications` and visible at
**Admin → Payments**.

Confirming an appointment schedules its reminders in the `reminders` table.
`/api/cron` dispatches those that are due.

---

## Admin area

`/admin`, behind authentication, mobile-friendly throughout.

| Page | What the owner can do |
| --- | --- |
| **Dashboard** | Today's appointments, upcoming, deposits collected, open slots, cancellations, no-shows, checkouts in progress, revenue today/week/month, a 14-day revenue chart, service performance, new customers and the next appointment |
| **Calendar** | Month view with booking counts; block or reopen a date with a reason; add, block or delete individual time slots |
| **Bookings** | Filter by today, upcoming, confirmed, pending, completed, cancelled or no-show; search by reference, name or phone; change status; refund a deposit |
| **Services** | Add, edit, reprice, retime, reorder, feature, activate or deactivate. A service with bookings is **deactivated rather than deleted**, so history and reporting stay accurate |
| **Customers** | Searchable list with booking counts and total spend; a profile page with full appointment history |
| **Payments** | Every payment with status, method, instrument and booking, plus the notification log |
| **Settings** | Business details, deposit, slot interval, buffer, booking window, minimum notice, reservation window, daily cap, deposit and cancellation policies, notification preferences, and the weekly working hours |

Editing a price never rewrites bookings already taken: each booking snapshots the
service name and the amounts agreed at the time.

---

## Security

- **Server-side validation everywhere.** The Zod schemas in `src/schemas` are
  shared with the forms, but the server always re-validates. Client-side checks
  are a convenience, never a control.
- **Admin authentication.** Passwords are hashed with scrypt. Sessions are a small
  JSON payload signed with HMAC-SHA256 in an httpOnly, SameSite=Lax cookie
  (secure in production), with the expiry enforced server-side on every read.
- **Two layers of route protection.** `middleware.ts` redirects anonymous visitors
  away from `/admin`, and every admin page and route handler independently calls
  `requireAdminPage` / `requireAdminApi` — the middleware is a convenience, not
  the control.
- **Rate limiting** on booking creation, payment initiation, booking lookup and
  admin login.
- **Safe errors.** Domain errors carry a machine code, an HTTP status and a
  message written for a customer. Anything unexpected is logged server-side and
  returned as "Something went wrong. Please try again." — no stack traces, no
  database details.
- **Security headers** on every response (`X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Signed webhooks**, verified with a timing-safe comparison.
- **No secrets in the client bundle or in Git.**
- **No raw card data**, ever.

Customers need no account: booking stays frictionless.

---

## Project structure

```
prisma/
  schema.prisma           relational schema
  migrations/             includes the partial unique index for double booking
  seed.ts                 demo data
src/
  app/
    (site)/               homepage, /book, /policy, /my-booking
    admin/                dashboard, calendar, bookings, services, customers,
                          payments, settings, login
    api/                  customer + admin route handlers, webhook, cron
    globals.css           the design system (colours, type, shadows, motion)
    manifest.ts           PWA manifest
  components/
    booking/              the customer flow (stepper, calendar, slot grid,
                          policy, payment, confirmation…)
    admin/                dashboard, calendar, booking table, service manager,
                          settings panel…
    site/                 header, footer, mobile bottom navigation
    ui/                   button, card, badge, field, dialog, alert, skeleton…
  hooks/                  availability data hooks
  lib/
    auth/                 password hashing, sessions, guards
    booking/              slots engine, availability, booking service, pricing,
                          references
    database/             typed data access per entity
    notifications/        channels, templates, reminders
    payments/             provider interface, sandbox provider, state machine
    config.ts errors.ts http.ts money.ts phone.ts rate-limit.ts time.ts
  schemas/                Zod schemas shared by client and server
  types/                  serialisable DTOs crossing the server/client boundary
tests/
  unit/                   pure logic
  integration/            database-backed lifecycle tests
```

---

## Testing

```bash
npm test
```

131 tests run against a throwaway database (`TEST_DATABASE_URL`); the suite
refuses to start if that points at the same database as `DATABASE_URL`.

**Unit** — money and ngwee arithmetic, deposit and balance calculation for every
service, Zambian phone normalisation and wallet detection, booking references,
Lusaka timezone conversions, the availability engine (buffers, blocked dates,
closed days, daily caps, minimum notice, booking window, hand-crafted slots), the
payment state machine, password hashing, session signing and tampering, webhook
signatures and rate limiting.

**Integration** — reserving a slot end to end; the slot leaving circulation;
concurrent bookings for one slot where exactly one wins; buffer overlaps; blocked
dates; the policy gate; reservation expiry releasing a slot; lookup by reference
and phone; cancellation; a mobile-money deposit confirming an appointment and
scheduling reminders; declines, cancellations and retries; expiry mid-payment;
money landing after a slot is gone; replayed and forged webhooks; refunds; price
changes not rewriting history; and admin authorisation across every admin
endpoint.

---

## Scheduled jobs

`POST /api/cron` releases expired reservations and dispatches due reminders.
Authenticate with `Authorization: Bearer $CRON_SECRET` (or a `secret` query
parameter), and optionally narrow the work with `?task=release-expired` or
`?task=reminders`. Point a platform scheduler at it every few minutes:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron
```

---

## Connecting a real payment provider

1. Implement `PaymentProvider` for the gateway — for example Flutterwave, Lenco or
   Broadpay for cards and wallets, or a direct Airtel Money / MTN MoMo / Zamtel
   Kwacha integration.
2. Register it in `lib/payments/provider.ts`.
3. Set `PAYMENT_PROVIDER` to its id and `DEMO_MODE=false`.
4. Point the gateway's webhook at `/api/payments/webhook` and set
   `PAYMENT_WEBHOOK_SECRET` to the signing secret it uses.

No booking, availability or UI code changes. The same applies to messaging:
implement a channel in `lib/notifications/channels.ts` and supply its credentials.

---

## Deployment notes

- Set `DEMO_MODE=false`. This removes the sandbox simulator and the login hint.
- Generate fresh `SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET` and `CRON_SECRET`
  values (`openssl rand -hex 32`).
- Run `npm run db:deploy` (`prisma migrate deploy`) as part of the release, not
  `db:reset`.
- Serve over HTTPS so the session cookie's `secure` flag applies.
- The in-memory rate limiter is per-instance; move it to Redis before running
  more than one instance.
- The app is installable: a web manifest, generated icons and a theme colour are
  in place. Booking and payment integrity is never traded for offline behaviour —
  availability and payment state always come from the server.
