// middleware/requestLogger.ts
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { isProduction } from "../config/env";

const SENSITIVE_FIELDS = ['password', 'confirmPassword', 'pin', 'token']

/**
 * Replaces sensitive values anywhere in the structure. `token` matters as much as
 * `password` here: login and register return a 7-day JWT with no revocation
 * mechanism, so one leaked log line is a week of account access.
 *
 * Depth-capped: JSON.parse handles arbitrarily deep input iteratively, but a
 * recursive walk over it does not — an unauthenticated request with a deeply
 * nested body used to blow the stack here, before the route ever ran.
 */
const MAX_DEPTH = 32

const redact = (value: unknown, depth = 0): unknown => {
    if (depth >= MAX_DEPTH) return '[truncated]'

    if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1))

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, val]) =>
                SENSITIVE_FIELDS.includes(key) && val ? [key, '***'] : [key, redact(val, depth + 1)]
            )
        )
    }

    return value
}

/**
 * Redaction must never be the reason a request fails or a secret escapes: on any
 * failure we drop the payload rather than fall through to the raw value, which is
 * how the previous catch leaked unredacted response bodies.
 */
const safeStringify = (value: unknown): string => {
    try {
        return JSON.stringify(redact(value)) ?? 'undefined'
    } catch {
        return '[unloggable]'
    }
}

const tryParse = (raw: string): unknown => {
    try {
        return JSON.parse(raw)
    } catch {
        return raw
    }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    const reqId = randomUUID()

    console.log(`\n→ [${reqId}] [${req.method}] ${req.originalUrl}`)
    console.log(`  IP: ${req.headers['x-forwarded-for'] ?? req.ip}`)
    console.log(`  Body: ${safeStringify(req.body)}`)

    // Capture response body
    const chunks: Buffer[] = []
    const originalWrite = res.write.bind(res)
    const originalEnd = res.end.bind(res)

    res.write = (chunk: any, ...args: any[]): boolean => {
        if (chunk && typeof chunk !== 'function') chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        return (originalWrite as any)(chunk, ...args)
    }

    res.end = (chunk: any, ...args: any[]): Response => {
        if (chunk && typeof chunk !== 'function') chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        return (originalEnd as any)(chunk, ...args)
    }

    res.on('finish', () => {
        const duration = Date.now() - start
        console.log(`← [${reqId}] [${res.statusCode}] ${req.method} ${req.originalUrl} - ${duration}ms`)

        // In production only failures are worth the log volume — successful
        // responses are the user's own financial data.
        if (isProduction && res.statusCode < 400) return

        const responseBody = Buffer.concat(chunks).toString('utf8')

        console.log(`  Response Body: ${safeStringify(tryParse(responseBody))}`)
    })

    next()
}
