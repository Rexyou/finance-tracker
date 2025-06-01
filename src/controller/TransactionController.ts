import type { NextFunction, Request, Response } from "express";
import { validateParameter } from "../utility/Validation";
import { AuthService } from "../services/AuthService";
import { isEmpty } from "../utility/GeneralFunctions";
import { CustomError } from "../utility/CustomError";
import { CreateTransactionSchema, UpdateTransactionSchema } from "../variables/ValidationSchemas";
import { ErrorMessages, HttpCode } from "../variables/errorCodes";
import { ObjectId } from "mongodb";
import { TransactionService } from "../services/TransactionService";

export const createTransaction= async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, CreateTransactionSchema)
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        // Convert string IDs to ObjectId
        const payload = {
            ...filterData,
            accountId: new ObjectId(filterData.accountId),
            transactionLabelId: new ObjectId(filterData.transactionLabelId),
        };

        const transactionService = new TransactionService(getProfile)
        const result = await transactionService.createTransaction(payload)
        res.status(HttpCode.CREATED).json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const transactionService = new TransactionService(getProfile)
        const result = await transactionService.getTransaction()
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const editTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, UpdateTransactionSchema)
        const getProfile = await AuthService.getProfile(req.userId)
        if(isEmpty(getProfile)){
            throw new CustomError(ErrorMessages.NotFound)
        }

        const transactionService = new TransactionService(getProfile)
        const { transactionId, ...filteredData } = filterData

        // Convert string IDs to ObjectId if present
        const updatedPayload = {
            ...filteredData,
            accountId: filteredData.accountId ? new ObjectId(filteredData.accountId) : undefined,
            transactionLabelId: filteredData.transactionLabelId ? new ObjectId(filteredData.transactionLabelId) : undefined,
        };

        const result = await transactionService.editTransaction(new ObjectId(transactionId), updatedPayload)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}