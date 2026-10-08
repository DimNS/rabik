import { type Dir, tryMove } from './core/game-rules.ts'
import { createGameState } from './core/game-state.ts'
import { loadLevel, loadManifest } from './data/levels-loader.ts'
import { attachKeyboard } from './input/keyboard.ts'
import { attachPointer } from './input/pointer.ts'
import { createGameLoop } from './loop/game-loop.ts'
import { setupCanvas } from './view/canvas.ts'
import { computeLayout, type Layout, readDpr } from './view/layout.ts'
import { createRenderer } from './view/renderer.ts'
import { createSpriteAnimator } from './view/sprite-anim.ts'
import { loadAnimationAtlas, loadAtlas } from './view/sprite-atlas.ts'

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
    const entry = manifest.levels[0]
    if (!entry) throw new Error('манифест: нет ни одного уровня')
    const level = await loadLevel(entry.file, entry.id)
    const state = createGameState(level)

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

    let layout: Layout = computeLayout(canvas.clientWidth, canvas.clientHeight, state.width, state.height, readDpr())
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

    let announced = false
    let announcedGameOver = false
    const loop = createGameLoop(
        (dtMs) => {
            animator.advance(dtMs)
            const dir = queue.shift()
            if (dir && tryMove(state, dir)) {
                facing = dir
                renderer.redrawTile(state.player.x, state.player.y, state)
            }
            if (state.solved && !announced) {
                announced = true
                console.log('Уровень решён: вся земля замощена')
            } else if (state.stuck && !announcedGameOver) {
                announcedGameOver = true
                console.log('Игра окончена: ходов больше нет')
            }
        },
        () => renderer.render(state),
    )

    window.addEventListener('resize', () => {
        game.resize()
        layout = computeLayout(canvas.clientWidth, canvas.clientHeight, state.width, state.height, readDpr())
        renderer.renderAll(state)
    })

    renderer.renderAll(state)
    loop.start()
}

bootstrap().catch(showError)
