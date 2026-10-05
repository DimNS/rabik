import type { Dir } from '../core/game-rules.ts'
import { decodeKey } from './direction.ts'

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']

export function attachKeyboard(queue: Dir[]): void {
    window.addEventListener('keydown', (event) => {
        if (ARROW_KEYS.includes(event.key)) event.preventDefault()
        const dir = decodeKey(event.key, event.repeat)
        if (dir) queue.push(dir)
    })
}
