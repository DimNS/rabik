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

// Тот же шов по вертикали: низ A против верха B.
function crossSeamV(a: Uint8Array, b: Uint8Array): number {
    let sum = 0
    let n = 0
    for (let x = 0; x < TILE; x++) {
        for (let c = 0; c < 3; c++) {
            sum += Math.abs((a[((TILE - 1) * TILE + x) * 4 + c] ?? 0) - (b[x * 4 + c] ?? 0))
            n++
        }
    }
    return sum / n
}

// Средний цвет зоны: full — весь тайл, rim — только рамка 12px (чистый фон).
function meanZone(img: Uint8Array, rimOnly: boolean): [number, number, number] {
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            if (rimOnly && Math.min(x, y, TILE - 1 - x, TILE - 1 - y) >= 12) continue
            r += img[(y * TILE + x) * 4] ?? 0
            g += img[(y * TILE + x) * 4 + 1] ?? 0
            b += img[(y * TILE + x) * 4 + 2] ?? 0
            n++
        }
    }
    return [r / n, g / n, b / n]
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

// Пиксели, сильно отклоняющиеся от среднего (камни/объекты: тень+тело+блик).
function strongCount(img: Uint8Array, mean: [number, number, number], rimOnly: boolean): number {
    let n = 0
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const d = Math.min(x, y, TILE - 1 - x, TILE - 1 - y)
            if (rimOnly ? d >= 12 : d < 12) continue
            const dev =
                Math.abs((img[(y * TILE + x) * 4] ?? 0) - mean[0]) +
                Math.abs((img[(y * TILE + x) * 4 + 1] ?? 0) - mean[1]) +
                Math.abs((img[(y * TILE + x) * 4 + 2] ?? 0) - mean[2])
            if (dev > 90) n++
        }
    }
    return n
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
            const seamV = crossSeamV(a, b)
            const spread = centerSpread(a, b)
            expect(seam).toBeLessThan(12)
            expect(seamV).toBeLessThan(12)
            expect(spread).toBeGreaterThan(seam)
        }
    })

    test('травы grass1..grass4 на едином зелёном базисе, различаются объектами', async () => {
        const outDir = mkdtempSync(join(tmpdir(), 'gen-variants-base-'))
        tmpRoots.push(outDir)
        expect(runGen(outDir, 'grass1,grass2,grass3,grass4', '7')).toBe(0)
        const imgs = []
        for (const recipe of ['grass1', 'grass2', 'grass3', 'grass4']) {
            imgs.push(await loadJpg(join(outDir, 'wall', `${recipe}-7.jpg`)))
        }
        // Единый базис: рамка (чистый фон) почти идентична, полный средний близок.
        for (let i = 0; i < imgs.length; i++) {
            for (let j = i + 1; j < imgs.length; j++) {
                expect(
                    colorDist(meanZone(imgs[i] as Uint8Array, true), meanZone(imgs[j] as Uint8Array, true)),
                ).toBeLessThan(8)
                expect(
                    colorDist(meanZone(imgs[i] as Uint8Array, false), meanZone(imgs[j] as Uint8Array, false)),
                ).toBeLessThan(20)
            }
        }
        // Объекты в центре дифференцируют: каждая пара различается сильнее порога.
        for (let i = 0; i < imgs.length; i++) {
            for (let j = i + 1; j < imgs.length; j++) {
                expect(centerSpread(imgs[i] as Uint8Array, imgs[j] as Uint8Array)).toBeGreaterThan(15)
            }
        }
    })

    test('камни earth целиком внутри и контрастнее крапа', async () => {
        const outDir = mkdtempSync(join(tmpdir(), 'gen-variants-stones-'))
        tmpRoots.push(outDir)
        expect(runGen(outDir, 'earth', '7,11,23')).toBe(0)
        for (const seed of ['7', '11', '23']) {
            const img = await loadJpg(join(outDir, 'soil', `earth-${seed}.jpg`))
            const mean = meanZone(img, false)
            // Камни в интерьере дают сильные отклонения, рамка чистая.
            expect(strongCount(img, mean, false)).toBeGreaterThan(150)
            expect(strongCount(img, mean, true)).toBeLessThan(40)
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
