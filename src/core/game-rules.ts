import type { GameState } from './game-state.ts'
import type { Vec2 } from './level-types.ts'

export type Dir = 'up' | 'down' | 'left' | 'right'

const STEP: Record<Dir, Vec2> = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
}

export function canMove(state: GameState, dir: Dir): Vec2 | null {
    const step = STEP[dir]
    if (!step) return null
    const x = state.player.x + step.x
    const y = state.player.y + step.y
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null
    return state.grid[y]?.[x] === 'soil' ? { x, y } : null
}

const DIRS: Dir[] = ['up', 'down', 'left', 'right']

export function isStuck(state: GameState): boolean {
    return DIRS.every((dir) => canMove(state, dir) === null)
}

export function tryMove(state: GameState, dir: Dir): boolean {
    const next = canMove(state, dir)
    if (!next) return false
    const row = state.grid[next.y]
    if (!row) return false
    row[next.x] = 'road'
    state.player = next
    state.soilCount--
    if (state.soilCount === 0) state.solved = true
    else state.stuck = isStuck(state)
    return true
}
