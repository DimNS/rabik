export interface Layout {
    tileSize: number
    offsetX: number
    offsetY: number
    dpr: number
}

export interface Rect {
    x: number
    y: number
    width: number
    height: number
}

export function readDpr(): number {
    return globalThis.devicePixelRatio || 1
}

// Исходный размер спрайта: растягивать сильнее нет смысла, только мыло.
export const MAX_TILE_SIZE = 130

export function computeLayout(cssW: number, cssH: number, gridW: number, gridH: number, dpr?: number): Layout {
    const ratio = dpr ?? readDpr()
    const tileSize = Math.min(MAX_TILE_SIZE, Math.max(1, Math.floor(Math.min(cssW / gridW, cssH / gridH))))
    return {
        tileSize,
        offsetX: Math.floor((cssW - tileSize * gridW) / 2),
        offsetY: Math.floor((cssH - tileSize * gridH) / 2),
        dpr: ratio,
    }
}

export function playerRect(x: number, y: number, layout: Layout): Rect {
    return {
        x: layout.offsetX + x * layout.tileSize,
        y: layout.offsetY + y * layout.tileSize,
        width: layout.tileSize,
        height: layout.tileSize,
    }
}
