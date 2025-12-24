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

const app: Express = express();
app.use(cors())
app.use(express.json()); 
const port = process.env.PORT || 3000;

const dbInstance = new DbConnection();
dbInstance.connectDB();

RedisClient()

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
  throw new CustomError(ErrorMessages.NotFound);
});

app.use(errorHandler)

app.listen(port, () => {
  console.log(`[Server]: Running at http://localhost:${port}`);
});

