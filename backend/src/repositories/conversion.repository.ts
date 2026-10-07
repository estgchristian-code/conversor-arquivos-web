import type {
  ConversionJobRecord,
} from '../types/index.js'

export interface ConversionRepository {
  create(job: ConversionJobRecord): Promise<ConversionJobRecord>
  findById(id: string): Promise<ConversionJobRecord | undefined>
  update(id: string, patch: Partial<ConversionJobRecord>): Promise<ConversionJobRecord | undefined>
}

export class InMemoryConversionRepository implements ConversionRepository {
  private readonly jobs = new Map<string, ConversionJobRecord>()

  async create(job: ConversionJobRecord): Promise<ConversionJobRecord> {
    this.jobs.set(job.id, job)
    return job
  }

  async findById(id: string): Promise<ConversionJobRecord | undefined> {
    return this.jobs.get(id)
  }

  async update(id: string, patch: Partial<ConversionJobRecord>): Promise<ConversionJobRecord | undefined> {
    const existing = this.jobs.get(id)
    if (!existing) return undefined

    const next: ConversionJobRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }

    this.jobs.set(id, next)
    return next
  }
}

export const conversionRepository: ConversionRepository = new InMemoryConversionRepository()