import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { encodeJpg, type RgbaImage } from './atlas-codec.ts'

const TILE = 130
const TILE_TYPES = ['wall', 'soil', 'road'] as const
type TileType = (typeof TILE_TYPES)[number]

const RECIPE_TYPE: Record<string, TileType> = {
    grass1: 'wall',
    grass2: 'wall',
    grass3: 'wall',
    grass4: 'wall',
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

// Единая зелёная база всех трав: различия только объектами/травинками/крапом.
const GRASS_BG = {
    baseCells: 6,
    grainCells: 24,
    r0: 58,
    r1: 44,
    g0: 118,
    g1: 52,
    b0: 44,
    b1: 30,
} as const

type RGB = [number, number, number]

// Затемнение диска (тень объекта) на месте, множитель ~0.72.
function shadeDisc(data: Uint8Array, cx: number, cy: number, r: number): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            if (x < 0 || y < 0 || x >= TILE || y >= TILE) continue
            const dx = x - cx
            const dy = y - cy
            if (dx * dx + dy * dy > r * r) continue
            const i = (y * TILE + x) * 4
            data[i] = clamp255((data[i] ?? 0) * 0.72)
            data[i + 1] = clamp255((data[i + 1] ?? 0) * 0.72)
            data[i + 2] = clamp255((data[i + 2] ?? 0) * 0.72)
        }
    }
}

function paintDisc(data: Uint8Array, cx: number, cy: number, r: number, col: RGB): void {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            if (x < 0 || y < 0 || x >= TILE || y >= TILE) continue
            const dx = x - cx
            const dy = y - cy
            if (dx * dx + dy * dy > r * r) continue
            const i = (y * TILE + x) * 4
            data[i] = col[0]
            data[i + 1] = col[1]
            data[i + 2] = col[2]
        }
    }
}

// Общий хелпер «тень (+2,+3) + тело + блик», один свет для всех объектов.
// ponytail: плоские диски вместо спрайтов, объёма хватает для тайла 130px
function blob(data: Uint8Array, cx: number, cy: number, r: number, body: RGB, hi: RGB): void {
    shadeDisc(data, cx + 2, cy + 3, r)
    paintDisc(data, cx, cy, r, body)
    paintDisc(data, cx - r * 0.3, cy - r * 0.3, Math.max(1.5, r * 0.35), hi)
}

// Камень «контур + грань»: неровный силуэт из трёх лепестков, тёмный контур,
// светлая грань сверху-слева. Плоский диск читался как шар — контур и грань
// ломают идеальный круг.
function stone(
    data: Uint8Array,
    rand: () => number,
    cx: number,
    cy: number,
    r: number,
    body: RGB,
    dark: RGB,
    light: RGB,
): void {
    shadeDisc(data, cx + 2, cy + 3, r + 1)
    const lumps = [
        { dx: 0, dy: 0, k: 1 },
        { dx: r * 0.3, dy: r * 0.2, k: 0.7 },
        { dx: -r * 0.25, dy: -r * 0.12, k: 0.55 },
    ]
    for (const lump of lumps) {
        const rl = r * lump.k * (0.9 + rand() * 0.2)
        paintDisc(data, cx + lump.dx, cy + lump.dy, rl + 1.2, dark)
        paintDisc(data, cx + lump.dx, cy + lump.dy, rl, body)
    }
    paintDisc(data, cx - r * 0.25, cy - r * 0.3, r * 0.45, light)
    paintDisc(data, cx - r * 0.3, cy - r * 0.35, Math.max(1.5, r * 0.15), [222, 222, 228])
}

// Случайный центр объекта: центральная зона, чтобы объект попадал в центр
// тайла (тест дифференциации меряет центр) и не задевал рамку RIM.
function objectCenter(rand: () => number): { cx: number; cy: number } {
    return { cx: 48 + Math.floor(rand() * 24), cy: 48 + Math.floor(rand() * 24) }
}

interface GrassCfg {
    blades: number
    bladeMin: number
    bladeVar: number
    bladeAmp: number
    speckles: number
    speckleAmp: number
}

function renderGrassCfg(rand: () => number, cfg: GrassCfg): Uint8Array {
    const base = makeNoise(rand, GRASS_BG.baseCells)
    const grain = makeNoise(rand, GRASS_BG.grainCells)
    const data = new Uint8Array(TILE * TILE * 4)
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const n1 = base((x * GRASS_BG.baseCells) / TILE, (y * GRASS_BG.baseCells) / TILE)
            const n2 = grain((x * GRASS_BG.grainCells) / TILE, (y * GRASS_BG.grainCells) / TILE)
            const i = (y * TILE + x) * 4
            data[i] = clamp255(GRASS_BG.r0 + n1 * GRASS_BG.r1 + (n2 - 0.5) * 22)
            data[i + 1] = clamp255(GRASS_BG.g0 + n1 * GRASS_BG.g1 + (n2 - 0.5) * 26)
            data[i + 2] = clamp255(GRASS_BG.b0 + n1 * GRASS_BG.b1 + (n2 - 0.5) * 18)
            data[i + 3] = 255
        }
    }
    // Дискретный шум строго в интерьере [RIM, TILE-RIM): рамка остаётся чистым фоном.
    for (let k = 0; k < cfg.blades; k++) {
        const bx = RIM + Math.floor(rand() * (TILE - 2 * RIM))
        const by = RIM + Math.floor(rand() * (TILE - 2 * RIM))
        const len = cfg.bladeMin + Math.floor(rand() * cfg.bladeVar)
        const d = rand() < 0.5 ? cfg.bladeAmp : -cfg.bladeAmp
        for (let s = 0; s < len; s++) {
            const yy = by - s
            if (yy < RIM || yy >= TILE - RIM) break
            const i = (yy * TILE + bx) * 4
            data[i] = clamp255((data[i] ?? 0) + d * 0.5)
            data[i + 1] = clamp255((data[i + 1] ?? 0) + d)
            data[i + 2] = clamp255((data[i + 2] ?? 0) + d * 0.4)
        }
    }
    for (let k = 0; k < cfg.speckles; k++) {
        const dx = RIM + Math.floor(rand() * (TILE - 2 * RIM))
        const dy = RIM + Math.floor(rand() * (TILE - 2 * RIM))
        const d = cfg.speckleAmp
        const i = (dy * TILE + dx) * 4
        data[i] = clamp255((data[i] ?? 0) + d)
        data[i + 1] = clamp255((data[i + 1] ?? 0) + d)
        data[i + 2] = clamp255((data[i + 2] ?? 0) + d)
    }
    return data
}

// grass1 — пучок тонких наклонных тёмно-зелёных травинок вокруг центра.
function renderGrass1(rand: () => number): Uint8Array {
    const data = renderGrassCfg(rand, {
        blades: 500,
        bladeMin: 3,
        bladeVar: 4,
        bladeAmp: 22,
        speckles: 0,
        speckleAmp: 0,
    })
    const { cx, cy } = objectCenter(rand)
    shadeDisc(data, cx + 1, cy + 2, 8)
    for (let k = 0; k < 44; k++) {
        const light = rand() < 0.25
        const col: RGB = light
            ? [112, 164, 78]
            : [44 + Math.floor(rand() * 14), 92 + Math.floor(rand() * 20), 36 + Math.floor(rand() * 12)]
        let xx = cx + Math.floor((rand() - 0.5) * 26)
        let yy = cy + Math.floor((rand() - 0.5) * 12)
        const slant = (rand() - 0.5) * 0.9
        let acc = 0
        const len = 8 + Math.floor(rand() * 9)
        for (let s = 0; s < len; s++) {
            if (xx < RIM || xx >= TILE - RIM || yy < RIM || yy >= TILE - RIM) break
            const i = (yy * TILE + xx) * 4
            data[i] = col[0]
            data[i + 1] = col[1]
            data[i + 2] = col[2]
            acc += slant
            if (acc > 0.5) {
                xx++
                acc -= 1
            } else if (acc < -0.5) {
                xx--
                acc += 1
            }
            yy--
        }
    }
    return data
}

// grass2 — 2–3 тёмных куста вокруг центра.
function renderGrass2(rand: () => number): Uint8Array {
    const data = renderGrassCfg(rand, {
        blades: 900,
        bladeMin: 5,
        bladeVar: 5,
        bladeAmp: 20,
        speckles: 0,
        speckleAmp: 0,
    })
    const { cx, cy } = objectCenter(rand)
    const n = 2 + Math.floor(rand() * 2)
    for (let k = 0; k < n; k++) {
        const ox = cx + Math.floor((rand() - 0.5) * 26)
        const oy = cy + Math.floor((rand() - 0.5) * 26)
        const r = 8 + Math.floor(rand() * 4)
        blob(data, ox, oy, r, [34, 86, 30], [66, 128, 54])
    }
    return data
}

// grass3 — одно дерево: ствол + 2–3 диска кроны.
function renderGrass3(rand: () => number): Uint8Array {
    const data = renderGrassCfg(rand, {
        blades: 350,
        bladeMin: 2,
        bladeVar: 3,
        bladeAmp: 18,
        speckles: 160,
        speckleAmp: -28,
    })
    const { cx, cy } = objectCenter(rand)
    shadeDisc(data, cx + 2, cy + 3, 22)
    for (let y = cy; y < Math.min(cy + 16, TILE - RIM); y++) {
        for (let x = cx - 2; x <= cx + 2; x++) {
            if (x < RIM || x >= TILE - RIM || y < RIM) continue
            const i = (y * TILE + x) * 4
            data[i] = 96
            data[i + 1] = 66
            data[i + 2] = 40
        }
    }
    const n = 2 + Math.floor(rand() * 2)
    for (let k = 0; k < n; k++) {
        const ox = cx + Math.floor((rand() - 0.5) * 16)
        const oy = cy - 8 + Math.floor((rand() - 0.5) * 14)
        blob(data, ox, oy, 13 + Math.floor(rand() * 7), [30, 78, 32], [62, 122, 52])
    }
    return data
}

// grass4 — один серый камень с бликом.
function renderGrass4(rand: () => number): Uint8Array {
    const data = renderGrassCfg(rand, {
        blades: 650,
        bladeMin: 3,
        bladeVar: 4,
        bladeAmp: 22,
        speckles: 140,
        speckleAmp: 34,
    })
    const { cx, cy } = objectCenter(rand)
    stone(data, rand, cx, cy, 14 + Math.floor(rand() * 5), [128, 128, 132], [74, 74, 80], [180, 180, 186])
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
        const dx = RIM + Math.floor(rand() * (TILE - 2 * RIM))
        const dy = RIM + Math.floor(rand() * (TILE - 2 * RIM))
        const d = rand() < 0.5 ? -26 : 24
        const i = (dy * TILE + dx) * 4
        data[i] = clamp255((data[i] ?? 0) + d)
        data[i + 1] = clamp255((data[i + 1] ?? 0) + d)
        data[i + 2] = clamp255((data[i + 2] ?? 0) + d)
    }
    // Камни по размеру: 6–9 мелких, два средних или один крупный.
    // Центры — rejection sampling целиком внутри, без пересечений.
    const roll = rand()
    let radii: number[]
    if (roll < 0.4) {
        const n = 6 + Math.floor(rand() * 4)
        radii = Array.from({ length: n }, () => 3 + Math.floor(rand() * 4))
    } else if (roll < 0.7) {
        radii = [9 + Math.floor(rand() * 5), 9 + Math.floor(rand() * 5)]
    } else {
        radii = [16 + Math.floor(rand() * 7)]
    }
    const placed: Array<{ x: number; y: number; r: number }> = []
    for (const r of radii) {
        for (let attempt = 0; attempt < 40; attempt++) {
            const cx = RIM + r + 2 + Math.floor(rand() * (TILE - 2 * RIM - 2 * r - 4))
            const cy = RIM + r + 2 + Math.floor(rand() * (TILE - 2 * RIM - 2 * r - 4))
            if (placed.some((p) => (p.x - cx) ** 2 + (p.y - cy) ** 2 < (p.r + r + 2) ** 2)) continue
            placed.push({ x: cx, y: cy, r })
            const dark = rand() < 0.5
            const body: RGB = dark ? [104, 74, 48] : [150, 116, 78]
            stone(data, rand, cx, cy, r, body, [64, 44, 28], dark ? [140, 106, 72] : [186, 152, 110])
            break
        }
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
        const dx = RIM + Math.floor(rand() * (TILE - 2 * RIM))
        const dy = RIM + Math.floor(rand() * (TILE - 2 * RIM))
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
    // Перьевая рамка: внешний край — чистый EDGE_SEED (стык между тайлами
    // попиксельно совпадает), внутрь вес сходит на нет. В зоне бленда только
    // фоновый шум — дискрет живёт строго в интерьере, кольца нет.
    if (seed !== EDGE_SEED) featherSharedRim(data, renderVariant(recipe, mulberry32(EDGE_SEED)))
    return { w: TILE, h: TILE, data }
}

// Кромка, общая для всех вариантов рецепта: тот же рецепт с фиксированным
// seed. Дискретный шум живёт строго внутри, рамка копируется попиксельно.
const EDGE_SEED = 0
const RIM = 12

function renderVariant(recipe: string, rand: () => number): Uint8Array {
    if (recipe === 'grass1') return renderGrass1(rand)
    if (recipe === 'grass2') return renderGrass2(rand)
    if (recipe === 'grass3') return renderGrass3(rand)
    if (recipe === 'grass4') return renderGrass4(rand)
    if (recipe === 'earth') return renderEarth(rand)
    if (recipe === 'asphalt') return renderAsphalt(rand)
    fail(`неизвестный рецепт: ${recipe} (известные: ${ALL_RECIPES.join(', ')})`)
}

function featherSharedRim(data: Uint8Array, edge: Uint8Array): void {
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
