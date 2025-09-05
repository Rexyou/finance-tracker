import type { Request } from "express";
import type { ZodType, ZodTypeDef } from "zod";
import { CustomError } from "./CustomError";
import { ErrorMessages } from "../variables/errorCodes";

export const validateParameter = <
  TOutput,
  TDef extends ZodTypeDef,
  TInput = TOutput
>(
  input: Request,
  schema: ZodType<TOutput, TDef, TInput>
): TOutput => {
  const result = schema.safeParse(input.body);
  if (!result.success) {
    throw new CustomError(
      ErrorMessages.ValidationError,
      JSON.stringify(result.error.format())
    );
  }
  return result.data;
};
