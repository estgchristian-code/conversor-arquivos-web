import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase()
}

export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '')
    .replace(/\.\.+/g, '.')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\x00-\x1F\x7F]/g, '_')
    .trim()
    .replace(/[. ]+$/, '')

  return base.replace(/[^\p{L}\p{N}\p{M}._-]+/gu, '_') || 'arquivo'
}