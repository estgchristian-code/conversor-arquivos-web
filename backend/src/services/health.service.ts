import { config } from '../config/index.js'
import { getDocumentEngineStatus } from './document-engine.service.js'
import type { HealthStatus } from '../types/index.js'

export function checkHealth(): HealthStatus {
  const documents = getDocumentEngineStatus()

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime() * 1000) / 1000,
    environment: config.env,
    capabilities: {
      images: true,
      documents: documents.available,
      documentEngine: documents.available ? 'libreoffice' : null,
    },
  }
}
