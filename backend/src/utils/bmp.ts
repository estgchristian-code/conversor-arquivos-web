/**
 * Decodificador BMP para imagens nao comprimidas (BI_RGB).
 *
 * O build precompilado do libvips usado pelo sharp nao inclui o carregador
 * magick e, portanto, nao consegue ler BMP. Como BMP e um formato de entrada
 * aceito pela API, os arquivos sao decodificados aqui e entregues ao sharp
 * como buffer raw RGB.
 */

export interface DecodedBmp {
  data: Buffer
  width: number
  height: number
  channels: 3
}

/** Entrada de paleta em ordem RGB (o BMP armazena B, G, R, A). */
type RgbEntry = [number, number, number]

const BMP_SIGNATURE = 0x4d42 // 'BM'
const FILE_HEADER_SIZE = 14
const CORE_HEADER_SIZE = 12
const INFO_HEADER_SIZE = 40
const MAX_DIMENSION = 20000
const MAX_PIXELS = 50_000_000

export class BmpDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BmpDecodeError'
  }
}

export function isBmp(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer.readUInt16LE(0) === BMP_SIGNATURE
}

export function decodeBmp(buffer: Buffer): DecodedBmp {
  if (!isBmp(buffer)) {
    throw new BmpDecodeError('Arquivo nao possui assinatura BMP valida.')
  }

  if (buffer.length < FILE_HEADER_SIZE + CORE_HEADER_SIZE) {
    throw new BmpDecodeError('Cabecalho BMP incompleto.')
  }

  const pixelOffset = buffer.readUInt32LE(10)
  const headerSize = buffer.readUInt32LE(14)

  if (headerSize < CORE_HEADER_SIZE) {
    throw new BmpDecodeError(`Cabecalho DIB invalido (${headerSize} bytes).`)
  }

  const usesCoreHeader = headerSize === CORE_HEADER_SIZE
  const width = usesCoreHeader ? buffer.readInt16LE(18) : buffer.readInt32LE(18)
  const rawHeight = usesCoreHeader ? buffer.readInt16LE(20) : buffer.readInt32LE(22)
  const bitCount = buffer.readUInt16LE(usesCoreHeader ? 24 : 28)
  const compression = usesCoreHeader ? 0 : buffer.readUInt32LE(30)

  if (compression !== 0) {
    throw new BmpDecodeError(`BMP com compressao (${compression}) nao e suportado.`)
  }

  if (![1, 4, 8, 16, 24, 32].includes(bitCount)) {
    throw new BmpDecodeError(`Profundidade de bits BMP nao suportada (${bitCount}).`)
  }

  const topDown = rawHeight < 0
  const height = Math.abs(rawHeight)

  if (width <= 0 || height <= 0) {
    throw new BmpDecodeError(`Dimensoes BMP invalidas (${width}x${height}).`)
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new BmpDecodeError(`Dimensoes BMP excedem o limite suportado (${width}x${height}).`)
  }

  const palette = readPalette(buffer, FILE_HEADER_SIZE + headerSize, bitCount, headerSize)
  const rowStride = Math.floor((bitCount * width + 31) / 32) * 4

  if (buffer.length < pixelOffset + rowStride * height) {
    throw new BmpDecodeError('Dados de pixel BMP truncados.')
  }

  // O canal alpha e descartado de proposito: em BMP de 32 bits BI_RGB o quarto
  // byte costuma ser zero eTransparent, o que tornaria a imagem invisivel.
  const data = Buffer.allocUnsafe(width * height * 3)

  for (let row = 0; row < height; row += 1) {
    const sourceRow = topDown ? row : height - 1 - row
    const rowStart = pixelOffset + sourceRow * rowStride
    const targetRow = row * width * 3

    for (let column = 0; column < width; column += 1) {
      const target = targetRow + column * 3
      const pixel = rowStart + byteOffsetForColumn(column, bitCount)

      if (bitCount <= 8) {
        const entry = palette[readIndexedPixel(buffer, rowStart, column, bitCount)] ?? [0, 0, 0]
        data[target] = entry[0]
        data[target + 1] = entry[1]
        data[target + 2] = entry[2]
      } else if (bitCount === 16) {
        // 5-6-5: vermelho nos bits 11-15, verde nos bits 5-10, azul nos bits 0-4.
        const value = buffer.readUInt16LE(pixel)
        const r = (value >> 11) & 0x1f
        const g = (value >> 5) & 0x3f
        const b = value & 0x1f
        data[target] = (r << 3) | (r >> 2)
        data[target + 1] = (g << 2) | (g >> 4)
        data[target + 2] = (b << 3) | (b >> 2)
      } else {
        data[target] = buffer[pixel + 2]
        data[target + 1] = buffer[pixel + 1]
        data[target + 2] = buffer[pixel]
      }
    }
  }

  return { data, width, height, channels: 3 }
}

function byteOffsetForColumn(column: number, bitCount: number): number {
  if (bitCount === 1) return column >> 3
  if (bitCount === 4) return column >> 1
  if (bitCount === 8) return column
  return column * (bitCount >> 3)
}

function readIndexedPixel(buffer: Buffer, rowStart: number, column: number, bitCount: number): number {
  if (bitCount === 8) {
    return buffer[rowStart + column]
  }

  const byte = buffer[rowStart + (column >> (bitCount === 1 ? 3 : 1))]

  if (bitCount === 4) {
    return column % 2 === 0 ? (byte >> 4) & 0x0f : byte & 0x0f
  }

  return (byte >> (7 - (column % 8))) & 0x01
}

function readPalette(
  buffer: Buffer,
  offset: number,
  bitCount: number,
  headerSize: number,
): RgbEntry[] {
  if (bitCount > 8) return []

  const declaredColors = headerSize >= INFO_HEADER_SIZE ? buffer.readUInt32LE(46) : 0
  const count = declaredColors > 0 ? Math.min(declaredColors, 1 << bitCount) : 1 << bitCount
  const palette: RgbEntry[] = []

  for (let index = 0; index < count; index += 1) {
    const entryOffset = offset + index * 4
    if (entryOffset + 2 >= buffer.length) break
    palette.push([buffer[entryOffset + 2], buffer[entryOffset + 1], buffer[entryOffset]])
  }

  if (palette.length === 0) {
    throw new BmpDecodeError('Paleta BMP ausente ou invalida.')
  }

  return palette
}