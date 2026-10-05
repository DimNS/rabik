// ponytail: clamp dt в 100 мс вместо полного учёта скрытого времени вкладки; после возврата на вкладку
// анимация дёргается максимум на 100 мс, а не прыгает на минуту простоя
const MAX_DT_MS = 100

export interface GameLoop {
    start(): void
    stop(): void
}

export function createGameLoop(update: (dtMs: number) => void, render: () => void): GameLoop {
    let rafId = 0
    let last = 0
    let running = false

    function frame(now: number): void {
        if (!running) return
        const dt = Math.min(now - last, MAX_DT_MS)
        last = now
        update(dt)
        render()
        rafId = requestAnimationFrame(frame)
    }

    return {
        start(): void {
            if (running) return
            running = true
            last = performance.now()
            rafId = requestAnimationFrame(frame)
        },
        stop(): void {
            running = false
            cancelAnimationFrame(rafId)
        },
    }
}
