export const CELL_TYPES = ['wall', 'soil', 'road'] as const

export type CellType = (typeof CELL_TYPES)[number]

export interface Vec2 {
    x: number
    y: number
}

export interface LevelData {
    id: string
    width: number
    height: number
    tiles: CellType[][]
    start: Vec2
    tileSeed?: number
}

export interface LevelManifestItem {
    id: string
    file: string
    name: string
}

export interface LevelManifest {
    levels: LevelManifestItem[]
}

export interface AtlasFrame {
    frame: { x: number; y: number; w: number; h: number }
    duration?: number
}

export interface AtlasMeta {
    image: string
    size: { w: number; h: number }
}

export interface SpriteAtlasJSON {
    frames: Record<string, AtlasFrame>
    meta: AtlasMeta
}
