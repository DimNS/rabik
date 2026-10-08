import type { CellType, LevelData, Vec2 } from '../core/level-types.ts'

export interface SolveOptions {
    maxAttempts?: number
    timeLimitMs?: number
}

const DEFAULT_MAX_ATTEMPTS = 500_000
const DEFAULT_TIME_LIMIT_MS = 2000

const STEPS: readonly Vec2[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
]

// DFS по soil-соседям по правилам game-rules: ход только на соседнюю soil,
// входящая клетка асфальтируется (повторно не посещается). Победа — вся soil покрыта.
export function solveLevel(level: LevelData, options?: SolveOptions): Vec2[] | null {
    const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
    const timeLimitMs = options?.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS
    const { grid, width, height, start } = level

    let remaining = 0
    for (const row of grid) for (const cell of row) if (cell === 'soil') remaining++
    if (remaining === 0) return [{ ...start }]

    const visited: boolean[][] = grid.map((row) => row.map(() => false))
    const startRow = visited[start.y]
    if (!startRow) return null
    startRow[start.x] = true

    const path: Vec2[] = [{ ...start }]
    const stack: Vec2[][] = [soilNeighbours(grid, visited, width, height, start, remaining)]
    let attempts = 0
    const deadline = Date.now() + timeLimitMs

    while (stack.length > 0) {
        attempts++
        if (attempts > maxAttempts) return null
        if (attempts % 1000 === 0 && Date.now() > deadline) return null

        const top = stack[stack.length - 1]
        if (!top) return null
        const next = top.pop()
        if (!next) {
            stack.pop()
            const left = path.pop()
            if (left) {
                const row = visited[left.y]
                if (row) row[left.x] = false
                remaining++
            }
            continue
        }
        const row = visited[next.y]
        if (!row || row[next.x]) continue
        row[next.x] = true
        path.push(next)
        remaining--
        if (remaining === 0) return path.map((p) => ({ ...p }))
        stack.push(soilNeighbours(grid, visited, width, height, next, remaining))
    }
    return null
}

function soilNeighbours(
    grid: CellType[][],
    visited: boolean[][],
    width: number,
    height: number,
    from: Vec2,
    remaining: number,
): Vec2[] {
    const out: Vec2[] = []
    for (const step of STEPS) {
        const x = from.x + step.x
        const y = from.y + step.y
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        if (grid[y]?.[x] !== 'soil' || visited[y]?.[x]) continue
        out.push({ x, y })
    }
    // Эвристика Варнсдорфа: сначала ходы с меньшим числом выходов.
    // Стек берёт с конца, поэтому сортируем по убыванию.
    if (out.length > 1 && remaining > 1) {
        const degree = (p: Vec2): number => {
            let n = 0
            for (const step of STEPS) {
                const x = p.x + step.x
                const y = p.y + step.y
                if (x < 0 || y < 0 || x >= width || y >= height) continue
                if (grid[y]?.[x] === 'soil' && !visited[y]?.[x]) n++
            }
            return n
        }
        out.sort((a, b) => degree(b) - degree(a))
    }
    return out
}
