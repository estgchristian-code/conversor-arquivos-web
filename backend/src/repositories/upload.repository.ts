import type { UploadRecord, UploadedFileRecord } from '../types/index.js'

export interface UploadRepository {
  save(record: UploadRecord): Promise<UploadRecord>
  findById(uploadId: string): Promise<UploadRecord | undefined>
  findFile(uploadId: string, fileId: string): Promise<UploadedFileRecord | undefined>
  findFileById(fileId: string): Promise<UploadedFileRecord | undefined>
  remove(uploadId: string): Promise<boolean>
  clear(): Promise<void>
}

export class InMemoryUploadRepository implements UploadRepository {
  private readonly uploads = new Map<string, UploadRecord>()

  async save(record: UploadRecord): Promise<UploadRecord> {
    this.uploads.set(record.uploadId, record)
    return record
  }

  async findById(uploadId: string): Promise<UploadRecord | undefined> {
    return this.uploads.get(uploadId)
  }

  async findFile(uploadId: string, fileId: string): Promise<UploadedFileRecord | undefined> {
    return this.uploads.get(uploadId)?.files.find((file) => file.id === fileId)
  }

  async findFileById(fileId: string): Promise<UploadedFileRecord | undefined> {
    for (const upload of this.uploads.values()) {
      const file = upload.files.find((entry) => entry.id === fileId)
      if (file) return file
    }
    return undefined
  }

  async remove(uploadId: string): Promise<boolean> {
    return this.uploads.delete(uploadId)
  }

  async clear(): Promise<void> {
    this.uploads.clear()
  }
}

export const uploadRepository: UploadRepository = new InMemoryUploadRepository()