import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { createChildLogger } from '../utils/logger.js'

const gotenbergLogger = createChildLogger({ module: 'gotenberg' })

export interface GotenbergStatus {
  available: boolean
  url: string | null
  reason?: string
}

export class GotenbergError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 502) {
    super(message)
    this.name = 'GotenbergError'
    this.statusCode = statusCode
  }
}

/**
 * Verifica se o servico Gotenberg esta disponível fazendo uma requisicao
 * GET ao endpoint /health. O resultado nao e armazenado em cache para que
 * o health check do frontend reflita o estado atual do serviço remoto.
 */
export async function getGotenbergStatus(): Promise<GotenbergStatus> {
  const url = config.gotenberg.url

  if (!url) {
    return { available: false, url: null, reason: 'GOTENBERG_URL nao configurada' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (response.ok) {
      return { available: true, url }
    }

    return {
      available: false,
      url,
      reason: `Gotenberg retornou ${response.status}`,
    }
  } catch (error) {
    return {
      available: false,
      url,
      reason: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Converte um arquivo de escritorio (documento, planilha ou apresentacao)
 * usando o servico Gotenberg via HTTP multipart.
 *
 * O Gotenberg recebe o arquivo no campo 'files' e o formato de saida no
 * campo 'outputFormat'. O corpo da resposta e o arquivo convertido.
 *
 * Suportado pelo Gotenberg: DOCX, XLSX, PPTX, ODT, ODS, ODP, PDF, imagens,
 * HTML e Markdown como entrada, com saida em PDF. Formatos como CSV de
 * saida nao sao suportados pelo Gotenberg e devem ser tratados pelo chamador.
 */
export async function convertOfficeFileViaGotenberg(
  inputPath: string,
  outputDir: string,
  outputFormat: string,
  timeoutMs?: number,
): Promise<string> {
  const url = config.gotenberg.url

  if (!url) {
    throw new GotenbergError('GOTENBERG_URL nao configurada', 503)
  }

  const fileBuffer = await readFile(inputPath)
  const fileName = path.basename(inputPath)

  const formData = new FormData()
  formData.append('files', new Blob([fileBuffer]), fileName)
  formData.append('outputFormat', outputFormat)

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs ?? config.gotenberg.timeoutMs,
  )

  try {
    gotenbergLogger.info(
      { input: fileName, outputFormat, url },
      'Convertendo via Gotenberg',
    )

    const response = await fetch(`${url}/forms/libreoffice/convert`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      gotenbergLogger.warn(
        { status: response.status, input: fileName, error: errorBody },
        'Gotenberg retornou erro',
      )
      throw new GotenbergError(
        `Gotenberg retornou ${response.status}` +
          (errorBody ? `: ${errorBody}` : '.'),
        response.status >= 500 ? 502 : 400,
      )
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const baseName = path.basename(inputPath, path.extname(inputPath)) || 'arquivo'
    const outputName = `${baseName}.${outputFormat}`
    const outputPath = path.join(outputDir, outputName)

    await writeFile(outputPath, buffer)

    gotenbergLogger.info(
      { input: fileName, output: outputName, outputFormat },
      'Conversao via Gotenberg concluida',
    )

    return outputPath
  } catch (error) {
    if (error instanceof GotenbergError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GotenbergError('Gotenberg excedeu o tempo limite', 504)
    }
    const message = error instanceof Error ? error.message : 'erro desconhecido'
    throw new GotenbergError(`Erro ao chamar Gotenberg: ${message}`, 502)
  } finally {
    clearTimeout(timeout)
  }
}
