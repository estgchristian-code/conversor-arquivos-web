import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { config } from './config/index.js'
import { API_PREFIX, registerRoutes } from './routes/index.js'
import { ensureStorageDirs, getStoragePaths } from './services/storage.service.js'
import { logger } from './utils/logger.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger as FastifyBaseLogger,
    bodyLimit: config.upload.maxFileSize,
    disableRequestLogging: config.env === 'test',
  })

  await app.register(cors, {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  })

  await app.register(multipart, {
    limits: {
      fileSize: config.upload.maxFileSize,
      files: config.upload.maxFiles,
    },
  })

  const storagePaths = getStoragePaths()

  await app.register(fastifyStatic, {
    root: storagePaths.uploadDir,
    prefix: '/storage/uploads/',
    index: false,
    decorateReply: false,
  })

  await app.register(fastifyStatic, {
    root: storagePaths.outputDir,
    prefix: '/storage/outputs/',
    index: false,
    decorateReply: false,
  })

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode ?? 500

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled request error')
    }

    return reply.code(statusCode).send({
      success: false,
      data: null,
      message: error.message || 'Erro interno do servidor',
    })
  })

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      success: false,
      data: null,
      message: `Rota nao encontrada: ${request.method} ${request.url}`,
    })
  })

  await registerRoutes(app)

  return app
}

export async function start(): Promise<FastifyInstance> {
  const app = await buildApp()

  try {
    await ensureStorageDirs()
  } catch (error) {
    app.log.warn({ err: error }, 'Nao foi possivel preparar os diretorios de storage')
  }

  await app.listen({ port: config.port, host: config.host })
  app.log.info(`API disponível em ${API_PREFIX} (${config.env})`)

  const shutdown = async (signal: string) => {
    app.log.info(`Recebido ${signal}, encerrando...`)
    await app.close()
    process.exit(0)
  }

  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  return app
}

const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectExecution) {
  start().catch((error) => {
    logger.error({ err: error }, 'Falha ao iniciar a API')
    process.exit(1)
  })
}