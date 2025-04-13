import type { ObjectId } from "mongodb";
import type { NonEmpty } from "../variables/types";
import jwt from "jsonwebtoken";
import { CustomError } from "./CustomError";
import { ErrorMessages } from "../variables/errorCodes";

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