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
    test('реальные плитки: 55 именованных кадров, tileSize 130', async () => {
        const atlas = await realTiles()
        // Именованный атлас ручных тайлов: w* — 47, s* — 6, r* — 2.
        const names = Object.keys(atlas.frames)
        expect(names).toHaveLength(55)
        expect(names.filter((n) => n.startsWith('w'))).toHaveLength(47)
        expect(names.filter((n) => n.startsWith('s'))).toHaveLength(6)
        expect(names.filter((n) => n.startsWith('r'))).toHaveLength(2)
        for (const name of ['w101', 'w201', 'w307', 'w403', 's101', 's201', 's301', 's302', 'r101', 'r102']) {
            expect(atlas.getFrame(name)).toBeDefined()
        }
        // Индексных имён и алиасов типов нет.
        for (const name of names) {
            expect(name).not.toMatch(/^(wall|soil|road)(_\d+)?$/)
        }
        expect(atlas.meta.image).toBe('tiles.jpg')
    })

    test('tileSize равен ширине любого кадра статики', async () => {
        const atlas = await realTiles()
        expect(atlas.tileSize).toBe(atlas.getFrame('w101').frame.w)
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

    test('отклоняет атлас без кадров', () => {
        expect(() =>
            parseAtlas({
                frames: {},
                meta: { image: 'tiles.jpg', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/ни одного кадра/)
    })

    test('отклоняет некорректный прямоугольник кадра', () => {
        expect(() =>
            parseAtlas({
                frames: { w101: { frame: { x: 0, y: 0, w: '16' } } },
                meta: { image: 'tiles.jpg', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/frame/)
        expect(() =>
            parseAtlas({
                frames: { w101: { frame: { x: 0, y: 0, w: 0, h: 16 } } },
                meta: { image: 'tiles.jpg', size: { w: 64, h: 32 } },
            }),
        ).toThrow(/w101/)
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
