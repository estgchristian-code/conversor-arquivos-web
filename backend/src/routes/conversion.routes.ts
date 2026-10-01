import type { FastifyPluginAsync } from 'fastify'
import { notImplementedHandler } from './utils.js'

export const conversionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/conversion', notImplementedHandler('conversion.create'))
  app.get('/conversion', notImplementedHandler('conversion.list'))
  app.get('/conversion/:jobId', notImplementedHandler('conversion.get'))
  app.delete('/conversion/:jobId', notImplementedHandler('conversion.cancel'))
  app.get('/conversion/:jobId/download/:fileId', notImplementedHandler('conversion.download'))
}