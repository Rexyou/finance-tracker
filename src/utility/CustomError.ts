import { ErrorMessage, ErrorMessages } from "../variables/errorCodes";

export class CustomError extends Error {
    public statusCode: number;
    public details?: string;
  
    constructor(error: ErrorMessage = ErrorMessages.UnknownError, details?: string) {
        super(error.message);
        this.statusCode = error.code;
        this.details = details ?? "";
        Error.captureStackTrace(this, this.constructor);
    }
}
