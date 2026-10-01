import type { FastifyPluginAsync } from 'fastify'
import { notImplementedHandler } from './utils.js'

export const formatsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/formats', notImplementedHandler('formats.list'))
}