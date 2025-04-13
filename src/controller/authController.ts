import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { validateParameter } from '../utility/Validation';
import { LoginSchema, RegisterSchema } from '../variables/ValidationSchemas';

export async function register (req: Request, res: Response, next: NextFunction) {
    try {
        const filterData = validateParameter(req, RegisterSchema)
        await AuthService.register(filterData)
        res.status(201).json({ message: "User registered successfully" });
        return
    } catch (error) {
        next(error)
    }
};

export async function login (req: Request, res: Response, next: NextFunction) {
    try {
        const filterData = validateParameter(req, LoginSchema)
        const token = await AuthService.login(filterData)
        res.status(201).json({ token });
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