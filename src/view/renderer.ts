import type { Dir } from '../core/game-rules.ts'
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
    getFacing: () => Dir
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

// ponytail: блок фиксирован 2×2, вынести в константу WALL_BLOCK=2 если карты станут больше.
export function pickWallVariant(x: number, y: number, seed: number, count: number): number {
    return pickVariant(Math.floor(x / 2), Math.floor(y / 2), seed, count)
}

// Имя кадра клетки с учётом кластеризации стен. count=0 — базовое имя типа.
export function variantFrame(type: CellType, x: number, y: number, seed: number, count: number): string {
    if (count === 0) return type
    const v = type === 'wall' ? pickWallVariant(x, y, seed, count) : pickVariant(x, y, seed, count)
    return `${type}_${v}`
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
    const { ctx, tiles, rabbit, animator, getLayout, getFacing, tileSeed } = options
    const layer = document.createElement('canvas')
    const layerCtx = layer.getContext('2d')
    if (!layerCtx) throw new Error('renderer: не удалось создать offscreen-слой')

    function countFrames(type: CellType): number {
        let count = 0
        while (tiles.frames[`${type}_${count}`] !== undefined) count++
        return count
    }
    const frameCounts: Record<CellType, number> = {
        wall: countFrames('wall'),
        soil: countFrames('soil'),
        road: countFrames('road'),
    }

    // Базовый тайл.
    function drawCell(target: CanvasRenderingContext2D, x: number, y: number, type: CellType, tileSize: number): void {
        const name = variantFrame(type, x, y, tileSeed, frameCounts[type])
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
