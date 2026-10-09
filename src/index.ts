import { type Dir, tryMove } from './core/game-rules.ts'
import { createGameState, type GameState } from './core/game-state.ts'
import { loadLevel, loadManifest } from './data/levels-loader.ts'
import { loadDone, markDone } from './data/progress.ts'
import { attachKeyboard } from './input/keyboard.ts'
import { attachPointer } from './input/pointer.ts'
import { createGameLoop } from './loop/game-loop.ts'
import { setupCanvas } from './view/canvas.ts'
import { computeLayout, type Layout, readDpr } from './view/layout.ts'
import { createRenderer } from './view/renderer.ts'
import { createSpriteAnimator } from './view/sprite-anim.ts'
import { loadAnimationAtlas, loadAtlas } from './view/sprite-atlas.ts'
import { createUi, type ModalKind, nextLevelId, type Ui } from './view/ui.ts'

const TILES_JSON = 'public/assets/sprites/tiles.json'
const RABBIT_JSON = 'public/assets/sprites/rabbit.json'

function requireCanvas(): HTMLCanvasElement {
    const canvas = document.getElementById('game')
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('index: не найден <canvas id="game">')
    return canvas
}

function showError(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    const pre = document.createElement('pre')
    pre.textContent = `Ошибка загрузки: ${message}`
    document.body.append(pre)
}

async function bootstrap(): Promise<void> {
    const canvas = requireCanvas()
    const game = setupCanvas(canvas)

    const [tiles, rabbit, manifest] = await Promise.all([
        loadAtlas(TILES_JSON),
        loadAnimationAtlas(RABBIT_JSON),
        loadManifest(),
    ])
    if (manifest.levels.length === 0) throw new Error('манифест: нет ни одного уровня')

    const rabbitFrames: [name: string, duration: number][] = []
    for (const [name, frame] of Object.entries(rabbit.frames)) {
        if (!name.startsWith('rabbit_')) continue
        if (frame.duration === undefined) throw new Error(`анимация: кадр "${name}" без duration`)
        rabbitFrames.push([name, frame.duration])
    }
    if (rabbitFrames.length === 0) throw new Error('анимация: в атласе нет кадров rabbit_*')
    rabbitFrames.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    const animator = createSpriteAnimator(
        rabbitFrames.map(([name]) => name),
        rabbitFrames.map(([, duration]) => duration),
    )

    let layout: Layout = computeLayout(canvas.clientWidth || 300, canvas.clientHeight || 300, 1, 1, readDpr())
    let facing: Dir = 'up'
    const renderer = createRenderer({
        ctx: game.ctx,
        tiles,
        rabbit,
        animator,
        getLayout: () => layout,
        getFacing: () => facing,
    })

    const queue: Dir[] = []
    attachKeyboard(queue)
    attachPointer(queue, canvas)

    let state: GameState | null = null
    let currentId = ''
    let screen: 'entry' | 'levels' | 'game' = 'entry'
    let modal: ModalKind = 'none'
    let ui!: Ui

    const loop = createGameLoop(
        (dtMs) => {
            animator.advance(dtMs)
            if (!state || screen !== 'game' || modal !== 'none') {
                queue.length = 0
                return
            }
            const dir = queue.shift()
            if (dir && tryMove(state, dir)) {
                facing = dir
                renderer.redrawTile(state.player.x, state.player.y, state)
            }
            if (state.solved) {
                markDone(currentId)
                modal = 'win'
                ui.showModal('win')
            } else if (state.stuck) {
                modal = 'fail'
                ui.showModal('fail')
            }
        },
        () => {
            if (state) renderer.render(state)
        },
    )

    async function startLevel(id: string): Promise<void> {
        const entry = manifest.levels.find((l) => l.id === id)
        if (!entry) throw new Error(`манифест: уровень "${id}" не найден`)
        const level = await loadLevel(entry.id)
        state = createGameState(level)
        currentId = entry.id
        facing = 'up'
        screen = 'game'
        modal = 'none'
        queue.length = 0
        layout = computeLayout(canvas.clientWidth, canvas.clientHeight, state.width, state.height, readDpr())
        renderer.renderAll(state)
        ui.showGame(entry.seed)
        loop.start()
    }

    function openLevels(): void {
        screen = 'levels'
        modal = 'none'
        queue.length = 0
        ui.showLevels(manifest, loadDone())
    }

    async function goNext(): Promise<void> {
        const next = nextLevelId(manifest.levels, currentId)
        if (!next) openLevels()
        else await startLevel(next).catch(showError)
    }

    ui = createUi({
        onPlay: () => openLevels(),
        onPick: (id) => startLevel(id).catch(showError),
        onMenu: () => {
            if (screen !== 'game' || !state) return
            modal = 'menu'
            ui.showModal('menu')
        },
        onBack: () => openLevels(),
        onRestart: () => {
            if (currentId) startLevel(currentId).catch(showError)
        },
        onNext: () => void goNext(),
        onClose: () => {
            modal = 'none'
            ui.showModal('none')
        },
    })

    window.addEventListener('resize', () => {
        game.resize()
        if (state) {
            layout = computeLayout(canvas.clientWidth, canvas.clientHeight, state.width, state.height, readDpr())
            renderer.renderAll(state)
        }
    })

    ui.showEntry()
}

bootstrap().catch(showError)
