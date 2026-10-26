import path from 'node:path'

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '524288000', 10), // 500MB
    // O fluxo de upload aceita somente 1 arquivo por vez. O limite nao e
    // configuravel por variavel de ambiente.
    maxFiles: 1,
    tempDir: process.env.UPLOAD_TEMP_DIR || '/tmp/uploads',
  },

  storage: {
    local: {
      uploadDir: process.env.STORAGE_LOCAL_DIR || './storage/uploads',
      outputDir: process.env.STORAGE_OUTPUT_DIR || './storage/outputs',
    },
  },

  documents: {
    // Caminho explicito do soffice; quando vazio a deteccao procura nos
    // diretorios padrao e no PATH do processo.
    // Mantido para compatibilidade; nao e mais usado pelo mecanismo de
    // conversao, que agora depende do Gotenberg via HTTP.
    libreOfficePath: process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH || '',
    timeoutMs: parseInt(process.env.DOCUMENT_CONVERSION_TIMEOUT_MS || '120000', 10),
  },

  gotenberg: {
    // URL do servico Gotenberg (ex.: http://localhost:3000).
    // Quando vazio, conversoes de documentos/planilhas/apresentacoes
    // sao rejeitadas com erro 503.
    url: process.env.GOTENBERG_URL || '',
    timeoutMs: parseInt(process.env.GOTENBERG_TIMEOUT_MS || '120000', 10),
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