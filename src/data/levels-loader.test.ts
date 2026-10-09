import { afterEach, describe, expect, test } from 'bun:test'
import { LEVELS_INDEX, loadLevel, loadManifest, parseLevel, parseManifest } from './levels-loader.ts'

const REAL_LEVEL_URL = new URL('../../public/data/levels/001.json', import.meta.url)
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
            ['w101', 'w101', 'w101'],
            ['w101', 'r101', 's101'],
            ['w101', 's102', 's201'],
        ],
        start: { x: 1, y: 1 },
    }
}

describe('parseLevel', () => {
    test('принимает реальный уровень 001.json', async () => {
        const level = parseLevel(await Bun.file(REAL_LEVEL_URL).json())
        expect(level.id).toBe('001')
        expect(level.width).toBe(7)
        expect(level.height).toBe(7)
        expect(level.start).toEqual({ x: 1, y: 1 })
        expect(level.tiles.length).toBe(7)
        expect(level.tiles.every((row) => row.length === 7)).toBe(true)
        expect(level.tiles[1]?.[1]).toBe('r101')
        expect(level.grid[1]?.[1]).toBe('road')
        expect(level.tiles[0]?.[0]).toBe('w403')
        // (0,2): стороны замкнуты, открыты диагонали NE+SE — внутренний угол w406, не кромка.
        expect(level.tiles[2]?.[0]).toBe('w406')
        expect(level.grid[2]?.[0]).toBe('wall')
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
                    ['w101', 'w101'],
                    ['w101', 'r101', 's101'],
                    ['w101', 's102', 's201'],
                ],
            }),
        ).toThrow(/не совпадает с width/)
    })

    test('отклоняет неизвестный кадр и старый тип без номера', () => {
        expect(() =>
            parseLevel({
                ...validLevel(),
                tiles: [
                    ['w101', 'w101', 'w101'],
                    ['w101', 'lava', 's101'],
                    ['w101', 's102', 's201'],
                ],
            }),
        ).toThrow(/неизвестный кадр "lava"/)
        for (const old of ['wall', 'soil', 'road', 's999', 'x101']) {
            expect(() =>
                parseLevel({
                    ...validLevel(),
                    tiles: [
                        ['w101', 'w101', 'w101'],
                        ['w101', old, 's101'],
                        ['w101', 's102', 's201'],
                    ],
                }),
            ).toThrow(/неизвестный кадр/)
        }
    })

    test('отклоняет разорванную и перевёрнутую пару s301/s302', () => {
        const lone = validLevel()
        lone.tiles[1] = ['w101', 's301', 's101']
        expect(() => parseLevel(lone)).toThrow(/s301/)
        const reversed = validLevel()
        reversed.tiles[1] = ['w101', 's302', 's301']
        expect(() => parseLevel(reversed)).toThrow(/s302/)
        const single = validLevel()
        single.tiles[1] = ['w101', 's302', 's101']
        expect(() => parseLevel(single)).toThrow(/s302/)
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

    test('поле tileSeed запрещено', () => {
        expect(() => parseLevel({ ...validLevel(), tileSeed: 42 })).toThrow(/tileSeed/)
        expect(() => parseLevel({ ...validLevel(), tileSeed: 0 })).toThrow(/tileSeed/)
    })

    test('без tileSeed seed не вычисляется', () => {
        expect(parseLevel(validLevel())).not.toHaveProperty('tileSeed')
    })
})

describe('parseManifest', () => {
    test('принимает реальный index.json', async () => {
        const manifest = parseManifest(await Bun.file(REAL_MANIFEST_URL).json())
        expect(manifest.levels).toEqual([
            { id: '001', seed: '---' },
            { id: '002', seed: '2e8201e7' },
            { id: '003', seed: '72a1718b' },
            { id: '004', seed: 'ab553aff' },
            { id: '005', seed: 'b78a7f4a' },
        ])
    })

    test('seed необязателен, но обязан быть непустой строкой', () => {
        expect(parseManifest({ levels: [{ id: 'a' }] })).toEqual({ levels: [{ id: 'a' }] })
        expect(() => parseManifest({ levels: [{ id: 'a', seed: '' }] })).toThrow(/seed/)
        expect(() => parseManifest({ levels: [{ id: 'a', seed: 7 }] })).toThrow(/seed/)
    })

    test('отклоняет отсутствующий levels и неполные записи', () => {
        expect(() => parseManifest(null)).toThrow(/манифест/)
        expect(() => parseManifest({})).toThrow(/levels/)
        expect(() => parseManifest({ levels: ['x'] })).toThrow(/объектом/)
        expect(() => parseManifest({ levels: [{}] })).toThrow(/id/)
        expect(() => parseManifest({ levels: [{ id: '' }] })).toThrow(/id/)
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
    test('путь к уровню строится из id: {id}.json относительно index.json', async () => {
        const calls = stubFetch({ 'public/data/levels/001.json': await Bun.file(REAL_LEVEL_URL).json() })
        const level = await loadLevel('001')
        expect(calls).toEqual(['public/data/levels/001.json'])
        expect(level.id).toBe('001')
        expect(level.width).toBe(7)
    })

    test('путь считается от абсолютного адреса манифеста', async () => {
        const calls = stubFetch({ 'http://host/data/001.json': await Bun.file(REAL_LEVEL_URL).json() })
        await loadLevel('001', 'http://host/data/index.json')
        expect(calls).toEqual(['http://host/data/001.json'])
    })

    test('несовпадающий id записи манифеста и файла уровня — ошибка о расхождении', async () => {
        const file = { ...(await Bun.file(REAL_LEVEL_URL).json()), id: '002' }
        stubFetch({ 'public/data/levels/001.json': file })
        await expect(loadLevel('001')).rejects.toThrow(/расхождение.*"001".*"002"/)
    })
})
