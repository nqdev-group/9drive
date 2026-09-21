import type { NextFunction, Request, Response } from 'express'
import { logger } from '../config/logger.js'

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now()

  res.on('finish', () => {
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      ip: req.ip,
    })
  })

  next()
}
