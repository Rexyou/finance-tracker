// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from "express";
import { CustomError } from "../utility/CustomError";
import { HttpCode } from "../variables/errorCodes";

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let statusCode = HttpCode.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  let details = err.stack;

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message;
    if(err.details){
      details = err.details;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
  });
};
