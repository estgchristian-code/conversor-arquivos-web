import type { FastifyPluginAsync } from 'fastify'
import { processUpload } from '../services/upload.service.js'
import { config } from '../config/index.js'
import { createChildLogger } from '../utils/logger.js'
import type { ApiResponse, UploadResponse } from '../types/index.js'

const uploadRoutesLogger = createChildLogger({ module: 'routes.upload' })

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post('/upload', async (request, reply) => {
    if (!request.isMultipart()) {
      const payload: ApiResponse<null> = {
        success: false,
        data: null,
        message: 'Envie o arquivo no formato multipart/form-data no campo "files".',
      }
      return reply.code(415).send(payload)
    }

    const result = await processUpload(request.parts())

    uploadRoutesLogger.info(
      { uploadId: result.uploadId, accepted: result.files.length, rejected: result.rejected.length },
      'Upload concluido',
    )

    const payload: ApiResponse<UploadResponse> = {
      success: true,
      data: result,
      message: result.rejected.length
        ? 'Arquivo enviado, mas parte do envio foi rejeitada.'
        : 'Arquivo enviado com sucesso.',
    }

    return reply.code(201).send(payload)
  })

  uploadRoutesLogger.debug(
    { maxFiles: config.upload.maxFiles, maxFileSize: config.upload.maxFileSize },
    'Rotas de upload registradas',
  )
}