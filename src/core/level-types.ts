export const CELL_TYPES = ['wall', 'soil', 'road'] as const

export type CellType = (typeof CELL_TYPES)[number]

function range(from: number, to: number): string[] {
    const out: string[] = []
    for (let n = from; n <= to; n++) out.push(String(n))
    return out
}

// Инвентарь ручных кадров: номер SHALL совпадать с именем JPG в raw/ без расширения.
export const FRAME_NUMBERS: Record<CellType, readonly string[]> = {
    wall: ['101', '201', ...range(301, 314), ...range(401, 415), ...range(501, 516)],
    soil: ['101', '102', '103', '201', '301', '302'],
    road: ['101', '102'],
}

const FRAME_PREFIX: Record<string, CellType> = { w: 'wall', s: 'soil', r: 'road' }

// Логический тип кадра (`w307` → `wall`); undefined — кадр вне инвентаря.
export function frameType(frame: string): CellType | undefined {
    const type = FRAME_PREFIX[frame[0] ?? '']
    if (type === undefined) return undefined
    return FRAME_NUMBERS[type].includes(frame.slice(1)) ? type : undefined
}

export interface Vec2 {
    x: number
    y: number
}

export interface LevelData {
    id: string
    width: number
    height: number
    tiles: string[][]
    grid: CellType[][]
    start: Vec2
    // Фактический seed генерации (заполняет generateLevel; в файлах уровней отсутствует).
    seed?: string
}

export interface LevelManifestItem {
    id: string
    seed?: string
    difficulty?: 'easy' | 'normal' | 'hard'
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
