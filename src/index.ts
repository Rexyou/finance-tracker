// src/index.ts
import express, { type Express, type Request, type Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Hello World!" });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});