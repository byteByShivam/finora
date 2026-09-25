# AGENTS.md — Instructions for AI Coding Agents Working on Finora

This file governs how any AI coding agent (e.g. Antigravity, Claude Code, Copilot Workspace, etc.) must work on this repository. It is binding for all code changes.

**Source of truth:** `finora-architecture.md`, at the project root, is the authoritative architecture document. Every rule below is derived from it. If this file and `finora-architecture.md` ever conflict, `finora-architecture.md` wins — flag the conflict and stop rather than silently picking one.

**Where the architecture leaves something undecided**, this file marks it explicitly as an **Open decision**. Agents must not silently invent an architectural decision to fill an open gap — either ask, or apply the minimal stated convention and leave a `// TODO(architecture):` comment explaining what was assumed and why.

---

## 1. Project Context

Finora is a full-stack personal finance management web app: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Lucide + Recharts + PostgreSQL + Prisma + Zod + Auth.js + Vitest + Playwright. It is a production-quality student (BCA) project — code should be held to real-world engineering standards, not "good enough for a demo."

The single non-negotiable design principle: **the frontend never performs financial calculations.** All money math lives in `src/server/services/` and `src/lib/money.ts`, using `Prisma.Decimal` / Postgres `numeric` — never native JS floats (`parseFloat`, plain `+`/`-` on numbers representing money).

---

## 2. Architecture Rules

- **Reads:** async Server Components call the service layer directly. Do not introduce an internal fetch/API round-trip for data your own server already has.
- **Writes:** go through **Server Actions** in `src/app/actions/`, grouped by domain (`auth`, `account`, `transaction`, `category`, `budget`, `goal`, `recurring`, `notification`, `settings`). Do not write mutation logic inline inside a component.
- **`/api/*` routes** are reserved for what Server Actions cannot do: the NextAuth handler, streamed export downloads, and future webhooks. Do not add new `/api` routes for functionality a Server Action can already handle.
- **Every Server Action follows this exact order:** resolve `userId` from session → validate input with Zod → apply rate limiting if the action is sensitive (auth, password reset, 2FA) → call the domain service → write an `audit_logs` entry if the action is sensitive → revalidate the relevant path(s).
- **Every service method** takes `userId` as an explicit first argument and every Prisma query inside it is scoped `where: { userId, ... }`. There must be no code path that reads or writes financial data without a user scope.
- Do not add a new architectural layer (e.g. a GraphQL API, a separate microservice, a new state-management library) without it being reflected first in `finora-architecture.md`.

---

## 3. Coding Standards

- TypeScript strict mode. No `any` unless justified with a comment explaining why a precise type isn't possible.
- Prefer explicit return types on exported functions, especially service methods and Server Actions.
- No default exports for components except Next.js special files (`page.tsx`, `layout.tsx`, etc.) that require them.
- Functions should do one thing; extract helpers rather than growing a single function to handle multiple concerns (validation + calculation + persistence in one function body is a smell).
- Comments explain *why*, not *what* — avoid narrating obvious code.

---

## 4. Folder / Module Responsibilities

| Path | Responsibility | Must NOT contain |
|---|---|---|
| `src/app/(app)/**/page.tsx` | Route composition, data fetching via services, passing typed props to components | Business logic, direct Prisma calls, money math |
| `src/app/actions/*.actions.ts` | Session resolution, Zod validation, calling services, audit logging, revalidation | Raw SQL/Prisma queries beyond what the service returns, UI logic |
| `src/components/**` | Presentational + light client interactivity (forms, charts rendering) | Financial calculations, direct database access |
| `src/server/services/**` | All business logic and money math, Prisma transactions | JSX, Next.js request/response objects |
| `src/server/db/prisma.ts` | Prisma client singleton only | Business logic |
| `src/server/auth/**` | Auth.js configuration | Feature business logic |
| `src/lib/validation/**` | Zod schemas | Persistence logic |
| `src/lib/money.ts` | Decimal arithmetic helpers | UI formatting beyond currency display helpers |
| `src/lib/dates.ts` | Timezone-safe date/period boundary helpers | Business rules unrelated to dates |
| `prisma/schema.prisma` | Data model — must match §5/§6 of `finora-architecture.md` | N/A |
| `prisma/seed.ts` | Idempotent demo data generation per §14 | Production logic |
| `tests/unit`, `tests/e2e` | Vitest and Playwright suites respectively | N/A |

An agent adding a new file must place it according to this table. If a new concern doesn't fit an existing folder, propose the new folder and its responsibility rather than dropping the file wherever is convenient.

---

## 5. Naming Conventions

- **Database (Postgres):** `snake_case` table and column names (as specified in `finora-architecture.md` §5), e.g. `current_balance`, `occurred_at`.
- **Prisma models/fields (TypeScript-facing):** `PascalCase` model names, `camelCase` fields, mapped to `snake_case` via `@map`/`@@map` (as shown in §6). Do not rename fields from what §6 specifies without updating the architecture doc first.
- **React components:** `PascalCase` (`TransactionTable`, `BudgetProgressCard`), matching names used in §11 of the architecture doc where one is given.
- **Server Actions:** `camelCase` verbs, e.g. `createTransaction`, `updateAccount`, `archiveAccount` — matching the action names listed in §7.
- **Service methods:** `PascalCase` service class/object (`TransactionService`, `BudgetService`) with `camelCase` methods (`TransactionService.create`, `AnalyticsService.getDashboardSnapshot`).
- **Files:** `kebab-case` for non-component files (`money.ts`, `transaction.service.ts`, `transaction.actions.ts`), `PascalCase.tsx` for components.
- **Zod schemas:** suffix with `Schema` (`createTransactionSchema`), colocated in `src/lib/validation/`.

---

## 6. TypeScript / JavaScript Conventions

- Money values in application code are `Prisma.Decimal` (from `@prisma/client/runtime/library`) or plain strings/DB `numeric` at the boundary — never `number` for a value representing currency. Convert to `number` only at the final display-formatting step, never for arithmetic.
- Dates are handled with the user's stored `timezone` for any "this month / this year" boundary logic (per §13) — do not use server-local time or naive UTC-only boundaries for period calculations.
- No silent `any`-typed Prisma query results — use the generated Prisma types.
- Prefer `async/await` over raw Promise chains.
- Do not introduce a new runtime dependency for something the existing stack already solves (e.g. do not add a second date library if the project has settled on one, do not add a second UI kit alongside shadcn/ui).

---

## 7. Component & API Development Rules

- New pages/components must match the purpose, actions, and states (loading/empty/error, mobile) already defined for that page in `finora-architecture.md` §11. If a page isn't yet described there, describe it in the architecture doc first (or flag it as an open decision) before building it.
- Every list/detail view must implement all four states explicitly: loading (skeleton), empty (guidance/CTA), error (retry), and populated — per the pattern established for every page in §11. Do not ship a component that only handles the happy path.
- Charts (Recharts) receive already-computed data from a service via the page — components must not aggregate or sum raw transaction rows themselves.
- New Server Actions must follow the exact order defined in §2 above and in §7 of the architecture doc; do not skip audit logging for actions the doc marks as sensitive (login, password change, transaction/account deletion, data export).
- Do not add REST/GraphQL endpoints for functionality already covered by a Server Action or Server Component read path.

---

## 8. Database Rules

- The schema in `prisma/schema.prisma` must match `finora-architecture.md` §5/§6 exactly. Any schema change starts with updating the architecture doc, not the other way around.
- **Money columns are always `numeric(14,2)`** (`Decimal` in Prisma) — never `Float`/`Int` for a currency amount. This is non-negotiable per §5/§9/§13.
- Every user-owned table carries `userId` directly and every query touching it filters on it — do not rely solely on joins through `Account`/`Category` to establish ownership.
- Respect the delete/update behaviors specified in §5: `Cascade` from `User`, `Restrict` from `Account`/`Category` → `Transaction` (never allow deleting an account/category that still has transaction history — the app must force reassignment or archiving instead), `SetNull` where specified (e.g. a goal's linked account).
- Any new migration must be generated via `prisma migrate dev` and committed — never hand-edit the database out of band.
- Account `current_balance` and goal `current_amount` are cached, derived values. They are only ever written by the relevant service (`TransactionService`, `GoalService`) inside the same transaction as the write that changes them — never set directly from a form or Server Action.
- **Open decision (per §13):** balance recomputation uses an application-level Prisma transaction, not a database trigger. Do not introduce Postgres triggers for this without first updating the architecture doc, since it would contradict the stated rationale (visibility/testability in TypeScript).

---

## 9. Authentication / Authorization Rules

- Auth.js (NextAuth) with **database sessions**, not JWT-only, per §8 — sessions must be revocable server-side.
- Password hashing: argon2id preferred, bcrypt (cost ≥ 12) acceptable. Never store or log plaintext passwords.
- `middleware.ts` must guard every route under the `(app)` group — do not rely on page-level checks alone as the only gate.
- Every Server Action and service call resolves `userId` from the **session**, never from a client-supplied field (e.g. a hidden form input or request body `userId`). Treat any such client-supplied ID as untrusted even if present.
- 2FA secrets are encrypted at rest (AES-256-GCM per §9) and never returned to the client after initial setup.
- On password change, revoke other active sessions (per §8).
- Cross-user access attempts (e.g. fetching another user's transaction by guessed ID) must return **404**, not 403 — do not confirm existence of another user's resource (per §15 testing requirement).

---

## 10. Security Requirements

Enforce every row of the §9 security table. Non-exhaustive highlights an agent must never violate:

- All Prisma queries are parameterized by construction — never build a `$queryRaw`/`$executeRaw` string via interpolation of user input.
- All Server Action inputs are validated with a Zod schema using `.strict()` (reject unknown fields) before touching the database.
- Rate-limit login, register, password reset, and 2FA verification endpoints/actions.
- Cookies: `httpOnly`, `secure`, `sameSite=lax`, signed.
- Never log secrets, tokens, password hashes, or full 2FA secrets.
- Env vars are the only source of secrets; validate them at boot with a Zod env schema; never hardcode a secret or default fallback value for a required secret.
- Auth error messages are generic ("invalid credentials") — never reveal whether an email exists in the system.
- Write an `audit_logs` entry for: login, password change, 2FA change, transaction deletion, account deletion, data export, and any other action §9 marks sensitive.

---

## 11. Error Handling

- User-facing errors are generic and safe; detailed error information (stack traces, internal messages) is logged server-side only, never sent to the client — this applies especially to auth failures (§9).
- Every Server Action returns a typed result (success/error discriminated union) rather than throwing uncaught across the server/client boundary.
- Every list/detail page implements an explicit error state with a retry affordance, per §11 — do not let a failed fetch render a blank page.
- Handle zero/empty-data edge cases explicitly (e.g. divide-by-zero on savings rate for a new user with no income) — per §17, this must not produce `NaN`/`Infinity` in the UI.

---

## 12. Validation Requirements

- Every Server Action has a corresponding Zod schema in `src/lib/validation/`, used with `.strict()`.
- Validate at the boundary (Server Action entry), not deep inside a service — services can assume validated input, but must still enforce business-rule invariants (e.g. `amount > 0`, transfer account ≠ source account) that mirror the DB `CHECK` constraints in §5, so failures surface with clear application-level errors rather than relying solely on a raw DB constraint violation.
- Reuse Zod schemas for both client-side form validation and server-side Server Action validation where the shapes match — do not maintain two divergent validation definitions for the same form.

---

## 13. Testing Requirements

- Any new service method affecting money (balance, budget progress, goal contribution, recurring generation) requires a Vitest unit test covering at least: normal case, zero/edge amount, and a cross-user isolation case (per §15).
- Any new page or user-facing flow requires a Playwright test if it materially changes a flow already covered in §15 (auth, transaction CRUD, budget alerts, goal contributions, recurring generation, access control).
- `lib/money.ts` changes require unit tests for rounding and decimal edge cases.
- Do not mark a task complete if tests were skipped, stubbed out, or written to always pass — see §16 verification requirements below.

---

## 14. Dependency Rules

- Do not add a new npm package outside the stack listed in §2 of `finora-architecture.md` (Next.js 15, TypeScript, Tailwind, shadcn/ui, Lucide, Recharts, PostgreSQL, Prisma, Zod, Auth.js, Vitest, Playwright) without first checking whether an existing dependency already solves the problem.
- If a new dependency is genuinely required (e.g. a rate-limiting backend, a PDF generation library for exports), note it explicitly in the PR/commit description with the reason, since it is not preselected by the architecture doc — this is an **open decision** territory (see §9/§16 of the architecture doc: rate-limiting backend and export library are not pinned).
- Never introduce a second library that duplicates an existing one's purpose (e.g. a second date library, a second chart library, a second ORM).

---

## 15. Git / Change-Management Rules

- Commits are scoped to a single concern; do not bundle unrelated schema changes, feature work, and formatting-only changes into one commit.
- Any schema change (`prisma/schema.prisma`) ships with its generated migration in the same commit/PR.
- Commit messages describe *what* changed and *why*, referencing the relevant architecture section when applicable (e.g. "Add budget rollover calculation per architecture §13").
- Do not push directly to a protected main/production branch; work through a branch + PR flow if the repository has one configured.

---

## 16. Rules for Modifying Existing Code

- Before changing a service method or schema field, check `finora-architecture.md` for the specified behavior — a change that contradicts the architecture doc requires updating the doc first, in the same change set, with a clear note on what changed and why.
- Preserve existing function signatures/exports used elsewhere unless the change is explicitly a refactor task — check call sites before altering a shared service method's contract.
- When fixing a bug, add a regression test that would have caught it, in addition to the fix.

---

## 17. Rules Against Unnecessary Rewrites

- Do not rewrite a file wholesale to make a small, localized change — use targeted edits.
- Do not restructure folder layout, rename working modules, or change established naming conventions as a side effect of an unrelated feature task.
- Do not introduce a different architectural pattern for a new feature than the one already established for equivalent existing features (e.g. do not build one domain's mutations as a Server Action and another's as a raw API route without justification tied to §7's stated exceptions).
- If an agent believes a larger refactor is genuinely warranted, it proposes the refactor as its own scoped task/PR rather than folding it into an unrelated feature change.

---

## 18. Rules Against Mock / Placeholder Production Implementations

- Do not ship a feature with hardcoded/mock data, a stubbed service method that returns fake values, or a "TODO: implement real logic" left in a code path that is reachable in production.
- Financial calculations are never approximated, hardcoded, or computed client-side "for now" — this directly violates the core principle in §1 and §13 of the architecture doc. If a calculation can't yet be done properly, the feature is not done — do not fake the number.
- If a task cannot be fully completed (e.g. a dependency, credential, or upstream decision is missing), say so explicitly and stop, rather than filling the gap with a placeholder that looks finished.
- Seed data (per §14) is clearly a development/demo aid and must never leak into or be mistaken for production logic — seed scripts do not run automatically in a production build/deploy path.

---

## 19. Verification Requirements Before Considering a Task Complete

An agent must confirm all of the following before marking a task done:

1. **Type-checks cleanly** (`tsc`/`next build` type-check passes, no new `any` introduced without justification).
2. **Relevant tests pass**: any new/changed service has unit tests (§13) and any new/changed user flow has or updates an E2E test where one already exists for that flow.
3. **No money math in components** — grep the diff for arithmetic on values that represent currency outside `server/services/` and `lib/money.ts`.
4. **User scoping intact** — every new/changed query touching a user-owned table filters by session-derived `userId`.
5. **Schema/architecture consistency** — if `prisma/schema.prisma` changed, `finora-architecture.md` §5/§6 is updated to match (or the change is rejected as out of scope).
6. **States covered** — if a UI flow changed, loading/empty/error states are still handled per §11.
7. **No placeholder/mock logic remains** in a reachable production code path (§18).
8. **Audit logging present** for any action §9 marks sensitive, if that action was touched.
9. **No undocumented new dependency or architectural pattern** introduced without a note explaining the open decision it resolves.

If any of these cannot be satisfied, the task is **not complete** — the agent should report what's missing rather than closing it out.

---

*This file governs AI-agent contributions to Finora. `finora-architecture.md` remains the single source of truth for architecture; update it first whenever a decision changes, then bring this file back into alignment.*
