import { describe, expect, test } from 'bun:test'
import type { CellType } from '../core/level-types.ts'
import { facingAngle, pickVariant, pickWallVariant, variantFrame, wallNeighborMask } from './renderer.ts'

describe('pickVariant', () => {
    test('детерминирован: те же аргументы — тот же вариант', () => {
        expect(pickVariant(2, 3, 42, 8)).toBe(pickVariant(2, 3, 42, 8))
    })

    test('count=1 всегда даёт 0', () => {
        for (const [x, y, seed] of [
            [0, 0, 0],
            [3, 5, 99],
            [6, 6, 3838523700],
        ] as const) {
            expect(pickVariant(x, y, seed, 1)).toBe(0)
        }
    })

    test('результат всегда в диапазоне [0, count)', () => {
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                for (const seed of [0, 1, 42, 3838523700]) {
                    const variant = pickVariant(x, y, seed, 8)
                    expect(variant).toBeGreaterThanOrEqual(0)
                    expect(variant).toBeLessThan(8)
                }
            }
        }
    })

    test('разные seed дают разную раскладку', () => {
        const a: number[] = []
        const b: number[] = []
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                a.push(pickVariant(x, y, 1, 8))
                b.push(pickVariant(x, y, 2, 8))
            }
        }
        expect(a).not.toEqual(b)
    })
})

describe('facingAngle', () => {
    test('вверх — без поворота, остальные — на 90°', () => {
        expect(facingAngle('up')).toBe(0)
        expect(facingAngle('right')).toBe(Math.PI / 2)
        expect(facingAngle('down')).toBe(Math.PI)
        expect(facingAngle('left')).toBe(-Math.PI / 2)
    })
})

describe('pickWallVariant', () => {
    test('детерминирован: те же аргументы — тот же вариант', () => {
        expect(pickWallVariant(2, 3, 42, 8)).toBe(pickWallVariant(2, 3, 42, 8))
    })

    test('count=1 всегда даёт 0, count<=0 бросает как pickVariant', () => {
        expect(pickWallVariant(0, 0, 0, 1)).toBe(0)
        expect(() => pickWallVariant(0, 0, 0, 0)).toThrow()
    })

    test('результат всегда в диапазоне [0, count)', () => {
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                for (const seed of [0, 1, 42]) {
                    const variant = pickWallVariant(x, y, seed, 8)
                    expect(variant).toBeGreaterThanOrEqual(0)
                    expect(variant).toBeLessThan(8)
                }
            }
        }
    })

    test('клетки одного блока 2×2 всегда совпадают', () => {
        for (const seed of [0, 1, 42]) {
            for (const count of [2, 4, 8]) {
                for (let bx = -1; bx < 4; bx++) {
                    for (let by = -1; by < 4; by++) {
                        const expected = pickWallVariant(bx * 2, by * 2, seed, count)
                        expect(pickWallVariant(bx * 2 + 1, by * 2, seed, count)).toBe(expected)
                        expect(pickWallVariant(bx * 2, by * 2 + 1, seed, count)).toBe(expected)
                        expect(pickWallVariant(bx * 2 + 1, by * 2 + 1, seed, count)).toBe(expected)
                    }
                }
            }
        }
    })

    test('окно из 4 подряд не даёт 4 разных одиночных: есть пара соседей', () => {
        for (const seed of [0, 1, 42, 99]) {
            for (const count of [2, 3, 8]) {
                for (let i = -2; i < 6; i++) {
                    const row = [0, 1, 2, 3].map((d) => pickWallVariant(i + d, 0, seed, count))
                    expect(row.some((v, k) => k > 0 && v === row[k - 1])).toBe(true)
                    const col = [0, 1, 2, 3].map((d) => pickWallVariant(0, i + d, seed, count))
                    expect(col.some((v, k) => k > 0 && v === col[k - 1])).toBe(true)
                }
            }
        }
    })

    test('разные seed дают разную раскладку', () => {
        const a: number[] = []
        const b: number[] = []
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                a.push(pickWallVariant(x, y, 1, 8))
                b.push(pickWallVariant(x, y, 2, 8))
            }
        }
        expect(a).not.toEqual(b)
    })
})

describe('variantFrame', () => {
    test('count=0 возвращает базовое имя типа', () => {
        expect(variantFrame('soil', 3, 5, 42, 0)).toBe('soil')
        expect(variantFrame('wall', 3, 5, 42, 0)).toBe('wall')
    })

    test('soil/road совпадают с pickVariant, wall — с pickWallVariant', () => {
        for (const [x, y, seed, count] of [
            [0, 0, 7, 3],
            [4, 2, 99, 12],
            [6, 6, 1, 2],
        ] as const) {
            expect(variantFrame('soil', x, y, seed, count)).toBe(`soil_${pickVariant(x, y, seed, count)}`)
            expect(variantFrame('road', x, y, seed, count)).toBe(`road_${pickVariant(x, y, seed, count)}`)
            expect(variantFrame('wall', x, y, seed, count)).toBe(`wall_${pickWallVariant(x, y, seed, count)}`)
        }
    })
})

describe('wallNeighborMask', () => {
    const W: CellType = 'wall'
    const S: CellType = 'soil'

    test('центр массива 3×3 — все биты, одиночка — ноль', () => {
        const full = [
            [W, W, W],
            [W, W, W],
            [W, W, W],
        ]
        expect(wallNeighborMask(full, 1, 1)).toBe(15)
        expect(wallNeighborMask([[W]], 0, 0)).toBe(0)
    })

    test('угол карты: только внутренние соседи', () => {
        const grid = [
            [W, W],
            [W, W],
        ]
        expect(wallNeighborMask(grid, 0, 0)).toBe(2 | 4)
    })

    test('сосед soil/road считается внешней границей', () => {
        const grid = [
            [W, S, W],
            [S, W, S],
            [W, S, W],
        ]
        expect(wallNeighborMask(grid, 1, 1)).toBe(0)
    })
})

describe('wall rendering consistency', () => {
    const W: CellType = 'wall'
    const S: CellType = 'soil'

    test('вариант и стыки — чистая функция (x, y, seed, grid): повтор совпадает', () => {
        const grid = [
            [W, W, S],
            [W, W, W],
            [S, W, W],
        ]
        for (const [x, y] of [
            [0, 0],
            [1, 1],
            [2, 1],
        ] as const) {
            expect(pickWallVariant(x, y, 42, 4)).toBe(pickWallVariant(x, y, 42, 4))
            expect(wallNeighborMask(grid, x, y)).toBe(wallNeighborMask(grid, x, y))
        }
    })

    test('дальняя клетка не влияет на локальные вариант и стыки (O(1))', () => {
        const grid: CellType[][] = [
            [W, W, S, W],
            [W, W, S, W],
            [S, S, S, S],
        ]
        const before = [pickWallVariant(0, 0, 7, 4), wallNeighborMask(grid, 0, 0)]
        grid[0] = [W, W, S, S]
        expect([pickWallVariant(0, 0, 7, 4), wallNeighborMask(grid, 0, 0)]).toEqual(before)
    })
})
