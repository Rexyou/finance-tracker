import type { NextFunction, Request, Response } from "express";
import { validateParameter } from "../utility/Validation";
import { AuthService } from "../services/AuthService";
import { isEmpty } from "../utility/GeneralFunctions";
import { CustomError } from "../utility/CustomError";
import { CreateTransactionLabelSchema, UpdateTransactionLabelSchema } from "../variables/ValidationSchemas";
import { ErrorMessages, HttpCode } from "../variables/errorCodes";
import { ObjectId } from "mongodb";
import { TransactionLabelService } from "../services/TransactionLabelService";

export const createTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, CreateTransactionLabelSchema)
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const transactionLabelService = new TransactionLabelService(getProfile)
        const result = await transactionLabelService.createTransactionLabel(filterData)
        res.status(HttpCode.CREATED).json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const transactionLabelService = new TransactionLabelService(getProfile)
        const result = await transactionLabelService.getTransactionLabel()
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const editTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, UpdateTransactionLabelSchema)
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const transactionLabelService = new TransactionLabelService(getProfile)
        const { transactionLabelId, ...filteredData } = filterData
        const result = await transactionLabelService.editTransactionLabel(new ObjectId(transactionLabelId), filteredData)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}