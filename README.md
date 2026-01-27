# Finance Tracker API

A robust RESTful API built with TypeScript and Express for managing personal finances. This application provides comprehensive endpoints for tracking accounts, transactions, labels, and financial dashboards with secure authentication and caching capabilities.

## Features

- **User Authentication**: Secure JWT-based authentication with bcrypt password hashing
- **Account Management**: Create and manage multiple financial accounts
- **Transaction Tracking**: Record and categorize financial transactions
- **Transaction Labels**: Organize transactions with custom labels
- **Dashboard Analytics**: Get insights into your financial data
- **Redis Caching**: Fast data access with Redis integration
- **MongoDB Database**: Scalable NoSQL database with Mongoose ODM

## Tech Stack

### Core Technologies
- **TypeScript** - Type-safe JavaScript
- **Express.js** - Fast, minimalist web framework
- **MongoDB** - NoSQL database with Mongoose ODM
- **Redis** - In-memory data structure store for caching

### Key Packages
- **Authentication & Security**
  - `jsonwebtoken` - JWT token generation and verification
  - `bcryptjs` - Password hashing and encryption
  - `cors` - Cross-Origin Resource Sharing support

- **Database & Validation**
  - `mongoose` - MongoDB object modeling
  - `mongoose-lean-getters` - Virtual getters for lean queries
  - `zod` - TypeScript-first schema validation

- **Development Tools**
  - `nodemon` - Auto-restart during development
  - `ts-node` - TypeScript execution for Node.js
  - `concurrently` - Run multiple commands concurrently

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB instance
- Redis server

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Create a .env file in the root directory with:
# - PORT
# - MONGODB_URI
# - REDIS_URL
# - JWT_SECRET

# Build the project
npm run build

# Start the server
npm start
```

### Development

```bash
# Run in development mode with auto-reload
npm run dev
```

## Project Structure

```
src/
├── config/          # Database and Redis connection configurations
├── controller/      # Request handlers and business logic
├── middleware/      # Authentication and error handling middleware
├── routes/          # API route definitions
├── schemas/         # Mongoose schemas and models
├── services/        # Business logic and data access layer
├── utility/         # Helper functions and custom utilities
└── variables/       # Enums, types, and validation schemas
```

## API Endpoints

- `/auth` - Authentication (login, register)
- `/account` - Account management
- `/transaction` - Transaction operations
- `/transactionLabel` - Label management
- `/dashboard` - Financial analytics and dashboards

## License

ISC
