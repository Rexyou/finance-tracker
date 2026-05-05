import type { NextFunction, Request, Response } from "express";
import { HttpCode } from "../variables/errorCodes";
import { DashboardService } from "../services/DashboardService";
import { validateParameter } from "../utility/Validation";
import { DatePaginationSchema } from "../variables/ValidationSchemas";

export const getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filterData = validateParameter(req, DatePaginationSchema)
        const result = await DashboardService.getData(req.userData, filterData)
        res.status(HttpCode.SUCCESS).json(result);
        return
    } catch (error) {
        next(error)
    }
}