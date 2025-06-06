import type { NextFunction, Request, Response } from "express";
import { validateParameter } from "../utility/Validation";
import { AccountService } from "../services/AccountService";
import { AuthService } from "../services/AuthService";
import { isEmpty } from "../utility/GeneralFunctions";
import { CustomError } from "../utility/CustomError";
import { CreateAccountSchema, UpdateAccountSchema } from "../variables/ValidationSchemas";
import { ErrorMessages, HttpCode } from "../variables/errorCodes";
import { ObjectId } from "mongodb";

export const createAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, CreateAccountSchema)
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const accountService = new AccountService(getProfile)
        const result = await accountService.createAccount(filterData)
        res.status(HttpCode.CREATED).json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getAccountList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const accountService = new AccountService(getProfile)
        const result = await accountService.getAccountList()
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const editAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, UpdateAccountSchema)
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const accountService = new AccountService(getProfile)
        const { accountId, ...filteredData } = filterData
        const result = await accountService.editAccount(new ObjectId(accountId), filteredData)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}