import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decodeJpg } from './atlas-codec.ts'

const TILE = 130
const GEN = new URL('./gen-tile-variants.ts', import.meta.url).pathname

const tmpRoots: string[] = []
afterEach(() => {
    while (tmpRoots.length > 0) rmSync(tmpRoots.pop() as string, { recursive: true, force: true })
})

function runGen(outDir: string, recipes: string, seeds: string): number {
    const result = Bun.spawnSync(['bun', GEN, '--out-dir', outDir, '--recipes', recipes, '--seeds', seeds], {
        stdout: 'pipe',
        stderr: 'pipe',
    })
    return result.exitCode ?? 1
}

async function loadJpg(path: string): Promise<Uint8Array> {
    return decodeJpg(new Uint8Array(await Bun.file(path).arrayBuffer()), path).data
}

// Шов «вариант A слева, вариант B справа»: край A против края B.
function crossSeam(a: Uint8Array, b: Uint8Array): number {
    let sum = 0
    let n = 0
    for (let y = 0; y < TILE; y++) {
        for (let c = 0; c < 3; c++) {
            sum += Math.abs((a[(y * TILE + TILE - 1) * 4 + c] ?? 0) - (b[(y * TILE + 0) * 4 + c] ?? 0))
            n++
        }
    }
    return sum / n
}

// Разброс внутри: центр двух вариантов обязан различаться (вариативность жива).
function centerSpread(a: Uint8Array, b: Uint8Array): number {
    let sum = 0
    let n = 0
    for (let y = 50; y < 80; y++) {
        for (let x = 50; x < 80; x++) {
            for (let c = 0; c < 3; c++) {
                sum += Math.abs((a[(y * TILE + x) * 4 + c] ?? 0) - (b[(y * TILE + x) * 4 + c] ?? 0))
                n++
            }
        }
    }
    return sum / n
}

describe('gen-tile-variants: общая кромка рецепта', () => {
    test('варианты одного рецепта сшиваются краями, центр различается', async () => {
        const outDir = mkdtempSync(join(tmpdir(), 'gen-variants-rim-'))
        tmpRoots.push(outDir)
        expect(runGen(outDir, 'grass1,grass2,grass3,grass4,earth,asphalt', '7,8')).toBe(0)
        for (const [type, recipe] of [
            ['wall', 'grass1'],
            ['wall', 'grass2'],
            ['wall', 'grass3'],
            ['wall', 'grass4'],
            ['soil', 'earth'],
            ['road', 'asphalt'],
        ] as const) {
            const a = await loadJpg(join(outDir, type, `${recipe}-7.jpg`))
            const b = await loadJpg(join(outDir, type, `${recipe}-8.jpg`))
            const seam = crossSeam(a, b)
            const spread = centerSpread(a, b)
            expect(seam).toBeLessThan(12)
            expect(spread).toBeGreaterThan(seam)
        }
    })

    test('травы grass1..grass4 сильно различаются между собой', async () => {
        const outDir = mkdtempSync(join(tmpdir(), 'gen-variants-diff-'))
        tmpRoots.push(outDir)
        expect(runGen(outDir, 'grass1,grass2,grass3,grass4', '1')).toBe(0)
        const imgs = []
        for (const recipe of ['grass1', 'grass2', 'grass3', 'grass4']) {
            imgs.push(await loadJpg(join(outDir, 'wall', `${recipe}-1.jpg`)))
        }
        for (let i = 0; i < imgs.length; i++) {
            for (let j = i + 1; j < imgs.length; j++) {
                expect(centerSpread(imgs[i] as Uint8Array, imgs[j] as Uint8Array)).toBeGreaterThan(15)
            }
        }
    })

    test('тот же seed даёт попиксельно идентичный файл', async () => {
        const first = mkdtempSync(join(tmpdir(), 'gen-variants-det-a-'))
        const second = mkdtempSync(join(tmpdir(), 'gen-variants-det-b-'))
        tmpRoots.push(first, second)
        expect(runGen(first, 'grass1,earth', '5')).toBe(0)
        expect(runGen(second, 'grass1,earth', '5')).toBe(0)
        for (const file of ['wall/grass1-5.jpg', 'soil/earth-5.jpg']) {
            const a = new Uint8Array(await Bun.file(join(first, file)).arrayBuffer())
            const b = new Uint8Array(await Bun.file(join(second, file)).arrayBuffer())
            expect(a).toEqual(b)
        }
    })
})
