import type { NextFunction, Request, Response } from "express";
import { validateParameter } from "../utility/Validation";
import { CreateAccountSchema, UpdateAccountSchema } from "../variables/ValidationSchemas";
import { HttpCode } from "../variables/errorCodes";
import { ObjectId } from "mongodb";
import ServiceContainer from "../services/ServiceContainer";

export const createAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, CreateAccountSchema)
        const result = await ServiceContainer.account.createAccount(req.userData, filterData)
        res.status(HttpCode.CREATED).json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getAccountList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ServiceContainer.account.getAccountList(req.userData, req.body)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const editAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, UpdateAccountSchema)
        const { accountId, ...filteredData } = filterData
        const result = await ServiceContainer.account.editAccount(req.userData, new ObjectId(accountId), filteredData)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}