export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'partial' | 'cancelled'

export interface UploadedFileRecord {
  id: string
  originalName: string
  size: number
  mimeType: string
  extension: string
  path: string
  uploadedAt: string
}

export interface UploadRecord {
  uploadId: string
  files: UploadedFileRecord[]
  createdAt: string
}

export interface UploadResponseFile {
  id: string
  originalName: string
  size: number
  mimeType: string
  url: string
}

export interface RejectedFile {
  name: string
  reason: string
}

export interface UploadResponse {
  uploadId: string
  files: UploadResponseFile[]
  rejected: RejectedFile[]
}

export interface ConversionJobRecord {
  id: string
  batchId?: string
  fileIds: string[]
  outputFormat: string
  status: JobStatus
  progress: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  error?: string
  results?: ConversionResultRecord[]
}

export interface ConversionResultRecord {
  fileId: string
  originalName: string
  outputName: string
  outputUrl: string
  outputSize: number
  duration: number
}

export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ConversionOptions {
  quality?: number
  [key: string]: unknown
}

export interface StartConversionRequest {
  fileIds: string[]
  outputFormat: string
  options?: ConversionOptions
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  timestamp: string
  uptime: number
  environment: string
}