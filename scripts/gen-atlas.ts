import { deflateSync } from 'node:zlib'

interface AtlasFrame {
    frame: { x: number; y: number; w: number; h: number }
    duration?: number
}

interface Atlas {
    frames: Record<string, AtlasFrame>
    meta: { image: string; size: { w: number; h: number } }
}

const SPRITES_DIR = new URL('../public/assets/sprites/', import.meta.url)
const BACKGROUND: RGB = [16, 16, 16]
const COLORS: Record<string, RGB> = {
    wall: [74, 74, 74],
    soil: [139, 90, 43],
    road: [43, 43, 43],
    rabbit: [242, 242, 242],
}
const UNKNOWN_FRAME: RGB = [255, 0, 255]

type RGB = [number, number, number]

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

function encodePng(atlas: Atlas): Uint8Array {
    const { w, h } = atlas.meta.size
    const stride = 1 + w * 3
    const [bgR, bgG, bgB] = BACKGROUND
    const raw = new Uint8Array(h * stride)
    for (let y = 0; y < h; y++) {
        const row = y * stride
        raw[row] = 0
        for (let x = 0; x < w; x++) {
            const px = row + 1 + x * 3
            raw[px] = bgR
            raw[px + 1] = bgG
            raw[px + 2] = bgB
        }
    }
    for (const [name, entry] of Object.entries(atlas.frames)) {
        const [r, g, b] = COLORS[name.replace(/_.*$/, '')] ?? UNKNOWN_FRAME
        const { x: fx, y: fy, w: fw, h: fh } = entry.frame
        for (let y = fy; y < fy + fh; y++) {
            const row = y * stride
            for (let x = fx; x < fx + fw; x++) {
                const px = row + 1 + x * 3
                raw[px] = r
                raw[px + 1] = g
                raw[px + 2] = b
            }
        }
    }

    const ihdr = new Uint8Array(13)
    const ihdrView = new DataView(ihdr.buffer)
    ihdrView.setUint32(0, w)
    ihdrView.setUint32(4, h)
    ihdr[8] = 8
    ihdr[9] = 2

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

const jsonUrl = new URL('atlas.json', SPRITES_DIR)
const atlas = (await Bun.file(jsonUrl).json()) as Atlas
await Bun.write(new URL(atlas.meta.image, SPRITES_DIR), encodePng(atlas))
console.log(
    `${atlas.meta.image}: ${atlas.meta.size.w}x${atlas.meta.size.h}, кадров ${Object.keys(atlas.frames).length}`,
)
