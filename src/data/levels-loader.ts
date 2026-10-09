import {
    type CellType,
    frameType,
    type LevelData,
    type LevelManifest,
    type LevelManifestItem,
} from '../core/level-types.ts'

export const LEVELS_INDEX = 'public/data/levels/index.json'
export const FRAME_PATTERN = /^[wsr]\d+$/

function fail(message: string): never {
    throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseLevel(data: unknown): LevelData {
    if (!isRecord(data)) fail('уровень: данные должны быть объектом')

    const { id, width, height, tiles, start, tileSeed } = data
    if (typeof id !== 'string' || id === '') fail('уровень: id должен быть непустой строкой')
    if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) {
        fail(`уровень "${id}": width должен быть положительным целым числом`)
    }
    if (typeof height !== 'number' || !Number.isInteger(height) || height <= 0) {
        fail(`уровень "${id}": height должен быть положительным целым числом`)
    }
    if (!Array.isArray(tiles)) fail(`уровень "${id}": tiles должен быть массивом кадров`)
    if (tiles.length !== height) {
        fail(`уровень "${id}": высота массива клеток (${tiles.length}) не совпадает с height (${height})`)
    }

    const frames: string[][] = []
    const grid: CellType[][] = []
    for (const [y, row] of tiles.entries()) {
        if (!Array.isArray(row)) fail(`уровень "${id}": строка ${y} должна быть массивом клеток`)
        if (row.length !== width) {
            fail(`уровень "${id}": длина строки ${y} (${row.length}) не совпадает с width (${width})`)
        }
        const frameRow: string[] = []
        const typeRow: CellType[] = []
        for (const cell of row) {
            const type = typeof cell === 'string' && FRAME_PATTERN.test(cell) ? frameType(cell) : undefined
            if (type === undefined) fail(`уровень "${id}": неизвестный кадр "${String(cell)}" в строке ${y}`)
            frameRow.push(cell as string)
            typeRow.push(type)
        }
        frames.push(frameRow)
        grid.push(typeRow)
    }

    // Пара s301+s302 — неделимый горизонтальный блок строго в этом порядке.
    for (const [y, row] of frames.entries()) {
        for (const [x, frame] of row.entries()) {
            if (frame === 's301' && row[x + 1] !== 's302') {
                fail(`уровень "${id}": кадр "s301" (${x}, ${y}) должен стоять слева от "s302"`)
            }
            if (frame === 's302' && row[x - 1] !== 's301') {
                fail(`уровень "${id}": кадр "s302" (${x}, ${y}) должен стоять справа от "s301"`)
            }
        }
    }

    if (start === undefined) fail(`уровень "${id}": не объявлена стартовая позиция`)
    if (!isRecord(start)) fail(`уровень "${id}": стартовая позиция должна быть объектом { x, y }`)
    const { x, y } = start
    if (typeof x !== 'number' || !Number.isInteger(x) || typeof y !== 'number' || !Number.isInteger(y)) {
        fail(`уровень "${id}": стартовая позиция должна содержать целые числа x и y`)
    }
    if (x < 0 || y < 0 || x >= width || y >= height) {
        fail(`уровень "${id}": стартовая позиция (${x}, ${y}) вне сетки ${width}x${height}`)
    }
    if (grid[y]?.[x] !== 'road') {
        fail(`уровень "${id}": стартовая клетка (${x}, ${y}) должна иметь тип road`)
    }

    if (tileSeed !== undefined) {
        fail(`уровень "${id}": поле tileSeed запрещено — раскладка кадров статична`)
    }

    return { id, width, height, tiles: frames, grid, start: { x, y } }
}

export interface ManifestDuplicate {
    kind: 'id' | 'seed'
    value: string
    /** Вхождения в порядке файла: номер записи (с 1) и id. */
    entries: { index: number; id: string }[]
}

// Все дубликаты id и seed списком (порядок — по первому повтору в файле).
// Не бросает: для отчёта целиком; битые записи пропускаются.
export function findManifestDuplicates(items: readonly unknown[]): ManifestDuplicate[] {
    const ids = new Map<string, { index: number; id: string }[]>()
    const seeds = new Map<string, { index: number; id: string }[]>()
    items.forEach((item, i) => {
        if (!isRecord(item)) return
        const { id, seed } = item
        if (typeof id !== 'string' || id === '') return
        const at = { index: i + 1, id }
        ids.set(id, [...(ids.get(id) ?? []), at])
        if (typeof seed === 'string' && seed !== '' && seed !== '---') {
            seeds.set(seed, [...(seeds.get(seed) ?? []), at])
        }
    })
    const out: ManifestDuplicate[] = []
    for (const [value, at] of ids) if (at.length > 1) out.push({ kind: 'id', value, entries: at })
    for (const [value, at] of seeds) if (at.length > 1) out.push({ kind: 'seed', value, entries: at })
    out.sort((a, b) => (a.entries[1]?.index ?? 0) - (b.entries[1]?.index ?? 0))
    return out
}

export function parseManifest(data: unknown): LevelManifest {
    if (!isRecord(data)) fail('манифест: данные должны быть объектом')

    const { levels } = data
    if (!Array.isArray(levels)) fail('манифест: поле levels должно быть массивом')

    const entries: LevelManifestItem[] = []
    for (const [i, item] of levels.entries()) {
        const place = `манифест: запись №${i + 1}`
        if (!isRecord(item)) fail(`${place} должна быть объектом`)
        const { id, seed, difficulty } = item
        if (typeof id !== 'string' || id === '') fail(`${place}: id должен быть непустой строкой`)
        if (seed !== undefined && (typeof seed !== 'string' || seed === '')) {
            fail(`${place} (${id}): seed должен быть непустой строкой`)
        }
        if (difficulty !== undefined && difficulty !== 'easy' && difficulty !== 'normal' && difficulty !== 'hard') {
            fail(`${place} (${id}): difficulty должен быть easy, normal или hard`)
        }
        entries.push({
            id,
            ...(seed === undefined ? {} : { seed }),
            ...(difficulty === undefined ? {} : { difficulty }),
        })
    }
    for (const dup of findManifestDuplicates(entries)) {
        const first = dup.entries[0]
        const second = dup.entries[1]
        if (first === undefined || second === undefined) continue
        if (dup.kind === 'id') fail(`манифест: запись №${second.index} (${second.id}): дублирующийся id`)
        fail(
            `манифест: запись №${second.index} (${second.id}): дублирующийся seed "${dup.value}" (уже у "${first.id}")`,
        )
    }
    return { levels: entries }
}

async function fetchJson(url: string | URL): Promise<unknown> {
    const response = await fetch(url)
    if (!response.ok) fail(`не удалось загрузить ${url}: HTTP ${response.status}`)
    return response.json()
}

export async function loadManifest(url: string | URL = LEVELS_INDEX): Promise<LevelManifest> {
    return parseManifest(await fetchJson(url))
}

export async function loadLevel(id: string, manifestUrl: string | URL = LEVELS_INDEX): Promise<LevelData> {
    const file = `${id}.json`
    const url = `${String(manifestUrl).replace(/[^/]*$/, '')}${file}`
    const level = parseLevel(await fetchJson(url))
    if (level.id !== id) {
        fail(`расхождение идентификаторов: манифест — "${id}", файл "${file}" содержит "${level.id}"`)
    }
    return level
}
