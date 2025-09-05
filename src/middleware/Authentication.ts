import type { NextFunction, Request, Response } from "express";
import { CustomError } from "../utility/CustomError";
import { ErrorMessages } from "../variables/errorCodes";
import { isEmpty, verifyToken } from "../utility/GeneralFunctions";
import { ObjectId } from "mongodb";
import { AuthService } from "../services/AuthService";

export async function Authenticate(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        throw new CustomError(ErrorMessages.TokenInvalidError);
    }

    try {
        const decodedData = verifyToken(token)
        if(!token || !decodedData.userId){
            throw new CustomError(ErrorMessages.TokenInvalidError);
        }

        if(isEmpty(decodedData.userId)){
            throw new CustomError(ErrorMessages.TokenInvalidError);
        }

        const getProfile = await AuthService.getProfile(new ObjectId(decodedData.userId))
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        req.userData = getProfile

        next();
    } catch (error) {
        console.log("token invalid error: ", error)
        throw new CustomError(ErrorMessages.TokenInvalidError);
    }
}