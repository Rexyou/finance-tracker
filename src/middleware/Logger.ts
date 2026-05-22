// middleware/requestLogger.ts
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    const reqId = randomUUID()

    console.log(`\n→ [${reqId}] [${req.method}] ${req.originalUrl}`)
    console.log(`  IP: ${req.headers['x-forwarded-for'] ?? req.ip}`)

    const safeBody = { ...req.body }
    const sensitiveFields = ['password', 'confirmPassword', 'pin']
    sensitiveFields.forEach(f => { if (safeBody[f]) safeBody[f] = '***' })
    console.log(`  Body: ${JSON.stringify(safeBody)}`)

    res.on('finish', () => {
        const duration = Date.now() - start
        console.log(`← [${reqId}] [${res.statusCode}] ${req.method} ${req.originalUrl} - ${duration}ms`)
    })

    next()
}