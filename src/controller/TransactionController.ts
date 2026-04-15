import type { NextFunction, Request, Response } from "express";
import { validateParameter } from "../utility/Validation";
import { CreateTransactionSchema, DeleteTransactionSchema, DatePaginationSchema, UpdateTransactionSchema } from "../variables/ValidationSchemas";
import { HttpCode } from "../variables/errorCodes";
import { ObjectId } from "mongodb";
import ServiceContainer from "../services/ServiceContainer";

export const createTransaction= async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, CreateTransactionSchema)
        // Convert string IDs to ObjectId
        const payload = {
            ...filterData,
            accountId: new ObjectId(filterData.accountId),
            transactionLabelId: new ObjectId(filterData.transactionLabelId),
        };

        const result = await ServiceContainer.transaction.createTransaction(req.userData, payload)
        res.status(HttpCode.CREATED).json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, DatePaginationSchema)

        const result = await ServiceContainer.transaction.getTransaction(req.userData, filterData)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const editTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, UpdateTransactionSchema)
        const { transactionId, ...filteredData } = filterData

        // Convert string IDs to ObjectId if present
        const updatedPayload = {
            ...filteredData,
            accountId: filteredData.accountId ? new ObjectId(filteredData.accountId) : undefined,
            transactionLabelId: filteredData.transactionLabelId ? new ObjectId(filteredData.transactionLabelId) : undefined,
        };

        const result = await ServiceContainer.transaction.editTransaction(req.userData, new ObjectId(transactionId), updatedPayload)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const deleteTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { transactionId } = validateParameter(req, DeleteTransactionSchema)

        const result = await ServiceContainer.transaction.deleteTransaction(req.userData, new ObjectId(transactionId))
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getTransactionsByLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, DatePaginationSchema)

        const result = await ServiceContainer.transaction.getTransactionsByTransactionLabel(req.userData, filterData)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}