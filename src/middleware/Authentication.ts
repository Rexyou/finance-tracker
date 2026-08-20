import type { NextFunction, Request, Response } from "express";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty, verifyToken } from "../utility/GeneralFunctions";
import { ObjectId } from "mongodb";
import { AuthService } from "../services/AuthService";
import { UserStatus } from "../variables/Enums";

export const Authenticate = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return next(new CustomError(ErrorMessages.TokenInvalidError));
    }

    let profile;
    try {
        const decodedData = verifyToken(token)
        if(!decodedData.userId || isEmpty(decodedData.userId)){
            return next(new CustomError(ErrorMessages.TokenInvalidError));
        }

        profile = await AuthService.getProfile(new ObjectId(decodedData.userId))
        if(isEmpty(profile)){
            return next(new CustomError(ErrorMessages.NotFound))
        }

        // Login checks this too, but a token outlives a ban: JWTs are 7-day with no
        // revocation path. This narrows the window from the token's lifetime to the
        // profile cache TTL (15 min, see AuthService.getProfile) — NOT to zero.
        // Making deactivation immediate needs the cache key cleared wherever status
        // changes, and no endpoint currently changes it.
        if(profile.status !== UserStatus.Active){
            return next(new CustomError(ErrorMessages.UserInactiveError))
        }
    } catch (error) {
        console.log("token invalid error: ", error)
        return next(error instanceof CustomError ? error : new CustomError(ErrorMessages.TokenInvalidError));
    }

    req.userData = profile

    // Deliberately outside the try: next() runs the rest of the chain synchronously,
    // so a downstream throw caught here would be rewritten as token_invalid and the
    // real error lost.
    next();
};
