import { describe, expect, test } from 'bun:test'
import { computeLayout, playerRect } from './layout.ts'

describe('computeLayout', () => {
    test('размер тайла — floor(min(соотношение по ширине, по высоте))', () => {
        expect(computeLayout(100, 100, 4, 4, 1).tileSize).toBe(25)
        expect(computeLayout(200, 100, 5, 3, 1).tileSize).toBe(33)
        expect(computeLayout(100, 200, 5, 3, 1).tileSize).toBe(20)
    })

    test('минимальный размер тайла — 1', () => {
        expect(computeLayout(3, 3, 10, 10, 1).tileSize).toBe(1)
        expect(computeLayout(9, 40, 10, 10, 1).tileSize).toBe(1)
    })

    test('максимальный размер тайла — 130', () => {
        expect(computeLayout(2000, 2000, 4, 4, 1).tileSize).toBe(130)
        expect(computeLayout(520, 130, 4, 1, 1).tileSize).toBe(130)
    })

    test('при cap поле центрируется с полями, а не растягивается', () => {
        const layout = computeLayout(2000, 2000, 4, 4, 1)
        expect(layout.tileSize).toBe(130)
        expect(layout.offsetX).toBe(740)
        expect(layout.offsetY).toBe(740)
    })

    test('маленькое окно сжимает тайл как раньше', () => {
        expect(computeLayout(100, 100, 4, 4, 1).tileSize).toBe(25)
    })

    test('смещение центрирования целочисленное и центрирует сетку', () => {
        const layout = computeLayout(105, 60, 4, 3, 1)
        expect(layout.offsetX).toBe(12)
        expect(layout.offsetY).toBe(0)
        expect(Number.isInteger(layout.offsetX)).toBe(true)
        expect(Number.isInteger(layout.offsetY)).toBe(true)

        const centered = computeLayout(101, 100, 3, 4, 1)
        expect(centered.offsetX).toBe(13)
        expect(centered.offsetY).toBe(0)
        expect(Number.isInteger(centered.offsetX)).toBe(true)
    })

    test('устройство не остаётся пустым: сетка помещается в окно', () => {
        const layout = computeLayout(105, 61, 4, 3, 1)
        expect(layout.offsetX * 2 + 4 * layout.tileSize).toBeLessThanOrEqual(105)
        expect(layout.offsetY * 2 + 3 * layout.tileSize).toBeLessThanOrEqual(61)
    })

    test('devicePixelRatio сохраняется в раскладке', () => {
        expect(computeLayout(200, 200, 4, 4, 2).dpr).toBe(2)
        expect(computeLayout(200, 200, 4, 4, 1.5).dpr).toBe(1.5)
    })

    test('без явного dpr берётся devicePixelRatio окружения', () => {
        expect(computeLayout(200, 200, 4, 4).dpr).toBeGreaterThanOrEqual(1)
    })
})

describe('playerRect', () => {
    test('прямоугольник игрока — клетка сетки в координатах раскладки', () => {
        const layout = computeLayout(100, 100, 4, 4, 1)
        expect(playerRect(2, 1, layout)).toEqual({ x: 50, y: 25, width: 25, height: 25 })
    })

    test('учитывает смещение центрирования', () => {
        const layout = computeLayout(105, 60, 4, 3, 1)
        expect(playerRect(0, 0, layout)).toEqual({ x: 12, y: 0, width: 20, height: 20 })
        expect(playerRect(3, 2, layout)).toEqual({ x: 72, y: 40, width: 20, height: 20 })
    })
})
