import { countSoil } from './grid-utils.ts'
import type { CellType, LevelData, Vec2 } from './level-types.ts'

export interface GameState {
    grid: CellType[][]
    frames: string[][]
    width: number
    height: number
    player: Vec2
    soilCount: number
    solved: boolean
    stuck: boolean
}

export function createEmptyState(): GameState {
    return {
        grid: [],
        frames: [],
        width: 0,
        height: 0,
        player: { x: 0, y: 0 },
        soilCount: 0,
        solved: false,
        stuck: false,
    }
}

export function createGameState(level: LevelData): GameState {
    return {
        grid: level.grid.map((row) => [...row]),
        frames: level.tiles.map((row) => [...row]),
        width: level.width,
        height: level.height,
        player: { ...level.start },
        soilCount: countSoil(level.grid),
        solved: false,
        stuck: false,
    }
}
