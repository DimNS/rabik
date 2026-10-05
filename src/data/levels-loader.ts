import {
    CELL_TYPES,
    type CellType,
    type LevelData,
    type LevelManifest,
    type LevelManifestItem,
} from '../core/level-types.ts'

export const LEVELS_INDEX = 'public/data/levels/index.json'

function fail(message: string): never {
    throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCellType(value: unknown): value is CellType {
    return CELL_TYPES.some((type) => type === value)
}

export function parseLevel(data: unknown): LevelData {
    if (!isRecord(data)) fail('уровень: данные должны быть объектом')

    const { id, width, height, tiles, start } = data
    if (typeof id !== 'string' || id === '') fail('уровень: id должен быть непустой строкой')
    if (typeof width !== 'number' || !Number.isInteger(width) || width <= 0) {
        fail(`уровень "${id}": width должен быть положительным целым числом`)
    }
    if (typeof height !== 'number' || !Number.isInteger(height) || height <= 0) {
        fail(`уровень "${id}": height должен быть положительным целым числом`)
    }
    if (!Array.isArray(tiles)) fail(`уровень "${id}": tiles должен быть массивом строк клеток`)
    if (tiles.length !== height) {
        fail(`уровень "${id}": высота массива клеток (${tiles.length}) не совпадает с height (${height})`)
    }

    const grid: CellType[][] = []
    for (const [y, row] of tiles.entries()) {
        if (!Array.isArray(row)) fail(`уровень "${id}": строка ${y} должна быть массивом клеток`)
        if (row.length !== width) {
            fail(`уровень "${id}": длина строки ${y} (${row.length}) не совпадает с width (${width})`)
        }
        const cells: CellType[] = []
        for (const cell of row) {
            if (!isCellType(cell)) fail(`уровень "${id}": неизвестный тип клетки "${String(cell)}" в строке ${y}`)
            cells.push(cell)
        }
        grid.push(cells)
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

    return { id, width, height, tiles: grid, start: { x, y } }
}

export function parseManifest(data: unknown): LevelManifest {
    if (!isRecord(data)) fail('манифест: данные должны быть объектом')

    const { levels } = data
    if (!Array.isArray(levels)) fail('манифест: поле levels должно быть массивом')

    const entries: LevelManifestItem[] = []
    for (const [i, item] of levels.entries()) {
        const place = `манифест: запись №${i + 1}`
        if (!isRecord(item)) fail(`${place} должна быть объектом`)
        const { id, file, name } = item
        if (typeof id !== 'string' || id === '') fail(`${place}: id должен быть непустой строкой`)
        if (typeof file !== 'string' || file === '') fail(`${place} (${id}): file должен быть непустой строкой`)
        if (typeof name !== 'string' || name === '') fail(`${place} (${id}): name должен быть непустой строкой`)
        entries.push({ id, file, name })
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

export async function loadLevel(
    file: string,
    expectedId: string,
    manifestUrl: string | URL = LEVELS_INDEX,
): Promise<LevelData> {
    const url = `${String(manifestUrl).replace(/[^/]*$/, '')}${file}`
    const level = parseLevel(await fetchJson(url))
    if (level.id !== expectedId) {
        fail(`расхождение идентификаторов: манифест — "${expectedId}", файл "${file}" содержит "${level.id}"`)
    }
    return level
}
