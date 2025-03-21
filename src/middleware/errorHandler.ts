// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from "express";
import { CustomError } from "../utility/CustomError";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let statusCode = 500;
  let message = "Internal Server Error";
  const details = err.stack;

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
  });
};
