import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { decodeJpg, decodePng, encodeJpg, encodePng, type RgbaImage } from './atlas-codec.ts'

interface AtlasFrame {
    frame: { x: number; y: number; w: number; h: number }
    duration?: number
}

interface Atlas {
    frames: Record<string, AtlasFrame>
    meta: { image: string; size: { w: number; h: number } }
}

const TILE = 130
const TILE_NAMES = ['wall', 'soil', 'road'] as const
const STRIP_FILE = 'rabbit-strip.png'
const STRIP_W = 1170
const STRIP_H = 130
const RABBIT_FRAMES = 9

function fail(message: string): never {
    console.error(`gen-atlas: ${message}`)
    process.exit(1)
}

// Копирует прямоугольник из src в dest построчно.
function blit(
    src: RgbaImage,
    sx: number,
    sy: number,
    w: number,
    h: number,
    dest: Uint8Array,
    destW: number,
    dx: number,
    dy: number,
): void {
    for (let y = 0; y < h; y++) {
        const si = ((sy + y) * src.w + sx) * 4
        const di = ((dy + y) * destW + dx) * 4
        dest.set(src.data.subarray(si, si + w * 4), di)
    }
}

function join(dir: string, name: string): string {
    return `${dir.replace(/\/+$/, '')}/${name}`
}

function argValue(name: string): string | undefined {
    const index = Bun.argv.indexOf(name)
    if (index < 0) return undefined
    const value = Bun.argv[index + 1]
    if (value === undefined || value.startsWith('--')) fail(`флаг ${name} требует значения`)
    return value
}

async function loadFile(path: string): Promise<Uint8Array | undefined> {
    const file = Bun.file(path)
    if (!(await file.exists())) return undefined
    return new Uint8Array(await file.arrayBuffer())
}

interface Output {
    fileName: string
    jsonName: string
    bytes: Uint8Array
    json: Atlas
}

function decodeInput(bytes: Uint8Array, label: string): RgbaImage {
    try {
        return label.endsWith('.png') ? decodePng(bytes, label) : decodeJpg(bytes, label)
    } catch (error) {
        fail(error instanceof Error ? error.message.replace(/^png: /, `${label}: `) : String(error))
    }
}

const rawDir = argValue('--raw-dir') ?? new URL('../public/assets/raw/', import.meta.url).pathname
const outDir = argValue('--out-dir') ?? new URL('../public/assets/sprites/', import.meta.url).pathname
const frameDuration = Number(argValue('--frame-duration') ?? '120')
if (!Number.isFinite(frameDuration) || frameDuration <= 0) fail('--frame-duration должен быть положительным числом')
const jpgQuality = Number(argValue('--jpg-quality') ?? '85')
if (!Number.isFinite(jpgQuality) || jpgQuality < 1 || jpgQuality > 100) fail('--jpg-quality должен быть числом 1..100')
const combinedName = argValue('--combined')

// --- Fail-fast: сначала всё читаем, декодируем и проверяем, писать начинаем только после.
// Входы плиток — папки вариантов: raw/wall/*.jpg, raw/soil/*.jpg, raw/road/*.jpg.
// Только `.jpg`, сортировка по имени; посторонние файлы игнорируются.
function listVariantNames(dir: string): string[] {
    let entries: string[]
    try {
        entries = readdirSync(dir)
    } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return []
        fail(`не удалось прочитать ${dir}: ${error instanceof Error ? error.message : String(error)}`)
    }
    return entries.filter((name) => name.endsWith('.jpg')).sort()
}

const variantNames = TILE_NAMES.map((name) => listVariantNames(join(rawDir, name)))
const variantBytes = await Promise.all(
    variantNames.map((names, t) => {
        const typeDir = join(rawDir, TILE_NAMES[t] ?? '')
        return Promise.all(names.map((name) => loadFile(join(typeDir, name))))
    }),
)
const stripBytes = await loadFile(join(rawDir, STRIP_FILE))
const variantCount = variantNames.reduce((n, names) => n + names.length, 0)
const haveTiles = variantCount > 0
if (!haveTiles && stripBytes === undefined)
    fail(`в ${rawDir} нет входов: нужны варианты wall/*.jpg, soil/*.jpg, road/*.jpg и/или ${STRIP_FILE}`)

let variants: RgbaImage[][] | undefined
if (haveTiles) {
    variants = variantBytes.map((files, t) => {
        const type = TILE_NAMES[t] ?? 'tile'
        const names = variantNames[t] ?? []
        return (files ?? []).map((bytes, i) => {
            const name = names[i] ?? `${i}.jpg`
            if (bytes === undefined) fail(`${type}/${name}: не удалось прочитать файл`)
            const image = decodeInput(bytes, `${type}/${name}`)
            if (image.w !== TILE || image.h !== TILE) {
                fail(`${type}/${name}: ожидается ${TILE}x${TILE}, получено ${image.w}x${image.h}`)
            }
            return image
        })
    })
}

let strip: RgbaImage | undefined
if (stripBytes !== undefined) {
    const image = decodeInput(stripBytes, STRIP_FILE)
    if (image.w !== STRIP_W || image.h !== STRIP_H) {
        fail(`${STRIP_FILE}: ожидается ${STRIP_W}x${STRIP_H}, получено ${image.w}x${image.h}`)
    }
    strip = image
}

// --- Сборка выходов в памяти (ничего ещё не записано).
const outputs: Output[] = []
if (combinedName !== undefined) {
    if (!combinedName.endsWith('.json')) fail('--combined ждёт имя JSON, например atlas.json')
    if (variants === undefined || strip === undefined) {
        fail('--combined требует оба набора входов: хотя бы один вариант каждого типа и стрип')
    }
    const first = TILE_NAMES.map((name, t) => {
        const tile = variants[t]?.[0]
        if (!tile) fail(`--combined: нет вариантов типа ${name} — нужен хотя бы один`)
        return tile
    })
    const pngW = STRIP_W
    const pngH = TILE + STRIP_H
    const data = new Uint8Array(pngW * pngH * 4) // прозрачный фон, плитки непрозрачные (альфа 255 из JPEG)
    first.forEach((tile, i) => {
        blit(tile, 0, 0, TILE, TILE, data, pngW, i * TILE, 0)
    })
    blit(strip, 0, 0, STRIP_W, STRIP_H, data, pngW, 0, TILE)
    const frames: Record<string, AtlasFrame> = {}
    TILE_NAMES.forEach((name, i) => {
        frames[name] = { frame: { x: i * TILE, y: 0, w: TILE, h: TILE } }
    })
    for (let i = 0; i < RABBIT_FRAMES; i++) {
        frames[`rabbit_${i}`] = { frame: { x: i * TILE, y: TILE, w: TILE, h: TILE }, duration: frameDuration }
    }
    const pngName = combinedName.replace(/\.json$/, '.png')
    outputs.push({
        fileName: pngName,
        jsonName: combinedName,
        bytes: encodePng(pngW, pngH, data, true),
        json: { frames, meta: { image: pngName, size: { w: pngW, h: pngH } } },
    })
} else {
    if (variants !== undefined) {
        // Три ряда (ряд на тип), ширина по максимуму вариантов.
        // Имя кадра — буква типа + имя файла без расширения: wall/307.jpg → w307.
        const maxCount = Math.max(...variants.map((list) => list.length))
        const pngW = maxCount * TILE
        const pngH = TILE * TILE_NAMES.length
        const data = new Uint8Array(pngW * pngH * 4)
        const frames: Record<string, AtlasFrame> = {}
        TILE_NAMES.forEach((name, t) => {
            const list = variants[t] ?? []
            const names = variantNames[t] ?? []
            list.forEach((tile, i) => {
                const base = (names[i] ?? `${i}.jpg`).replace(/\.jpg$/, '')
                const frameName = `${name[0]}${base}`
                frames[frameName] = { frame: { x: i * TILE, y: t * TILE, w: TILE, h: TILE } }
                blit(tile, 0, 0, TILE, TILE, data, pngW, i * TILE, t * TILE)
            })
        })
        outputs.push({
            fileName: 'tiles.jpg',
            jsonName: 'tiles.json',
            bytes: encodeJpg(pngW, pngH, data, jpgQuality),
            json: { frames, meta: { image: 'tiles.jpg', size: { w: pngW, h: pngH } } },
        })
    }
    if (strip !== undefined) {
        const frames: Record<string, AtlasFrame> = {}
        for (let i = 0; i < RABBIT_FRAMES; i++) {
            frames[`rabbit_${i}`] = { frame: { x: i * TILE, y: 0, w: TILE, h: TILE }, duration: frameDuration }
        }
        outputs.push({
            fileName: 'rabbit.png',
            jsonName: 'rabbit.json',
            bytes: encodePng(STRIP_W, STRIP_H, strip.data, true),
            json: { frames, meta: { image: 'rabbit.png', size: { w: STRIP_W, h: STRIP_H } } },
        })
    }
}

// --- Только теперь пишем: при любой ошибке выше не записан ни один файл.
mkdirSync(outDir, { recursive: true })
for (const out of outputs) {
    await Bun.write(join(outDir, out.fileName), out.bytes)
    await Bun.write(join(outDir, out.jsonName), `${JSON.stringify(out.json, null, 4)}\n`)
    console.log(
        `${out.fileName}: ${out.json.meta.size.w}x${out.json.meta.size.h}, кадров ${Object.keys(out.json.frames).length}`,
    )
}
if (outputs.some((out) => out.fileName === 'tiles.jpg')) {
    rmSync(join(outDir, 'tiles.png'), { force: true })
}
