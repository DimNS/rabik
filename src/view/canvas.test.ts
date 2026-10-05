import { describe, expect, test } from 'bun:test'
import { applyCanvasSize } from './canvas.ts'

interface Stub {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    transforms: number[][]
}

function stub(): Stub {
    const transforms: number[][] = []
    const ctx = {
        imageSmoothingEnabled: true,
        setTransform: (...args: number[]) => {
            transforms.push(args)
        },
    } as unknown as CanvasRenderingContext2D
    const canvas = { width: 0, height: 0 } as unknown as HTMLCanvasElement
    return { canvas, ctx, transforms }
}

describe('applyCanvasSize', () => {
    test('backing store равен CSS-размеру, умноженному на devicePixelRatio', () => {
        const { canvas, ctx } = stub()
        applyCanvasSize(canvas, ctx, 300, 200, 2)
        expect(canvas.width).toBe(600)
        expect(canvas.height).toBe(400)
    })

    test('после ресайза размеры пересчитываются под новый CSS-размер', () => {
        const { canvas, ctx } = stub()
        applyCanvasSize(canvas, ctx, 300, 200, 2)
        applyCanvasSize(canvas, ctx, 100, 50, 1)
        expect(canvas.width).toBe(100)
        expect(canvas.height).toBe(50)
    })

    test('устанавливает transform под DPR и отключает сглаживание', () => {
        const { canvas, ctx, transforms } = stub()
        applyCanvasSize(canvas, ctx, 300, 200, 3)
        expect(transforms.at(-1)).toEqual([3, 0, 0, 3, 0, 0])
        expect(ctx.imageSmoothingEnabled).toBe(false)
    })
})
