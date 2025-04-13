import type { NextFunction, Request, Response } from "express";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { verifyToken } from "../utility/GeneralFunctions";
import { ObjectId } from "mongodb";

export function Authenticate(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        throw new CustomError(ErrorMessages.TokenInvalidError);
    }

    try {
        const decodedData = verifyToken(token)
        if(!token || !decodedData.userId){
            throw new CustomError(ErrorMessages.TokenInvalidError);
        }

        req.userId = new ObjectId(decodedData.userId)
        if(!req.userId){
            throw new CustomError(ErrorMessages.TokenInvalidError);
        }
        next();
    } catch (error) {
        console.log("token invalid error: ", error)
        throw new CustomError(ErrorMessages.TokenInvalidError);
    }
}