// middleware/requestLogger.ts
import type { Request, Response, NextFunction } from "express";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()

    console.log(`\n→ [${req.method}] ${req.originalUrl}`)  // originalUrl includes query string
    console.log(`  IP: ${req.headers['x-forwarded-for'] ?? req.ip}`)

    if (req.body && Object.keys(req.body).length > 0) {
        const safeBody = { ...req.body }
        const sensitiveFields = ['password', 'confirmPassword', 'pin']
        sensitiveFields.forEach(f => { if (safeBody[f]) safeBody[f] = '***' })
        console.log(`  Body: ${JSON.stringify(safeBody)}`)
    }

    res.on('finish', () => {
        const duration = Date.now() - start
        console.log(`← [${res.statusCode}] ${req.method} ${req.originalUrl} - ${duration}ms`)
    })

    next()
}