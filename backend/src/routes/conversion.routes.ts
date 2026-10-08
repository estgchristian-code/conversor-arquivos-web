import { createReadStream } from 'node:fs'
import type { FastifyPluginAsync } from 'fastify'
import {
  getConversion,
  getConversionOutput,
  getConversions,
  getOutputMimeType,
  startConversion,
} from '../services/conversion.service.js'
import { createChildLogger } from '../utils/logger.js'
import type { ApiResponse, ConversionJobRecord, PaginatedResult, StartConversionRequest } from '../types/index.js'

const conversionLogger = createChildLogger({ module: 'routes.conversion' })

interface JobParams {
  jobId: string
}

interface DownloadParams extends JobParams {
  fileId: string
}

export const conversionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/conversion', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<StartConversionRequest>
    const job = await startConversion(body as StartConversionRequest)

    conversionLogger.info(
      { jobId: job.id, status: job.status, converted: job.results?.length ?? 0 },
      'Job de conversao criado',
    )

    const payload: ApiResponse<ConversionJobRecord> = {
      success: job.status !== 'failed',
      data: job,
      message:
        job.status === 'failed'
          ? `Conversao falhou: ${job.error ?? 'erro nao informado'}`
          : `${job.results?.length ?? 0} arquivo(s) convertido(s) para .${job.outputFormat}.`,
    }

    return reply.code(201).send(payload)
  })

  app.get('/conversion', async (request, reply) => {
    const query = request.query as { page?: string; limit?: string }
    const page = Math.max(1, Math.floor(Number(query.page) || 1))
    const limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit) || 20)))

    const result = await getConversions(page, limit)

    const payload: ApiResponse<PaginatedResult<ConversionJobRecord>> = {
      success: true,
      data: result,
    }

    return reply.send(payload)
  })

  app.get('/conversion/:jobId', async (request, reply) => {
    const { jobId } = request.params as JobParams
    const job = await getConversion(jobId)

    const payload: ApiResponse<ConversionJobRecord> = {
      success: true,
      data: job,
    }

    return reply.send(payload)
  })

  app.get('/conversion/:jobId/download/:fileId', async (request, reply) => {
    const { jobId, fileId } = request.params as DownloadParams
    const { result, absolutePath } = await getConversionOutput(jobId, fileId)

    const asciiName = result.outputName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '')

    return reply
      .type(getOutputMimeType(result.outputName))
      .header(
        'content-disposition',
        `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(result.outputName)}`,
      )
      .send(createReadStream(absolutePath))
  })
}