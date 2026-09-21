import type { NextFunction, Request, Response } from 'express'
import { logger } from '../config/logger.js'

export function errorMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const message = error instanceof Error ? error.message : 'Internal server error'
  logger.error(`${req.method} ${req.originalUrl} failed: ${message}`, {
    stack: error instanceof Error ? error.stack : undefined,
  })
  return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message })
}
