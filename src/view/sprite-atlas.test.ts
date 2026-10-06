import { describe, expect, test } from 'bun:test'
import { parseAnimationAtlas, parseAtlas } from './sprite-atlas.ts'

const TILES_URL = new URL('../../public/assets/sprites/tiles.json', import.meta.url)
const RABBIT_URL = new URL('../../public/assets/sprites/rabbit.json', import.meta.url)

async function realTiles() {
    return parseAtlas(await Bun.file(TILES_URL).json())
}

async function realRabbit() {
    return parseAnimationAtlas(await Bun.file(RABBIT_URL).json())
}

describe('parseAtlas', () => {
    test('реальные плитки: wall/soil/road, tileSize 130', async () => {
        const atlas = await realTiles()
        expect(Object.keys(atlas.frames).sort()).toEqual(['road', 'soil', 'wall'])
        for (const name of ['wall', 'soil', 'road']) {
            expect(atlas.getFrame(name)).toBeDefined()
        }
        expect(atlas.meta.image).toBe('tiles.png')
    })

    test('tileSize равен ширине кадра wall', async () => {
        const atlas = await realTiles()
        expect(atlas.tileSize).toBe(atlas.getFrame('wall').frame.w)
        expect(atlas.tileSize).toBe(130)
    })

    test('реальная анимация: 9 кадров rabbit_* с положительной длительностью', async () => {
        const atlas = await realRabbit()
        expect(Object.keys(atlas.frames).sort()).toEqual([
            'rabbit_0',
            'rabbit_1',
            'rabbit_2',
            'rabbit_3',
            'rabbit_4',
            'rabbit_5',
            'rabbit_6',
            'rabbit_7',
            'rabbit_8',
        ])
        for (let i = 0; i < 9; i++) {
            const duration = atlas.getFrame(`rabbit_${i}`).duration
            expect(typeof duration).toBe('number')
            expect(duration).toBeGreaterThan(0)
        }
        expect(atlas.meta.image).toBe('rabbit.png')
    })

    test('неизвестное имя кадра даёт ошибку, содержащую это имя', async () => {
        const atlas = await realTiles()
        expect(() => atlas.getFrame('nope')).toThrow(/nope/)
        const rabbit = await realRabbit()
        expect(() => rabbit.getFrame('rabbit_9')).toThrow(/rabbit_9/)
    })

    test('отклоняет атлас без кадра wall', () => {
        expect(() =>
            parseAtlas({
                frames: { soil: { frame: { x: 0, y: 0, w: 16, h: 16 } } },
                meta: { image: 'tiles.png', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/wall/)
    })

    test('отклоняет некорректный прямоугольник кадра', () => {
        expect(() =>
            parseAtlas({
                frames: { wall: { frame: { x: 0, y: 0, w: '16' } } },
                meta: { image: 'tiles.png', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/frame/)
        expect(() =>
            parseAtlas({
                frames: { wall: { frame: { x: 0, y: 0, w: 0, h: 16 } } },
                meta: { image: 'tiles.png', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/wall/)
    })

    test('отклоняет неположительную duration', () => {
        expect(() =>
            parseAtlas({
                frames: {
                    wall: { frame: { x: 0, y: 0, w: 16, h: 16 } },
                    rabbit_0: { frame: { x: 0, y: 16, w: 16, h: 16 }, duration: 0 },
                },
                meta: { image: 'tiles.png', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/duration/)
    })
})
