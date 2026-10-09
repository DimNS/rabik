import type { LevelData, Vec2 } from '../src/core/level-types.ts'
import { parseLevel } from '../src/data/levels-loader.ts'
import { type Difficulty, generateLevel } from '../src/gen/generator.ts'
import { solveLevel } from '../src/gen/solver.ts'
import { loadAtlas, type SpriteAtlas } from '../src/view/sprite-atlas.ts'

const TILES_JSON = '../public/assets/sprites/tiles.json'
const LEVEL_001_JSON = '../public/data/levels/level-001.json'

function el(id: string): HTMLElement {
    const node = document.getElementById(id)
    if (!node) throw new Error(`preview: не найден #${id}`)
    return node
}

function inputEl(id: string): HTMLInputElement {
    const node = el(id)
    if (!(node instanceof HTMLInputElement)) throw new Error(`preview: #${id} не input`)
    return node
}

function selectEl(id: string): HTMLSelectElement {
    const node = el(id)
    if (!(node instanceof HTMLSelectElement)) throw new Error(`preview: #${id} не select`)
    return node
}

function canvasEl(id: string): HTMLCanvasElement {
    const node = el(id)
    if (!(node instanceof HTMLCanvasElement)) throw new Error(`preview: #${id} не canvas`)
    return node
}

const status = el('status')
const verdict = el('verdict')
const board = el('board')
const visual = canvasEl('visual')
const stepper = el('stepper')
const slider = inputEl('slider')
const stepLabel = el('stepLabel')
const fileInput = inputEl('file')
const diffSel = selectEl('diff')
const seedInput = inputEl('seed')
const genBtn = el('gen')
const saveBtn = el('save')
const load001Btn = el('load001')
const prevBtn = el('prev')
const nextBtn = el('next')
const playBtn = el('play')

let route: Vec2[] | null = null
let level: LevelData | null = null
let timer: ReturnType<typeof setInterval> | null = null
let lastStep = -1
const TS = 44
let atlas: SpriteAtlas | null = null

async function loadTiles(): Promise<void> {
    try {
        atlas = await loadAtlas(TILES_JSON)
        if (level) drawVisual(lastStep)
    } catch {
        visual.style.display = 'none'
    }
}

function drawVisual(step: number): void {
    const a = atlas
    const lvl = level
    if (!lvl || !a) return
    visual.width = lvl.width * TS
    visual.height = lvl.height * TS
    const ctx = visual.getContext('2d')
    if (!ctx) return
    const shown = route ?? []
    const inRoute = new Set(shown.slice(0, step + 1).map((p) => `${p.x},${p.y}`))
    const cur = shown[step]
    lvl.tiles.forEach((row, y) => {
        row.forEach((f, x) => {
            const fr = a.frames[f]?.frame
            if (fr) ctx.drawImage(a.image, fr.x, fr.y, fr.w, fr.h, x * TS, y * TS, TS, TS)
            else {
                ctx.fillStyle = '#f0f'
                ctx.fillRect(x * TS, y * TS, TS, TS)
            }
            if (cur?.x === x && cur?.y === y) {
                ctx.strokeStyle = '#fd0'
                ctx.lineWidth = 3
                ctx.strokeRect(x * TS + 1.5, y * TS + 1.5, TS - 3, TS - 3)
            } else if (inRoute.has(`${x},${y}`)) {
                ctx.fillStyle = 'rgba(0,0,0,0.35)'
                ctx.fillRect(x * TS, y * TS, TS, TS)
            }
        })
    })
}

function say(t: string): void {
    status.textContent = t
}

function show(lvl: LevelData, r: Vec2[] | null): void {
    level = lvl
    route = r
    saveBtn.toggleAttribute('disabled', false)
    const soil = lvl.grid.flat().filter((c) => c === 'soil').length
    if (r) {
        verdict.className = ''
        verdict.textContent = `Валиден: ${lvl.id} ${lvl.width}×${lvl.height}, soil ${soil}, seed ${lvl.seed ?? '—'}. Решаем, ходов ${r.length - 1}.`
        verdict.className = 'ok'
        stepper.hidden = false
        slider.max = String(r.length - 1)
        slider.value = String(r.length - 1)
        draw(r.length - 1)
    } else {
        verdict.textContent = `Валиден: ${lvl.id} ${lvl.width}×${lvl.height}, soil ${soil}, seed ${lvl.seed ?? '—'}. Нерешаем — прогон недоступен.`
        verdict.className = 'bad'
        stepper.hidden = true
        draw(-1)
    }
}

function failShow(e: unknown): void {
    level = null
    route = null
    stepper.hidden = true
    saveBtn.toggleAttribute('disabled', true)
    verdict.textContent = `Невалиден: ${e instanceof Error ? e.message : String(e)}`
    verdict.className = 'bad'
    board.textContent = ''
    board.style.gridTemplateColumns = ''
}

function draw(step: number): void {
    const lvl = level
    if (!lvl) return
    const shown = route ?? []
    const inRoute = new Set(shown.slice(0, step + 1).map((p) => `${p.x},${p.y}`))
    const cur = shown[step]
    board.style.gridTemplateColumns = `repeat(${lvl.width}, 44px)`
    board.textContent = ''
    lvl.tiles.forEach((row, y) => {
        row.forEach((f, x) => {
            const d = document.createElement('div')
            const t = lvl.grid[y]?.[x] ?? '?'
            d.className = `cell ${cur?.x === x && cur?.y === y ? 'step ' : ''}${inRoute.has(`${x},${y}`) ? 'done ' : ''}${t}`
            d.textContent = f
            d.title = `${x},${y} ${f}`
            board.append(d)
        })
    })
    stepLabel.textContent = route ? `шаг ${step} / ${shown.length - 1}` : ''
    lastStep = step
    drawVisual(step)
}

function check(raw: unknown): void {
    const lvl = parseLevel(raw)
    // parseLevel seed не возвращает — пробрасываем для вердикта отдельно.
    const seed = (raw as { seed?: unknown }).seed
    const withSeed: LevelData = typeof seed === 'string' ? { ...lvl, seed } : lvl
    show(withSeed, solveLevel(withSeed))
    say(`Проверено в памяти: ${withSeed.id}.`)
}

fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0]
    if (!f) return
    f.text()
        .then((text) => check(JSON.parse(text) as unknown))
        .catch((err: unknown) => failShow(err))
})

load001Btn.onclick = () => {
    fetch(LEVEL_001_JSON)
        .then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json() as Promise<unknown>
        })
        .then((data) => check(data))
        .catch((err: unknown) => failShow(err))
}

genBtn.onclick = () => {
    try {
        const difficulty = diffSel.value as Difficulty
        if (difficulty !== 'easy' && difficulty !== 'normal' && difficulty !== 'hard') {
            throw new Error('--difficulty должен быть easy, normal или hard')
        }
        const seed = seedInput.value || undefined
        const lvl = generateLevel({ difficulty, ...(seed === undefined ? {} : { seed }) })
        check({ id: lvl.id, width: lvl.width, height: lvl.height, tiles: lvl.tiles, start: lvl.start, seed: lvl.seed })
    } catch (err: unknown) {
        failShow(err)
    }
}

saveBtn.onclick = () => {
    if (!level) return
    const raw = { id: level.id, width: level.width, height: level.height, tiles: level.tiles, start: level.start }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`${JSON.stringify(raw, null, 2)}\n`], { type: 'application/json' }))
    a.download = `${level.id}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    say(`Сохранён ${level.id}. Для повтора той же генерации: seed ${level.seed ?? '—'}.`)
}

slider.oninput = () => {
    stop()
    draw(Number(slider.value))
}

prevBtn.onclick = () => {
    stop()
    slider.value = String(Math.max(0, Number(slider.value) - 1))
    draw(Number(slider.value))
}

nextBtn.onclick = () => {
    stop()
    slider.value = String(Math.min(Number(slider.max), Number(slider.value) + 1))
    draw(Number(slider.value))
}

function stop(): void {
    if (timer !== null) {
        clearInterval(timer)
        timer = null
    }
}

playBtn.onclick = () => {
    if (timer !== null) {
        stop()
        return
    }
    slider.value = '0'
    draw(0)
    timer = setInterval(() => {
        const v = Number(slider.value) + 1
        if (v > Number(slider.max)) {
            stop()
            return
        }
        slider.value = String(v)
        draw(v)
    }, 300)
}

window.__preview = { check, generateLevel, solveLevel, parseLevel }
void loadTiles()

declare global {
    interface Window {
        __preview: unknown
    }
}
