import path from 'node:path'

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000', 10), // 500MB
    maxFiles: parseInt(process.env.MAX_FILES || '50', 10),
    tempDir: process.env.UPLOAD_TEMP_DIR || '/tmp/uploads',
  },

  storage: {
    local: {
      uploadDir: process.env.STORAGE_LOCAL_DIR || './storage/uploads',
      outputDir: process.env.STORAGE_OUTPUT_DIR || './storage/outputs',
    },
  },

  frontend: {
    buildDir: path.resolve(process.cwd(), process.env.FRONTEND_BUILD_DIR || '../frontend/dist'),
  },

  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000']
        : 'same-origin',
    credentials: true,
  },

  logLevel: process.env.LOG_LEVEL || 'info',
}