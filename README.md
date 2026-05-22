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
- MongoDB instance (local or cloud)
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
  "phoneNumber": 60123456789
}
```

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
| Type | Value |
|------|-------|
| Debit Account | `debitAccount` |
| Credit Account | `creditAccount` |
| Fixed Deposit | `fixedDeposit` |
| Cash | `cash` |

#### Create Debit Account — Request Body
```json
{
  "type": "debitAccount",
  "accountNumber": 1234567890,
  "label": "My Savings",
  "balance": 1000
}
```

#### Create Credit Account — Request Body
```json
{
  "type": "creditAccount",
  "accountNumber": 9876543210,
  "label": "My Credit Card",
  "limit": 5000
}
```

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

#### List Transactions — Request Body (shared across list endpoints)
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
| `balance_not_enough_error` | 500 | Insufficient balance for debit |
| `limit_not_enough_error` | 500 | Credit limit exceeded |
| `user_inactive` | 403 | Account is deactivated |

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