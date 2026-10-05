import type { Dir } from '../core/game-rules.ts'
import { decodeSwipe } from './direction.ts'

// ponytail: порог подобран «по ощущению»; уточняется на реальном тач-устройстве (см. Open Questions в design.md)
export const SWIPE_THRESHOLD = 24

export function attachPointer(queue: Dir[], canvas: HTMLCanvasElement): void {
    let startX = 0
    let startY = 0
    let tracking = false

    canvas.addEventListener('pointerdown', (event) => {
        startX = event.clientX
        startY = event.clientY
        tracking = true
    })

    window.addEventListener('pointerup', (event) => {
        if (!tracking) return
        tracking = false
        const dir = decodeSwipe(event.clientX - startX, event.clientY - startY, SWIPE_THRESHOLD)
        if (dir) queue.push(dir)
    })
}
