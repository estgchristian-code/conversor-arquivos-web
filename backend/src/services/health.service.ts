import { config } from '../config/index.js'
import { getGotenbergStatus } from './gotenberg.service.js'
import type { HealthStatus } from '../types/index.js'

export async function checkHealth(): Promise<HealthStatus> {
  const documents = await getGotenbergStatus()

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 1000) / 1000,
    environment: config.env,
    capabilities: {
      images: true,
      documents: documents.available,
      documentEngine: documents.available ? 'gotenberg' : null,
    },
  }
}
