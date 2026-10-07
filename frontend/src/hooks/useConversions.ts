import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { StartConversionRequest } from '../types'

export interface UploadVariables {
  files: File[]
  onProgress?: (percent: number) => void
}

export function useUpload() {
  return useMutation({
    mutationFn: ({ files, onProgress }: UploadVariables) => api.uploadFiles(files, onProgress),
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
    refetchInterval: false,
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

export function useDownloadFile() {
  return useMutation({
    mutationFn: ({ jobId, fileId }: { jobId: string; fileId: string }) => api.downloadFile(jobId, fileId),
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