import { Queue, Worker, QueueEvents } from 'bullmq'
import { config } from '../config'
import { logger, createChildLogger } from '../utils/logger'

const queueLogger = createChildLogger({ module: 'queue' })

export const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) return null
    return Math.min(times * 200, 2000)
  },
}

export const conversionQueue = new Queue('conversion', {
  connection,
  defaultJobOptions: config.queue.defaultJobOptions,
})

export const conversionQueueEvents = new QueueEvents('conversion', { connection })

conversionQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  queueLogger.info({ jobId, returnvalue }, 'Job completed')
})

conversionQueueEvents.on('failed', ({ jobId, failedReason }) => {
  queueLogger.error({ jobId, failedReason }, 'Job failed')
})

conversionQueueEvents.on('progress', ({ jobId, data }) => {
  queueLogger.debug({ jobId, progress: data }, 'Job progress')
})

export async function closeQueues() {
  await conversionQueue.close()
  await conversionQueueEvents.close()
}

export interface ConversionJobData {
  id: string
  batchId?: string
  fileIds: string[]
  outputFormat: string
  options?: Record<string, unknown>
  userId?: string
}

export function createConversionJob(data: ConversionJobData) {
  return conversionQueue.add('convert', data, {
    jobId: data.id,
  })
}

export function getConversionQueue() {
  return conversionQueue
}