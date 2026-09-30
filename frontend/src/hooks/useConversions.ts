import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { FileItem, ConversionJob, StartConversionRequest, PaginatedResponse } from '../types'
import { generateId, getFileExtension, getMimeTypeFromExtension } from '../utils/helpers'

export function useUpload() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (files: FileList) => api.uploadFiles(files),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversions'] })
      return data
    },
  })
}

export function useConversions(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['conversions', page, limit],
    queryFn: () => api.getConversions(page, limit),
    placeholderData: (previousData) => previousData,
  })
}

export function useConversion(jobId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['conversion', jobId],
    queryFn: () => api.getConversion(jobId!),
    enabled: !!jobId && enabled,
    refetchInterval: (query) => {
      if (!query.state.data) return 2000
      const status = query.state.data.status
      if (status === 'queued' || status === 'processing') return 2000
      return false
    },
  })
}

export function useStartConversion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: StartConversionRequest) => api.startConversion(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversions'] })
      queryClient.setQueryData(['conversion', data.id], data)
    },
  })
}

export function useCancelConversion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => api.cancelConversion(jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['conversions'] })
      queryClient.invalidateQueries({ queryKey: ['conversion', jobId] })
    },
  })
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: ({ jobId, fileId }: { jobId: string; fileId: string }) => api.downloadFile(jobId, fileId),
  })
}

export function useSupportedFormats() {
  return useQuery({
    queryKey: ['formats'],
    queryFn: () => api.getSupportedFormats(),
    staleTime: 1000 * 60 * 30,
  })
}

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.healthCheck(),
    refetchInterval: 30000,
    retry: 3,
  })
}

export function createFileItems(files: FileList): FileItem[] {
  return Array.from(files).map((file) => ({
    id: generateId(),
    file,
    name: file.name,
    size: file.size,
    type: file.type || getMimeTypeFromExtension(getFileExtension(file.name)),
    extension: getFileExtension(file.name),
    status: 'pending' as const,
    progress: 0,
  }))
}