// src/index.ts
import express, { type Express, type Request, type Response } from "express";
import dotenv from "dotenv";
dotenv.config();

import { errorHandler } from "./middleware/errorHandler";
import { ErrorMessages } from "./variables/errorCodes";
import { CustomError } from "./utility/CustomError";
import { DbConnection } from "./config/dbconnection";
import AuthRoute from "./routes/AuthRoutes";
import { RedisClient } from "./config/RedisConnection";
import AccountRoute from "./routes/AccountRoutes";
import TransactionLabelRoute from "./routes/TransactionLabelRoutes";
import TransactionRoute from "./routes/TransactionRoutes";
import cors from 'cors'
import { UserDocument } from "./schemas/users";
import DashboardRoute from "./routes/DashboardRoutes";
import { requestLogger } from "./middleware/Logger";

const app: Express = express();
app.use(cors())
app.use(express.json()); 
app.use(requestLogger)
const port = process.env.PORT || 3000;

const dbInstance = new DbConnection();
async function bootstrap() {
    await dbInstance.connectDB(); // Fail fast if DB is down
    RedisClient();                // Redis is optional, fire and forget is ok
    app.listen(port, () => {
        console.log(`[Server]: Running at http://localhost:${port}`);
    });
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

app.get("/", (req: Request, res: Response) => {
  res.json({ timestamps: new Date().toISOString() });
});

app.use('/auth', AuthRoute)
app.use('/account', AccountRoute)
app.use('/transactionLabel', TransactionLabelRoute)
app.use('/transaction', TransactionRoute)
app.use('/dashboard', DashboardRoute)

app.get("*", (req, res, next) => {
  next(new CustomError(ErrorMessages.NotFound));
});

app.use(errorHandler)