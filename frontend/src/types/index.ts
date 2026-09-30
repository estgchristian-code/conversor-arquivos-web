export interface FileItem {
  id: string
  file: File
  name: string
  size: number
  type: string
  extension: string
  status: 'pending' | 'uploading' | 'uploaded' | 'converting' | 'completed' | 'error'
  progress: number
  error?: string
  outputFormat?: string
  outputUrl?: string
  conversionId?: string
}

export interface ConversionJob {
  id: string
  batchId?: string
  inputFiles: FileItem[]
  outputFormat: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'partial'
  progress: number
  createdAt: string
  updatedAt: string
  completedAt?: string
  error?: string
  results?: ConversionResult[]
}

export interface ConversionResult {
  fileId: string
  originalName: string
  outputName: string
  outputUrl: string
  outputSize: number
  duration: number
}

export interface BatchConversion {
  id: string
  name: string
  files: FileItem[]
  outputFormat: string
  status: 'draft' | 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  createdAt: string
  jobIds: string[]
}

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface UploadResponse {
  uploadId: string
  files: Array<{
    id: string
    originalName: string
    size: number
    mimeType: string
    url: string
  }>
}

export interface ConversionOptions {
  quality?: number
  resolution?: string
  bitrate?: string
  codec?: string
  preset?: string
  [key: string]: unknown
}

export interface StartConversionRequest {
  fileIds: string[]
  outputFormat: string
  options?: ConversionOptions
  batchName?: string
}