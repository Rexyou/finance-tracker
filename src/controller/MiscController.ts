import type { NextFunction, Request, Response } from "express";
import { HttpCode } from "../variables/errorCodes";
import { DashboardService } from "../services/DashboardService";

export const getDashboardData = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await DashboardService.getData(req.userData, req.body)
        res.status(HttpCode.SUCCESS).json(result);
        return
    } catch (error) {
        next(error)
    }
}