import type { LevelData, Vec2 } from '../core/level-types.ts'
import { createRng, type Rng, randomSeed } from './rng.ts'
import { solveLevel } from './solver.ts'

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface GenerateOptions {
    difficulty: Difficulty
    seed?: string
    id?: string
}

// Базы жмутся к максимуму 8×15; cover — доля soil (длина маршрута).
export const DIFFICULTY_PRESETS: Record<Difficulty, { w: number; h: number; cover: number }> = {
    easy: { w: 7, h: 12, cover: 0.35 },
    normal: { w: 8, h: 13, cover: 0.5 },
    hard: { w: 8, h: 15, cover: 0.6 },
}

export const MAX_WIDTH = 8
export const MAX_HEIGHT = 15

const STEPS: readonly Vec2[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
]

function shuffled<T>(items: T[], rng: Rng): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        const a = out[i]
        const b = out[j]
        if (a === undefined || b === undefined) continue
        out[i] = b
        out[j] = a
    }
    return out
}

// Случайный self-avoiding walk от старта длиной target (DFS с бэктрекингом).
function findWalk(width: number, height: number, start: Vec2, target: number, rng: Rng): Vec2[] | null {
    const visited: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false))
    const startRow = visited[start.y]
    if (!startRow) return null
    startRow[start.x] = true
    const path: Vec2[] = [{ ...start }]
    const freeNeighbours = (p: Vec2): Vec2[] => {
        const out: Vec2[] = []
        for (const s of STEPS) {
            const x = p.x + s.x
            const y = p.y + s.y
            if (x < 0 || y < 0 || x >= width || y >= height || visited[y]?.[x]) continue
            out.push({ x, y })
        }
        return shuffled(out, rng)
    }
    const stack: Vec2[][] = [freeNeighbours(start)]
    let iter = 0
    while (stack.length > 0) {
        if (path.length >= target) return path.map((p) => ({ ...p }))
        if (++iter > 50_000) return null
        const top = stack[stack.length - 1]
        if (!top) return null
        const next = top.pop()
        if (!next) {
            stack.pop()
            const left = path.pop()
            if (left) {
                const row = visited[left.y]
                if (row) row[left.x] = false
            }
            continue
        }
        const row = visited[next.y]
        if (!row || row[next.x]) continue
        row[next.x] = true
        path.push(next)
        stack.push(freeNeighbours(next))
    }
    return null
}

function isWall(grid: string[][], x: number, y: number): boolean {
    if (x < 0 || y < 0 || y >= grid.length || x >= (grid[y]?.length ?? 0)) return true
    return grid[y]?.[x] === 'wall'
}

// Полная таблица «маска → кадр» по design.md change hand-drawn-tiles-mapping.
// Группы сверены попиксельно с raw (доля серого по кромкам/углам) и эталоном 001:
// открытые стороны → кромки/углы 3xx, все стороны замкнуты + открытые диагонали → 401–415.
// Внутри группы берётся первый вариант (001 использует только их); 5xx — запас на потом.
const OPEN_SIDE_FRAMES: Record<number, string> = {
    2: 'w307', // открыта S
    8: 'w302', // открыта N
    4: 'w305', // открыта E
    1: 'w304', // открыта W
    10: 'w310', // N+S
    5: 'w313', // E+W
    12: 'w303', // N+E
    6: 'w308', // E+S
    3: 'w306', // S+W
    9: 'w301', // N+W
    11: 'w309', // только E
    14: 'w311', // только W
    13: 'w312', // только S
    7: 'w314', // только N
    15: 'w201', // изолированная
}

// Открытые диагонали при замкнутых сторонах: 401–404 одиночные,
// 405–408 пары по сторонам света, 409–412 тройки, 413 все, 414/415 диагональные пары.
const OPEN_DIAG_FRAMES: Record<number, string> = {
    0: 'w101',
    8: 'w401', // NW
    1: 'w402', // NE
    2: 'w403', // SE
    4: 'w404', // SW
    9: 'w405', // NE+NW
    3: 'w406', // NE+SE
    6: 'w407', // SE+SW
    12: 'w408', // SW+NW
    7: 'w409', // без NW
    14: 'w410', // без NE
    13: 'w411', // без SE
    11: 'w412', // без SW
    15: 'w413',
    10: 'w414', // SE+NW
    5: 'w415', // NE+SW
}

export function pickWallFrame(grid: string[][], x: number, y: number): string {
    const n = isWall(grid, x, y - 1)
    const e = isWall(grid, x + 1, y)
    const s = isWall(grid, x, y + 1)
    const w = isWall(grid, x - 1, y)
    if (n && e && s && w) {
        const key =
            (!isWall(grid, x + 1, y - 1) ? 1 : 0) |
            (!isWall(grid, x + 1, y + 1) ? 2 : 0) |
            (!isWall(grid, x - 1, y + 1) ? 4 : 0) |
            (!isWall(grid, x - 1, y - 1) ? 8 : 0)
        const frame = OPEN_DIAG_FRAMES[key]
        if (frame === undefined) throw new Error(`pickWallFrame: нет кадра под диагонали ${key}`)
        return frame
    }
    const key = (!n ? 8 : 0) | (!e ? 4 : 0) | (!s ? 2 : 0) | (!w ? 1 : 0)
    const frame = OPEN_SIDE_FRAMES[key]
    if (frame === undefined) throw new Error(`pickWallFrame: нет кадра под маску ${key}`)
    return frame
}

// Кроп пустых wall-полей: bbox маршрута + рамка в 1 клетку под стыки кадров.
function cropWalls(grid: string[][], start: Vec2): { grid: string[][]; start: Vec2; width: number; height: number } {
    const w = grid[0]?.length ?? 0
    let minX = w
    let minY = grid.length
    let maxX = 0
    let maxY = 0
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
            if (grid[y]?.[x] === 'wall') continue
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
        }
    }
    const x0 = Math.max(0, minX - 1)
    const y0 = Math.max(0, minY - 1)
    const x1 = Math.min(w - 1, maxX + 1)
    const y1 = Math.min(grid.length - 1, maxY + 1)
    return {
        grid: grid.slice(y0, y1 + 1).map((row) => row.slice(x0, x1 + 1)),
        start: { x: start.x - x0, y: start.y - y0 },
        width: x1 - x0 + 1,
        height: y1 - y0 + 1,
    }
}

export function generateLevel(options: GenerateOptions): LevelData {
    const { difficulty, seed } = options
    const preset = DIFFICULTY_PRESETS[difficulty]
    if (!preset) throw new Error(`неизвестная сложность "${difficulty}"`)
    const effectiveSeed = seed ?? randomSeed()
    const rng = createRng(effectiveSeed)
    const id = options.id ?? `gen-${difficulty}-${effectiveSeed}`

    for (let attempt = 0; attempt < 10; attempt++) {
        const jitter = () => Math.floor(rng() * 3) - 1
        let width = Math.min(MAX_WIDTH, Math.max(5, preset.w + jitter()))
        let height = Math.min(MAX_HEIGHT, Math.max(5, preset.h + jitter()))
        let start: Vec2 = { x: Math.floor(rng() * width), y: Math.floor(rng() * height) }
        const target = Math.min(width * height - 1, Math.max(4, Math.round(width * height * preset.cover)))

        const walk = findWalk(width, height, start, target + 1, rng)
        if (!walk || walk.length < 2) continue

        const grid: string[][] = Array.from({ length: height }, () => Array<string>(width).fill('wall'))
        for (const p of walk) {
            const row = grid[p.y]
            if (row) row[p.x] = 'soil'
        }
        const sRow = grid[start.y]
        if (sRow) sRow[start.x] = 'road'

        // Выкидываем пустые wall-поля, оставляя рамку в 1 клетку.
        const cropped = cropWalls(grid, start)
        const cgrid = cropped.grid
        start = cropped.start
        width = cropped.width
        height = cropped.height

        // Пары s301/s302 целыми горизонтальными блоками на soil.
        const pairRight = new Set<string>()
        for (let y = 0; y < height; y++) {
            for (let x = 0; x + 1 < width; x++) {
                if (cgrid[y]?.[x] !== 'soil' || cgrid[y]?.[x + 1] !== 'soil') continue
                if (pairRight.has(`${x - 1},${y}`)) continue
                if (rng() < 0.18) {
                    pairRight.add(`${x},${y}`)
                }
            }
        }

        const tiles: string[][] = []
        for (let y = 0; y < height; y++) {
            const row: string[] = []
            for (let x = 0; x < width; x++) {
                const cell = cgrid[y]?.[x]
                if (cell === 'road') {
                    row.push('r101')
                } else if (cell === 'soil') {
                    if (pairRight.has(`${x},${y}`)) row.push('s301')
                    else if (pairRight.has(`${x - 1},${y}`)) row.push('s302')
                    else {
                        const h = ((x * 73856093) ^ (y * 19349663) ^ (x * y * 83492791)) >>> 0
                        const r = h % 10
                        row.push(r < 7 ? 's101' : r < 9 ? 's102' : 's103')
                    }
                } else {
                    row.push(pickWallFrame(cgrid, x, y))
                }
            }
            tiles.push(row)
        }

        const level: LevelData = {
            id,
            width,
            height,
            tiles,
            grid: cgrid as LevelData['grid'],
            start: { ...start },
            seed: effectiveSeed,
        }
        // Гарантия проходимости: кандидат без решения отбрасывается.
        if (solveLevel(level)) return level
    }
    throw new Error(`не удалось сгенерировать уровень "${difficulty}" за 10 попыток`)
}
