import { describe, expect, test } from 'bun:test'
import { decodeKey, decodeSwipe } from './direction.ts'

const THRESHOLD = 24

describe('decodeKey', () => {
    test('четыре стрелки дают своё направление', () => {
        expect(decodeKey('ArrowUp', false)).toBe('up')
        expect(decodeKey('ArrowDown', false)).toBe('down')
        expect(decodeKey('ArrowLeft', false)).toBe('left')
        expect(decodeKey('ArrowRight', false)).toBe('right')
    })

    test('нерелевантная клавиша игнорируется', () => {
        expect(decodeKey('a', false)).toBeNull()
        expect(decodeKey('Enter', false)).toBeNull()
        expect(decodeKey(' ', false)).toBeNull()
    })

    test('автоповтор игнорируется', () => {
        expect(decodeKey('ArrowUp', true)).toBeNull()
        expect(decodeKey('ArrowRight', true)).toBeNull()
    })
})

describe('decodeSwipe', () => {
    test('свайп по горизонтали при преобладании оси x', () => {
        expect(decodeSwipe(100, 10, THRESHOLD)).toBe('right')
        expect(decodeSwipe(-100, -10, THRESHOLD)).toBe('left')
    })

    test('свайп по вертикали при преобладании оси y', () => {
        expect(decodeSwipe(10, 100, THRESHOLD)).toBe('down')
        expect(decodeSwipe(-10, -100, THRESHOLD)).toBe('up')
    })

    test('смещение ниже порога не даёт хода', () => {
        expect(decodeSwipe(23, 5, THRESHOLD)).toBeNull()
        expect(decodeSwipe(5, -23, THRESHOLD)).toBeNull()
        expect(decodeSwipe(20, 20, THRESHOLD)).toBeNull()
    })

    test('нулевое смещение не даёт хода', () => {
        expect(decodeSwipe(0, 0, THRESHOLD)).toBeNull()
    })

    test('смещение ровно на порог считается свайпом', () => {
        expect(decodeSwipe(THRESHOLD, 0, THRESHOLD)).toBe('right')
        expect(decodeSwipe(0, -THRESHOLD, THRESHOLD)).toBe('up')
    })
})
