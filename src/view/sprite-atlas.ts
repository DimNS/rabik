import type { AtlasFrame, AtlasMeta } from '../core/level-types.ts'

export interface AtlasDescription {
    frames: Record<string, AtlasFrame>
    meta: AtlasMeta
    tileSize: number
    getFrame(name: string): AtlasFrame
}

export interface SpriteAtlas extends AtlasDescription {
    image: HTMLImageElement
}

function fail(message: string): never {
    throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRect(value: unknown, name: string): { x: number; y: number; w: number; h: number } {
    if (!isRecord(value)) fail(`атлас: кадр "${name}" должен содержать объект frame`)
    const { x, y, w, h } = value
    if (typeof x !== 'number' || typeof y !== 'number' || typeof w !== 'number' || typeof h !== 'number') {
        fail(`атлас: кадр "${name}": frame должен содержать числа x, y, w, h`)
    }
    if (w <= 0 || h <= 0) fail(`атлас: кадр "${name}": frame должен иметь положительные w и h`)
    return { x, y, w, h }
}

export function parseAtlas(data: unknown): AtlasDescription {
    if (!isRecord(data)) fail('атлас: данные должны быть объектом')

    const { frames, meta } = data
    if (!isRecord(frames)) fail('атлас: поле frames должно быть объектом')
    if (!isRecord(meta)) fail('атлас: поле meta должно быть объектом')
    const { image, size } = meta
    if (typeof image !== 'string' || image === '') fail('атлас: meta.image должен быть непустой строкой')
    if (!isRecord(size) || typeof size.w !== 'number' || typeof size.h !== 'number') {
        fail('атлас: meta.size должен содержать числа w и h')
    }

    const parsed: Record<string, AtlasFrame> = {}
    for (const [name, value] of Object.entries(frames)) {
        if (!isRecord(value)) fail(`атлас: кадр "${name}" должен быть объектом`)
        const frame: AtlasFrame = { frame: parseRect(value.frame, name) }
        const duration = value.duration
        if (duration !== undefined) {
            if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
                fail(`атлас: кадр "${name}": duration должен быть положительным числом`)
            }
            frame.duration = duration
        }
        parsed[name] = frame
    }

    const wall = parsed.wall
    if (!wall) fail('атлас: отсутствует кадр "wall" — источник размера тайла')

    return {
        frames: parsed,
        meta: { image, size: { w: size.w, h: size.h } },
        tileSize: wall.frame.w,
        getFrame(name: string): AtlasFrame {
            const frame = parsed[name]
            if (!frame) fail(`атлас: неизвестный кадр "${name}"`)
            return frame
        },
    }
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error(`атлас: не удалось загрузить изображение "${url}"`))
        image.src = url
    })
}

export async function loadAtlas(jsonUrl: string | URL): Promise<SpriteAtlas> {
    const response = await fetch(jsonUrl)
    if (!response.ok) fail(`атлас: не удалось загрузить ${jsonUrl}: HTTP ${response.status}`)
    const atlas = parseAtlas(await response.json())
    const imageUrl = `${String(jsonUrl).replace(/[^/]*$/, '')}${atlas.meta.image}`
    const image = await loadImage(imageUrl)
    return { ...atlas, image }
}
