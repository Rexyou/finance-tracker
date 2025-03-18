import { errorMessages } from "../variables/errorCodes";

// src/utils/CustomError.ts
export class CustomError extends Error {
    public statusCode: number;
    public details?: string;
  
    constructor(error = errorMessages.UnknownError, details?: string) {
      super(error.message);
      this.statusCode = error.code;
      this.details = details ?? "";
      Error.captureStackTrace(this, this.constructor);
    }
}
  