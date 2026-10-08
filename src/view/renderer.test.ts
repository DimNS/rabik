import { describe, expect, test } from 'bun:test'
import { facingAngle } from './renderer.ts'

describe('facingAngle', () => {
    test('вверх — без поворота, остальные — на 90°', () => {
        expect(facingAngle('up')).toBe(0)
        expect(facingAngle('right')).toBe(Math.PI / 2)
        expect(facingAngle('down')).toBe(Math.PI)
        expect(facingAngle('left')).toBe(-Math.PI / 2)
    })
})
