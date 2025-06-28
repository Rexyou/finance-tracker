import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { validateParameter } from '../utility/Validation';
import { LoginSchema, RegisterSchema } from '../variables/ValidationSchemas';

export async function register (req: Request, res: Response, next: NextFunction) {
    try {
        const filterData = validateParameter(req, RegisterSchema)
        const userData = await AuthService.register(filterData)
        res.status(201).json(userData);
        return
    } catch (error) {
        next(error)
    }
};

export async function login (req: Request, res: Response, next: NextFunction) {
    try {
        const filterData = validateParameter(req, LoginSchema)
        const userData = await AuthService.login(filterData)
        res.status(201).json(userData);
        return
    } catch (error) {
        next(error)
    }
};

export async function getProfile (req: Request, res: Response, next: NextFunction) {
    try {
        const userProfile = await AuthService.getProfile(req.userId)
        res.json(userProfile)
        return  
    } catch (error) {
        next(error)
    }
}
