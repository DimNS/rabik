import { describe, expect, test } from 'bun:test'
import { parseAtlas } from './sprite-atlas.ts'

const REAL_ATLAS_URL = new URL('../../public/assets/sprites/atlas.json', import.meta.url)

async function realAtlas() {
    return parseAtlas(await Bun.file(REAL_ATLAS_URL).json())
}

describe('parseAtlas', () => {
    test('реальный атлас: все имена кадров доступны, у анимации есть длительности', async () => {
        const atlas = await realAtlas()
        expect(Object.keys(atlas.frames).sort()).toEqual([
            'rabbit_0',
            'rabbit_1',
            'rabbit_2',
            'rabbit_3',
            'road',
            'soil',
            'wall',
        ])
        for (const name of ['wall', 'soil', 'road']) {
            expect(atlas.getFrame(name)).toBeDefined()
        }
        for (const name of ['rabbit_0', 'rabbit_1', 'rabbit_2', 'rabbit_3']) {
            const duration = atlas.getFrame(name).duration
            expect(typeof duration).toBe('number')
            expect(duration).toBeGreaterThan(0)
        }
        expect(atlas.meta.image).toBe('atlas.png')
    })

    test('tileSize равен ширине кадра wall', async () => {
        const atlas = await realAtlas()
        expect(atlas.tileSize).toBe(atlas.getFrame('wall').frame.w)
        expect(atlas.tileSize).toBe(16)
    })

    test('неизвестное имя кадра даёт ошибку, содержащую это имя', async () => {
        const atlas = await realAtlas()
        expect(() => atlas.getFrame('nope')).toThrow(/nope/)
        expect(() => atlas.getFrame('rabbit_9')).toThrow(/rabbit_9/)
    })

    test('отклоняет атлас без кадра wall', () => {
        expect(() =>
            parseAtlas({
                frames: { soil: { frame: { x: 0, y: 0, w: 16, h: 16 } } },
                meta: { image: 'atlas.png', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/wall/)
    })

    test('отклоняет некорректный прямоугольник кадра', () => {
        expect(() =>
            parseAtlas({
                frames: { wall: { frame: { x: 0, y: 0, w: '16' } } },
                meta: { image: 'atlas.png', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/frame/)
        expect(() =>
            parseAtlas({
                frames: { wall: { frame: { x: 0, y: 0, w: 0, h: 16 } } },
                meta: { image: 'atlas.png', size: { w: 64, h: 32 } },
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
                meta: { image: 'atlas.png', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/duration/)
    })
})
