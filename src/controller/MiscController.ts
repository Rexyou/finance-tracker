import type { NextFunction, Request, Response } from "express";
import { HttpCode } from "../variables/errorCodes";
import { validateParameter } from "../utility/Validation";
import { DatePaginationSchema } from "../variables/ValidationSchemas";
import ServiceContainer from "../services/ServiceContainer";

export const getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, DatePaginationSchema)
        const result = await ServiceContainer.transaction.getTransaction(req.userData, filterData)
        res.status(HttpCode.SUCCESS).json({ transactionsList: result });
        return
    } catch (error) {
        next(error)
    }
}