# Finance Tracker API

A RESTful API built with TypeScript and Express for managing personal finances. Supports multiple account types, transaction tracking, custom labels, and financial dashboard analytics with JWT authentication and Redis caching.

---

## Tech Stack

- **Runtime**: Node.js (v16+)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis
- **Validation**: Zod
- **Authentication**: JSON Web Token (JWT)
- **Password Hashing**: bcryptjs

---

## Prerequisites

- Node.js v16 or higher
- MongoDB **replica set** (local or cloud) — transaction create/update/delete run inside Mongo transactions, which a standalone `mongod` does not support
- Redis server (optional — app runs without it but caching is disabled)

---

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd financetracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
PORT=3000
NODE_ENV=development   # set to "production" to suppress stack traces and trim response logging

# MongoDB
DB_URL=mongodb://localhost:27017/financetracker

# Redis
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_SOCKET_HOST=localhost
REDIS_SOCKET_PORT=6379

# JWT
TOKEN_SECRET=your_jwt_secret_here
```

### 4. Run the app

```bash
# Development (with auto-reload)
npm run dev

# Production build
npm run build
npm start
```

---

## Project Structure

```
src/
├── config/
│   ├── dbconnection.ts        # MongoDB connection and index sync
│   └── RedisConnection.ts     # Redis client setup
├── controller/
│   ├── AccountController.ts
│   ├── AuthController.ts
│   ├── MiscController.ts
│   ├── TransactionController.ts
│   └── TransactionLabelController.ts
├── middleware/
│   ├── Authentication.ts      # JWT verification middleware
│   └── errorHandler.ts        # Global error handler
├── routes/
│   ├── AccountRoutes.ts
│   ├── AuthRoutes.ts
│   ├── DashboardRoutes.ts
│   ├── TransactionLabelRoutes.ts
│   └── TransactionRoutes.ts
├── schemas/
│   ├── account.ts             # Mongoose account schema
│   ├── transaction.ts         # Mongoose transaction schema
│   ├── transactionLabel.ts    # Mongoose label schema
│   └── users.ts               # Mongoose user schema
├── services/
│   ├── AccountService.ts
│   ├── AuthService.ts
│   ├── GeneralService.ts      # Shared paginate helper
│   ├── ModelService.ts        # Shared findOrFail helper
│   ├── ServiceContainer.ts    # Service dependency injection
│   ├── TransactionLabelService.ts
│   └── TransactionService.ts
├── utility/
│   ├── CustomError.ts         # Custom error class
│   ├── GeneralFunctions.ts    # JWT, cache, isEmpty helpers
│   └── Validation.ts          # Zod request body validator
├── variables/
│   ├── Enums.ts               # App-wide enums
│   ├── errorCodes.ts          # HTTP codes and error messages
│   ├── types.ts               # TypeScript types and interfaces
│   └── ValidationSchemas.ts   # Zod validation schemas
└── index.ts                   # App entry point
```

---

## API Endpoints

All protected routes require the `Authorization: Bearer <token>` header.

### Auth — `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register a new user |
| POST | `/auth/login` | ❌ | Login and receive JWT token |
| POST | `/auth/profile` | ✅ | Get current user profile |

#### Register — Request Body
```json
{
  "username": "johndoe1",
  "password": "password123",
  "confirmPassword": "password123",
  "email": "john@example.com",
  "country": "MY",
  "countryCode": 60,
  "phoneNumber": "60123456789"
}
```

> `phoneNumber` must be the **full international number including the country code**,
> sent as a string: `"601116359480"`, not `"1116359480"`. Registration rejects a
> number that does not start with its own `countryCode`.
>
> `country` (`"MY"`) and `countryCode` (`60`) are stored for display and locale; they
> are **not** part of identity. Uniqueness is on `phoneNumber` alone, which is only
> correct because the stored value is a globally unique full number.
>
> Log in with the full number too — `/auth/login` takes username, email, or phone in
> one `username` field, so there is nowhere to put a country code and the server
> cannot infer which prefix to add.

#### Login — Request Body
```json
{
  "username": "johndoe1",
  "password": "password123"
}
```
> `username` accepts username, email, or phone number.

---

### Accounts — `/account`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/account/create` | ✅ | Create a new account |
| POST | `/account/list` | ✅ | Get paginated account list |
| POST | `/account/update` | ✅ | Update an account |

#### Account Types
| Type | Value | Identified by |
|------|-------|---------------|
| Debit Account | `debitAccount` | `accountNumber` |
| Credit Account | `creditAccount` | `accountNumber` |
| Cash | `cash` | `label` — physical money has no account number |

> **`accountNumber` and `phoneNumber` are strings**, 6–17 and 4–15 digits respectively.
> Send them as JSON strings (`"0012345678"`), not numeric literals: a 17-digit number
> exceeds JavaScript's safe integer range and is corrupted by `JSON.parse` before the
> server sees it, and a numeric type also drops leading zeros. Numeric literals are
> rejected with `validation_error`.

#### Create Cash Account — Request Body
```json
{
  "type": "cash",
  "label": "Wallet",
  "balance": 250
}
```
Cash behaves exactly like a debit account for money in and out. Cash account labels
must be unique per user, since there is no account number to distinguish them.

#### Create Debit Account — Request Body
```json
{
  "type": "debitAccount",
  "accountNumber": "1234567890",
  "label": "My Savings",
  "balance": 1000
}
```

#### Create Credit Account — Request Body
```json
{
  "type": "creditAccount",
  "accountNumber": "9876543210",
  "label": "My Credit Card",
  "limit": 5000
}
```

#### Update Account — Request Body
```json
{
  "accountId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "label": "Renamed",
  "limit": 8000
}
```

Editable fields: `label`, `accountNumber`, `status`, and `limit` (credit accounts only).

> **`balance` cannot be set through this endpoint.** Balances only move as a
> consequence of transactions. Sending `balance` returns `validation_error`.
> Set a debit account's opening balance at creation time instead.
>
> Lowering `limit` below the amount already used returns `credit_account_limit_error`.

---

### Transaction Labels — `/transactionLabel`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/transactionLabel/create` | ✅ | Create a new label |
| POST | `/transactionLabel/list` | ✅ | Get paginated label list |
| POST | `/transactionLabel/update` | ✅ | Update a label |

#### Create Label — Request Body
```json
{
  "labelName": "Food & Drinks",
  "labelColor": "#FF5733"
}
```

`labelName` is at most 25 characters and unique per user.

> Labels are soft-deleted (`status: "delete"`) so historical transactions keep
> resolving their original category name. Deleted labels are hidden from
> `/transactionLabel/list`, and creating a label with the name of a deleted one
> **revives that label** — same id, so its old transactions stay attached.

> A transaction's `transactionLabelId` must belong to the caller; anything else
> returns `label_not_found`.

---

### Transactions — `/transaction`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/transaction/create` | ✅ | Create a new transaction |
| POST | `/transaction/list` | ✅ | Get paginated transactions |
| POST | `/transaction/update` | ✅ | Update a transaction |
| POST | `/transaction/delete` | ✅ | Delete a transaction |
| POST | `/transaction/listByLabel` | ✅ | Get transactions grouped by label |

#### Create Transaction — Request Body
```json
{
  "transactionType": "debit",
  "accountId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "transactionLabelId": "64f1a2b3c4d5e6f7a8b9c0d2",
  "amount": 50,
  "remarks": "Lunch"
}
```

#### Transaction Types
| Type | Value |
|------|-------|
| Money in | `credit` |
| Money out | `debit` |

#### List Transactions — Request Body

```json
{
  "dateFrom": "2024-01-01",
  "dateTo": "2024-01-31",
  "pagination": {
    "page": 1,
    "size": 10,
    "sort": { "createdAt": -1 }
  }
}
```

Every field is optional. `dateFrom` / `dateTo` default to **the last 30 days**; send an
explicit early `dateFrom` to reach further back. `pagination` defaults to
`page: 1, size: 10, sort: { createdAt: -1 }`. So `{}` is a valid body.

`page` is capped at 10000 and `size` at 100. `sort` accepts only `createdAt` and `updatedAt` (the indexed fields). An empty `sort` object falls back to the default rather
than to natural order, which is not a stable paging order.

Applies to `/transaction/list`, `/transaction/listByLabel`, and `/dashboard/getData`.

> `/account/list` and `/transactionLabel/list` take **only** `pagination` — they do
> not filter by date, and now reject `dateFrom` / `dateTo` with `validation_error`
> rather than silently ignoring them.

##### Date semantics

**All dates are interpreted in UTC.** The server pins its own timezone to UTC, so a
string without an offset (`"2024-01-01T00:00:00"`) means UTC no matter where the
service is deployed.

The range is inclusive at both ends, and a bare `YYYY-MM-DD` covers the whole day:

| You send | Range actually used |
|---|---|
| `dateFrom: "2024-01-31"` | from `2024-01-31T00:00:00.000Z` |
| `dateTo: "2024-01-31"` | through `2024-01-31T23:59:59.999Z` (the full day) |
| `dateTo: "2024-01-31T12:00:00Z"` | through exactly `12:00:00.000Z` — an explicit time is never widened |
| `dateTo: "2024-01-31T12:00:00+08:00"` | through `2024-01-31T04:00:00.000Z` — explicit offsets are honoured |
| `dateTo: 1706700000000` | epoch milliseconds, used as-is |

So `{ "dateFrom": "2024-01-01", "dateTo": "2024-01-31" }` returns all of January,
including every transaction on the 31st.

> **If your users are not on UTC, send explicit timestamps.** A bare date is split on
> UTC day boundaries, so for a UTC+8 user `"2024-01-01"` covers 08:00 on Jan 1 through
> 08:00 on Jan 2 in their local time. To select their local day, convert on the client
> and send a full ISO string with an offset (or `Z`) — e.g. `dateFrom:
> "2024-01-01T00:00:00+08:00"`, `dateTo: "2024-01-01T23:59:59.999+08:00"`.

---

### Dashboard — `/dashboard`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/dashboard/getData` | ✅ | Get transaction summary |

Request body same as list transactions above.

---

## Response Format

### Success
```json
{
  "data": [...],
  "currentPage": 1,
  "totalCount": 50,
  "totalPage": 5
}
```

### Error
```json
{
  "success": false,
  "message": "balance_not_enough_error",
  "details": "..."
}
```

### Common Error Messages
| Message | HTTP Code | Meaning |
|---------|-----------|---------|
| `validation_error` | 422 | Request body failed validation |
| `token_invalid` | 401 | Missing or invalid JWT token |
| `username_or_password_error` | 401 | Wrong credentials |
| `not_found` | 404 | Resource not found |
| `account_exists` | 422 | Duplicate account |
| `label_exists` | 422 | Duplicate label name |
| `label_not_found` | 404 | Label does not exist or belongs to another user |
| `label_name_taken_by_deleted` | 422 | That name belongs to a soft-deleted label — restore it or pick another |
| `balance_not_enough_error` | 422 | Insufficient balance for debit |
| `limit_not_enough_error` | 422 | Credit limit exceeded |
| `credit_amount_over_limit_error` | 422 | Payment exceeds the amount owed |
| `credit_account_limit_error` | 422 | Invalid credit limit (missing, or below the amount already used) |
| `invalid_account_field_error` | 422 | Field not applicable to this account type |
| `account_not_active` | 404 | Account is not active |
| `user_inactive` | 403 | Account is deactivated — returned on login **and on every authenticated request**, so deactivating a user takes effect immediately rather than when their token expires |

---

## Account Business Rules

### Debit Account
- Tracks `balance`
- Debit transactions reduce balance; credit transactions increase it
- Cannot go below zero balance

### Credit Account
- Requires a `limit` on creation
- Tracks `amountUsed` and `availableCredit`
- Debit = spending (increases `amountUsed`)
- Credit = payment/refund (decreases `amountUsed`)
- Cannot exceed the set `limit`

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Development | `npm run dev` | Run with nodemon auto-reload |
| Build | `npm run build` | Compile TypeScript to `dist/` |
| Start | `npm start` | Run compiled production build |

---

## License

ISC

C:\Users\User\.local\bin\claude.exe