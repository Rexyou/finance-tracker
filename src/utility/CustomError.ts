import { ErrorMessages } from "../variables/errorCodes";

// src/utils/CustomError.ts
export class CustomError extends Error {
    public statusCode: number;
    public details?: string;
  
    constructor(error = ErrorMessages.UnknownError, details?: string) {
      super(error.message);
      this.statusCode = error.code;
      this.details = details ?? "";
      Error.captureStackTrace(this, this.constructor);
    }
}
  