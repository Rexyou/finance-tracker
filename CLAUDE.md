# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A RESTful personal finance tracker API: TypeScript + Express, MongoDB/Mongoose, Redis caching (optional), Zod validation, JWT auth. See [README.md](README.md) for the full API reference (endpoints, request/response shapes, business rules).

## Commands

```bash
npm run dev      # run with nodemon auto-reload (ts-node, src/index.ts)
npm run build     # npm install + tsc compile to dist/
npm start          # run compiled build (node dist/index.js)
```

There is no test suite and no linter configured in this repo. A `.env` file is required at runtime (`DB_URL`, `TOKEN_SECRET`, `PORT`, `REDIS_*` — see [README.md](README.md) for the full list); the app fails fast if `DB_URL`/`TOKEN_SECRET` are missing, but Redis is optional (caching silently disables if it can't connect).

## Architecture

**Request flow**: `routes/ → middleware/Authentication.ts → controller/ → services/ServiceContainer.ts → services/*Service.ts → schemas/ (Mongoose models)`.

- **Routes** (`src/routes/`) wire an Express path + `Authenticate` middleware to a controller function. All routes are POST-only, including reads (list/get endpoints take filters in the body rather than query params).
- **Controllers** (`src/controller/`) are thin: `validateParameter(req, SomeZodSchema)` → call a `ServiceContainer.<domain>` method → send the response. Errors are always passed to `next(error)`, never thrown/handled locally.
- **ServiceContainer** (`src/services/ServiceContainer.ts`) is a static singleton registry of service instances — this is how cross-service dependencies are wired (e.g. `TransactionService` receives the shared `AccountService` instance in its constructor). Add new services here rather than instantiating them ad hoc.
- **Services** hold all business logic and are the only layer that touches Mongoose models directly.
- **Schemas** (`src/schemas/`) define Mongoose schemas/models. Monetary fields (`balance`, `limit`, `amountUsed`, `availableCredit`) are stored as `Decimal128` with getters/setters that convert to/from `number` — the `mongoose-lean-getters` plugin is required on every schema with such fields so `.lean({ getters: true })` still applies them.
- **Validation**: request bodies are validated with Zod schemas from `src/variables/ValidationSchemas.ts` via `validateParameter()` ([Validation.ts](src/utility/Validation.ts)), which throws a `CustomError` (422, `validation_error`) with the Zod error details attached on failure. Every handler that reads `req.body` must call it — passing `req.body` through raw is how two list endpoints ended up 500-ing on an empty body. Money fields use `moneyValidator`/`positiveMoneyValidator`, which are `.finite()`: bare `z.number()` accepts `Infinity`, and `Infinity` round-trips through `Decimal128` successfully, permanently corrupting an account.

**Errors**: all thrown errors should be a `CustomError` (`src/utility/CustomError.ts`), constructed from an entry in `ErrorMessages` (`src/variables/errorCodes.ts`) — each entry pairs an HTTP status with a snake_case message key. The global `errorHandler` middleware (registered last in [index.ts](src/index.ts)) converts any error into the `{ success, message, details }` response shape; non-`CustomError` errors fall back to 500/`unknown_error`. Add new error types as new `ErrorMessages` entries rather than inline strings. Business-rule violations (insufficient balance, over limit) are **422, not 500** — 500s should mean the server actually failed, so they stay useful for alerting.

**Environment-gated behavior** goes through `isProduction` ([env.ts](src/config/env.ts)), not scattered `process.env` reads. It currently gates stack traces in error responses and full-response-body logging. [Logger.ts](src/middleware/Logger.ts) redacts `password`/`confirmPassword`/`pin`/`token` recursively from both request and response bodies — `token` matters because JWTs are 7-day and have no revocation path.

**Shared data-access helpers** (`src/services/`):
- `ModelService.ts` — `findOrFail(model, filter, projection?, options?, error?)`: fetch-one-or-throw, used everywhere instead of raw `Model.findOne`.
- `GeneralService.ts` — `paginate(model, filter, paginationData, options?)`: shared list/pagination logic (page, size, sort, projection, populate) returning `{ data, currentPage, totalCount, totalPage }`, the standard success response shape.

**Money movement — read this before touching balances.** Two rules, both load-bearing:

1. *Every balance change goes through `AccountService.applyBalanceDelta`*, inside a `withSession()` block. It builds the `$inc` **and** a guard: for any negative delta it adds `{ field: { $gte: -delta } }` to the update filter. That one rule enforces `balance >= 0`, `amountUsed >= 0`, and `amountUsed <= limit` (the last via `availableCredit >= 0`). A `matchedCount` of 0 means a guard failed. Never write a read-then-`$inc` sequence: MongoDB transactions take no read locks, so a prior read does *not* constrain a later write — the guard is the only thing that does. The pre-checks in `TransactionService` exist for precise error messages, not for correctness.
2. *Every monetary value passes through `toMoney()`* ([Money.ts](src/utility/Money.ts)) before reaching a filter or an `$inc`. Mongoose applies custom setters to `$inc` values but **not** to comparison operators like `$gte`, so a raw JS float would be rounded on one side and not the other. `toMoney` also accepts an already-converted `Decimal128` — the schema setters are `set: toMoney` precisely so pre-converted values don't crash on `.toFixed()`.

`withSession()` ([TransactionService.ts](src/services/TransactionService.ts)) wraps `session.withTransaction()`, which retries transient errors — concurrent writes to one account produce a `WriteConflict`, and without the retry contention would surface as a 500. Its callback may therefore run more than once: keep it free of side effects outside the session, and never swallow errors inside it. **Requires MongoDB to be a replica set.**

`availableCredit` is derived (`limit - amountUsed`) but stored, because it is the guard column that makes the credit check a single comparison. Every path that writes it must be atomic — including `AccountService.editAccount`, which uses optimistic concurrency on `limit` rather than recomputing from a stale `amountUsed`.

**Over-limit is deliberately not representable — do not "fix" this.** `availableCredit >= 0` is a hard invariant, so a credit account can never exceed its limit. The visible consequence is that **deleting a payment transaction is rejected with `limit_not_enough_error` when reversing it would push `amountUsed` past `limit`** — reversing a payment moves `{ amountUsed: +X, availableCredit: -X }`, and the negative delta on `availableCredit` trips the guard. This looks like a bug and is not one. Relaxing the guard would not break the machinery (spending stays blocked because `availableCredit >= amount` still fails, paying down still recovers, and `used + avail == limit` still holds) — it was rejected on modelling grounds: a bad record is corrected with a compensating entry, not by letting the column go negative, so the ledger stays reconcilable against stored balances.

Note the compensating entry hits the *same* guard, so near the limit there is currently no in-app path to reverse a bad payment. The supported workaround is to raise `limit`, post the correction, and let it heal: `editAccount` will refuse to lower `limit` back below `amountUsed`, so the ceiling stays raised until the user pays down. If a dedicated adjustment endpoint is ever added, `editAccount`'s "new limit must be >= amountUsed" rule has to be relaxed in step with it — otherwise the same over-limit state is reachable one way and forbidden the other.

The `amountUsed >= 0` guard is a separate rule and must stay regardless: it blocks paying more than is owed. Negative `amountUsed` would mean the issuer owes the user money (a credit balance), which this schema does not model.

**Dates are UTC, and the process is pinned to make that true.** [env.ts](src/config/env.ts) sets `process.env.TZ = "UTC"` at import time, which is why it must stay the first project import in [index.ts](src/index.ts). Without the pin, `new Date("2024-01-01T00:00:00")` — an ISO string carrying a time but no offset — resolves in the *host's* zone, so the same request lands eight hours apart on a +08:00 dev box versus a UTC container; date-only strings are always UTC per spec, so the two formats also disagreed with each other. Pinning settles both. Explicit offsets from clients are still honoured and converted normally — the pin only decides the ambiguous forms.

`dateFrom`/`dateTo` on `DatePaginationSchema` are the only client-supplied dates in the app (`createdAt`/`updatedAt` come from `timestamps: true`). Both ends are inclusive (`$gte`/`$lte`), so `dateTo` runs through `toEndOfDayUtc` ([GeneralFunctions.ts](src/utility/GeneralFunctions.ts)) inside a `z.preprocess`: a bare `YYYY-MM-DD` is widened to `23:59:59.999Z` so the final day is actually covered, while explicit timestamps pass through untouched. **The widening has to happen before coercion** — `new Date("2024-01-31")` and `new Date("2024-01-31T00:00:00Z")` produce identical objects, so afterwards there is no way to tell the client only sent a date. Range defaulting lives beside it in `resolveDateRange` rather than inline in the schema, so reports or exports can reuse the same 30-day window; `DEFAULT_DATE_RANGE_DAYS` is the single source for that number.

A bare date still splits on UTC day boundaries, so for a UTC+8 user it is not their local day. That is a deliberate trade-off (a per-user timezone field was considered and rejected as too invasive); the README tells clients to send offset-bearing ISO strings when the distinction matters. Repeated "off by 8 hours" reports would be the signal to revisit it.

**Identifier fields are strings, not numbers.** `accountNumber` and `phoneNumber` are `type: String`. A 17-digit value exceeds 2^53 and is already mangled by `JSON.parse` before any validator sees it, and a numeric type also drops significant leading zeros — both matter for real bank and phone numbers. Clients must send them as JSON strings; a numeric literal is rejected with `validation_error`. Anything comparing or storing them treats them as opaque digit strings.

**`phoneNumber` stores the full international number**, country code included
(`"601116359480"`). It is the identity — uniqueness is on that field alone, which is
only correct because a full number is globally unique; a national number would make
`+60 123456789` and `+65 123456789` collide. `RegisterSchema` enforces the prefix with
a cross-field refine, because without it half the rows had already drifted to the
national form. `country` (`"MY"`) and `countryCode` (`60`) are display/locale metadata
and deliberately not part of identity — read `country` to know where a user is from
rather than parsing the number, since dialling codes are a variable-length prefix tree.
Login takes the full number too: `LoginSchema` has one `username` field accepting
username/email/phone, so there is nowhere to carry a country code.

**Phone numbers get structural validation only — that is deliberate.** `phoneNumberValidator`
checks digits, 4–15 length, and (via the `RegisterSchema` refine) that the country code
prefix is present. It does not check that the number is plausible for its country: a
per-country pattern such as `^1\d{8,9}$` for MY rejects `600000` and `609999999999` but
still passes `601111111111`, so it buys typo protection and nothing more. Do not add one.
The failure modes are asymmetric — letting a fake number through costs one undelivered
OTP, while wrongly rejecting a real one blocks registration entirely and nobody reports
it. Mobile prefix ranges also grow over time (Malaysia's `011` was a later addition), so
a hardcoded pattern eventually starts rejecting valid new numbers. Only OTP delivery
actually proves a number exists. If formal validation is ever needed — multiple countries,
or formatting/parsing — reach for `libphonenumber-js` so the library tracks prefix changes,
rather than hand-maintaining a regex table.

**Account types**: `debitAccount`, `cash`, `creditAccount`. Cash behaves exactly like a debit account (the money path branches only on `type === CreditAccount`), but has **no account number** — it is physical money. `AccountService.assertUnique` therefore keys on `label` for cash and on `accountNumber` for everything else; never build that filter by spreading a possibly-undefined `accountNumber`, because Mongoose strips undefined keys and the filter would collapse to `{ userId, type }` and match every account of that type. `fixedDeposit` was removed from the enum: the balance arithmetic worked, but no FD semantics exist (no tenure, no maturity date, nothing blocks an early withdrawal, no maturity notification) — add it back with those fields, not as a bare enum member.

**Account types drive branching logic**: `debitAccount` and `cash` track `balance` directly; `creditAccount` tracks `limit`/`amountUsed`/`availableCredit` and treats debit transactions as spending, credit transactions as payment/refund. Branch on `type === CreditAccount` with the balance-tracking types as the `else` arm — an `if/else if` on `DebitAccount` alone silently skips `cash`. See [README.md](README.md) "Account Business Rules".

**Auth**: `Authenticate` middleware ([Authentication.ts](src/middleware/Authentication.ts)) verifies the JWT, loads the user via `AuthService.getProfile` (cached in Redis under `RedisKeyName.UserData` for 15 min via `getOrSetCache`), and attaches it as `req.userData` (typed via the `express-serve-static-core` module augmentation in [index.ts](src/index.ts)). Controllers/services take `user: UserDocument` as the first argument and scope all queries by `userId` — never trust an id from the request body alone for ownership checks.

**Async middleware must not `throw`.** This runs on Express **4** (despite `@types/express` being v5 — a real mismatch), which does not forward rejected promises to `errorHandler`; a throwing async middleware hangs the request instead of returning a status. Wrap async middleware in `asyncHandler` ([asyncHandler.ts](src/utility/asyncHandler.ts)) and use `next(err)`. Also keep the terminal `next()` outside any `try` — it runs the rest of the chain synchronously, so a downstream throw caught locally would be rewritten as the wrong error. Note `app.get("*")` in [index.ts](src/index.ts) is invalid under Express 5's path-to-regexp, so upgrading is not a drop-in.

**Ownership is checked per resource, not inferred.** Every service scopes its
queries by `userId`, but an id that merely *appears* in a validated body is not
owned by the caller: `TransactionService.assertLabelOwned` exists because a
`transactionLabelId` reaching `create`/`edit` unchecked let a transaction point at
another user's label (dereferenced by the populate in `getTransaction`) or at one
that does not exist, which the `$lookup` in `getTransactionsByTransactionLabel`
would then silently drop from its totals.

**Soft delete is the model for accounts and labels**, so populate and `$lookup` keep
resolving names for historical transactions. List endpoints therefore filter
`status: { $ne: delete }` — not `status: active`, which would hide an *inactive*
account and leave no way to get its id back to reactivate it. Because the unique
index on `{ userId, labelName }` has no status component, a deleted label still
holds its name; `createTransactionLabel` revives it instead of erroring, keeping
the same `_id` so old transactions stay attached.

**Auth checks user status on every request**, not just at login — JWTs are 7-day
with no revocation, so a login-only check meant deactivating a user did nothing
until their token expired.

**Caching**: `getOrSetCache`/`getCacheData`/`setCacheData` ([GeneralFunctions.ts](src/utility/GeneralFunctions.ts)) wrap Redis reads/writes and fall back to the DB query on any Redis error, so caching failures never break a request. `clientInstance` ([RedisConnection.ts](src/config/RedisConnection.ts)) is `null` when Redis is unavailable; cache helpers no-op in that case.

**Logging**: `requestLogger` middleware ([Logger.ts](src/middleware/Logger.ts)) logs every request and response (correlation id, method, URL, IP, body, status, duration). Response bodies are logged in full outside production; under `isProduction` only 4xx/5xx bodies are, since successful responses are mostly user financial data. Redaction is recursive and covers both directions — see the environment-gated behavior section above.
