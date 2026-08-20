// src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from "express";
import { CustomError } from "../utility/CustomError";
import { HttpCode } from "../variables/errorCodes";
import { isProduction } from "../config/env";

const TAGGED_MESSAGES: Record<number, string> = {
  400: "malformed_request",
  413: "payload_too_large",
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let statusCode = HttpCode.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  // CustomError's constructor defaults details to "", which is falsy — the old
  // `if (err.details)` check therefore never fired and every error response
  // shipped a full stack trace to the client.
  let details: string | undefined = isProduction ? undefined : err.stack;

  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  // body-parser tags its own failures (malformed JSON -> 400, oversized body ->
  // 413). Without this every one of them reported as a server error. Map them to
  // stable keys rather than forwarding err.message: every other response here
  // carries a snake_case key, and body-parser embeds a fragment of the submitted
  // body in its message.
  const tagged = (err as { status?: number; statusCode?: number }).status
      ?? (err as { statusCode?: number }).statusCode;
  if (typeof tagged === "number" && tagged >= 400 && tagged < 500) {
    statusCode = tagged;
    message = TAGGED_MESSAGES[tagged] ?? "bad_request";
  }

  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message;
    if (err.details) {
      details = err.details;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
  });
};
