import { config } from '../config/index.js'
import type { HealthStatus } from '../types/index.js'

export function checkHealth(): HealthStatus {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 1000) / 1000,
    environment: config.env,
  }
}