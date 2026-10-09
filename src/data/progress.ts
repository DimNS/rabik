export const PROGRESS_KEY = 'rabik.done.v1'

export interface ProgressStore {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

let memFallback: string[] = []

function defaultStore(): ProgressStore | null {
    try {
        const s = globalThis.localStorage
        if (!s) return null
        return s as unknown as ProgressStore
    } catch {
        return null
    }
}

function parseIds(raw: string | null): string[] {
    if (!raw) return []
    try {
        const data: unknown = JSON.parse(raw)
        if (!Array.isArray(data)) return []
        return data.filter((v): v is string => typeof v === 'string' && v !== '')
    } catch {
        return []
    }
}

export function loadDone(store?: ProgressStore | null): Set<string> {
    const s = store === undefined ? defaultStore() : store
    if (!s) return new Set(memFallback)
    try {
        return new Set(parseIds(s.getItem(PROGRESS_KEY)))
    } catch {
        return new Set(memFallback)
    }
}

export function markDone(id: string, store?: ProgressStore | null): Set<string> {
    if (!id) return loadDone(store)
    const done = loadDone(store)
    done.add(id)
    const ids = [...done]
    const s = store === undefined ? defaultStore() : store
    if (!s) {
        memFallback = ids
        return done
    }
    try {
        s.setItem(PROGRESS_KEY, JSON.stringify(ids))
    } catch {
        memFallback = ids
    }
    return done
}

export function resetFallback(): void {
    memFallback = []
}
