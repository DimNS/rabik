import { describe, expect, test } from 'bun:test'
import { createSpriteAnimator } from './sprite-anim.ts'

describe('createSpriteAnimator', () => {
    test('кадры с разными длительностями сменяются по своим длительностям', () => {
        const animator = createSpriteAnimator(['a', 'b'], [100, 300])
        expect(animator.current()).toBe('a')
        animator.advance(150)
        expect(animator.current()).toBe('b')
        animator.advance(250)
        expect(animator.current()).toBe('a')
    })

    test('переход через сумму цикла зацикливает анимацию с остатком', () => {
        const animator = createSpriteAnimator(['a', 'b', 'c'], [50, 50, 100])
        animator.advance(275)
        expect(animator.current()).toBe('b')
        animator.advance(25)
        expect(animator.current()).toBe('c')
        animator.advance(100)
        expect(animator.current()).toBe('a')
        animator.advance(200)
        expect(animator.current()).toBe('a')
    })

    test('фаза продолжается: вызовы advance не сбрасывают анимацию', () => {
        const animator = createSpriteAnimator(['a', 'b'], [100, 100])
        animator.advance(60)
        expect(animator.current()).toBe('a')
        animator.advance(40)
        expect(animator.current()).toBe('b')
        animator.advance(30)
        expect(animator.current()).toBe('b')
        animator.advance(70)
        expect(animator.current()).toBe('a')
    })

    test('отклоняет пустой список кадров и несовпадающие длительности', () => {
        expect(() => createSpriteAnimator([], [])).toThrow(/пуст/)
        expect(() => createSpriteAnimator(['a'], [100, 200])).toThrow(/разное количество/)
        expect(() => createSpriteAnimator(['a', 'b'], [100])).toThrow(/разное количество/)
    })
})
