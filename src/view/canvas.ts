import { readDpr } from './layout.ts'

export function applyCanvasSize(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    cssW: number,
    cssH: number,
    dpr: number,
): void {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
}

export interface GameCanvas {
    ctx: CanvasRenderingContext2D
    resize(): void
}

export function setupCanvas(canvas: HTMLCanvasElement): GameCanvas {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas: не удалось получить контекст 2D')
    const resize = (): void => {
        applyCanvasSize(canvas, ctx, canvas.clientWidth, canvas.clientHeight, readDpr())
    }
    resize()
    return { ctx, resize }
}
