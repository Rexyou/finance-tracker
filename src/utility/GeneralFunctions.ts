import type { ObjectId } from "mongodb";
import type { NonEmpty } from "../variables/types";
import jwt from "jsonwebtoken";
import { CustomError } from "./CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { clientInstance } from "../config/RedisConnection";

export function isEmpty<PayloadType>(payload: PayloadType): payload is Exclude<PayloadType, NonEmpty<PayloadType>> {
    if (payload === undefined || payload === null) {
        return true;
    }

    if ((typeof payload === 'string' || typeof payload === 'number') && !payload) {
        return true;
    }

    if (Array.isArray(payload)) {
        return payload.length === 0;
    }

    if (typeof payload === 'object' && !(payload instanceof Date)) {
        return Object.keys(payload).length === 0;
    }

    return false;
}

export const generateToken = (userId: ObjectId) => {
    if (!process.env.TOKEN_SECRET) {
        throw new CustomError(ErrorMessages.UnknownError);
    }

    return jwt.sign({ userId }, process.env.TOKEN_SECRET, { expiresIn: '7d' });
}

export const verifyToken = (token: string) => {
    if (!process.env.TOKEN_SECRET) {
        throw new CustomError(ErrorMessages.UnknownError);
    }

    return jwt.verify(token, process.env.TOKEN_SECRET) as { userId: string };
}

export const getOrSetCache = async <T> (key: string, ttl: number, dbQuery: () => Promise<T | null>) => {
    try {
        const getCachedData = await getCacheData(key);
        if (!isEmpty(getCachedData)) return getCachedData;
        return setCacheData(key, ttl, dbQuery);
    } catch (err) {
        console.error('[Cache]: getOrSetCache failed, falling back to DB:', err)
        return dbQuery() // ← Graceful fallback
    }
}

export const getCacheData = async <T> (key: string) => {
    if(clientInstance){
        const cachedData = await clientInstance.get(key);
        if (!isEmpty(cachedData)) {
            return JSON.parse(cachedData) as T;
          }
    }

    return null
}

export const setCacheData = async <T> (key: string, ttl: number, dbQuery: () => Promise<T | null>) => {
    const data = await dbQuery();
    if (!data) {
        return null;
    }

    if (clientInstance) {
        await clientInstance.set(key, JSON.stringify(data), { EX: ttl });
    }

    return data;
}

/**
 * Date-range helpers. Kept here rather than in ValidationSchemas so report,
 * export, or dashboard code can share the same window without restating it.
 * Everything below assumes the process is pinned to UTC (see config/env.ts).
 */
export const DEFAULT_DATE_RANGE_DAYS = 30;
const DAY_MS = 86_400_000;

/** A bare calendar date: no time, no offset. */
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Widen a bare calendar date to the last instant of that day in UTC, so an
 * inclusive range end ($lte) covers the whole day instead of just its midnight.
 * Anything else — a full timestamp, epoch millis, a Date — passes through.
 *
 * This must run BEFORE date coercion: new Date("2024-01-31") and
 * new Date("2024-01-31T00:00:00Z") produce identical objects, so once coerced
 * there is no way to tell that the client only supplied a date.
 */
export const toEndOfDayUtc = (value: unknown): unknown =>
    typeof value === "string" && DATE_ONLY_PATTERN.test(value)
        ? `${value}T23:59:59.999Z`
        : value;

/**
 * Fill in a date range: `dateTo` defaults to now, `dateFrom` to
 * DEFAULT_DATE_RANGE_DAYS before it. Bounding the window is what keeps
 * countDocuments off a full scan and makes the { userId, createdAt } index pay.
 */
export const resolveDateRange = (
    dateFrom?: Date,
    dateTo?: Date
): { dateFrom: Date; dateTo: Date } => {
    const to = dateTo ?? new Date();
    const from = dateFrom ?? new Date(to.getTime() - DEFAULT_DATE_RANGE_DAYS * DAY_MS);
    return { dateFrom: from, dateTo: to };
};

/**
 * Mongo duplicate-key error. Every uniqueness rule here is a check-then-write, so
 * a concurrent request can still reach the unique index; without this the loser
 * of the race gets a 500 instead of the intended *_exists 422.
 */
export const isDuplicateKey = (err: unknown): boolean =>
    (err as { code?: number } | null)?.code === 11000;
