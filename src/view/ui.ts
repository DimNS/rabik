import type { LevelManifest } from '../core/level-types.ts'

export type ModalKind = 'none' | 'menu' | 'win' | 'fail'

export interface UiCallbacks {
    onPlay(): void
    onPick(id: string): void
    onMenu(): void
    onBack(): void
    onRestart(): void
    onNext(): void
    onClose(): void
}

export const UI_ASSETS = {
    logo: 'public/assets/ui/logo.png',
    play: 'public/assets/ui/button/play.png',
    backBtn: 'public/assets/ui/button/back.png',
    done: 'public/assets/ui/lvlsel/done.png',
    none: 'public/assets/ui/lvlsel/none.png',
    art: 'public/assets/ui/lvlsel/art.png',
    win: 'public/assets/ui/modal/win.png',
    fail: 'public/assets/ui/modal/fail.png',
    menu: 'public/assets/ui/modal/menu.png',
}

interface Zone {
    left: number
    top: number
    width: number
    height: number
}

// Хит-зоны кнопок поверх цельных PNG модалок, в % от размера картинки. Калибровать здесь.
export const MODAL_ZONES: Record<string, Record<string, Zone>> = {
    win: {
        back: { left: 4, top: 52, width: 44, height: 43 },
        next: { left: 52, top: 52, width: 44, height: 43 },
    },
    fail: {
        back: { left: 4, top: 48, width: 30, height: 47 },
        restart: { left: 35, top: 48, width: 30, height: 47 },
        skip: { left: 66, top: 48, width: 30, height: 47 },
    },
    menu: {
        back: { left: 4, top: 40, width: 30, height: 45 },
        restart: { left: 35, top: 40, width: 29, height: 45 },
        next: { left: 65, top: 40, width: 31, height: 45 },
        close: { left: 80, top: 0, width: 19, height: 28 },
    },
}

export function nextLevelId(levels: { id: string }[], currentId: string): string | null {
    const i = levels.findIndex((l) => l.id === currentId)
    return levels[i + 1]?.id ?? null
}

function zoneButton(label: string, zone: Zone, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('aria-label', label)
    b.style.position = 'absolute'
    b.style.left = `${zone.left}%`
    b.style.top = `${zone.top}%`
    b.style.width = `${zone.width}%`
    b.style.height = `${zone.height}%`
    b.style.background = 'rgba(0,0,0,0)'
    b.style.border = 'none'
    b.style.cursor = 'pointer'
    b.addEventListener('click', onClick)
    return b
}

export interface Ui {
    showEntry(): void
    showLevels(manifest: LevelManifest, done: Set<string>): void
    showGame(seed?: string): void
    showModal(kind: ModalKind): void
}

export function createUi(cb: UiCallbacks): Ui {
    for (const src of Object.values(UI_ASSETS)) {
        const img = new Image()
        img.src = src
    }

    const root = document.createElement('div')
    root.id = 'ui'
    root.style.position = 'fixed'
    root.style.inset = '0'
    root.style.zIndex = '10'
    root.style.pointerEvents = 'none'
    document.body.append(root)

    const entry = document.createElement('div')
    entry.style.cssText =
        'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:#111;pointer-events:auto'
    const logo = document.createElement('img')
    logo.src = UI_ASSETS.logo
    logo.alt = 'Road builder'
    logo.style.cssText = 'max-width:min(420px,86vw);width:86vw'
    const play = document.createElement('button')
    play.type = 'button'
    play.setAttribute('aria-label', 'play')
    play.style.cssText = 'background:none;border:none;cursor:pointer;padding:0'
    const playImg = document.createElement('img')
    playImg.src = UI_ASSETS.play
    playImg.alt = 'play'
    playImg.style.cssText = 'width:220px;max-width:60vw'
    play.append(playImg)
    play.addEventListener('click', cb.onPlay)
    entry.append(logo, play)

    const levels = document.createElement('div')
    levels.style.cssText =
        'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;gap:16px;background:#111;padding:24px 16px;pointer-events:auto;overflow:auto'
    const list = document.createElement('div')
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:16px;justify-content:center'
    const art = document.createElement('img')
    art.src = UI_ASSETS.art
    art.alt = ''
    art.style.cssText = 'max-width:min(520px,92vw);width:92vw;margin-top:auto'
    levels.append(list, art)

    const hud = document.createElement('button')
    hud.type = 'button'
    hud.setAttribute('aria-label', 'menu')
    hud.style.cssText =
        'position:absolute;top:12px;left:12px;display:none;background:none;border:none;cursor:pointer;pointer-events:auto;padding:0'
    const hudImg = document.createElement('img')
    hudImg.src = UI_ASSETS.backBtn
    hudImg.alt = 'menu'
    hudImg.style.cssText = 'width:48px;height:48px'
    hud.append(hudImg)
    hud.addEventListener('click', cb.onMenu)

    const seedBadge = document.createElement('div')
    seedBadge.style.cssText =
        'position:absolute;top:12px;right:12px;display:none;color:#fff;font:14px/1 monospace;text-shadow:0 1px 2px #000;pointer-events:none'

    const modal = document.createElement('div')
    modal.style.cssText =
        'position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto'
    const backdrop = document.createElement('div')
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.65)'
    const card = document.createElement('div')
    card.style.cssText = 'position:relative;width:min(480px,92vw)'
    const modalImg = document.createElement('img')
    modalImg.alt = ''
    modalImg.style.cssText = 'display:block;width:100%'
    card.append(modalImg)
    modal.append(backdrop, card)

    root.append(entry, levels, hud, seedBadge, modal)

    function renderModal(kind: ModalKind): void {
        for (const b of card.querySelectorAll('button')) b.remove()
        if (kind === 'none') {
            modal.style.display = 'none'
            return
        }
        modal.style.display = 'flex'
        modalImg.src = kind === 'win' ? UI_ASSETS.win : kind === 'fail' ? UI_ASSETS.fail : UI_ASSETS.menu
        const zones = MODAL_ZONES[kind]
        if (!zones) return
        const actions: Record<string, () => void> = {
            back: cb.onBack,
            restart: cb.onRestart,
            next: cb.onNext,
            skip: cb.onNext,
            close: cb.onClose,
        }
        for (const [name, zone] of Object.entries(zones)) {
            const fn = actions[name]
            if (!zone || !fn) continue
            card.append(zoneButton(name, zone, fn))
        }
    }

    return {
        showEntry(): void {
            entry.style.display = 'flex'
            levels.style.display = 'none'
            hud.style.display = 'none'
            seedBadge.style.display = 'none'
            renderModal('none')
        },
        showLevels(manifest: LevelManifest, done: Set<string>): void {
            entry.style.display = 'none'
            hud.style.display = 'none'
            seedBadge.style.display = 'none'
            renderModal('none')
            levels.style.display = 'flex'
            list.textContent = ''
            for (const item of manifest.levels) {
                const b = document.createElement('button')
                b.type = 'button'
                b.setAttribute('aria-label', `level ${item.id}`)
                b.style.cssText =
                    'background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:#fff'
                const img = document.createElement('img')
                img.src = done.has(item.id) ? UI_ASSETS.done : UI_ASSETS.none
                img.alt = done.has(item.id) ? `done ${item.id}` : `level ${item.id}`
                img.style.cssText = 'width:72px;height:72px'
                const label = document.createElement('span')
                label.textContent = item.id
                label.style.cssText = 'font-size:14px;max-width:96px'
                b.append(img, label)
                b.addEventListener('click', () => cb.onPick(item.id))
                list.append(b)
            }
        },
        showGame(seed?: string): void {
            entry.style.display = 'none'
            levels.style.display = 'none'
            hud.style.display = 'block'
            if (seed === undefined) {
                seedBadge.style.display = 'none'
            } else {
                seedBadge.textContent = seed
                seedBadge.style.display = 'block'
            }
            renderModal('none')
        },
        showModal(kind: ModalKind): void {
            if (kind === 'none') renderModal('none')
            else {
                hud.style.display = 'block'
                renderModal(kind)
            }
        },
    }
}
