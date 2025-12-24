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

    if (typeof payload === 'object' && !(payload instanceof Date)) {
        return Object.keys(payload).length === 0;
    }

    if (Array.isArray(payload)) {
        return payload.length === 0;
    }

    return false;
}

export const generateToken = (userId: ObjectId) => {
    if (!process.env.TOKEN_SECRET) {
        throw new CustomError(ErrorMessages.UnknownError);
    }

    return jwt.sign({ userId }, process.env.TOKEN_SECRET)
}

export const verifyToken = (token: string) => {
    if (!process.env.TOKEN_SECRET) {
        throw new CustomError(ErrorMessages.UnknownError);
    }

    return jwt.verify(token, process.env.TOKEN_SECRET) as { userId: string };
}

export const getOrSetCache = async <T> (key: string, ttl: number, dbQuery: () => Promise<T | null>) => {
    const getCachedData = await getCacheData(key);
    if(isEmpty(getCachedData)){
        return setCacheData(key, ttl, dbQuery)
    }

    return getCachedData
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