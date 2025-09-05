import type { NextFunction, Request, Response } from "express";
import { validateParameter } from "../utility/Validation";
import { CreateTransactionLabelSchema, UpdateTransactionLabelSchema } from "../variables/ValidationSchemas";
import { HttpCode } from "../variables/errorCodes";
import { ObjectId } from "mongodb";
import { TransactionLabelService } from "../services/TransactionLabelService";

export const createTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, CreateTransactionLabelSchema)
        const transactionLabelService = new TransactionLabelService(req.userData)
        const result = await transactionLabelService.createTransactionLabel(filterData)
        res.status(HttpCode.CREATED).json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const transactionLabelService = new TransactionLabelService(req.userData)
        const result = await transactionLabelService.getTransactionLabel(req.body)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const editTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, UpdateTransactionLabelSchema)
        const transactionLabelService = new TransactionLabelService(req.userData)
        const { transactionLabelId, ...filteredData } = filterData
        const result = await transactionLabelService.editTransactionLabel(new ObjectId(transactionLabelId), filteredData)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}