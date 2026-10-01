import type { FastifyPluginAsync } from 'fastify'
import { checkHealth } from '../services/health.service.js'
import type { ApiResponse, HealthStatus } from '../types/index.js'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_request, reply) => {
    const payload: ApiResponse<HealthStatus> = {
      success: true,
      data: checkHealth(),
    }

    return reply.code(200).send(payload)
  })
}