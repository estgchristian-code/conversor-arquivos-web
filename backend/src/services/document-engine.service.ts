import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { config } from '../config/index.js'
import { createChildLogger } from '../utils/logger.js'

const engineLogger = createChildLogger({ module: 'document-engine' })

const DETECTION_TTL_MS = 10_000
const MAX_STDERR_CHARS = 4_000

const LIBREOFFICE_CANDIDATES = [
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/opt/libreoffice/program/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
]

export class DocumentEngineUnavailableError extends Error {
  readonly statusCode = 503

  constructor(message: string) {
    super(message)
    this.name = 'DocumentEngineUnavailableError'
  }
}

export interface DocumentEngineStatus {
  available: boolean
  binary: string | null
  reason?: string
}

let detection: { binary: string | null; checkedAt: number } | null = null
let warnedMissing = false

/**
 * Detecta o LibreOffice sem executar nada. O resultado fica em cache curto para
 * que o health check (a cada 30s no frontend) nao varra o PATH a cada chamada.
 */
export function getDocumentEngineStatus(force = false): DocumentEngineStatus {
  const now = Date.now()

  if (!force && detection && now - detection.checkedAt < DETECTION_TTL_MS) {
    return toStatus(detection.binary)
  }

  const binary = detectLibreOffice()
  detection = { binary, checkedAt: now }

  if (!binary) {
    if (!warnedMissing) {
      engineLogger.warn('LibreOffice nao encontrado; conversao de documentos indisponivel')
      warnedMissing = true
    }
  } else {
    warnedMissing = false
  }

  return toStatus(binary)
}

export interface ConvertOfficeFileOptions {
  inputPath: string
  outputDir: string
  outputFormat: string
  timeoutMs?: number
}

export interface ConvertOfficeFileResult {
  path: string
  size: number
}

/**
 * Converte um documento/planilha/apresentacao usando o LibreOffice headless.
 * As conversoes sao serializadas porque o soffice compartilha estado global e
 * duas instancias simultaneas podem disputar o perfil e travar.
 */
export async function convertOfficeFile(
  options: ConvertOfficeFileOptions,
): Promise<ConvertOfficeFileResult> {
  const status = getDocumentEngineStatus(true)

  if (!status.available || !status.binary) {
    throw new DocumentEngineUnavailableError(
      status.reason ?? 'Conversor de documentos indisponivel no servidor.',
    )
  }

  const binary = status.binary

  return runExclusive(() => runLibreOffice(binary, options))
}

let queue: Promise<unknown> = Promise.resolve()

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task)
  queue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

async function runLibreOffice(
  binary: string,
  options: ConvertOfficeFileOptions,
): Promise<ConvertOfficeFileResult> {
  const timeoutMs = options.timeoutMs ?? config.documents.timeoutMs
  // Perfil descartavel por conversao: evita lock de perfil, herdar configuracoes
  // do usuario do servidor e permite rodar sem sessao grafica.
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'lo-profile-'))
  const startedAt = Date.now()

  try {
    const stderr = await runSoffice(binary, profileDir, options, timeoutMs)
    const produced = await findProducedFile(options.outputDir, options.outputFormat)

    if (!produced) {
      throw new Error(
        `LibreOffice terminou sem gerar .${options.outputFormat}` +
          (stderr ? `: ${stderr}` : '.'),
      )
    }

    engineLogger.info(
      {
        outputFormat: options.outputFormat,
        duration: Date.now() - startedAt,
        output: path.basename(produced),
      },
      'Documento convertido',
    )

    return { path: produced, size: 0 }
  } finally {
    await rm(profileDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

function runSoffice(
  binary: string,
  profileDir: string,
  options: ConvertOfficeFileOptions,
  timeoutMs: number,
): Promise<string> {
  engineLogger.info(
    { binary, outputFormat: options.outputFormat, filter: 'pdf:writer_pdf_Export' },
    'Executando LibreOffice',
  )

  return new Promise((resolve, reject) => {
    const args = [
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--headless',
      '--nologo',
      '--nodefault',
      '--norestore',
      '--nolockcheck',
      '--nofirststartwizard',
      '--convert-to',
      options.outputFormat === 'pdf' ? 'pdf:writer_pdf_Export' : options.outputFormat,
      '--outdir',
      options.outputDir,
      options.inputPath,
    ]

    const env = { ...process.env }
    delete env.PYTHONHOME
    delete env.PYTHONPATH

    const child = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })

    let stderr = ''
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (error) reject(error)
      else resolve(stderr)
    }

    timer = setTimeout(() => {
      killProcessTree(child)
      finish(new Error(`LibreOffice excedeu o tempo limite de ${timeoutMs} ms`))
    }, timeoutMs)

    child.stdout?.on('data', () => undefined)

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_STDERR_CHARS) {
        stderr += chunk.toString('utf8')
      }
    })

    child.on('error', (error) => {
      const stderrTrimmed = stderr.trim()
      finish(
        new Error(
          `Erro ao iniciar LibreOffice (${binary}): ${error.message}${stderrTrimmed ? ` | stderr: ${stderrTrimmed}` : ''}`,
        ),
      )
    })
    child.on('close', (code) => {
      const stderrTrimmed = stderr.trim()
      if (code === 0) finish()
      else
        finish(
          new Error(
            `LibreOffice saiu com codigo ${code} (${binary}, --convert-to pdf:writer_pdf_Export)${stderrTrimmed ? `: ${stderrTrimmed}` : ''}`,
          ),
        )
    })
  })
}

async function findProducedFile(
  outputDir: string,
  outputFormat: string,
): Promise<string | null> {
  const entries = await readdir(outputDir, { withFileTypes: true })
  const expected = outputFormat.toLowerCase()

  const match = entries.find(
    (entry) => entry.isFile() && path.extname(entry.name).slice(1).toLowerCase() === expected,
  )

  return match ? path.join(outputDir, match.name) : null
}

function killProcessTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    }).unref()
    return
  }

  try {
    child.kill('SIGKILL')
  } catch {
    // Processo pode ja ter encerrado.
  }
}

function toStatus(binary: string | null): DocumentEngineStatus {
  if (binary) return { available: true, binary }

  return {
    available: false,
    binary: null,
    reason:
      'Conversor de documentos indisponivel: LibreOffice nao encontrado. ' +
      'Instale o LibreOffice ou defina LIBREOFFICE_PATH com o caminho do soffice.',
  }
}

function detectLibreOffice(): string | null {
  const explicit = config.documents.libreOfficePath.trim()

  if (explicit) {
    if (existsSync(explicit)) return explicit
    engineLogger.warn({ path: explicit }, 'LIBREOFFICE_PATH configurado, mas o arquivo nao existe')
  }

  for (const candidate of LIBREOFFICE_CANDIDATES) {
    if (existsSync(candidate)) return candidate
  }

  const names = process.platform === 'win32' ? ['soffice.exe', 'soffice.com'] : ['soffice']
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)

  for (const entry of pathEntries) {
    for (const name of names) {
      const candidate = path.join(entry, name)
      if (existsSync(candidate)) return candidate
    }
  }

  return null
}
