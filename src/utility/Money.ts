import mongoose from "mongoose";
import { CustomError } from "./CustomError";
import { ErrorMessages } from "../variables/errorCodes";

/**
 * The BSON value type, i.e. what a Decimal128 field actually holds at runtime.
 * Note `Decimal128` imported from "mongoose" is the SchemaType, not this.
 */
export type MoneyValue = mongoose.Types.Decimal128;

/**
 * Single conversion point for every monetary value.
 *
 * Two reasons this must be used everywhere instead of inline conversions:
 *
 * 1. Mongoose applies custom setters asymmetrically. `$inc` values go through
 *    `applySetters` (so they get rounded), but comparison operators like `$gte`
 *    take the `$conditional` branch of `castForQuery` and skip setters entirely.
 *    A float artifact such as -0.30000000000000004 would therefore be rounded on
 *    the `$inc` side but not on the guard side, making a balance of exactly 0.30
 *    fail a `{ $gte: 0.30000000000000004 }` guard. Routing both sides through
 *    this helper keeps them consistent regardless of what Mongoose does.
 *
 * 2. Because callers now pass already-converted Decimal128 values into `$inc`,
 *    the schema setters receive Decimal128 rather than number. The passthrough
 *    branch below is what stops `v.toFixed(2)` from throwing on those.
 */
export const toMoney = (v: number | MoneyValue): MoneyValue => {
    if (typeof v !== "number") return v;

    // Decimal128.fromString("NaN") and ("Infinity") both succeed. A non-finite
    // balance fails every subsequent $gte guard, so the account is bricked with no
    // code path back. Validators block these at the boundary; this is the backstop
    // for values produced by arithmetic inside the services.
    if (!Number.isFinite(v)) {
        throw new CustomError(ErrorMessages.UnknownError, `non-finite monetary value: ${v}`);
    }

    return mongoose.Types.Decimal128.fromString(v.toFixed(2));
};
