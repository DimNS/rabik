import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { encodeJpg, type RgbaImage } from './atlas-codec.ts'

const TILE = 130
const TILE_TYPES = ['wall', 'soil', 'road'] as const
type TileType = (typeof TILE_TYPES)[number]

const RECIPE_TYPE: Record<string, TileType> = {
    brick: 'wall',
    stone: 'wall',
    grass: 'wall',
    water: 'wall',
    earth: 'soil',
    asphalt: 'road',
}
const ALL_RECIPES = Object.keys(RECIPE_TYPE)

interface CandidateEntry {
    type: string
    recipe: string
    seed: number
    file: string
}

function fail(message: string): never {
    console.error(`gen-tile-variants: ${message}`)
    process.exit(1)
}

function join(dir: string, name: string): string {
    return `${dir.replace(/\/+$/, '')}/${name}`
}

function argValue(name: string): string | undefined {
    const index = Bun.argv.indexOf(name)
    if (index < 0) return undefined
    const value = Bun.argv[index + 1]
    if (value === undefined || value.startsWith('--')) fail(`флаг ${name} требует значения`)
    return value
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Value-noise на периодической хэш-решётке: тайлится без швов.
function makeNoise(rand: () => number, cells: number): (u: number, v: number) => number {
    const lat = new Float32Array(cells * cells)
    for (let i = 0; i < lat.length; i++) lat[i] = rand()
    return (u, v) => {
        const xi = Math.floor(u)
        const yi = Math.floor(v)
        const xf = u - xi
        const yf = v - yi
        const sx = xf * xf * (3 - 2 * xf)
        const sy = yf * yf * (3 - 2 * yf)
        const x0 = ((xi % cells) + cells) % cells
        const y0 = ((yi % cells) + cells) % cells
        const x1 = (x0 + 1) % cells
        const y1 = (y0 + 1) % cells
        const v00 = lat[y0 * cells + x0] ?? 0
        const v10 = lat[y0 * cells + x1] ?? 0
        const v01 = lat[y1 * cells + x0] ?? 0
        const v11 = lat[y1 * cells + x1] ?? 0
        const top = v00 + (v10 - v00) * sx
        const bottom = v01 + (v11 - v01) * sx
        return top + (bottom - top) * sy
    }
}

function clamp255(v: number): number {
    return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

function renderBrick(rand: () => number): Uint8Array {
    const noise = makeNoise(rand, 8)
    const data = new Uint8Array(TILE * TILE * 4)
    // BW/BH делят TILE (130 = 5×26 = 10×13), покрытие шума — ровно 1 период
    // решётки: одинаковые варианты в соседних клетках сшиваются без швов.
    const BW = 26
    const BH = 13
    const M = 2
    for (let y = 0; y < TILE; y++) {
        const row = Math.floor(y / BH)
        const off = (row % 2) * (BW / 2)
        const ly = y - row * BH
        for (let x = 0; x < TILE; x++) {
            const bx = (((x + off) % BW) + BW) % BW
            const n = noise((x * 8) / TILE, (y * 8) / TILE)
            let r: number
            let g: number
            let b: number
            if (bx < M || ly < M) {
                const v = 52 + n * 16
                r = v + 6
                g = v
                b = v + 2
            } else {
                const brickId = row * 64 + Math.floor((x + off) / BW)
                const h = Math.imul(brickId, 2654435761) >>> 0
                const shade = h / 4294967296
                r = 138 + shade * 32 + (n - 0.5) * 26
                g = 60 + shade * 20 + (n - 0.5) * 18
                b = 46 + shade * 14 + (n - 0.5) * 14
            }
            const i = (y * TILE + x) * 4
            data[i] = clamp255(r)
            data[i + 1] = clamp255(g)
            data[i + 2] = clamp255(b)
            data[i + 3] = 255
        }
    }
    return data
}

function renderStone(rand: () => number): Uint8Array {
    const noise = makeNoise(rand, 8)
    const data = new Uint8Array(TILE * TILE * 4)
    const N = 4
    const px = new Float64Array(N * N)
    const py = new Float64Array(N * N)
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            px[j * N + i] = ((i + 0.15 + rand() * 0.7) / N) * TILE
            py[j * N + i] = ((j + 0.15 + rand() * 0.7) / N) * TILE
        }
    }
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            let d1 = Infinity
            let d2 = Infinity
            let cell = 0
            for (let c = 0; c < N * N; c++) {
                // Тороидальная дистанция: тайл сшивается сам с собой без швов.
                let dx = Math.abs(x - (px[c] ?? 0))
                if (dx > TILE / 2) dx = TILE - dx
                let dy = Math.abs(y - (py[c] ?? 0))
                if (dy > TILE / 2) dy = TILE - dy
                const d = dx * dx + dy * dy
                if (d < d1) {
                    d2 = d1
                    d1 = d
                    cell = c
                } else if (d < d2) {
                    d2 = d
                }
            }
            const n = noise((x * 8) / TILE, (y * 8) / TILE)
            const h = Math.imul(cell * 2 + 1, 2246822519) >>> 0
            const shade = h / 4294967296
            let v = 118 + shade * 30 + (n - 0.5) * 30
            if (Math.sqrt(d2) - Math.sqrt(d1) < 2.5) v *= 0.55
            const i = (y * TILE + x) * 4
            data[i] = clamp255(v + 8)
            data[i + 1] = clamp255(v)
            data[i + 2] = clamp255(v - 5)
            data[i + 3] = 255
        }
    }
    return data
}

function renderGrass(rand: () => number): Uint8Array {
    const base = makeNoise(rand, 6)
    const grain = makeNoise(rand, 24)
    const data = new Uint8Array(TILE * TILE * 4)
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const n1 = base((x * 6) / TILE, (y * 6) / TILE)
            const n2 = grain((x * 24) / TILE, (y * 24) / TILE)
            const i = (y * TILE + x) * 4
            data[i] = clamp255(58 + n1 * 44 + (n2 - 0.5) * 22)
            data[i + 1] = clamp255(118 + n1 * 52 + (n2 - 0.5) * 26)
            data[i + 2] = clamp255(44 + n1 * 30 + (n2 - 0.5) * 18)
            data[i + 3] = 255
        }
    }
    for (let k = 0; k < 500; k++) {
        const bx = Math.floor(rand() * TILE)
        const by = Math.floor(rand() * TILE)
        const len = 3 + Math.floor(rand() * 4)
        const d = rand() < 0.5 ? 22 : -22
        for (let s = 0; s < len; s++) {
            // Заворот по вертикали: травинка через край продолжается с другой стороны.
            const yy = (((by - s) % TILE) + TILE) % TILE
            const i = (yy * TILE + bx) * 4
            data[i] = clamp255((data[i] ?? 0) + d * 0.5)
            data[i + 1] = clamp255((data[i + 1] ?? 0) + d)
            data[i + 2] = clamp255((data[i + 2] ?? 0) + d * 0.4)
        }
    }
    return data
}

function renderWater(rand: () => number): Uint8Array {
    const base = makeNoise(rand, 6)
    const ripple = makeNoise(rand, 16)
    const data = new Uint8Array(TILE * TILE * 4)
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const n = base((x * 6) / TILE, (y * 6) / TILE)
            // 7 волн на тайл (было 0.35 рад/px ≈ 7.2 волн): стык сверху/снизу сшит.
            const wave = Math.sin((y * Math.PI * 2 * 7) / TILE + n * 3.5 + ripple((x * 16) / TILE, (y * 16) / TILE) * 4)
            const glare = wave > 0.55 ? (wave - 0.55) * 70 : 0
            const i = (y * TILE + x) * 4
            data[i] = clamp255(32 + n * 30 + glare * 0.7)
            data[i + 1] = clamp255(98 + n * 34 + glare)
            data[i + 2] = clamp255(168 + n * 30 + glare * 0.8)
            data[i + 3] = 255
        }
    }
    return data
}

function renderEarth(rand: () => number): Uint8Array {
    const base = makeNoise(rand, 6)
    const grain = makeNoise(rand, 32)
    const data = new Uint8Array(TILE * TILE * 4)
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const n1 = base((x * 6) / TILE, (y * 6) / TILE)
            const n2 = grain((x * 32) / TILE, (y * 32) / TILE)
            const i = (y * TILE + x) * 4
            data[i] = clamp255(124 + (n1 - 0.5) * 44 + (n2 - 0.5) * 30)
            data[i + 1] = clamp255(90 + (n1 - 0.5) * 36 + (n2 - 0.5) * 26)
            data[i + 2] = clamp255(56 + (n1 - 0.5) * 28 + (n2 - 0.5) * 20)
            data[i + 3] = 255
        }
    }
    for (let k = 0; k < 260; k++) {
        const dx = Math.floor(rand() * TILE)
        const dy = Math.floor(rand() * TILE)
        const d = rand() < 0.5 ? -26 : 24
        const i = (dy * TILE + dx) * 4
        data[i] = clamp255((data[i] ?? 0) + d)
        data[i + 1] = clamp255((data[i + 1] ?? 0) + d)
        data[i + 2] = clamp255((data[i + 2] ?? 0) + d)
    }
    return data
}

function renderAsphalt(rand: () => number): Uint8Array {
    const base = makeNoise(rand, 6)
    const grain = makeNoise(rand, 32)
    const data = new Uint8Array(TILE * TILE * 4)
    // Без разметки: тайл встаёт и вертикально, любая полоса даст визуальный шов.
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const n1 = base((x * 6) / TILE, (y * 6) / TILE)
            const n2 = grain((x * 32) / TILE, (y * 32) / TILE)
            const v = 88 + (n1 - 0.5) * 26 + (n2 - 0.5) * 18
            const i = (y * TILE + x) * 4
            data[i] = clamp255(v + 2)
            data[i + 1] = clamp255(v)
            data[i + 2] = clamp255(v + 5)
            data[i + 3] = 255
        }
    }
    for (let k = 0; k < 220; k++) {
        const dx = Math.floor(rand() * TILE)
        const dy = Math.floor(rand() * TILE)
        const d = 18 + Math.floor(rand() * 10)
        const i = (dy * TILE + dx) * 4
        data[i] = clamp255((data[i] ?? 0) + d)
        data[i + 1] = clamp255((data[i + 1] ?? 0) + d)
        data[i + 2] = clamp255((data[i + 2] ?? 0) + d)
    }
    return data
}

function renderRecipe(recipe: string, seed: number): RgbaImage {
    const data = renderVariant(recipe, mulberry32(seed))
    // Общая кромка: край одинаков у всех вариантов рецепта и сшивается
    // с любым из них, вариативность живёт внутри (см. applySharedRim).
    if (seed !== EDGE_SEED) applySharedRim(data, renderVariant(recipe, mulberry32(EDGE_SEED)))
    return { w: TILE, h: TILE, data }
}

// Кромка, общая для всех вариантов рецепта: тот же рецепт с фиксированным
// seed. Ширина меньше половины тайла, вес — smoothstep от 1 у края к 0 внутрь.
const EDGE_SEED = 0
const RIM = 12

function renderVariant(recipe: string, rand: () => number): Uint8Array {
    if (recipe === 'brick') return renderBrick(rand)
    if (recipe === 'stone') return renderStone(rand)
    if (recipe === 'grass') return renderGrass(rand)
    if (recipe === 'water') return renderWater(rand)
    if (recipe === 'earth') return renderEarth(rand)
    if (recipe === 'asphalt') return renderAsphalt(rand)
    fail(`неизвестный рецепт: ${recipe} (известные: ${ALL_RECIPES.join(', ')})`)
}

function applySharedRim(data: Uint8Array, edge: Uint8Array): void {
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const d = Math.min(x, y, TILE - 1 - x, TILE - 1 - y)
            if (d >= RIM) continue
            const t = 1 - d / RIM
            const w = t * t * (3 - 2 * t)
            const i = (y * TILE + x) * 4
            for (let c = 0; c < 3; c++) {
                data[i + c] = Math.round((edge[i + c] ?? 0) * w + (data[i + c] ?? 0) * (1 - w))
            }
        }
    }
}

const outDir = argValue('--out-dir') ?? new URL('../public/assets/candidates/', import.meta.url).pathname
const recipesRaw = argValue('--recipes') ?? ALL_RECIPES.join(',')
const seedsRaw = argValue('--seeds') ?? '1,2,3'
const jpgQuality = Number(argValue('--jpg-quality') ?? '85')
if (!Number.isFinite(jpgQuality) || jpgQuality < 1 || jpgQuality > 100) fail('--jpg-quality должен быть числом 1..100')

const recipes = [
    ...new Set(
        recipesRaw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
    ),
]
if (recipes.length === 0) fail('--recipes: нужен хотя бы один рецепт')
for (const recipe of recipes) {
    if (!(recipe in RECIPE_TYPE)) fail(`неизвестный рецепт: ${recipe} (известные: ${ALL_RECIPES.join(', ')})`)
}
recipes.sort((a, b) => ALL_RECIPES.indexOf(a) - ALL_RECIPES.indexOf(b))
const seeds = [...new Set(seedsRaw.split(',').map((s) => s.trim()))].map((s) => {
    if (!/^\d+$/.test(s)) fail(`--seeds: нецелый seed "${s}" — нужны целые ≥ 0`)
    return Number(s)
})
if (seeds.length === 0) fail('--seeds: нужен хотя бы один seed')
seeds.sort((a, b) => a - b)

// --- Fail-fast: сначала всё генерируем в памяти, пишем только после.
const outputs: Array<{ type: TileType; fileName: string; bytes: Uint8Array }> = []
for (const recipe of recipes) {
    const type = RECIPE_TYPE[recipe] ?? fail(`неизвестный рецепт: ${recipe}`)
    for (const seed of seeds) {
        const image = renderRecipe(recipe, seed)
        outputs.push({
            type,
            fileName: `${recipe}-${seed}.jpg`,
            bytes: encodeJpg(image.w, image.h, image.data, jpgQuality),
        })
    }
}

for (const type of TILE_TYPES) mkdirSync(join(outDir, type), { recursive: true })
// Очистка: каждый запуск даёт ровно запрошенный набор — stale-JPG не накапливаются.
// Стоит после in-memory генерации, так что ошибка рендера оставляет диск нетронутым.
for (const type of TILE_TYPES) {
    const dir = join(outDir, type)
    for (const name of readdirSync(dir)) {
        if (name.endsWith('.jpg')) rmSync(join(dir, name))
    }
}
for (const out of outputs) {
    await Bun.write(join(join(outDir, out.type), out.fileName), out.bytes)
    console.log(`${out.type}/${out.fileName}: ${TILE}x${TILE}`)
}

// Манифест — по всем JPG на диске (каталог очищен выше, на диске ровно этот запуск).
const candidates: CandidateEntry[] = []
for (const type of TILE_TYPES) {
    let entries: string[]
    try {
        entries = readdirSync(join(outDir, type))
    } catch {
        continue
    }
    for (const name of entries.filter((entry) => entry.endsWith('.jpg')).sort()) {
        const match = /^(.+)-(\d+)\.jpg$/.exec(name)
        candidates.push({
            type,
            recipe: match?.[1] ?? name.replace(/\.jpg$/, ''),
            seed: match?.[2] === undefined ? 0 : Number(match[2]),
            file: `${type}/${name}`,
        })
    }
}
await Bun.write(join(outDir, 'candidates.json'), `${JSON.stringify({ tileSize: TILE, candidates }, null, 4)}\n`)
console.log(`candidates.json: записей ${candidates.length}`)
