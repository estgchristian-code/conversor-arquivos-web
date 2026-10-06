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
    type: (process.env.STORAGE_TYPE as 'local' | 's3') || 'local',
    local: {
      uploadDir: process.env.STORAGE_LOCAL_DIR || './storage/uploads',
      outputDir: process.env.STORAGE_OUTPUT_DIR || './storage/outputs',
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET,
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
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