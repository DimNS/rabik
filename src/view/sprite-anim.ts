export interface SpriteAnimator {
    advance(dtMs: number): void
    current(): string
}

export function createSpriteAnimator(frames: string[], durations: number[]): SpriteAnimator {
    if (frames.length === 0) throw new Error('аниматор: список кадров пуст')
    if (frames.length !== durations.length) throw new Error('аниматор: кадров и длительностей разное количество')
    if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
        throw new Error('аниматор: длительность кадра должна быть положительной')
    }

    let elapsed = 0
    let index = 0

    return {
        advance(dtMs: number): void {
            elapsed += dtMs
            let duration = durations[index]
            while (duration !== undefined && elapsed >= duration) {
                elapsed -= duration
                index = (index + 1) % frames.length
                duration = durations[index]
            }
        },
        current(): string {
            const frame = frames[index]
            if (frame === undefined) throw new Error('аниматор: нет текущего кадра')
            return frame
        },
    }
}
