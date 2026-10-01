import type { FastifyInstance } from 'fastify'
import { conversionRoutes } from './conversion.routes.js'
import { formatsRoutes } from './formats.routes.js'
import { healthRoutes } from './health.routes.js'
import { uploadRoutes } from './upload.routes.js'

export const API_PREFIX = '/api'

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes, { prefix: API_PREFIX })
  await app.register(uploadRoutes, { prefix: API_PREFIX })
  await app.register(conversionRoutes, { prefix: API_PREFIX })
  await app.register(formatsRoutes, { prefix: API_PREFIX })
}