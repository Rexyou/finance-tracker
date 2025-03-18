// src/index.ts
import express, { type Express, type Request, type Response } from "express";
import dotenv from "dotenv";
import { errorHandler } from "./middleware/errorHandler";
import { errorMessages } from "./variables/errorCodes";
import { CustomError } from "./utility/CustomError";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hello World!" });
});

app.get("*", (req, res, next) => {
  throw new CustomError(errorMessages.NotFound);
});

app.use(errorHandler)

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});