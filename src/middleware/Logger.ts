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

    // Capture response body
    const chunks: Buffer[] = []
    const originalWrite = res.write.bind(res)
    const originalEnd = res.end.bind(res)

    res.write = (chunk: any, ...args: any[]): boolean => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        return (originalWrite as any)(chunk, ...args)
    }

    res.end = (chunk: any, ...args: any[]): Response => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        return (originalEnd as any)(chunk, ...args)
    }

    res.on('finish', () => {
        const duration = Date.now() - start
        const responseBody = Buffer.concat(chunks).toString('utf8')

        let parsedBody: any = responseBody
        try {
            parsedBody = JSON.parse(responseBody)
        } catch {
            // not JSON, log as plain string
        }

        console.log(`← [${reqId}] [${res.statusCode}] ${req.method} ${req.originalUrl} - ${duration}ms`)
        console.log(`  Response Body: ${JSON.stringify(parsedBody)}`)
    })

    next()
}