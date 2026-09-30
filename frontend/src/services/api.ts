import axios, { AxiosInstance, AxiosError } from 'axios'
import type { ApiResponse, UploadResponse, ConversionJob, PaginatedResponse, StartConversionRequest } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const message = error.response?.data?.message || error.message || 'Erro desconhecido'
        return Promise.reject(new Error(message))
      }
    )
  }

  async uploadFiles(files: FileList): Promise<UploadResponse> {
    const formData = new FormData()
    Array.from(files).forEach((file) => {
      formData.append('files', file)
    })

    const response = await this.client.post<ApiResponse<UploadResponse>>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        // Progress handled by React Query
      },
    })
    return response.data.data
  }

  async startConversion(request: StartConversionRequest): Promise<ConversionJob> {
    const response = await this.client.post<ApiResponse<ConversionJob>>('/conversion', request)
    return response.data.data
  }

  async getConversion(jobId: string): Promise<ConversionJob> {
    const response = await this.client.get<ApiResponse<ConversionJob>>(`/conversion/${jobId}`)
    return response.data.data
  }

  async getConversions(page = 1, limit = 20): Promise<PaginatedResponse<ConversionJob>> {
    const response = await this.client.get<ApiResponse<PaginatedResponse<ConversionJob>>>(
      `/conversion?page=${page}&limit=${limit}`
    )
    return response.data.data
  }

  async cancelConversion(jobId: string): Promise<void> {
    await this.client.delete(`/conversion/${jobId}`)
  }

  async downloadFile(jobId: string, fileId: string): Promise<Blob> {
    const response = await this.client.get(`/conversion/${jobId}/download/${fileId}`, {
      responseType: 'blob',
    })
    return response.data
  }

  async getSupportedFormats(): Promise<Record<string, string[]>> {
    const response = await this.client.get<ApiResponse<Record<string, string[]>>>('/formats')
    return response.data.data
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get<ApiResponse<{ status: string; timestamp: string }>>('/health')
    return response.data.data
  }
}

export const api = new ApiClient()