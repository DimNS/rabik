import { mkdirSync } from 'node:fs'
import { decodePng, encodePng, type RgbaImage } from './atlas-codec.ts'

const SRC = new URL('../icon.png', import.meta.url).pathname
const OUT_DIR = new URL('../icons/', import.meta.url).pathname
const BG = 0x11

function fail(message: string): never {
    console.error(`gen-icons: ${message}`)
    process.exit(1)
}

// Центральный квадратный кроп.
function squareCrop(src: RgbaImage): RgbaImage {
    const side = Math.min(src.w, src.h)
    const sx = Math.floor((src.w - side) / 2)
    const sy = Math.floor((src.h - side) / 2)
    const data = new Uint8Array(side * side * 4)
    for (let y = 0; y < side; y++) {
        const si = ((sy + y) * src.w + sx) * 4
        data.set(src.data.subarray(si, si + side * 4), y * side * 4)
    }
    return { w: side, h: side, data }
}

// Билинейный даунскейл с компоновкой поверх непрозрачного фона #111 (для maskable).
function resize(src: RgbaImage, size: number): Uint8Array {
    const out = new Uint8Array(size * size * 4)
    const xRatio = src.w / size
    const yRatio = src.h / size
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const sx = (x + 0.5) * xRatio - 0.5
            const sy = (y + 0.5) * yRatio - 0.5
            const x0 = Math.max(0, Math.floor(sx))
            const y0 = Math.max(0, Math.floor(sy))
            const x1 = Math.min(src.w - 1, x0 + 1)
            const y1 = Math.min(src.h - 1, y0 + 1)
            const fx = Math.min(1, Math.max(0, sx - x0))
            const fy = Math.min(1, Math.max(0, sy - y0))
            const di = (y * size + x) * 4
            for (let c = 0; c < 3; c++) {
                const p00 = src.data[(y0 * src.w + x0) * 4 + c] ?? 0
                const p10 = src.data[(y0 * src.w + x1) * 4 + c] ?? 0
                const p01 = src.data[(y1 * src.w + x0) * 4 + c] ?? 0
                const p11 = src.data[(y1 * src.w + x1) * 4 + c] ?? 0
                const v = p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy
                const a00 = (src.data[(y0 * src.w + x0) * 4 + 3] ?? 255) / 255
                const a10 = (src.data[(y0 * src.w + x1) * 4 + 3] ?? 255) / 255
                const a01 = (src.data[(y1 * src.w + x0) * 4 + 3] ?? 255) / 255
                const a11 = (src.data[(y1 * src.w + x1) * 4 + 3] ?? 255) / 255
                const a = a00 * (1 - fx) * (1 - fy) + a10 * fx * (1 - fy) + a01 * (1 - fx) * fy + a11 * fx * fy
                out[di + c] = Math.round(v * a + BG * (1 - a))
            }
            out[di + 3] = 255
        }
    }
    return out
}

const file = Bun.file(SRC)
if (!(await file.exists())) fail(`не найден исходник ${SRC}`)
let src: RgbaImage
try {
    src = decodePng(new Uint8Array(await file.arrayBuffer()), 'icon.png')
} catch (error) {
    fail(error instanceof Error ? error.message : String(error))
}

const cropped = squareCrop(src)
const targets = [
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
]
mkdirSync(OUT_DIR, { recursive: true })
for (const { name, size } of targets) {
    await Bun.write(`${OUT_DIR}${name}`, encodePng(size, size, resize(cropped, size), false))
    console.log(`${name}: ${size}x${size}`)
}
