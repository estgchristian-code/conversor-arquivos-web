export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000', 10), // 500MB
    maxFiles: parseInt(process.env.MAX_FILES || '50', 10),
    tempDir: process.env.UPLOAD_TEMP_DIR || '/tmp/uploads',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  queue: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
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

  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },

  logLevel: process.env.LOG_LEVEL || 'info',
}