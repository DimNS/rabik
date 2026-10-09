import { describe, expect, test } from 'bun:test'
import type { CellType, LevelData } from '../core/level-types.ts'
import { parseLevel } from '../data/levels-loader.ts'
import { solveLevel } from './solver.ts'

const LEVEL_URL = new URL('../../public/data/levels/001.json', import.meta.url)

function isOrthogonalStep(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
}

describe('solver', () => {
    test('уровень 001 решается с покрытием всей soil', async () => {
        const level = parseLevel(await Bun.file(LEVEL_URL).json())
        const route = solveLevel(level)
        expect(route).not.toBeNull()
        if (!route) return

        const soilCount = level.grid.flat().filter((c) => c === 'soil').length
        expect(route).toHaveLength(soilCount + 1)
        expect(route[0]).toEqual(level.start)
        const seen = new Set([`${level.start.x},${level.start.y}`])
        for (let i = 1; i < route.length; i++) {
            const prev = route[i - 1]
            const cur = route[i]
            if (!prev || !cur) throw new Error('пустой шаг маршрута')
            expect(isOrthogonalStep(prev, cur)).toBe(true)
            expect(level.grid[cur.y]?.[cur.x]).toBe('soil')
            const key = `${cur.x},${cur.y}`
            expect(seen.has(key)).toBe(false)
            seen.add(key)
        }
        expect(seen.size).toBe(soilCount + 1)
    })

    test('заведомо тупиковый уровень признаётся нерешаемым', () => {
        const grid: CellType[][] = [
            ['road', 'soil'],
            ['soil', 'wall'],
        ]
        const level: LevelData = {
            id: 'dead-end',
            width: 2,
            height: 2,
            tiles: [
                ['r101', 's101'],
                ['s101', 'w101'],
            ],
            grid,
            start: { x: 0, y: 0 },
        }
        expect(solveLevel(level, { maxAttempts: 1000, timeLimitMs: 500 })).toBeNull()
    })

    test('старт без соседней soil при ненулевой soil — нерешаем', () => {
        const grid: CellType[][] = [
            ['road', 'wall'],
            ['wall', 'soil'],
        ]
        const level: LevelData = {
            id: 'isolated',
            width: 2,
            height: 2,
            tiles: [
                ['r101', 'w101'],
                ['w101', 's101'],
            ],
            grid,
            start: { x: 0, y: 0 },
        }
        expect(solveLevel(level)).toBeNull()
    })
})
