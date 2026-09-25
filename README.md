# Finora — Personal Finance Management System

Finora is a full-stack personal finance management web application built as a production-quality student project. It helps a user track accounts, income/expense transactions, budgets, and savings goals in one place, with the interface and engineering discipline of a real fintech SaaS product rather than a basic CRUD app.

> This README is derived strictly from `finora-architecture.md`, the project's source-of-truth architecture document. Where a decision has not yet been made in that document, it is explicitly marked **"Open decision"** below rather than invented.

---

## Table of Contents

- [Overview](#overview)
- [Problem Finora Solves](#problem-finora-solves)
- [Target Users](#target-users)
- [Key Features](#key-features)
- [Core Functionality](#core-functionality)
- [Tech Stack](#tech-stack)
- [System Architecture Overview](#system-architecture-overview)
- [Project Structure](#project-structure)
- [Installation / Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Running the Project Locally](#running-the-project-locally)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Build & Deployment](#build--deployment)
- [Security Considerations](#security-considerations)
- [Future Scope](#future-scope)

---

## Overview

Finora is a single-user-per-account personal finance ledger and analytics dashboard. Every account, transaction, budget, and goal is scoped to the authenticated user. A core design principle governs the whole system: **the frontend never performs financial calculations — it only renders numbers already computed server-side**, using decimal-safe arithmetic against a PostgreSQL database. This keeps every balance, budget total, and goal-progress figure consistent and auditable.

## Problem Finora Solves

People tracking their money across multiple bank accounts, cash, and credit cards in spreadsheets lose visibility into where money goes, struggle to stick to category budgets, and have no single source of truth for savings goals or spending trends. Finora consolidates this into one ledger with automated recurring entries, budget alerts, goal tracking, and analytics — without requiring manual spreadsheet formulas.

## Target Users

An individual user who wants a single place to:
- Record income and expenses across multiple financial accounts
- Set spending caps (budgets) per category
- Track progress toward savings goals
- Understand spending patterns over time

*(Shared/family accounts and multi-user collaboration are explicitly out of scope for v1 — see [Future Scope](#future-scope).)*

## Key Features

- Authentication (email/password + OAuth) with session management
- User profile & preferences (currency, timezone, locale)
- Multiple financial accounts (bank, cash, credit card, wallet, investment)
- Income, expense, and transfer transactions
- Custom and default (system) categories
- Budget management (monthly/yearly, per category, with optional rollover)
- Financial goals with linked contributions
- Recurring transactions (auto-generated on a schedule)
- Dashboard analytics (balances, trends, breakdowns)
- Spending analysis and monthly/yearly reports
- In-app notifications (budget alerts, goal milestones, recurring due)
- Search, filtering, sorting, and pagination on transactions
- Settings (profile, security, preferences, data export)
- CSV/PDF data export
- Audit logging of sensitive actions

## Core Functionality

| Area | What it does |
|---|---|
| Ledger | Create/edit/delete income, expense, and transfer transactions against user-owned accounts |
| Balances | Account `current_balance` is derived from transaction history, never hand-edited |
| Budgets | Per-category monthly/yearly caps compared against actual period spend, with alert thresholds |
| Goals | Target-amount savings goals tracked via linked contributions, with progress computed from the contribution ledger |
| Recurring | Templates that auto-generate real transactions on a schedule (daily/weekly/biweekly/monthly/yearly) |
| Analytics | Server-computed aggregates (trend, category breakdown, income vs. expense, savings rate) feeding dashboard and reports |
| Notifications | System-generated alerts for budget thresholds, goal milestones, and recurring activity |

## Tech Stack

As defined in `finora-architecture.md`:

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Icons:** Lucide
- **Charts:** Recharts
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation:** Zod
- **Authentication:** Auth.js / NextAuth
- **Unit/Integration Testing:** Vitest
- **E2E Testing:** Playwright

No technologies outside this list are used. Anything not on this list that a feature might imply (e.g. a specific caching layer, a specific hosting provider, a specific queue system) is **not yet decided** and is called out explicitly where relevant below.

## System Architecture Overview

Finora is server-first:

- **Reads** happen in async React Server Components, calling a domain service layer directly (no internal API round-trip needed).
- **Writes** happen through **Server Actions** (not a separate REST layer), each validated with Zod.
- A thin `/api/*` route surface exists only where Server Actions can't do the job: the NextAuth handler, streamed file export downloads, and (future) webhook endpoints.
- All business logic and financial arithmetic live in a **service layer** (`server/services/`) — never in UI components — using `Prisma.Decimal` or Postgres `numeric` arithmetic, never JavaScript floats.
- Every service call and query is scoped by `userId` resolved from the session; no client-supplied ID is ever trusted for authorization.

```
Client (Server/Client Components, shadcn/ui, Recharts)
        │
        ▼
Next.js App Router (Route Handlers · Server Actions · Middleware)
        │
        ▼
Service / Domain Layer (business rules + money math)
        │
        ▼
Prisma ORM
        │
        ▼
PostgreSQL (decimal money columns, indexes, constraints)
```

Full detail, including the database ERD, is in `finora-architecture.md` (§3–§6).

## Project Structure

```
finora/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (marketing)/            # "/"
│   │   ├── (auth)/                 # login, register
│   │   ├── (app)/                  # authenticated routes (dashboard, transactions, etc.)
│   │   ├── actions/                # Server Actions, by domain
│   │   └── api/                    # auth handler, export route
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── charts/                 # Recharts wrappers
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── forms/
│   │   └── shared/                 # empty/loading/error states, pagination
│   ├── server/
│   │   ├── services/                # domain logic — all calculations live here
│   │   ├── db/                      # Prisma client singleton
│   │   └── auth/                    # Auth.js config
│   ├── lib/
│   │   ├── validation/               # Zod schemas
│   │   ├── money.ts                  # Decimal helpers
│   │   ├── dates.ts                  # timezone-safe date helpers
│   │   ├── rate-limit.ts
│   │   └── utils.ts
│   ├── types/
│   └── middleware.ts
├── tests/
│   ├── unit/                        # Vitest
│   └── e2e/                         # Playwright
├── .env.example
└── package.json
```

Full page-by-page and component-by-component breakdown is in `finora-architecture.md` (§10–§11).

## Installation / Setup

**Prerequisites:**
- Node.js (LTS version compatible with Next.js 15)
- A running PostgreSQL instance (local or hosted)
- npm, pnpm, or yarn

**Steps:**

```bash
# 1. Clone the repository
git clone <repository-url>
cd finora

# 2. Install dependencies
npm install

# 3. Copy environment variables and fill them in
cp .env.example .env

# 4. Run database migrations
npx prisma migrate dev

# 5. Seed demo data (recommended for local development)
npx prisma db seed
```

## Environment Variables

The architecture specifies these required variables (validated at boot via a Zod env schema, per §9 of `finora-architecture.md`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js session signing secret |
| `NEXTAUTH_URL` | Base URL for Auth.js callbacks (local: `http://localhost:3000`) |
| OAuth provider credentials (e.g. `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | Required only if OAuth login is enabled |
| An encryption key for 2FA secrets at rest | Required if two-factor authentication is enabled |

> **Open decision:** the exact env var names for the 2FA encryption key, and the full list of OAuth providers to support beyond Google, are not finalized in `finora-architecture.md`. Add them to `.env.example` as they are decided — do not silently assume a provider or key name not already specified.

Secrets are never committed to the repository and are never logged.

## Running the Project Locally

```bash
npm run dev
```

The app runs on `http://localhost:3000` by default. Authenticated routes are grouped under `(app)/` and guarded by `middleware.ts`, which checks for a valid session before any page code runs.

## Development Workflow

- All business logic and financial calculations belong in `server/services/` — never in components or Server Actions directly (Server Actions call services, they don't reimplement logic).
- All mutations go through Server Actions; all reads happen in Server Components calling services directly.
- Every Server Action: resolves `userId` from session → validates input with Zod → applies rate limiting where relevant → calls the domain service → writes an audit log entry if sensitive → revalidates the relevant path(s).
- Money is always handled as `Prisma.Decimal` / Postgres `numeric` — never native JavaScript floats.
- Follow the phased build order defined in `finora-architecture.md` §16 (Foundation → Auth → Core Ledger → Budgets/Goals → Recurring/Notifications → Dashboard/Analytics → Polish/Security/Testing → Deployment).

## Testing

**Unit / integration (Vitest):**
- `lib/money.ts` decimal math edge cases
- Every service in `server/services/` (balance updates, budget progress, goal contributions, recurring generation)
- Zod schema validation (valid/invalid payloads)
- Cross-user data isolation (a call scoped to user A must never touch user B's rows)

**End-to-end (Playwright):**
- Auth flow (register → verify → login → logout → session persistence)
- Transaction CRUD and balance/dashboard updates
- Budget threshold alerts
- Goal contribution and progress updates
- Recurring transaction generation
- Access control (guessed IDs return 404, not another user's data)
- Mobile viewport smoke tests

Run tests with:

```bash
npm run test          # Vitest unit/integration suite
npm run test:e2e       # Playwright end-to-end suite
```

> **Open decision:** exact `package.json` script names and CI provider/configuration are not specified in `finora-architecture.md` beyond "CI runs Vitest on every push and Playwright against a seeded test database on PR." Confirm the actual script names in `package.json` once scaffolded.

## Build & Deployment

```bash
npm run build
npm run start
```

`finora-architecture.md` §16 (Phase 7) specifies deployment requires: a production PostgreSQL instance, environment secrets configured in the hosting platform, CI/CD, and monitoring/logging.

> **Open decision:** the specific hosting platform (e.g. Vercel, a VPS, a container platform), the production PostgreSQL provider, and the CI/CD tool are **not specified** in the architecture document. Do not assume a provider — choose and document one explicitly when the deployment phase begins.

## Security Considerations

Summarized from `finora-architecture.md` §9; see that document for the full table.

- Passwords hashed with argon2id (or bcrypt, cost ≥ 12) — never stored in plaintext
- Database sessions via Auth.js (revocable server-side), httpOnly/secure/signed cookies
- Optional TOTP-based two-factor authentication, secret encrypted at rest
- Every query/action authorized by session-derived `userId`; no client-supplied ID is trusted
- All input validated with Zod at every Server Action boundary
- SQL injection prevented structurally via Prisma's parameterized queries (no raw string interpolation)
- XSS mitigated by React's default escaping; no unsanitized HTML rendering
- CSRF mitigated via Next.js's built-in Server Action origin checks
- Rate limiting on login, register, password reset, and 2FA verification
- Audit logging of sensitive actions (login, password change, transaction/account deletion, data export)
- Money stored exclusively as `numeric(14,2)` with `CHECK (amount > 0)` constraints — sign is derived from transaction `type`
- Generic (non-enumerable) error messages on auth failures; detailed errors logged server-side only

## Future Scope

As defined in `finora-architecture.md` §18, the schema and architecture are designed to support these additively (without breaking changes), but **none are implemented in v1**:

- Bank sync (Plaid/Salt Edge-style) via an `institution_connections` table and webhook handlers
- Multi-currency support with exchange-rate conversion
- Shared/family accounts via an `account_members` join table
- Background job infrastructure (e.g. a proper queue) for recurring transactions and notifications
- Read replicas / caching for dashboard aggregates at scale
- Table partitioning of `transactions` by date for very large histories
- Full-text search on transaction descriptions/notes
- A versioned public API for a future mobile app

---

*This README reflects `finora-architecture.md` as the source of truth. If the two ever disagree, the architecture document governs — update this README to match, not the other way around.*
