import { describe, expect, test } from 'bun:test'
import type { ProgressStore } from './progress.ts'
import { loadDone, markDone, resetFallback } from './progress.ts'

function memStore(initial: Record<string, string> = {}): ProgressStore {
    const data: Record<string, string> = { ...initial }
    return {
        getItem: (key) => data[key] ?? null,
        setItem: (key, value) => {
            data[key] = value
        },
    }
}

describe('progress', () => {
    test('запись при победе читается после «перезагрузки»', () => {
        const store = memStore()
        expect(loadDone(store).has('001')).toBe(false)
        markDone('001', store)
        // «перезагрузка» — тот же store, новый вызов load
        expect(loadDone(store)).toEqual(new Set(['001']))
    })

    test('skip не пишет: без markDone прогресс пуст', () => {
        const store = memStore()
        expect(loadDone(store).size).toBe(0)
    })

    test('битый JSON и пустой id не роняют', () => {
        const store = memStore({ 'rabik.done.v1': 'not-json' })
        expect(loadDone(store).size).toBe(0)
        expect(markDone('', store).size).toBe(0)
    })

    test('in-memory fallback при недоступном storage', () => {
        resetFallback()
        markDone('007', null)
        expect(loadDone(null)).toEqual(new Set(['007']))
        resetFallback()
    })
})
