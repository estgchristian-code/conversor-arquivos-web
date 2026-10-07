import type { UploadRecord, UploadedFileRecord } from '../types/index.js'

export interface UploadRepository {
  save(record: UploadRecord): Promise<UploadRecord>
  findFileById(fileId: string): Promise<UploadedFileRecord | undefined>
}

export class InMemoryUploadRepository implements UploadRepository {
  private readonly uploads = new Map<string, UploadRecord>()

  async save(record: UploadRecord): Promise<UploadRecord> {
    this.uploads.set(record.uploadId, record)
    return record
  }

  async findFileById(fileId: string): Promise<UploadedFileRecord | undefined> {
    for (const upload of this.uploads.values()) {
      const file = upload.files.find((entry) => entry.id === fileId)
      if (file) return file
    }
    return undefined
  }
}

export const uploadRepository: UploadRepository = new InMemoryUploadRepository()