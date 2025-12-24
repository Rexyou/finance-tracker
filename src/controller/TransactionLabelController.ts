import type { NextFunction, Request, Response } from "express";
import { validateParameter } from "../utility/Validation";
import { CreateTransactionLabelSchema, UpdateTransactionLabelSchema } from "../variables/ValidationSchemas";
import { HttpCode } from "../variables/errorCodes";
import { ObjectId } from "mongodb";
import ServiceContainer from "../services/ServiceContainer";

export const createTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, CreateTransactionLabelSchema)
        const result = await ServiceContainer.label.createTransactionLabel(req.userData, filterData)
        res.status(HttpCode.CREATED).json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const getTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await ServiceContainer.label.getTransactionLabel(req.userData, req.body)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}

export const editTransactionLabel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, UpdateTransactionLabelSchema)
        const { transactionLabelId, ...filteredData } = filterData
        const result = await ServiceContainer.label.editTransactionLabel(req.userData, new ObjectId(transactionLabelId), filteredData)
        res.json(result);
        return
    } catch (error) {
        next(error)
    }
}