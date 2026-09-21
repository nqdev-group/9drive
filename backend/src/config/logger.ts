import path from 'path'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { env } from './env.js'

const logDir = path.resolve(process.cwd(), env.LOG_DIR)

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

const rotateOptions = {
  dirname: logDir,
  datePattern: 'YYYY-MM-DD',
  maxFiles: '7d',
  zippedArchive: true,
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: fileFormat,
  transports: [
    new DailyRotateFile({
      ...rotateOptions,
      filename: 'app-%DATE%.log',
    }),
    new DailyRotateFile({
      ...rotateOptions,
      filename: 'error-%DATE%.log',
      level: 'error',
    }),
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
})
