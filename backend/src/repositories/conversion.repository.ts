import type {
  ConversionJobRecord,
  JobStatus,
  PaginatedResult,
  PaginationParams,
} from '../types/index.js'

export interface ConversionRepository {
  create(job: ConversionJobRecord): Promise<ConversionJobRecord>
  findById(id: string): Promise<ConversionJobRecord | undefined>
  findAll(params: PaginationParams): Promise<PaginatedResult<ConversionJobRecord>>
  findByStatus(status: JobStatus): Promise<ConversionJobRecord[]>
  update(id: string, patch: Partial<ConversionJobRecord>): Promise<ConversionJobRecord | undefined>
  remove(id: string): Promise<boolean>
  clear(): Promise<void>
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function normalizePagination(params: PaginationParams): PaginationParams {
  const page = Number.isFinite(params.page) && params.page >= 1 ? Math.floor(params.page) : DEFAULT_PAGE
  const requested = Number.isFinite(params.limit) && params.limit >= 1 ? Math.floor(params.limit) : DEFAULT_LIMIT
  return { page, limit: Math.min(requested, MAX_LIMIT) }
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

  async findAll(params: PaginationParams): Promise<PaginatedResult<ConversionJobRecord>> {
    const { page, limit } = normalizePagination(params)

    const all = [...this.jobs.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )

    const total = all.length
    const start = (page - 1) * limit
    const data = all.slice(start, start + limit)

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  async findByStatus(status: JobStatus): Promise<ConversionJobRecord[]> {
    return [...this.jobs.values()].filter((job) => job.status === status)
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

  async remove(id: string): Promise<boolean> {
    return this.jobs.delete(id)
  }

  async clear(): Promise<void> {
    this.jobs.clear()
  }
}

export const conversionRepository: ConversionRepository = new InMemoryConversionRepository()