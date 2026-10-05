import { describe, expect, test } from 'bun:test'
import { CELL_TYPES, type CellType } from './level-types.ts'

const ALL_CELL_TYPES: Record<CellType, true> = { wall: true, soil: true, road: true }

describe('CELL_TYPES', () => {
    test('набор значений совпадает с CellType', () => {
        expect([...CELL_TYPES] as string[]).toEqual(Object.keys(ALL_CELL_TYPES))
    })
})
