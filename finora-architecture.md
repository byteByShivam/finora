# Finora — Personal Finance Management System
### Complete Technical Architecture Specification

---

## 1. Product Vision

Finora is a production-grade personal finance management platform that lets a user track accounts, transactions, budgets, and goals with the polish of a real fintech SaaS product. The design principle throughout: **the frontend never computes money — it only renders what the backend/database has already calculated.** Every number a user sees (balance, budget remaining, goal progress) is derived server-side from the transaction ledger, using decimal-safe arithmetic, so the numbers are always auditable and consistent.

Target user: an individual who wants a single place to record income/expenses across multiple accounts, set budgets by category, track savings goals, and understand spending patterns over time — without spreadsheets.

Design ethos: clean, quiet, confidence-inspiring. A finance app should feel calm and trustworthy, not loud.

---

## 2. Feature Scope

**In scope (v1):**
- Email/password + OAuth authentication, session management
- User profile & preferences (currency, timezone, locale)
- Multiple accounts per user (bank, cash, credit card, wallet, investment)
- Transactions: income, expense, transfer between own accounts
- Categories: system defaults + user-defined, with icons/colors
- Budgets: monthly per-category caps with rollover option
- Financial goals: target amount + deadline, linked contributions
- Recurring transactions: auto-generate transactions on a schedule
- Dashboard analytics: balances, trends, breakdowns
- Spending analysis & monthly/yearly reports
- In-app notifications (budget exceeded, goal milestone, recurring due)
- Search, filter, sort, pagination on transactions
- Settings: profile, security, preferences, data export
- CSV/PDF data export
- Audit log of sensitive actions

**Explicitly out of scope for v1** (noted for roadmap): bank-sync (Plaid-style), multi-currency conversion, shared/family accounts, mobile app, bill-pay integrations. The schema is designed so these can be added without breaking changes (see §18).

---

## 3. System Architecture

**Pattern:** Next.js 15 App Router, server-first. Server Components fetch data directly via a service layer; mutations go through Server Actions (not a separate REST layer) validated with Zod. A thin `/api/*` route surface exists only for things Server Actions can't do cleanly: webhooks (future), file export downloads, and NextAuth's own routes.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                       │
│   React Server/Client Components · shadcn/ui · Recharts       │
└───────────────┬─────────────────────────────┬─────────────────┘
                │  RSC data fetch              │  Server Actions
                ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 15 App Router                      │
│  ─ Route Handlers (/api) — export, auth callbacks             │
│  ─ Server Actions — all mutations (Zod-validated)              │
│  ─ Middleware — session guard, rate limiting, security headers │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service / Domain Layer                    │
│  TransactionService · BudgetService · GoalService ·            │
│  RecurringEngine · AnalyticsService · NotificationService      │
│  (all business rules + money math live here, not in UI)        │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                Prisma ORM (typed queries, migrations)          │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL (single source of truth)           │
│      Decimal money columns · indexes · constraints · triggers  │
└─────────────────────────────────────────────────────────────┘
```

Auth.js sits in middleware + route handlers, issuing a signed session (JWT or DB session — DB session recommended for a finance app so sessions are revocable). Every server action/query starts by resolving `userId` from the session and every Prisma query is scoped `where: { userId }` — never trusting a client-supplied user id.

---

## 4. Database ERD Description

Core relationships (1—many unless noted):

- **User** → Account, Category (custom), Budget, FinancialGoal, RecurringTransaction, Notification, Session, AuditLog
- **Account** → Transaction (as source account)
- **Category** → Transaction, Budget, RecurringTransaction
- **Transaction** → optionally references a **RecurringTransaction** (the template that spawned it) and optionally a **GoalContribution** (many-to-many join between Transaction and FinancialGoal, since one transaction could theoretically fund a goal)
- **FinancialGoal** → GoalContribution (many) — contributions reference Transactions
- **Budget** is scoped to (User, Category, Period) — unique per period
- **RecurringTransaction** generates **Transaction** rows via a scheduled job/service
- **AuditLog** references User (nullable, for system actions) + a polymorphic-ish `entityType`/`entityId` pair

Every user-owned table carries `userId` directly (denormalized on purpose) rather than requiring joins through Account/Category to establish ownership — this makes row-level authorization a single indexed `WHERE userId = ?` check everywhere, which matters a lot for both security and query speed.

---

## 5. Complete Database Schema

Notation: `PK` primary key, `FK` foreign key, `UQ` unique, `IDX` indexed.

### 5.1 `users`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| email | citext | UQ, not null |
| password_hash | text | nullable (null if OAuth-only) |
| name | varchar(120) | not null |
| avatar_url | text | nullable |
| currency | char(3) | not null, default `'INR'` |
| timezone | varchar(64) | not null, default `'Asia/Kolkata'` |
| locale | varchar(10) | not null, default `'en-IN'` |
| email_verified_at | timestamptz | nullable |
| two_factor_enabled | boolean | not null, default false |
| two_factor_secret | text | nullable, encrypted at rest |
| status | enum(`active`,`suspended`,`deleted`) | not null, default `active` |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now(), auto-touch |

Passwords are never stored — only bcrypt/argon2 hashes. Soft-delete via `status`, not row deletion, to preserve referential/audit integrity.

### 5.2 `accounts`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, not null, `ON DELETE CASCADE`, IDX |
| name | varchar(100) | not null |
| type | enum(`bank`,`cash`,`credit_card`,`wallet`,`investment`,`other`) | not null |
| currency | char(3) | not null, default from user |
| opening_balance | numeric(14,2) | not null, default 0 |
| current_balance | numeric(14,2) | not null, default 0 — **cached, recomputed by trigger/service, never hand-edited** |
| color | varchar(7) | nullable (hex) |
| icon | varchar(40) | nullable |
| is_archived | boolean | not null, default false |
| credit_limit | numeric(14,2) | nullable (only for `credit_card`) |
| created_at, updated_at | timestamptz | as above |

UQ: (`user_id`, `name`) — no duplicate account names per user.
IDX: (`user_id`, `is_archived`).

### 5.3 `categories`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, `ON DELETE CASCADE`, **nullable** (null = system default category, shared) |
| name | varchar(60) | not null |
| type | enum(`income`,`expense`) | not null |
| icon | varchar(40) | nullable |
| color | varchar(7) | nullable |
| parent_id | uuid | FK → categories.id, nullable, `ON DELETE SET NULL` (one level of subcategory) |
| is_system | boolean | not null, default false |
| created_at, updated_at | timestamptz | as above |

UQ: (`user_id`, `name`, `type`) with `user_id` nulls treated distinctly per row (Postgres default) — enforced additionally at the service layer for the null-user default set.
IDX: (`user_id`, `type`).

### 5.4 `transactions`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, `ON DELETE CASCADE`, not null, IDX |
| account_id | uuid | FK → accounts.id, `ON DELETE RESTRICT`, not null, IDX |
| transfer_account_id | uuid | FK → accounts.id, nullable, `ON DELETE RESTRICT` (set only for `transfer` type) |
| category_id | uuid | FK → categories.id, `ON DELETE RESTRICT`, nullable (nullable so a category can never be deleted out from under history without an explicit reassignment flow) |
| type | enum(`income`,`expense`,`transfer`) | not null |
| amount | numeric(14,2) | not null, `CHECK (amount > 0)` — sign is derived from `type`, never stored as negative |
| currency | char(3) | not null |
| description | varchar(255) | nullable |
| notes | text | nullable |
| occurred_at | timestamptz | not null, IDX — the user-facing transaction date/time |
| recurring_transaction_id | uuid | FK → recurring_transactions.id, nullable, `ON DELETE SET NULL` |
| is_reconciled | boolean | not null, default false |
| created_at, updated_at | timestamptz | as above |

IDX: (`user_id`, `occurred_at` DESC) — the primary listing query. (`user_id`, `category_id`, `occurred_at`) — analytics. (`account_id`, `occurred_at`).
`CHECK`: if `type = 'transfer'` then `transfer_account_id IS NOT NULL AND transfer_account_id <> account_id`.

**Money is `numeric(14,2)`, never `float`/`double`.** All arithmetic happens in Postgres `numeric` or JS `Decimal.js`/`Prisma.Decimal` — never native JS floats.

### 5.5 `budgets`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, `ON DELETE CASCADE`, not null |
| category_id | uuid | FK → categories.id, `ON DELETE CASCADE`, not null |
| amount | numeric(14,2) | not null, `CHECK (amount > 0)` |
| period | enum(`monthly`,`yearly`) | not null, default `monthly` |
| period_start | date | not null (first day of the covered month/year) |
| rollover_enabled | boolean | not null, default false |
| alert_threshold_pct | smallint | not null, default 80, `CHECK (0 < alert_threshold_pct <= 100)` |
| created_at, updated_at | timestamptz | as above |

UQ: (`user_id`, `category_id`, `period`, `period_start`) — exactly one budget per category per period.
IDX: (`user_id`, `period_start`).

### 5.6 `financial_goals`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, `ON DELETE CASCADE`, not null |
| name | varchar(120) | not null |
| description | text | nullable |
| target_amount | numeric(14,2) | not null, `CHECK (target_amount > 0)` |
| current_amount | numeric(14,2) | not null, default 0 — cached, recomputed from contributions |
| target_date | date | nullable |
| account_id | uuid | FK → accounts.id, nullable, `ON DELETE SET NULL` (a linked savings account, optional) |
| icon | varchar(40) | nullable |
| color | varchar(7) | nullable |
| status | enum(`active`,`achieved`,`archived`) | not null, default `active` |
| created_at, updated_at | timestamptz | as above |

IDX: (`user_id`, `status`).

### 5.7 `goal_contributions`
Join table linking a transaction (or standalone savings entry) to the goal it funds (a transaction may fund at most one goal in v1, simplifying the model to a nullable FK on the join instead of a true many-to-many; kept as its own table for auditability and future flexibility).

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| goal_id | uuid | FK → financial_goals.id, `ON DELETE CASCADE`, not null |
| transaction_id | uuid | FK → transactions.id, nullable, `ON DELETE SET NULL`, UQ |
| amount | numeric(14,2) | not null, `CHECK (amount > 0)` |
| note | text | nullable |
| created_at | timestamptz | default now() |

### 5.8 `recurring_transactions`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, `ON DELETE CASCADE`, not null |
| account_id | uuid | FK → accounts.id, `ON DELETE CASCADE`, not null |
| category_id | uuid | FK → categories.id, `ON DELETE RESTRICT`, nullable |
| type | enum(`income`,`expense`,`transfer`) | not null |
| amount | numeric(14,2) | not null |
| description | varchar(255) | nullable |
| frequency | enum(`daily`,`weekly`,`biweekly`,`monthly`,`yearly`) | not null |
| interval | smallint | not null, default 1 (e.g. every 2 weeks) |
| start_date | date | not null |
| end_date | date | nullable |
| next_run_at | date | not null, IDX — drives the scheduler |
| last_run_at | date | nullable |
| is_active | boolean | not null, default true |
| created_at, updated_at | timestamptz | as above |

### 5.9 `notifications`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, `ON DELETE CASCADE`, not null, IDX |
| type | enum(`budget_alert`,`budget_exceeded`,`goal_milestone`,`goal_achieved`,`recurring_due`,`recurring_failed`,`security`,`system`) | not null |
| title | varchar(150) | not null |
| body | text | nullable |
| link_url | text | nullable |
| is_read | boolean | not null, default false, IDX |
| created_at | timestamptz | default now() |

IDX: (`user_id`, `is_read`, `created_at` DESC).

### 5.10 Auth entities (NextAuth-compatible)
`sessions` (id, user_id FK cascade, session_token UQ, expires), `accounts_oauth` (NextAuth's OAuth linking table — renamed from the default `Account` to avoid collision with our financial `accounts` table: `oauth_accounts`), `verification_tokens` (identifier, token UQ, expires).

### 5.11 `audit_logs`
| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, `ON DELETE SET NULL`, nullable |
| action | varchar(80) | not null (e.g. `transaction.delete`, `login.failed`) |
| entity_type | varchar(50) | nullable |
| entity_id | uuid | nullable |
| ip_address | inet | nullable |
| user_agent | text | nullable |
| metadata | jsonb | nullable |
| created_at | timestamptz | default now(), IDX |

IDX: (`user_id`, `created_at` DESC), (`action`, `created_at` DESC).

### Delete/update behavior summary
- **Cascade** on User → everything owned by the user (account deletion = full data wipe, used for GDPR-style "delete my account").
- **Restrict** on Account/Category → Transaction: you cannot delete an account or category that still has transactions; the app forces reassignment or archiving instead. This is deliberate — it prevents silent loss of financial history.
- **Set Null** where losing the link is acceptable but the row should survive (e.g. a goal's linked account, a recurring template reference).

---

## 6. Prisma Model Design

```prisma
enum AccountType { bank cash credit_card wallet investment other }
enum TxnType     { income expense transfer }
enum CategoryType { income expense }
enum BudgetPeriod { monthly yearly }
enum GoalStatus   { active achieved archived }
enum NotifType {
  budget_alert budget_exceeded goal_milestone goal_achieved
  recurring_due recurring_failed security system
}
enum RecurFrequency { daily weekly biweekly monthly yearly }
enum UserStatus { active suspended deleted }

model User {
  id                String    @id @default(uuid())
  email             String    @unique @db.Citext
  passwordHash      String?   @map("password_hash")
  name              String
  avatarUrl         String?   @map("avatar_url")
  currency          String    @default("INR") @db.Char(3)
  timezone          String    @default("Asia/Kolkata")
  locale            String    @default("en-IN")
  emailVerifiedAt   DateTime? @map("email_verified_at")
  twoFactorEnabled  Boolean   @default(false) @map("two_factor_enabled")
  twoFactorSecret   String?   @map("two_factor_secret")
  status            UserStatus @default(active)
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  accounts          Account[]
  categories        Category[]
  transactions      Transaction[]
  budgets           Budget[]
  goals             FinancialGoal[]
  recurring         RecurringTransaction[]
  notifications     Notification[]
  sessions          Session[]
  auditLogs         AuditLog[]

  @@map("users")
}

model Account {
  id              String      @id @default(uuid())
  userId          String      @map("user_id")
  user            User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String
  type            AccountType
  currency        String      @db.Char(3)
  openingBalance  Decimal     @default(0) @map("opening_balance") @db.Decimal(14, 2)
  currentBalance  Decimal     @default(0) @map("current_balance") @db.Decimal(14, 2)
  creditLimit     Decimal?    @map("credit_limit") @db.Decimal(14, 2)
  color           String?
  icon            String?
  isArchived      Boolean     @default(false) @map("is_archived")
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")

  transactions       Transaction[] @relation("AccountTransactions")
  transferInbound     Transaction[] @relation("TransferAccount")
  recurring           RecurringTransaction[]
  linkedGoals          FinancialGoal[]

  @@unique([userId, name])
  @@index([userId, isArchived])
  @@map("accounts")
}

model Category {
  id         String        @id @default(uuid())
  userId     String?       @map("user_id")
  user       User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String
  type       CategoryType
  icon       String?
  color      String?
  parentId   String?       @map("parent_id")
  parent     Category?     @relation("CategoryParent", fields: [parentId], references: [id], onDelete: SetNull)
  children   Category[]    @relation("CategoryParent")
  isSystem   Boolean       @default(false) @map("is_system")
  createdAt  DateTime      @default(now()) @map("created_at")
  updatedAt  DateTime      @updatedAt @map("updated_at")

  transactions Transaction[]
  budgets      Budget[]
  recurring    RecurringTransaction[]

  @@index([userId, type])
  @@map("categories")
}

model Transaction {
  id                     String       @id @default(uuid())
  userId                 String       @map("user_id")
  user                   User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId              String       @map("account_id")
  account                Account      @relation("AccountTransactions", fields: [accountId], references: [id], onDelete: Restrict)
  transferAccountId      String?      @map("transfer_account_id")
  transferAccount        Account?     @relation("TransferAccount", fields: [transferAccountId], references: [id], onDelete: Restrict)
  categoryId             String?      @map("category_id")
  category               Category?    @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  type                   TxnType
  amount                 Decimal      @db.Decimal(14, 2)
  currency               String       @db.Char(3)
  description            String?
  notes                  String?
  occurredAt             DateTime     @map("occurred_at")
  recurringTransactionId String?      @map("recurring_transaction_id")
  recurringTransaction   RecurringTransaction? @relation(fields: [recurringTransactionId], references: [id], onDelete: SetNull)
  isReconciled            Boolean     @default(false) @map("is_reconciled")
  createdAt               DateTime    @default(now()) @map("created_at")
  updatedAt               DateTime    @updatedAt @map("updated_at")

  goalContribution GoalContribution?

  @@index([userId, occurredAt(sort: Desc)])
  @@index([userId, categoryId, occurredAt])
  @@index([accountId, occurredAt])
  @@map("transactions")
}

model Budget {
  id                 String       @id @default(uuid())
  userId             String       @map("user_id")
  user               User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId         String       @map("category_id")
  category           Category     @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  amount             Decimal      @db.Decimal(14, 2)
  period             BudgetPeriod @default(monthly)
  periodStart        DateTime     @map("period_start") @db.Date
  rolloverEnabled    Boolean      @default(false) @map("rollover_enabled")
  alertThresholdPct  Int          @default(80) @map("alert_threshold_pct")
  createdAt          DateTime     @default(now()) @map("created_at")
  updatedAt          DateTime     @updatedAt @map("updated_at")

  @@unique([userId, categoryId, period, periodStart])
  @@index([userId, periodStart])
  @@map("budgets")
}

model FinancialGoal {
  id             String     @id @default(uuid())
  userId         String     @map("user_id")
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  name           String
  description    String?    @db.Text
  targetAmount   Decimal    @map("target_amount") @db.Decimal(14, 2)
  currentAmount  Decimal    @default(0) @map("current_amount") @db.Decimal(14, 2)
  targetDate     DateTime?  @map("target_date") @db.Date
  accountId      String?    @map("account_id")
  account        Account?   @relation(fields: [accountId], references: [id], onDelete: SetNull)
  icon           String?
  color          String?
  status         GoalStatus @default(active)
  createdAt      DateTime   @default(now()) @map("created_at")
  updatedAt      DateTime   @updatedAt @map("updated_at")

  contributions GoalContribution[]

  @@index([userId, status])
  @@map("financial_goals")
}

model GoalContribution {
  id            String        @id @default(uuid())
  goalId        String        @map("goal_id")
  goal          FinancialGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)
  transactionId String?       @unique @map("transaction_id")
  transaction   Transaction?  @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  amount        Decimal       @db.Decimal(14, 2)
  note          String?       @db.Text
  createdAt     DateTime      @default(now()) @map("created_at")

  @@map("goal_contributions")
}

model RecurringTransaction {
  id          String         @id @default(uuid())
  userId      String         @map("user_id")
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId   String         @map("account_id")
  account     Account        @relation(fields: [accountId], references: [id], onDelete: Cascade)
  categoryId  String?        @map("category_id")
  category    Category?      @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  type        TxnType
  amount      Decimal        @db.Decimal(14, 2)
  description String?
  frequency   RecurFrequency
  interval    Int            @default(1)
  startDate   DateTime       @map("start_date") @db.Date
  endDate     DateTime?      @map("end_date") @db.Date
  nextRunAt   DateTime       @map("next_run_at") @db.Date
  lastRunAt   DateTime?      @map("last_run_at") @db.Date
  isActive    Boolean        @default(true) @map("is_active")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  generatedTransactions Transaction[]

  @@index([nextRunAt, isActive])
  @@map("recurring_transactions")
}

model Notification {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotifType
  title     String
  body      String?
  linkUrl   String?  @map("link_url")
  isRead    Boolean  @default(false) @map("is_read")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, isRead, createdAt(sort: Desc)])
  @@map("notifications")
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?  @map("user_id")
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action     String
  entityType String?  @map("entity_type")
  entityId   String?  @map("entity_id")
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt(sort: Desc)])
  @@index([action, createdAt(sort: Desc)])
  @@map("audit_logs")
}

// NextAuth-compatible auth models
model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expires      DateTime

  @@map("sessions")
}

model OAuthAccount {
  id                String  @id @default(uuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?

  @@unique([provider, providerAccountId])
  @@map("oauth_accounts")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

---

## 7. API / Server-Action Architecture

All mutations are **Server Actions**, colocated by domain, never called directly from JSX without going through the service layer. Pattern for every action:

1. Resolve session → `userId` (reject if absent)
2. Parse/validate input with a Zod schema
3. Rate-limit check (for sensitive actions)
4. Call the domain service (business logic + Prisma transaction)
5. Write an audit log entry if the action is sensitive
6. Revalidate the relevant path(s) / return typed result

```
app/actions/
  auth.actions.ts          register, login, logout, resetPassword
  account.actions.ts       createAccount, updateAccount, archiveAccount
  transaction.actions.ts   createTransaction, updateTransaction, deleteTransaction, bulkImport
  category.actions.ts      createCategory, updateCategory, deleteCategory
  budget.actions.ts        upsertBudget, deleteBudget
  goal.actions.ts          createGoal, contributeToGoal, updateGoal
  recurring.actions.ts     createRecurring, pauseRecurring, deleteRecurring
  notification.actions.ts  markRead, markAllRead
  settings.actions.ts      updateProfile, changePassword, exportData
```

Read paths are plain **async Server Components** calling the service layer directly (no API round-trip needed) — e.g. `app/(app)/transactions/page.tsx` calls `TransactionService.list(userId, filters)` server-side.

A minimal `/api` surface remains for:
- `app/api/auth/[...nextauth]/route.ts` — NextAuth handler
- `app/api/export/[format]/route.ts` — streamed CSV/PDF download (needs a Response, not a Server Action)
- (future) `app/api/webhooks/*` — bank-sync provider callbacks

Every service method takes `userId` as an explicit first argument and every Prisma call includes it in the `where` clause — there is no code path that queries financial data without a user scope.

---

## 8. Authentication Architecture

- **Provider:** Auth.js (NextAuth v5) with Credentials provider (email + password) and optional Google OAuth.
- **Password hashing:** argon2id (preferred) or bcrypt with cost factor ≥ 12.
- **Session strategy:** database sessions (not JWT-only) — allows immediate server-side revocation on password change, logout-everywhere, or suspicious activity, which matters for a finance app.
- **Session cookie:** `httpOnly`, `secure`, `sameSite=lax`, signed, short-medium lifetime (e.g. 7 days) with sliding renewal on activity.
- **2FA:** TOTP (optional per user), secret stored encrypted (AES-256-GCM) at rest, never returned to client after initial setup.
- **Email verification** required before financial features are usable (reduces throwaway-account abuse).
- **Password reset:** single-use, time-boxed token (15 min), invalidated on use; all other sessions revoked on password change.
- **Middleware** (`middleware.ts`) checks session presence for all `/dashboard`, `/transactions`, etc. routes and redirects unauthenticated users to `/login`, before any page code runs.

---

## 9. Security Architecture

| Concern | Approach |
|---|---|
| Password security | argon2id hashing, min length + breach-list check (e.g. HaveIBeenPwned range API), no max-length weirdness |
| AuthN | Auth.js DB sessions, httpOnly secure cookies, 2FA optional |
| AuthZ | Every query/action scoped by session `userId`; no client-supplied IDs trusted for ownership — always re-verified server-side against the row's `userId` |
| Input validation | Zod schema at every Server Action boundary; reject unknown fields (`.strict()`) |
| SQL injection | Prisma parameterized queries exclusively; zero raw string interpolation into `$queryRaw` |
| XSS | React's default escaping; sanitize any rendered rich text (e.g. notes) with an allowlist sanitizer if HTML is ever permitted (default: plain text only, so no HTML risk) |
| CSRF | Server Actions carry Next.js's built-in CSRF origin-check; `/api` routes double as same-site-cookie protected; state-changing GETs disallowed |
| Rate limiting | Sliding-window limiter (e.g. Upstash Redis or in-memory for dev) on login, register, password reset, 2FA verify — e.g. 5 attempts / 15 min per IP+email |
| Secure cookies | `Secure`, `HttpOnly`, `SameSite=Lax`, signed, scoped path |
| Env/secrets | `.env` never committed; `DATABASE_URL`, `AUTH_SECRET`, OAuth secrets, encryption key loaded via `process.env` and validated at boot with a Zod env schema; secrets never logged |
| Data isolation | `userId` foreign key + scoped query on every table; integration tests assert cross-user access returns 404, not 403 (avoid confirming existence) |
| Audit logging | Sensitive actions (login, password change, transaction delete, export, account deletion) written to `audit_logs` with IP + UA |
| Error handling | Generic user-facing error messages for auth failures (no "email not found" vs "wrong password" distinction); detailed errors logged server-side only, never sent to client |
| Money integrity | `numeric(14,2)` everywhere, DB `CHECK (amount > 0)`, sign derived from `type`, all arithmetic via `Prisma.Decimal`/Postgres `numeric` |

---

## 10. Folder Structure

```
finora/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   └── page.tsx                    # "/"
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                          # authenticated group, guarded by middleware
│   │   │   ├── layout.tsx                  # sidebar + topbar shell
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── transactions/page.tsx
│   │   │   ├── accounts/page.tsx
│   │   │   ├── budgets/page.tsx
│   │   │   ├── goals/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── recurring/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── categories/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── actions/                        # Server Actions, by domain
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   └── export/[format]/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                             # shadcn/ui primitives
│   │   ├── charts/                         # Recharts wrappers
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── forms/
│   │   └── shared/                         # empty/loading/error states, pagination
│   ├── server/
│   │   ├── services/                       # domain logic — the "brain"
│   │   │   ├── transaction.service.ts
│   │   │   ├── account.service.ts
│   │   │   ├── budget.service.ts
│   │   │   ├── goal.service.ts
│   │   │   ├── recurring.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   └── notification.service.ts
│   │   ├── db/
│   │   │   └── prisma.ts                   # singleton client
│   │   └── auth/
│   │       └── auth.config.ts
│   ├── lib/
│   │   ├── validation/                     # Zod schemas
│   │   ├── money.ts                        # Decimal helpers
│   │   ├── dates.ts                        # timezone-safe date helpers
│   │   ├── rate-limit.ts
│   │   └── utils.ts
│   ├── types/
│   └── middleware.ts
├── tests/
│   ├── unit/                               # Vitest — services, money math, validation
│   └── e2e/                                # Playwright — auth, transaction CRUD, budgets
├── .env.example
└── package.json
```

The key discipline: **`server/services/` owns every calculation.** Components and Server Actions call services; they never run `SUM()`-equivalent logic themselves.

---

## 11. Page / Component Architecture

For each page: purpose, key components, user actions, data needed, and state handling.

**`/` (marketing/landing)**
Purpose: unauthenticated pitch page. Components: Hero, FeatureGrid, CTA, Footer. Actions: sign up, log in. Data: none (static). States: N/A. Mobile: stacked single column.

**`/login`, `/register`**
Purpose: auth entry. Components: `AuthForm`, `OAuthButtons`, `PasswordInput`. Actions: submit credentials, forgot password. Data: none until submit. Loading: button spinner + disabled form. Error: inline field errors + generic top-level auth error. Mobile: full-width form, no side illustration.

**`/dashboard`**
Purpose: at-a-glance financial health. Components: `SummaryCards` (balance/income/expense/savings), `SpendingTrendChart`, `IncomeVsExpenseChart`, `CategoryBreakdownChart`, `RecentTransactionsList`, `BudgetProgressList`, `GoalProgressList`, `AccountSummaryList`, `AlertsBanner`. Actions: change date range, click-through to detail pages. Data: `AnalyticsService.getDashboard(userId, range)` — one aggregated call. Loading: skeleton cards + chart placeholders. Empty: "Add your first transaction" CTA when no data exists. Error: retry banner. Mobile: cards stack vertically, charts become swipeable/scroll-snap.

**`/transactions`**
Purpose: full ledger. Components: `TransactionTable` (virtualized), `FilterBar` (date, account, category, type, search), `TransactionFormSheet` (create/edit), `Pagination`. Actions: add/edit/delete transaction, bulk select, filter, sort, search, export. Data: `TransactionService.list(userId, filters, page)`. Loading: table skeleton rows. Empty: "No transactions match your filters" / "No transactions yet". Error: inline retry. Mobile: table collapses to card list.

**`/accounts`**
Purpose: manage financial accounts. Components: `AccountCard` grid, `AccountFormDialog`, `ArchiveConfirmDialog`. Actions: add/edit/archive account, view account transactions. Data: `AccountService.list(userId)` with computed `currentBalance`. Loading: card skeletons. Empty: "Add your first account". Error: toast + retry. Mobile: single-column cards.

**`/budgets`**
Purpose: category spending caps. Components: `BudgetProgressCard` (per category, progress bar + remaining), `BudgetFormDialog`, `PeriodSwitcher`. Actions: create/edit/delete budget, switch month. Data: `BudgetService.getForPeriod(userId, period)` joined with actual spend. Loading: progress bar skeletons. Empty: "No budgets set for this category yet". Error: retry. Mobile: stacked cards.

**`/goals`**
Purpose: savings targets. Components: `GoalCard` (progress ring, deadline), `GoalFormDialog`, `ContributeDialog`. Actions: create/edit goal, add contribution, archive. Data: `GoalService.list(userId)`. Loading: card skeletons. Empty: "Set your first goal". Error: retry. Mobile: single column.

**`/analytics`**
Purpose: deep spending analysis. Components: `TrendChart`, `CategoryPie`, `MerchantOrDescriptionBreakdown`, `ComparisonSelector` (this month vs last). Actions: change range, drill into a category. Data: `AnalyticsService.getBreakdown(userId, range, groupBy)`. Loading: chart skeletons. Empty: "Not enough data yet". Error: retry. Mobile: charts simplify to fewer data points, horizontal scroll for legends.

**`/recurring`**
Purpose: manage scheduled transactions. Components: `RecurringList`, `RecurringFormDialog`, `NextRunBadge`. Actions: create/pause/resume/delete. Data: `RecurringService.list(userId)`. Loading: list skeleton. Empty: "No recurring transactions". Error: retry. Mobile: stacked cards.

**`/reports`**
Purpose: monthly/yearly formal reports. Components: `ReportPeriodPicker`, `ReportSummaryTable`, `DownloadButton` (PDF/CSV). Actions: select period, download. Data: `AnalyticsService.getReport(userId, period)`. Loading: table skeleton. Empty: "No data for this period". Error: retry. Mobile: table becomes accordion.

**`/categories`**
Purpose: manage category taxonomy. Components: `CategoryList` (grouped income/expense), `CategoryFormDialog`, `MergeCategoryDialog`. Actions: add/edit/delete custom category (system categories read-only). Data: `CategoryService.list(userId)`. Loading: list skeleton. Empty: n/a (defaults always exist). Error: retry. Mobile: grouped accordions.

**`/notifications`**
Purpose: alert center. Components: `NotificationList`, `MarkAllReadButton`. Actions: mark read, click-through. Data: `NotificationService.list(userId)`. Loading: list skeleton. Empty: "You're all caught up". Error: retry. Mobile: full-width list.

**`/settings`**
Purpose: profile, security, preferences, export, danger zone. Components: `ProfileForm`, `PasswordChangeForm`, `TwoFactorSetup`, `PreferencesForm` (currency/timezone), `ExportDataPanel`, `DeleteAccountDialog`. Actions: update profile, change password, toggle 2FA, export data, delete account. Data: current user record. Loading: form skeletons. Error: inline field errors. Mobile: tabs become accordion sections.

---

## 12. Dashboard Data Flow

1. `dashboard/page.tsx` (Server Component) resolves `userId` from session.
2. Calls a single `AnalyticsService.getDashboardSnapshot(userId, { from, to })`.
3. That service runs a small number of aggregated Prisma queries **inside one transaction** for consistency:
   - Account balances (`SUM` per account, or read cached `current_balance`)
   - Income/expense totals for the period (`GROUP BY type`)
   - Category breakdown (`GROUP BY category_id`)
   - Spending trend (daily/weekly buckets via `date_trunc`)
   - Active budgets joined with period-to-date spend
   - Active goals with `current_amount`/`target_amount`
   - Unread notification count / active alerts (e.g. budgets over threshold)
4. Service returns one typed `DashboardSnapshot` DTO — all numbers pre-computed, already `Decimal`-safe, ready to format.
5. Page passes slices of the DTO to presentational client components (charts need `"use client"` for Recharts interactivity) — components format/display only, they perform **no math**.
6. Revalidation: any mutation (`createTransaction`, etc.) calls `revalidatePath('/dashboard')` so the next visit is fresh; for a snappier feel, client components can also optimistically update local UI state pending revalidation.

---

## 13. Financial Calculation Rules

All of the following live in `server/services/*` and `lib/money.ts`, never in components:

- **Account current balance** = `opening_balance + Σ(income to this account) − Σ(expense from this account) − Σ(transfer out) + Σ(transfer in)`. Recomputed transactionally whenever a transaction affecting the account is created/updated/deleted (either via a Postgres trigger or, more transparently for a student project, inside the same Prisma `$transaction` as the write — recommended: **application-level transaction**, so the logic is visible and testable in TypeScript rather than hidden in SQL).
- **Budget spent** = `Σ(expense transactions where category_id = budget.category_id AND occurred_at within period_start..period_end)`.
- **Budget remaining** = `budget.amount − spent` (plus prior-period rollover if `rollover_enabled`).
- **Goal progress** = `Σ(goal_contributions.amount for goal_id) / target_amount`, capped display at 100%; `current_amount` is a cache updated on every contribution write, always re-derivable from `goal_contributions` as the source of truth.
- **Net worth / total balance** = `Σ(current_balance across all non-archived accounts)`, with credit card balances treated as negative contribution to net worth.
- **Savings rate** (dashboard "Savings") = `(income − expense) / income` for the period, guarded against divide-by-zero.
- All monetary sums use `Prisma.Decimal` arithmetic (`.add`, `.sub`, `.mul`, `.div`) or are pushed down into Postgres `SUM()`/`numeric` aggregation — never `parseFloat` + `+`.
- All date-range math (month/year boundaries) is computed using the **user's stored timezone**, not server local time, so "this month" means the same thing to the user everywhere.

---

## 14. Seed Data Strategy

`prisma/seed.ts` builds a realistic demo dataset:

- **3–5 demo users**, each with a different profile (e.g. a salaried professional, a freelancer, a student) to showcase varied data shapes.
- **2–4 accounts per user** across types (bank, cash, credit card).
- **~15–20 categories**: a shared system default set (Salary, Freelance, Groceries, Rent, Utilities, Transport, Dining, Entertainment, Health, Shopping, Travel, Education, Subscriptions, Insurance, Other) plus 2–3 custom categories per user.
- **800–1500 transactions per user** spread over 12–18 months, generated with:
  - Weighted random category distribution (rent/salary monthly and regular; dining/transport frequent and small; travel occasional and large) using a seeded RNG (`faker` seeded, or a fixed seed array) for reproducibility.
  - Realistic amount distributions per category (e.g. groceries ₹300–₹2500, rent fixed monthly, salary fixed monthly with occasional bonus).
- **4–6 recurring transactions per user** (salary, rent, a subscription, an EMI) with correct `next_run_at` values so the recurring engine has real work to do on first run.
- **3–5 budgets per user** for their top spending categories, some intentionally over-threshold to demonstrate the alert UI.
- **1–3 goals per user** at varying completion percentages (one nearly complete, one just started).
- A handful of **notifications** pre-seeded (budget alert, goal milestone) so `/notifications` isn't empty on first login.

Seed script is idempotent (`upsert` keyed by email/name) so it can be re-run safely, and split into composable functions (`seedUsers`, `seedAccounts`, `seedCategories`, `seedTransactions`, ...) for maintainability.

---

## 15. Testing Strategy

**Vitest (unit/integration):**
- `lib/money.ts` — Decimal math edge cases (rounding, zero, negative guards)
- Every service in `server/services/` — especially `TransactionService.create` (balance updates), `BudgetService.getProgress`, `GoalService.contribute`, `RecurringService.generateDue`
- Zod schemas — valid/invalid payload cases
- Cross-user isolation — a service call with `userId=A` must never return/mutate rows owned by `userId=B`

**Playwright (E2E):**
- Auth flow: register → verify → login → logout → session persists across reload
- Transaction CRUD: create income + expense, edit, delete, confirm balance and dashboard update correctly
- Budget flow: create budget, add expense that crosses threshold, confirm alert appears
- Goal flow: create goal, contribute, confirm progress bar updates
- Recurring flow: create recurring transaction, simulate due date, confirm generated transaction appears
- Access control: attempt to reach another user's transaction by guessed ID → expect 404
- Mobile viewport smoke test for dashboard and transactions list

CI runs Vitest on every push and Playwright against a seeded test database on PR.

---

## 16. Development Phases

**Phase 0 — Foundation (Week 1)**
Repo scaffold, Tailwind + shadcn/ui setup, Prisma schema + migrations, env validation, base layout/navigation shell.

**Phase 1 — Auth & Users (Week 2)**
Auth.js integration, register/login/logout, session middleware, profile settings page, password security.

**Phase 2 — Core Ledger (Weeks 3–4)**
Accounts CRUD, Categories CRUD (system + custom), Transactions CRUD with balance recomputation logic, transactions list with filters/search/pagination.

**Phase 3 — Budgets & Goals (Week 5)**
Budget CRUD + progress calculation, goal CRUD + contribution flow, notification triggers for both.

**Phase 4 — Recurring & Notifications (Week 6)**
Recurring transaction engine (cron/scheduled job or on-request "catch-up" generation), notification center UI.

**Phase 5 — Dashboard & Analytics (Weeks 7–8)**
`AnalyticsService`, dashboard page, Recharts visualizations, `/analytics` and `/reports` pages, CSV/PDF export.

**Phase 6 — Polish, Security Hardening, Testing (Weeks 9–10)**
Rate limiting, audit logging, empty/loading/error states across all pages, accessibility pass, Vitest + Playwright suites, seed data finalization, responsive/mobile QA.

**Phase 7 — Deployment (Week 11)**
Production Postgres, environment secrets, CI/CD, monitoring/logging, final demo prep.

---

## 17. Risks and Edge Cases

- **Concurrent transaction writes** racing on the same account's `current_balance` — mitigate with a DB-level `SELECT ... FOR UPDATE` or serializable transaction when recomputing balances, not just optimistic app logic.
- **Timezone edge cases** — a transaction at 11:58 PM should land in the correct "month" for the user's timezone, not UTC; all period boundaries computed from `user.timezone`.
- **Deleting a category/account with history** — blocked at the DB level (`ON DELETE RESTRICT`); UI must guide the user to reassign or archive instead.
- **Recurring transaction backlog** — if the app wasn't opened for weeks, the recurring engine must catch up multiple missed occurrences (or intentionally cap catch-up and notify the user), not silently skip them.
- **Partial refunds / corrections** — v1 has no "edit history" beyond `updated_at`; consider transaction versioning if audit-grade correction trails are needed later.
- **Floating point creep** — guarded structurally by using `numeric`/`Decimal` everywhere; still needs unit tests for rounding at display boundaries (e.g. formatting ₹1234.005).
- **Goal linked to an archived/deleted account** — handled via `ON DELETE SET NULL`, goal survives without the link.
- **Over-budget vs. over-limit (credit cards)** — budgets track spending by category; credit limit tracking is a separate concern on the account itself, don't conflate the two in the UI.
- **Export of very large datasets** — stream CSV/PDF generation rather than building the whole file in memory for users with thousands of transactions.
- **Empty-state first-run experience** — a brand-new user has zero accounts/transactions; every aggregate query must handle nulls/zero gracefully (no divide-by-zero on savings rate, no NaN in charts).

---

## 18. Future Scalability Improvements

- **Bank sync** (Plaid/Salt Edge-style): add an `institution_connections` table and a `source` enum (`manual`,`synced`) on `transactions`; webhook route handler already reserved in `/api/webhooks/*`.
- **Multi-currency with conversion**: add an `exchange_rates` table and compute a `base_currency_amount` column on transactions, keeping `amount`/`currency` as the original entry.
- **Shared/family accounts**: introduce an `account_members` join table (account ↔ user, with a role) — the schema's consistent use of `userId` scoping makes this an additive change, not a rewrite.
- **Background job infrastructure**: move the recurring-transaction engine and notification dispatch from request-time "catch-up" logic to a proper queue (e.g. BullMQ/Redis or a cron-triggered serverless function) as data volume grows.
- **Read replicas / caching**: dashboard aggregates are natural candidates for a materialized view or Redis cache with short TTL once transaction volume is large.
- **Table partitioning**: `transactions` can be partitioned by `occurred_at` (monthly/yearly) if a single user's history grows very large.
- **Full-text search**: add a `tsvector` column on `transactions.description`/`notes` with a GIN index for fast free-text search at scale, replacing the simple `ILIKE` used in v1.
- **API-first evolution**: the Server Action layer already funnels everything through the service layer, so exposing a versioned public REST/GraphQL API later (for a future mobile app) means adding thin controllers, not rewriting business logic.

---

*End of specification.*
