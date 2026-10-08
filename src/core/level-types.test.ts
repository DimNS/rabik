import { describe, expect, test } from 'bun:test'
import { CELL_TYPES, type CellType, FRAME_NUMBERS, frameType } from './level-types.ts'

const ALL_CELL_TYPES: Record<CellType, true> = { wall: true, soil: true, road: true }

describe('CELL_TYPES', () => {
    test('набор значений совпадает с CellType', () => {
        expect([...CELL_TYPES] as string[]).toEqual(Object.keys(ALL_CELL_TYPES))
    })
})

describe('frameType', () => {
    test('префикс определяет тип, инвентарь полный (47+6+2)', () => {
        expect(FRAME_NUMBERS.wall).toHaveLength(47)
        expect(FRAME_NUMBERS.soil).toEqual(['101', '102', '103', '201', '301', '302'])
        expect(FRAME_NUMBERS.road).toEqual(['101', '102'])
        expect(frameType('w307')).toBe('wall')
        expect(frameType('s201')).toBe('soil')
        expect(frameType('r102')).toBe('road')
    })

    test('вне инвентаря — undefined', () => {
        for (const bad of ['wall', 'soil', 'road', 's999', 'x101', 'w1', '']) {
            expect(frameType(bad)).toBeUndefined()
        }
    })
})
