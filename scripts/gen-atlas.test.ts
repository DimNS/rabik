import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodeJpg, encodeJpg } from './atlas-codec.ts'

const TILE = 130
const GEN_ATLAS = new URL('./gen-atlas.ts', import.meta.url).pathname

const tmpRoots: string[] = []
afterEach(() => {
    while (tmpRoots.length > 0) rmSync(tmpRoots.pop() as string, { recursive: true, force: true })
})

function solidJpg(r: number, g: number, b: number, w = TILE, h = TILE): Uint8Array {
    const rgba = new Uint8Array(w * h * 4)
    for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = r
        rgba[i * 4 + 1] = g
        rgba[i * 4 + 2] = b
        rgba[i * 4 + 3] = 255
    }
    return encodeJpg(w, h, rgba, 85)
}

function makeRaw(structure: Record<string, Array<[string, Uint8Array]>>): string {
    const root = mkdtempSync(join(tmpdir(), 'gen-atlas-'))
    tmpRoots.push(root)
    const rawDir = join(root, 'raw')
    for (const [type, files] of Object.entries(structure)) {
        mkdirSync(join(rawDir, type), { recursive: true })
        for (const [name, bytes] of files) writeFileSync(join(rawDir, type, name), bytes)
    }
    return rawDir
}

function runGenAtlas(rawDir: string, outDir: string): number {
    const result = Bun.spawnSync(['bun', GEN_ATLAS, '--raw-dir', rawDir, '--out-dir', outDir], {
        stdout: 'pipe',
        stderr: 'pipe',
    })
    return result.exitCode ?? 1
}

function centerPixel(jpg: Uint8Array, imgW: number, fx: number, fy: number): [number, number, number] {
    const { data } = decodeJpg(jpg, 'tiles.jpg')
    const cx = fx + TILE / 2
    const cy = fy + TILE / 2
    const i = (cy * imgW + cx) * 4
    return [data[i] ?? -1, data[i + 1] ?? -1, data[i + 2] ?? -1]
}

function near(actual: [number, number, number], expected: [number, number, number], tol = 40): boolean {
    return actual.every((v, i) => Math.abs(v - (expected[i] ?? 0)) <= tol)
}

describe('gen-atlas: мульти-вариантная сборка', () => {
    test('фикстура 2+1+3: порядок по именам, алиасы, размеры JPG', async () => {
        const rawDir = makeRaw({
            wall: [
                ['b.jpg', solidJpg(30, 200, 30)],
                ['a.jpg', solidJpg(200, 30, 30)],
            ],
            soil: [['m.jpg', solidJpg(30, 30, 200)]],
            road: [
                ['z.jpg', solidJpg(30, 200, 200)],
                ['c.jpg', solidJpg(200, 30, 200)],
                ['a.jpg', solidJpg(200, 200, 30)],
            ],
        })
        // Посторонние файлы с не-.jpg расширениями игнорируются.
        writeFileSync(join(rawDir, 'wall', 'notes.txt'), 'not an image')
        writeFileSync(join(rawDir, 'soil', 'draft.png'), 'not an image')
        const outDir = join(tmpRoots[0] as string, 'out')

        expect(runGenAtlas(rawDir, outDir)).toBe(0)

        const json = (await Bun.file(join(outDir, 'tiles.json')).json()) as {
            frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>
            meta: { image: string; size: { w: number; h: number } }
        }
        expect(json.meta.image).toBe('tiles.jpg')
        expect(json.meta.size).toEqual({ w: 3 * TILE, h: 3 * TILE })
        for (const [name, x, y] of [
            ['wall_0', 0, 0],
            ['wall_1', TILE, 0],
            ['soil_0', 0, TILE],
            ['road_0', 0, 2 * TILE],
            ['road_1', TILE, 2 * TILE],
            ['road_2', 2 * TILE, 2 * TILE],
        ] as const) {
            expect(json.frames[name]?.frame).toEqual({ x, y, w: TILE, h: TILE })
        }
        expect(json.frames.wall).toEqual(json.frames.wall_0)
        expect(json.frames.soil).toEqual(json.frames.soil_0)
        expect(json.frames.road).toEqual(json.frames.road_0)
        expect(Object.keys(json.frames)).toHaveLength(9)

        // Порядок — по имени файла: wall_0 — a.jpg (красный), wall_1 — b.jpg (зелёный).
        const imgBytes = new Uint8Array(await Bun.file(join(outDir, 'tiles.jpg')).arrayBuffer())
        const decoded = decodeJpg(imgBytes, 'tiles.jpg')
        expect(decoded.w).toBe(3 * TILE)
        expect(decoded.h).toBe(3 * TILE)
        expect(near(centerPixel(imgBytes, decoded.w, 0, 0), [200, 30, 30])).toBe(true)
        expect(near(centerPixel(imgBytes, decoded.w, TILE, 0), [30, 200, 30])).toBe(true)
        expect(near(centerPixel(imgBytes, decoded.w, 0, TILE), [30, 30, 200])).toBe(true)
        expect(near(centerPixel(imgBytes, decoded.w, 0, 2 * TILE), [200, 200, 30])).toBe(true)
    })

    test('все папки пусты — ошибка без записи', () => {
        const root = mkdtempSync(join(tmpdir(), 'gen-atlas-empty-'))
        tmpRoots.push(root)
        const rawDir = join(root, 'raw')
        mkdirSync(join(rawDir, 'wall'), { recursive: true })
        const outDir = join(root, 'out')
        expect(runGenAtlas(rawDir, outDir)).not.toBe(0)
        expect(existsSync(join(outDir, 'tiles.jpg'))).toBe(false)
        expect(existsSync(join(outDir, 'tiles.json'))).toBe(false)
    })

    test('неверный размер входа — ошибка без записи', () => {
        const rawDir = makeRaw({ wall: [['0.jpg', solidJpg(200, 30, 30, 64, 64)]] })
        const outDir = join(tmpRoots[0] as string, 'out')
        expect(runGenAtlas(rawDir, outDir)).not.toBe(0)
        expect(existsSync(join(outDir, 'tiles.jpg'))).toBe(false)
        expect(existsSync(join(outDir, 'tiles.json'))).toBe(false)
    })
})
