import { deflateSync, inflateSync } from 'node:zlib'
import { decode as decodeJpeg } from 'jpeg-js'

export interface RgbaImage {
    w: number
    h: number
    data: Uint8Array // w*h*4, RGBA
}

function fail(message: string): never {
    throw new Error(`png: ${message}`)
}

function crc32(data: Uint8Array): number {
    let crc = -1
    for (const byte of data) {
        crc ^= byte
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
        }
    }
    return (crc ^ -1) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, data.length)
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
    out.set(data, 8)
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
    return out
}

function u32(bytes: Uint8Array, offset: number): number {
    return (
        (bytes[offset] ?? 0) * 0x1000000 +
        ((bytes[offset + 1] ?? 0) << 16) +
        ((bytes[offset + 2] ?? 0) << 8) +
        (bytes[offset + 3] ?? 0)
    )
}

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc) return a
    if (pb <= pc) return b
    return c
}

// Снимает PNG-фильтры с passH строк шириной passW и раскладывает результат
// в dest как RGBA. Возвращает смещение конца прохода в src.
function unfilterPass(
    src: Uint8Array,
    offset: number,
    passW: number,
    passH: number,
    channels: number,
    dest: Uint8Array,
    destW: number,
    mapX: (px: number) => number,
    mapY: (py: number) => number,
): number {
    const rowLen = passW * channels
    const prev = new Uint8Array(rowLen)
    for (let py = 0; py < passH; py++) {
        const filter = src[offset] ?? -1
        if (filter < 0 || filter > 4) fail('неизвестный PNG-фильтр')
        const cur = src.subarray(offset + 1, offset + 1 + rowLen)
        if (cur.length < rowLen) fail('оборванный IDAT-поток')
        for (let i = 0; i < rowLen; i++) {
            const a = i >= channels ? (cur[i - channels] ?? 0) : 0
            const b = prev[i] ?? 0
            const c = i >= channels ? (prev[i - channels] ?? 0) : 0
            let v = cur[i] ?? 0
            if (filter === 1) v += a
            else if (filter === 2) v += b
            else if (filter === 3) v += (a + b) >> 1
            else if (filter === 4) v += paeth(a, b, c)
            cur[i] = v & 0xff
        }
        prev.set(cur)
        const dy = mapY(py)
        for (let px = 0; px < passW; px++) {
            const si = px * channels
            const di = (dy * destW + mapX(px)) * 4
            dest[di] = cur[si] ?? 0
            dest[di + 1] = cur[si + 1] ?? 0
            dest[di + 2] = cur[si + 2] ?? 0
            dest[di + 3] = channels === 4 ? (cur[si + 3] ?? 0) : 255
        }
        offset += 1 + rowLen
    }
    return offset
}

// Проходы Adam7: реальный rabbit-strip.png отдан interlaced,
// поэтому декодер умеет и его (дизайн предполагал только non-interlaced).
const ADAM7 = [
    { x0: 0, y0: 0, dx: 8, dy: 8 },
    { x0: 4, y0: 0, dx: 8, dy: 8 },
    { x0: 0, y0: 4, dx: 4, dy: 8 },
    { x0: 2, y0: 0, dx: 4, dy: 4 },
    { x0: 0, y0: 2, dx: 2, dy: 4 },
    { x0: 1, y0: 0, dx: 2, dy: 2 },
    { x0: 0, y0: 1, dx: 1, dy: 2 },
] as const

export function decodePng(bytes: Uint8Array, label: string): RgbaImage {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    for (let i = 0; i < sig.length; i++) {
        if ((bytes[i] ?? -1) !== sig[i]) fail(`${label}: не PNG-сигнатура`)
    }
    let offset = 8
    let width = 0
    let height = 0
    let colorType = 0
    let interlace = 0
    let seenIhdr = false
    let seenIend = false
    const idatParts: Uint8Array[] = []
    let idatLen = 0
    while (offset + 8 <= bytes.length) {
        const length = u32(bytes, offset)
        const type = String.fromCharCode(
            bytes[offset + 4] ?? 0,
            bytes[offset + 5] ?? 0,
            bytes[offset + 6] ?? 0,
            bytes[offset + 7] ?? 0,
        )
        if (offset + 12 + length > bytes.length) fail(`${label}: оборванный PNG-чанк ${type}`)
        const data = bytes.subarray(offset + 8, offset + 8 + length)
        if (type === 'IHDR') {
            if (seenIhdr) fail(`${label}: повторный IHDR`)
            if (length !== 13) fail(`${label}: неверный IHDR`)
            width = u32(data, 0)
            height = u32(data, 4)
            if ((data[8] ?? 0) !== 8 || ((data[9] ?? 0) !== 2 && (data[9] ?? 0) !== 6)) {
                fail(`${label}: нужен 8-бит RGB/RGBA без палитры, пересохраните исходник`)
            }
            if ((data[10] ?? 1) !== 0 || (data[11] ?? 1) !== 0) fail(`${label}: неизвестный метод PNG`)
            colorType = data[9] ?? 0
            interlace = data[12] ?? 0
            if (interlace !== 0 && interlace !== 1) fail(`${label}: неизвестный interlace`)
            seenIhdr = true
        } else if (type === 'IDAT') {
            if (!seenIhdr) fail(`${label}: IDAT до IHDR`)
            idatParts.push(data)
            idatLen += length
        } else if (type === 'IEND') {
            seenIend = true
            break
        }
        // Остальные чанки (tEXt и т.п.) игнорируем.
        offset += 12 + length
    }
    if (!seenIhdr) fail(`${label}: нет IHDR`)
    if (!seenIend) fail(`${label}: нет IEND`)
    const idat = new Uint8Array(idatLen)
    let at = 0
    for (const part of idatParts) {
        idat.set(part, at)
        at += part.length
    }
    let inflated: Uint8Array
    try {
        inflated = inflateSync(idat)
    } catch {
        fail(`${label}: не удалось распаковать IDAT`)
    }
    const channels = colorType === 2 ? 3 : 4
    const rgba = new Uint8Array(width * height * 4)
    let end: number
    if (interlace === 0) {
        end = unfilterPass(
            inflated,
            0,
            width,
            height,
            channels,
            rgba,
            width,
            (px) => px,
            (py) => py,
        )
    } else {
        end = 0
        for (const pass of ADAM7) {
            const passW = pass.x0 < width ? Math.ceil((width - pass.x0) / pass.dx) : 0
            const passH = pass.y0 < height ? Math.ceil((height - pass.y0) / pass.dy) : 0
            if (passW === 0 || passH === 0) continue
            end = unfilterPass(
                inflated,
                end,
                passW,
                passH,
                channels,
                rgba,
                width,
                (px) => pass.x0 + px * pass.dx,
                (py) => pass.y0 + py * pass.dy,
            )
        }
    }
    if (end !== inflated.length) fail(`${label}: лишний хвост в IDAT`)
    return { w: width, h: height, data: rgba }
}

export function decodeJpg(bytes: Uint8Array, label: string): RgbaImage {
    let decoded: { width: number; height: number; data: Uint8Array }
    try {
        decoded = decodeJpeg(bytes, { useTArray: true })
    } catch (error) {
        fail(`${label}: не удалось декодировать JPEG (${error instanceof Error ? error.message : String(error)})`)
    }
    if (decoded.data.length !== decoded.width * decoded.height * 4) fail(`${label}: битый вывод JPEG`)
    return { w: decoded.width, h: decoded.height, data: decoded.data }
}

export function encodePng(w: number, h: number, rgba: Uint8Array, withAlpha: boolean): Uint8Array {
    const channels = withAlpha ? 4 : 3
    const stride = 1 + w * channels
    const raw = new Uint8Array(h * stride)
    for (let y = 0; y < h; y++) {
        const row = y * stride
        raw[row] = 0
        for (let x = 0; x < w; x++) {
            const si = (y * w + x) * 4
            const di = row + 1 + x * channels
            raw[di] = rgba[si] ?? 0
            raw[di + 1] = rgba[si + 1] ?? 0
            raw[di + 2] = rgba[si + 2] ?? 0
            if (withAlpha) raw[di + 3] = rgba[si + 3] ?? 0
        }
    }

    const ihdr = new Uint8Array(13)
    const ihdrView = new DataView(ihdr.buffer)
    ihdrView.setUint32(0, w)
    ihdrView.setUint32(4, h)
    ihdr[8] = 8
    ihdr[9] = withAlpha ? 6 : 2

    const parts = [
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', new Uint8Array(0)),
    ]
    const png = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
    let offset = 0
    for (const part of parts) {
        png.set(part, offset)
        offset += part.length
    }
    return png
}
