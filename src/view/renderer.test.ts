import { describe, expect, test } from 'bun:test'
import { facingAngle, pickVariant } from './renderer.ts'

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
