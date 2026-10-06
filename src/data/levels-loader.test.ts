import { afterEach, describe, expect, test } from 'bun:test'
import { hashLevelId, LEVELS_INDEX, loadLevel, loadManifest, parseLevel, parseManifest } from './levels-loader.ts'

const REAL_LEVEL_URL = new URL('../../public/data/levels/level-001.json', import.meta.url)
const REAL_MANIFEST_URL = new URL('../../public/data/levels/index.json', import.meta.url)

interface LevelJson {
    id?: string
    width: number
    height: number
    tiles: string[][]
    start?: { x: number; y: number }
}

function validLevel(): LevelJson {
    return {
        id: 't1',
        width: 3,
        height: 3,
        tiles: [
            ['wall', 'wall', 'wall'],
            ['wall', 'road', 'soil'],
            ['wall', 'soil', 'soil'],
        ],
        start: { x: 1, y: 1 },
    }
}

describe('parseLevel', () => {
    test('принимает реальный уровень level-001.json', async () => {
        const level = parseLevel(await Bun.file(REAL_LEVEL_URL).json())
        expect(level.id).toBe('001')
        expect(level.width).toBe(7)
        expect(level.height).toBe(7)
        expect(level.start).toEqual({ x: 1, y: 1 })
        expect(level.tiles.length).toBe(7)
        expect(level.tiles.every((row) => row.length === 7)).toBe(true)
        expect(level.tiles[1]?.[1]).toBe('road')
    })

    test('отклоняет не-объект', () => {
        for (const bad of [null, 'level', 42, ['x']]) {
            expect(() => parseLevel(bad)).toThrow(/объектом/)
        }
    })

    test('отклоняет отсутствующий, пустой и нестрочный id', () => {
        const level = validLevel()
        delete level.id
        expect(() => parseLevel(level)).toThrow(/id/)
        expect(() => parseLevel({ ...validLevel(), id: '' })).toThrow(/id/)
        expect(() => parseLevel({ ...validLevel(), id: 7 })).toThrow(/id/)
    })

    test('отклоняет неположительные и нецелые размеры', () => {
        expect(() => parseLevel({ ...validLevel(), width: 0 })).toThrow(/width/)
        expect(() => parseLevel({ ...validLevel(), width: 2.5 })).toThrow(/width/)
        expect(() => parseLevel({ ...validLevel(), height: '3' })).toThrow(/height/)
    })

    test('отклоняет высоту массива клеток, не совпадающую с height', () => {
        const level = validLevel()
        level.tiles.pop()
        expect(() => parseLevel(level)).toThrow(/не совпадает с height/)
    })

    test('отклоняет строку клеток, длину которой не совпадает с width', () => {
        expect(() =>
            parseLevel({
                ...validLevel(),
                tiles: [
                    ['wall', 'wall'],
                    ['wall', 'road', 'soil'],
                    ['wall', 'soil', 'soil'],
                ],
            }),
        ).toThrow(/не совпадает с width/)
    })

    test('отклоняет неизвестный тип клетки', () => {
        expect(() =>
            parseLevel({
                ...validLevel(),
                tiles: [
                    ['wall', 'wall', 'wall'],
                    ['wall', 'lava', 'soil'],
                    ['wall', 'soil', 'soil'],
                ],
            }),
        ).toThrow(/неизвестный тип клетки "lava"/)
    })

    test('отклоняет отсутствующую стартовую позицию', () => {
        const level = validLevel()
        delete level.start
        expect(() => parseLevel(level)).toThrow(/не объявлена стартовая позиция/)
    })

    test('отклоняет старт вне сетки и нецелые координаты', () => {
        expect(() => parseLevel({ ...validLevel(), start: { x: 5, y: 1 } })).toThrow(/вне сетки/)
        expect(() => parseLevel({ ...validLevel(), start: { x: -1, y: 0 } })).toThrow(/вне сетки/)
        expect(() => parseLevel({ ...validLevel(), start: { x: 1.5, y: 1 } })).toThrow(/целые числа/)
    })

    test('отклоняет старт не на road', () => {
        expect(() => parseLevel({ ...validLevel(), start: { x: 2, y: 1 } })).toThrow(/должна иметь тип road/)
        expect(() => parseLevel({ ...validLevel(), start: { x: 0, y: 0 } })).toThrow(/должна иметь тип road/)
    })

    test('явный tileSeed принимается', () => {
        expect(parseLevel({ ...validLevel(), tileSeed: 42 }).tileSeed).toBe(42)
        expect(parseLevel({ ...validLevel(), tileSeed: 0 }).tileSeed).toBe(0)
    })

    test('отсутствующий tileSeed выводится как хэш id', () => {
        expect(parseLevel(validLevel()).tileSeed).toBe(hashLevelId('t1'))
        expect(parseLevel({ ...validLevel(), id: 'other' }).tileSeed).toBe(hashLevelId('other'))
        expect(parseLevel(validLevel()).tileSeed).not.toBe(parseLevel({ ...validLevel(), id: 'other' }).tileSeed)
    })

    test('отклоняет нецелый, отрицательный и нечисловой tileSeed', () => {
        expect(() => parseLevel({ ...validLevel(), tileSeed: -1 })).toThrow(/tileSeed/)
        expect(() => parseLevel({ ...validLevel(), tileSeed: 4.5 })).toThrow(/tileSeed/)
        expect(() => parseLevel({ ...validLevel(), tileSeed: '42' })).toThrow(/tileSeed/)
    })
})

describe('parseManifest', () => {
    test('принимает реальный index.json', async () => {
        const manifest = parseManifest(await Bun.file(REAL_MANIFEST_URL).json())
        expect(manifest.levels).toEqual([{ id: '001', file: 'level-001.json', name: 'Пробный участок' }])
    })

    test('отклоняет отсутствующий levels и неполные записи', () => {
        expect(() => parseManifest(null)).toThrow(/манифест/)
        expect(() => parseManifest({})).toThrow(/levels/)
        expect(() => parseManifest({ levels: ['x'] })).toThrow(/объектом/)
        expect(() => parseManifest({ levels: [{}] })).toThrow(/id/)
        expect(() => parseManifest({ levels: [{ id: 'a' }] })).toThrow(/file/)
        expect(() => parseManifest({ levels: [{ id: 'a', file: 'f' }] })).toThrow(/name/)
    })
})

const realFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = realFetch
})

function stubFetch(routes: Record<string, unknown>): string[] {
    const calls: string[] = []
    globalThis.fetch = ((input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        const data = routes[url]
        if (data === undefined) return Promise.reject(new Error(`неожиданный запрос: ${url}`))
        return Promise.resolve(new Response(JSON.stringify(data)))
    }) as typeof fetch
    return calls
}

describe('loadManifest', () => {
    test('загружает index.json и парсит записи', async () => {
        const calls = stubFetch({ [LEVELS_INDEX]: await Bun.file(REAL_MANIFEST_URL).json() })
        const manifest = await loadManifest()
        expect(calls).toEqual([LEVELS_INDEX])
        expect(manifest.levels[0]?.id).toBe('001')
    })

    test('HTTP-ошибка загрузки — throw с причиной', async () => {
        globalThis.fetch = ((_input: RequestInfo | URL) =>
            Promise.resolve(new Response('', { status: 404 }))) as typeof fetch
        await expect(loadManifest()).rejects.toThrow(/HTTP 404/)
    })
})

describe('loadLevel', () => {
    test('путь к уровню строится относительно index.json', async () => {
        const calls = stubFetch({ 'public/data/levels/level-001.json': await Bun.file(REAL_LEVEL_URL).json() })
        const level = await loadLevel('level-001.json', '001')
        expect(calls).toEqual(['public/data/levels/level-001.json'])
        expect(level.id).toBe('001')
        expect(level.width).toBe(7)
    })

    test('путь считается от абсолютного адреса манифеста', async () => {
        const calls = stubFetch({ 'http://host/data/level-001.json': await Bun.file(REAL_LEVEL_URL).json() })
        await loadLevel('level-001.json', '001', 'http://host/data/index.json')
        expect(calls).toEqual(['http://host/data/level-001.json'])
    })

    test('несовпадающий id записи манифеста и файла уровня — ошибка о расхождении', async () => {
        const file = { ...(await Bun.file(REAL_LEVEL_URL).json()), id: '002' }
        stubFetch({ 'public/data/levels/level-001.json': file })
        await expect(loadLevel('level-001.json', '001')).rejects.toThrow(/расхождение.*"001".*"002"/)
    })
})
