import type { Dir } from '../core/game-rules.ts'
import type { GameState } from '../core/game-state.ts'
import { type Layout, playerRect } from './layout.ts'
import type { SpriteAnimator } from './sprite-anim.ts'
import type { SpriteAtlas } from './sprite-atlas.ts'

export interface RendererOptions {
    ctx: CanvasRenderingContext2D
    tiles: SpriteAtlas
    rabbit: SpriteAtlas
    animator: SpriteAnimator
    getLayout: () => Layout
    getFacing: () => Dir
}

export interface Renderer {
    renderAll(state: GameState): void
    redrawTile(x: number, y: number, state: GameState): void
    render(state: GameState): void
}

export const FACING_ANGLE: Record<Dir, number> = {
    up: 0,
    right: Math.PI / 2,
    down: Math.PI,
    left: -Math.PI / 2,
}

export function facingAngle(dir: Dir): number {
    return FACING_ANGLE[dir] ?? 0
}

export function createRenderer(options: RendererOptions): Renderer {
    const { ctx, tiles, rabbit, animator, getLayout, getFacing } = options
    const layer = document.createElement('canvas')
    const layerCtx = layer.getContext('2d')
    if (!layerCtx) throw new Error('renderer: не удалось создать offscreen-слой')

    // Кадр клетки — напрямую из данных уровня; единственная динамика — переход люка в game-rules.
    function drawCell(
        target: CanvasRenderingContext2D,
        x: number,
        y: number,
        state: GameState,
        tileSize: number,
    ): void {
        const name = state.frames[y]?.[x]
        if (!name) return
        const { x: sx, y: sy, w, h } = tiles.getFrame(name).frame
        target.drawImage(tiles.image, sx, sy, w, h, x * tileSize, y * tileSize, tileSize, tileSize)
    }

    function render(state: GameState): void {
        const layout = getLayout()
        ctx.drawImage(layer, layout.offsetX, layout.offsetY)
        const { x: sx, y: sy, w, h } = rabbit.getFrame(animator.current()).frame
        const rect = playerRect(state.player.x, state.player.y, layout)
        const angle = facingAngle(getFacing())
        if (angle === 0) {
            ctx.drawImage(rabbit.image, sx, sy, w, h, rect.x, rect.y, rect.width, rect.height)
            return
        }
        ctx.save()
        ctx.translate(rect.x + rect.width / 2, rect.y + rect.height / 2)
        ctx.rotate(angle)
        ctx.drawImage(rabbit.image, sx, sy, w, h, -rect.width / 2, -rect.height / 2, rect.width, rect.height)
        ctx.restore()
    }

    return {
        renderAll(state: GameState): void {
            const layout = getLayout()
            layer.width = state.width * layout.tileSize
            layer.height = state.height * layout.tileSize
            layerCtx.imageSmoothingEnabled = false
            for (let y = 0; y < state.height; y++) {
                for (let x = 0; x < state.width; x++) {
                    drawCell(layerCtx, x, y, state, layout.tileSize)
                }
            }
            render(state)
        },
        redrawTile(x: number, y: number, state: GameState): void {
            const layout = getLayout()
            const tileSize = layout.tileSize
            layerCtx.clearRect(x * tileSize, y * tileSize, tileSize, tileSize)
            drawCell(layerCtx, x, y, state, tileSize)
            render(state)
        },
        render,
    }
}
