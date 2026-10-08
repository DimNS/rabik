import { describe, expect, test } from 'bun:test'
import { createRng, hashSeed, mulberry32, randomSeed } from './rng.ts'

describe('rng', () => {
    test('одинаковый seed даёт одинаковую последовательность', () => {
        const a = createRng('level-seed')
        const b = createRng('level-seed')
        expect(Array.from({ length: 10 }, () => a())).toEqual(Array.from({ length: 10 }, () => b()))
    })

    test('разные seed дают разные последовательности', () => {
        const a = createRng('one')
        const b = createRng('two')
        const seqA = Array.from({ length: 10 }, () => a())
        const seqB = Array.from({ length: 10 }, () => b())
        expect(seqA).not.toEqual(seqB)
    })

    test('значения в диапазоне [0, 1)', () => {
        const rng = mulberry32(hashSeed('range'))
        for (let i = 0; i < 100; i++) {
            const v = rng()
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })

    test('без seed запуск не падает и даёт числа', () => {
        const rng = createRng()
        for (let i = 0; i < 10; i++) {
            const v = rng()
            expect(typeof v).toBe('number')
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })

    test('randomSeed даёт hex-строку, пригодную для повторной генерации', () => {
        const s = randomSeed()
        expect(s).toMatch(/^[0-9a-f]{1,8}$/)
        const a = createRng(s)
        const b = createRng(s)
        expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()))
    })
})
