import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ApiResponse } from '../types/index.js'

export const NOT_IMPLEMENTED_MESSAGE =
  'Endpoint reservado. A implementacao deste modulo ainda nao foi realizada.'

export function notImplemented(reply: FastifyReply, feature: string, extra?: Record<string, unknown>) {
  const payload: ApiResponse<Record<string, unknown>> = {
    success: false,
    data: { feature, ...extra },
    message: NOT_IMPLEMENTED_MESSAGE,
  }

  return reply.code(501).send(payload)
}

export function notImplementedHandler(feature: string, extra?: Record<string, unknown>) {
  return async (_request: FastifyRequest, reply: FastifyReply) => notImplemented(reply, feature, extra)
}