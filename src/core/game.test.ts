import { describe, expect, test } from 'bun:test'
import { canMove, type Dir, tryMove } from './game-rules.ts'
import { createEmptyState, createGameState, type GameState } from './game-state.ts'
import type { CellType, LevelData, Vec2 } from './level-types.ts'

const LEVEL_URL = new URL('../../public/data/levels/level-001.json', import.meta.url)

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

async function loadTestLevel(): Promise<LevelData> {
    return (await Bun.file(LEVEL_URL).json()) as LevelData
}

function cellAt(grid: CellType[][], { x, y }: Vec2): CellType | undefined {
    return grid[y]?.[x]
}

function dirBetween(from: Vec2, to: Vec2): Dir {
    if (to.y < from.y) return 'up'
    if (to.y > from.y) return 'down'
    if (to.x < from.x) return 'left'
    return 'right'
}

function countSoilIn(grid: CellType[][]): number {
    return grid.flat().filter((cell) => cell === 'soil').length
}

function snakeRoute(state: GameState): Dir[] {
    const dirs: Dir[] = []
    let { x, y } = state.player
    const lastRow = state.height - 2
    let right = true
    for (let row = y; row <= lastRow; row++) {
        while (x !== (right ? state.width - 2 : 1)) {
            dirs.push(right ? 'right' : 'left')
            x += right ? 1 : -1
        }
        if (row === lastRow) break
        dirs.push('down')
        y++
        right = !right
    }
    return dirs
}

function firstNeighbourSoil(state: GameState, from: Vec2): Vec2 {
    for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ] as const) {
        const cell = { x: from.x + dx, y: from.y + dy }
        if (cellAt(state.grid, cell) === 'soil') return cell
    }
    throw new Error('у стартовой клетки нет соседней soil')
}

describe('game-state', () => {
    test('createEmptyState пуст и не решён', () => {
        expect(createEmptyState()).toEqual({
            grid: [],
            width: 0,
            height: 0,
            player: { x: 0, y: 0 },
            soilCount: 0,
            solved: false,
        })
    })

    test('createGameState берёт размеры, старт и счётчик из уровня', async () => {
        const level = await loadTestLevel()
        const state = createGameState(level)

        expect(state.width).toBe(level.width)
        expect(state.height).toBe(level.height)
        expect(state.player).toEqual(level.start)
        expect(state.soilCount).toBe(countSoilIn(level.tiles))
        expect(state.solved).toBe(false)
        expect(cellAt(state.grid, state.player)).toBe('road')
    })

    test('createGameState не разделяет сетку с уровнем', async () => {
        const level = await loadTestLevel()
        const state = createGameState(level)
        const row = state.grid[1]
        if (row) row[1] = 'soil'
        expect(cellAt(level.tiles, { x: 1, y: 1 })).toBe('road')
    })
})

describe('tryMove', () => {
    test('ход на soil проходит и асфальтирует входящую клетку', async () => {
        const state = createGameState(await loadTestLevel())
        const from = { ...state.player }
        const target = firstNeighbourSoil(state, from)

        expect(canMove(state, dirBetween(from, target))).not.toBeNull()
        expect(tryMove(state, dirBetween(from, target))).toBe(true)
        expect(state.player).toEqual(target)
        expect(cellAt(state.grid, target)).toBe('road')
        expect(cellAt(state.grid, from)).toBe('road')
        expect(state.soilCount).toBe(countSoilIn(state.grid))
    })

    test('отказ на wall, на road, за границей и на неизвестном направлении ничего не меняет', async () => {
        const state = createGameState(await loadTestLevel())
        const start = { ...state.player }
        const before = { ...state, grid: state.grid.map((row) => [...row]) }

        expect(canMove(state, 'up')).toBeNull()
        expect(canMove(state, 'left')).toBeNull()

        for (const dir of ['up', 'left'] as Dir[]) {
            expect(tryMove(state, dir)).toBe(false)
        }
        expect(tryMove(state, dirBetween(start, { x: 0, y: 0 }))).toBe(false)
        expect(tryMove(state, 'diagonal' as Dir)).toBe(false)

        expect(state.player).toEqual(before.player)
        expect(state.grid).toEqual(before.grid)
        expect(state.soilCount).toBe(before.soilCount)
        expect(state.solved).toBe(false)
    })

    test('на асфальт ходить нельзя', async () => {
        const state = createGameState(await loadTestLevel())
        const start = { ...state.player }
        expect(tryMove(state, 'right')).toBe(true)
        expect(cellAt(state.grid, start)).toBe('road')
        expect(tryMove(state, 'left')).toBe(false)
        expect(state.player).not.toEqual(start)
    })
})

describe('маршрут и инварианты', () => {
    test('под игроком всегда road, возврат на свой асфальт и на старт отклоняется', async () => {
        const level = await loadTestLevel()
        const state = createGameState(level)
        const start = { ...level.start }
        const soilBefore = state.soilCount

        let steps = 0
        for (const dir of snakeRoute(state)) {
            const before = { ...state.player }
            expect(tryMove(state, dir)).toBe(true)
            steps++

            expect(cellAt(state.grid, state.player)).toBe('road')
            expect(tryMove(state, OPPOSITE[dir])).toBe(false)
            expect(state.player).not.toEqual(before)
            expect(tryMove(state, dirBetween(state.player, start))).toBe(false)
        }

        expect(steps).toBe(soilBefore)
        expect(state.solved).toBe(true)
        expect(state.soilCount).toBe(0)
        expect(state.player).not.toEqual(start)
    })

    test('пока осталась soil — solved не меняется, на последнем ходе победа', async () => {
        const state = createGameState(await loadTestLevel())
        const route = snakeRoute(state)

        for (const [i, dir] of route.entries()) {
            expect(tryMove(state, dir)).toBe(true)
            if (i === route.length - 1) {
                expect(state.soilCount).toBe(0)
                expect(state.solved).toBe(true)
            } else {
                expect(state.soilCount).toBeGreaterThan(0)
                expect(state.solved).toBe(false)
            }
        }
    })
})
