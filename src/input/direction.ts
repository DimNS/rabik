import type { Dir } from '../core/game-rules.ts'

export function decodeKey(key: string, repeat: boolean): Dir | null {
    if (repeat) return null
    switch (key) {
        case 'ArrowUp':
            return 'up'
        case 'ArrowDown':
            return 'down'
        case 'ArrowLeft':
            return 'left'
        case 'ArrowRight':
            return 'right'
        default:
            return null
    }
}

export function decodeSwipe(dx: number, dy: number, threshold: number): Dir | null {
    if (dx === 0 && dy === 0) return null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
    return dy > 0 ? 'down' : 'up'
}
