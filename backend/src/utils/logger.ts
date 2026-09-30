import pino from 'pino'
import { config } from './config'

export const logger = pino({
  level: config.logLevel,
  transport: config.env === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    service: 'file-converter-api',
  },
})

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}