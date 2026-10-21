import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { uploadRepository } from './src/repositories/upload.repository.js'
import { startConversion } from './src/services/conversion.service.js'
import { getStoragePaths } from './src/services/storage.service.js'
import { decodeBmp } from './src/utils/bmp.js'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18" viewBox="0 0 24 18"><rect width="24" height="18" fill="#0078ff"/><circle cx="12" cy="9" r="5" fill="#ffffff"/></svg>`

const tmp = await mkdtemp(path.join(os.tmpdir(), 'svg-outputs-check-'))
const svgPath = path.join(tmp, 'source.svg')
const fileId = `svg-outputs-${Date.now()}`
const createdJobs: string[] = []

await writeFile(svgPath, svg, 'utf8')
const info = await stat(svgPath)

await uploadRepository.save({
  uploadId: `upload-${fileId}`,
  files: [
    {
      id: fileId,
      originalName: 'source.svg',
      size: info.size,
      mimeType: 'image/svg+xml',
      extension: 'svg',
      path: svgPath,
      uploadedAt: new Date().toISOString(),
    },
  ],
  createdAt: new Date().toISOString(),
})

try {
  for (const outputFormat of ['png', 'jpg', 'webp', 'avif', 'gif', 'tiff', 'bmp']) {
    const job = await startConversion({ fileIds: [fileId], outputFormat })
    createdJobs.push(job.id)
    const output = path.join(getStoragePaths().outputDir, job.id, `${fileId}.${outputFormat}`)
    const buffer = await readFile(output)

    if (outputFormat === 'bmp') {
      const decoded = decodeBmp(buffer)
      console.log(`SVG -> ${outputFormat.toUpperCase()}:`, {
        status: job.status,
        dimensions: [decoded.width, decoded.height],
        bytes: buffer.length,
      })
    } else {
      const metadata = await sharp(buffer).metadata()
      console.log(`SVG -> ${outputFormat.toUpperCase()}:`, {
        status: job.status,
        format: metadata.format,
        dimensions: [metadata.width, metadata.height],
        bytes: buffer.length,
      })
    }
  }
} finally {
  for (const jobId of createdJobs) {
    try {
      await rm(path.join(getStoragePaths().outputDir, jobId), {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      })
    } catch (error) {
      console.warn(`Falha ao limpar job ${jobId}:`, error instanceof Error ? error.message : error)
    }
  }

  await rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
