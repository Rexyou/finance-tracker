import type { Request } from "express";
import type { ZodObject, ZodRawShape } from "zod";
import { CustomError } from "./CustomError";
import { ErrorMessages } from "../variables/errorCodes";

export const validateParameter = <T extends ZodRawShape>(input: Request, schema: ZodObject<T>) => {
    const result = schema.safeParse(input.body);
    if (!result.success) {
      throw new CustomError(ErrorMessages.ValidationError, JSON.stringify(result.error.format())); // or return an error response
    }
    return result.data; // typed as T
}