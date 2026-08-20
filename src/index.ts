// src/index.ts
import express, { type Express, type Request, type Response } from "express";
import dotenv from "dotenv";
dotenv.config();

// Must stay the first project import: it pins process.env.TZ, which has to be
// set before any module parses or formats a date.
import "./config/env";

import { errorHandler } from "./middleware/errorHandler";
import { ErrorMessages } from "./variables/errorCodes";
import { CustomError } from "./utility/CustomError";
import { DbConnection } from "./config/dbconnection";
import AuthRoute from "./routes/AuthRoutes";
import { RedisClient } from "./config/RedisConnection";
import AccountRoute from "./routes/AccountRoutes";
import TransactionLabelRoute from "./routes/TransactionLabelRoutes";
import TransactionRoute from "./routes/TransactionRoutes";
import mongoose from "mongoose";
import cors from 'cors'
import { UserDocument } from "./schemas/users";
import DashboardRoute from "./routes/DashboardRoutes";
import { requestLogger } from "./middleware/Logger";

const app: Express = express();
app.use(cors())
app.use(express.json()); 
app.use(requestLogger)
const port = process.env.PORT || 3000;

// Constructed inside bootstrap so its "DB_URL missing" throw lands in the catch
// below instead of escaping during module evaluation.
async function bootstrap() {
    const dbInstance = new DbConnection();
    await dbInstance.connectDB(); // Fail fast if DB is down
    RedisClient();                // Redis is optional, fire and forget is ok

    const server = app.listen(port, () => {
        console.log(`[Server]: Running at http://localhost:${port}`);
    });

    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.once(signal, () => {
            console.log(`[Server]: ${signal} received, shutting down`);
            server.close(async () => {
                await mongoose.connection.close();
                process.exit(0);
            });
        });
    }
}

bootstrap().catch((err) => {
    console.error('[Server]: Failed to start:', err);
    process.exit(1);
});

declare module "express-serve-static-core" {
  interface Request {
    userData: UserDocument;
  }
}

app.get("/", (_req: Request, res: Response) => {
  res.json({ timestamps: new Date().toISOString() });
});

app.use('/auth', AuthRoute)
app.use('/account', AccountRoute)
app.use('/transactionLabel', TransactionLabelRoute)
app.use('/transaction', TransactionRoute)
app.use('/dashboard', DashboardRoute)

// app.use, not app.get: every route here is POST, so a GET-only catch-all left
// unknown POST/PUT/DELETE paths falling through to Express's HTML 404 instead of
// the JSON shape every other error uses.
app.use((req, res, next) => {
  next(new CustomError(ErrorMessages.NotFound));
});

app.use(errorHandler)