import type {
  ConversionJobRecord,
  PaginatedResult,
} from '../types/index.js'

export interface ConversionRepository {
  create(job: ConversionJobRecord): Promise<ConversionJobRecord>
  findById(id: string): Promise<ConversionJobRecord | undefined>
  update(id: string, patch: Partial<ConversionJobRecord>): Promise<ConversionJobRecord | undefined>
  findAll(page?: number, limit?: number): Promise<PaginatedResult<ConversionJobRecord>>
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

  async findAll(page = 1, limit = 20): Promise<PaginatedResult<ConversionJobRecord>> {
    const total = this.jobs.size
    const safePage = Math.max(1, Math.floor(page))
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)))
    const start = (safePage - 1) * safeLimit
    const end = start + safeLimit

    const items = [...this.jobs.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(start, end)

    return {
      data: items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    }
  }
}

export const conversionRepository: ConversionRepository = new InMemoryConversionRepository()