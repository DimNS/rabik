import { describe, expect, test } from 'bun:test'
import { parseLevel } from '../data/levels-loader.ts'
import { canMove, type Dir, isStuck, tryMove } from './game-rules.ts'
import { createEmptyState, createGameState, type GameState } from './game-state.ts'
import type { CellType, LevelData, Vec2 } from './level-types.ts'

const LEVEL_URL = new URL('../../public/data/levels/level-001.json', import.meta.url)

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

async function loadTestLevel(): Promise<LevelData> {
    return parseLevel(await Bun.file(LEVEL_URL).json())
}

function cellAt(grid: CellType[][], { x, y }: Vec2): CellType | undefined {
    return grid[y]?.[x]
}

function frameAt(frames: string[][], { x, y }: Vec2): string | undefined {
    return frames[y]?.[x]
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

// Маршрут под level-001 (лабиринт): вдоль верхней строки, вниз по правому
// столбцу, по низу налево, вверх по левому столбцу и в тупичок (3,3).
// Каждый шаг — на soil, конец — победа (solved приоритетнее stuck).
function labyrinthRoute(): Dir[] {
    return [
        'right',
        'right',
        'right',
        'right',
        'down',
        'down',
        'down',
        'down',
        'left',
        'left',
        'left',
        'left',
        'up',
        'up',
        'right',
        'right',
    ]
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
            frames: [],
            width: 0,
            height: 0,
            player: { x: 0, y: 0 },
            soilCount: 0,
            solved: false,
            stuck: false,
        })
    })

    test('createGameState берёт размеры, старт и счётчик из уровня', async () => {
        const level = await loadTestLevel()
        const state = createGameState(level)

        expect(state.width).toBe(level.width)
        expect(state.height).toBe(level.height)
        expect(state.player).toEqual(level.start)
        expect(state.soilCount).toBe(countSoilIn(level.grid))
        expect(state.solved).toBe(false)
        expect(cellAt(state.grid, state.player)).toBe('road')
    })

    test('createGameState копирует кадры уровня', async () => {
        const level = await loadTestLevel()
        const state = createGameState(level)

        expect(state.frames).toEqual(level.tiles)
        expect(frameAt(state.frames, state.player)).toBe('r101')
    })

    test('createGameState не разделяет сетки с уровнем', async () => {
        const level = await loadTestLevel()
        const state = createGameState(level)
        const row = state.grid[1]
        if (row) row[1] = 'soil'
        const frameRow = state.frames[1]
        if (frameRow) frameRow[1] = 's101'
        expect(cellAt(level.grid, { x: 1, y: 1 })).toBe('road')
        expect(frameAt(level.tiles, { x: 1, y: 1 })).toBe('r101')
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
        expect(frameAt(state.frames, target)).toBe('r101')
        expect(state.soilCount).toBe(countSoilIn(state.grid))
    })

    test('ход на s201 закрывает люк кадром r102', () => {
        const level: LevelData = {
            id: 'hatch',
            width: 3,
            height: 1,
            tiles: [['r101', 's201', 's101']],
            grid: [['road', 'soil', 'soil']],
            start: { x: 0, y: 0 },
        }
        const state = createGameState(level)

        expect(tryMove(state, 'right')).toBe(true)
        expect(cellAt(state.grid, { x: 1, y: 0 })).toBe('road')
        expect(frameAt(state.frames, { x: 1, y: 0 })).toBe('r102')
        expect(state.soilCount).toBe(1)
        expect(state.solved).toBe(false)
    })

    test('отказ на wall, на road, за границей и на неизвестном направлении ничего не меняет', async () => {
        const state = createGameState(await loadTestLevel())
        const start = { ...state.player }
        const before = {
            ...state,
            grid: state.grid.map((row) => [...row]),
            frames: state.frames.map((row) => [...row]),
        }

        expect(canMove(state, 'up')).toBeNull()
        expect(canMove(state, 'left')).toBeNull()

        for (const dir of ['up', 'left'] as Dir[]) {
            expect(tryMove(state, dir)).toBe(false)
        }
        expect(tryMove(state, dirBetween(start, { x: 0, y: 0 }))).toBe(false)
        expect(tryMove(state, 'diagonal' as Dir)).toBe(false)

        expect(state.player).toEqual(before.player)
        expect(state.grid).toEqual(before.grid)
        expect(state.frames).toEqual(before.frames)
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

describe('тупик (game over)', () => {
    const DEFAULT_FRAME: Record<CellType, string> = { wall: 'w101', soil: 's101', road: 'r101' }

    function makeState(grid: CellType[][], player: Vec2, frames?: string[][]): GameState {
        return {
            grid: grid.map((row) => [...row]),
            frames: frames?.map((row) => [...row]) ?? grid.map((row) => row.map((cell) => DEFAULT_FRAME[cell])),
            width: grid[0]?.length ?? 0,
            height: grid.length,
            player: { ...player },
            soilCount: grid.flat().filter((cell) => cell === 'soil').length,
            solved: false,
            stuck: false,
        }
    }

    test('шаг в клетку без соседней soil при оставшейся soil — тупик', () => {
        const state = makeState(
            [
                ['road', 'soil', 'wall'],
                ['soil', 'wall', 'wall'],
            ],
            { x: 0, y: 0 },
        )
        expect(tryMove(state, 'right')).toBe(true)
        expect(state.solved).toBe(false)
        expect(state.stuck).toBe(true)
        expect(isStuck(state)).toBe(true)
    })

    test('последний ход даёт победу, а не тупик', () => {
        const state = makeState([['road', 'soil']], { x: 0, y: 0 })
        expect(tryMove(state, 'right')).toBe(true)
        expect(state.solved).toBe(true)
        expect(state.stuck).toBe(false)
    })

    test('есть соседняя soil — тупика нет', () => {
        const state = makeState([['road', 'soil', 'soil']], { x: 0, y: 0 })
        expect(tryMove(state, 'right')).toBe(true)
        expect(state.solved).toBe(false)
        expect(state.stuck).toBe(false)
    })

    test('неуспешный ход флаг тупика не выставляет', () => {
        const state = makeState(
            [
                ['road', 'wall'],
                ['soil', 'wall'],
            ],
            { x: 0, y: 0 },
        )
        expect(tryMove(state, 'right')).toBe(false)
        expect(state.stuck).toBe(false)
    })
})

describe('маршрут и инварианты', () => {
    test('под игроком всегда road, возврат на свой асфальт и на старт отклоняется', async () => {
        const level = await loadTestLevel()
        const state = createGameState(level)
        const start = { ...level.start }
        const soilBefore = state.soilCount

        let steps = 0
        for (const dir of labyrinthRoute()) {
            const before = { ...state.player }
            expect(tryMove(state, dir)).toBe(true)
            steps++

            expect(cellAt(state.grid, state.player)).toBe('road')
            expect(tryMove(state, OPPOSITE[dir])).toBe(false)
            expect(state.player).not.toEqual(before)
        }

        expect(steps).toBe(soilBefore)
        expect(state.solved).toBe(true)
        expect(state.soilCount).toBe(0)
        expect(state.player).not.toEqual(start)
    })

    test('пока осталась soil — solved не меняется, на последнем ходе победа', async () => {
        const state = createGameState(await loadTestLevel())
        const route = labyrinthRoute()

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
