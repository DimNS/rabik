import { describe, expect, test } from 'bun:test'
import { parseLevel } from '../data/levels-loader.ts'
import { DIFFICULTY_PRESETS, generateLevel, MAX_HEIGHT, MAX_WIDTH, pickWallFrame } from './generator.ts'
import { solveLevel } from './solver.ts'

function wallRatio(difficulty: 'easy' | 'normal' | 'hard', seed: string): number {
    const level = generateLevel({ difficulty, seed })
    const walls = level.grid.flat().filter((c) => c === 'wall').length
    return walls / (level.width * level.height)
}

describe('generator', () => {
    test('все сложности укладываются в лимит и не больше базы +1 (кроп режет пустые поля)', () => {
        for (const difficulty of ['easy', 'normal', 'hard'] as const) {
            const base = DIFFICULTY_PRESETS[difficulty]
            const started = Date.now()
            const level = generateLevel({ difficulty, seed: `size-${difficulty}` })
            expect(Date.now() - started).toBeLessThan(2000)
            expect(level.width).toBeLessThanOrEqual(MAX_WIDTH)
            expect(level.height).toBeLessThanOrEqual(MAX_HEIGHT)
            expect(level.width).toBeLessThanOrEqual(base.w + 1)
            expect(level.height).toBeLessThanOrEqual(base.h + 1)
            expect(solveLevel(level)).not.toBeNull()
        }
    })

    test('кроп: пустые wall-ряды только по самому краю в 1 клетку', () => {
        for (const difficulty of ['easy', 'normal', 'hard'] as const) {
            for (let i = 0; i < 10; i++) {
                const level = generateLevel({ difficulty, seed: `crop-${difficulty}-${i}` })
                level.grid.forEach((row, y) => {
                    if (y === 0 || y === level.height - 1) return
                    expect(row.some((c) => c !== 'wall')).toBe(true)
                })
                for (let x = 0; x < level.width; x++) {
                    if (x === 0 || x === level.width - 1) continue
                    expect(level.grid.some((row) => row[x] !== 'wall')).toBe(true)
                }
            }
        }
    })

    test('сложность меняет плотность: hard ведёт длиннее easy', () => {
        const easy = generateLevel({ difficulty: 'easy', seed: 'density' })
        const hard = generateLevel({ difficulty: 'hard', seed: 'density' })
        const soil = (d: typeof easy) => d.grid.flat().filter((c) => c === 'soil').length
        expect(soil(hard)).toBeGreaterThan(soil(easy))
        expect(wallRatio('easy', 'density')).not.toBe(wallRatio('hard', 'density'))
    })

    test('вывод проходит parseLevel без ошибок и без tileSeed', () => {
        for (const difficulty of ['easy', 'normal', 'hard'] as const) {
            const level = generateLevel({ difficulty, seed: `parse-${difficulty}` })
            const raw = {
                id: level.id,
                width: level.width,
                height: level.height,
                tiles: level.tiles,
                start: level.start,
            }
            const parsed = parseLevel(raw)
            expect(parsed.grid.flat().filter((c) => c === 'soil').length).toBeGreaterThan(0)
            expect(parsed.grid[parsed.start.y]?.[parsed.start.x]).toBe('road')
            expect('tileSeed' in raw).toBe(false)
        }
    })

    test('повтор с тем же seed даёт идентичный JSON', () => {
        const a = generateLevel({ difficulty: 'normal', seed: 'fixed-seed' })
        const b = generateLevel({ difficulty: 'normal', seed: 'fixed-seed' })
        const raw = (l: typeof a) => ({
            id: l.id,
            width: l.width,
            height: l.height,
            tiles: l.tiles,
            start: l.start,
            seed: l.seed,
        })
        expect(JSON.stringify(raw(b))).toBe(JSON.stringify(raw(a)))
    })

    test('без seed подставляется фактический seed, уровень по нему воспроизводим', () => {
        const a = generateLevel({ difficulty: 'normal' })
        if (a.seed === undefined) throw new Error('seed должен быть подставлен')
        expect(a.id).toContain(a.seed)
        const b = generateLevel({ difficulty: 'normal', seed: a.seed })
        expect(b.id).toBe(a.id)
        expect(b.width).toBe(a.width)
        expect(b.height).toBe(a.height)
        expect(b.tiles).toEqual(a.tiles)
        expect(b.start).toEqual(a.start)
    })

    test('таблица стен воспроизводит эталон 001 из его сетки типов', async () => {
        const raw = await Bun.file(new URL('../../public/data/levels/level-001.json', import.meta.url)).json()
        const level = parseLevel(raw)
        for (let y = 0; y < level.height; y++) {
            for (let x = 0; x < level.width; x++) {
                if (level.grid[y]?.[x] !== 'wall') continue
                const want = level.tiles[y]?.[x]
                if (want === undefined) throw new Error(`нет кадра (${x}, ${y})`)
                expect(pickWallFrame(level.grid, x, y)).toBe(want)
            }
        }
    })
})
