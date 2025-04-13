// src/index.ts
import express, { type Express, type Request, type Response } from "express";
import dotenv from "dotenv";
dotenv.config();

import { errorHandler } from "./middleware/errorHandler";
import { ErrorMessages } from "./variables/errorCodes";
import { CustomError } from "./utility/CustomError";
import { DbConnection } from "./config/dbconnection";
import AuthRoute from "./routes/AuthRoutes";
import type{ ObjectId } from "mongodb";

const app: Express = express();
app.use(express.json()); 
const port = process.env.PORT || 3000;

const dbInstance = new DbConnection();
dbInstance.connectDB();

declare module "express-serve-static-core" {
  interface Request {
    userId: ObjectId;
  }
}

app.get("/", (req: Request, res: Response) => {
  res.json({ timestamps: new Date().toISOString() });
});

app.use('/auth', AuthRoute)

app.get("*", (req, res, next) => {
  throw new CustomError(ErrorMessages.NotFound);
});

app.use(errorHandler)

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

