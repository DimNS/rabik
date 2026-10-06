import type { GameState } from '../core/game-state.ts'
import type { CellType } from '../core/level-types.ts'
import { type Layout, playerRect } from './layout.ts'
import type { SpriteAnimator } from './sprite-anim.ts'
import type { SpriteAtlas } from './sprite-atlas.ts'

export interface RendererOptions {
    ctx: CanvasRenderingContext2D
    tiles: SpriteAtlas
    rabbit: SpriteAtlas
    animator: SpriteAnimator
    getLayout: () => Layout
    tileSeed: number
}

export interface Renderer {
    renderAll(state: GameState): void
    redrawTile(x: number, y: number, state: GameState): void
    render(state: GameState): void
}

export function pickVariant(x: number, y: number, seed: number, count: number): number {
    if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`renderer: count вариантов должен быть положительным целым числом, получено ${count}`)
    }
    if (count === 1) return 0
    let hash = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 974634211)) >>> 0
    hash = (hash ^ (hash >>> 13)) >>> 0
    return hash % count
}

export function createRenderer(options: RendererOptions): Renderer {
    const { ctx, tiles, rabbit, animator, getLayout, tileSeed } = options
    const layer = document.createElement('canvas')
    const layerCtx = layer.getContext('2d')
    if (!layerCtx) throw new Error('renderer: не удалось создать offscreen-слой')

    function drawCell(target: CanvasRenderingContext2D, x: number, y: number, type: CellType, tileSize: number): void {
        let count = 0
        while (tiles.frames[`${type}_${count}`] !== undefined) count++
        const name = count === 0 ? type : `${type}_${pickVariant(x, y, tileSeed, count)}`
        const { x: sx, y: sy, w, h } = tiles.getFrame(name).frame
        target.drawImage(tiles.image, sx, sy, w, h, x * tileSize, y * tileSize, tileSize, tileSize)
    }

    function render(state: GameState): void {
        const layout = getLayout()
        ctx.drawImage(layer, layout.offsetX, layout.offsetY)
        const { x: sx, y: sy, w, h } = rabbit.getFrame(animator.current()).frame
        const rect = playerRect(state.player.x, state.player.y, layout)
        ctx.drawImage(rabbit.image, sx, sy, w, h, rect.x, rect.y, rect.width, rect.height)
    }

    return {
        renderAll(state: GameState): void {
            const layout = getLayout()
            layer.width = state.width * layout.tileSize
            layer.height = state.height * layout.tileSize
            layerCtx.imageSmoothingEnabled = false
            for (let y = 0; y < state.height; y++) {
                for (let x = 0; x < state.width; x++) {
                    const type = state.grid[y]?.[x]
                    if (type) drawCell(layerCtx, x, y, type, layout.tileSize)
                }
            }
            render(state)
        },
        redrawTile(x: number, y: number, state: GameState): void {
            const layout = getLayout()
            const type = state.grid[y]?.[x]
            if (!type) return
            const tileSize = layout.tileSize
            layerCtx.clearRect(x * tileSize, y * tileSize, tileSize, tileSize)
            drawCell(layerCtx, x, y, type, tileSize)
            render(state)
        },
        render,
    }
}
