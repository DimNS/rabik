import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const BASE = 'https://rabik.test/app/'
const SW_URL = `${BASE}sw.js`
const SCRIPT = readFileSync(new URL('../sw.js', import.meta.url), 'utf8')

type RequestLike = string | { url: string }
type Handler = (event: Record<string, unknown>) => void

function createCache() {
    const store = new Map<string, Response>()
    const added: string[] = []
    const failing = new Set<string>()
    const resolve = (input: RequestLike): string => new URL(typeof input === 'string' ? input : input.url, SW_URL).href
    return {
        store,
        added,
        failing,
        async addAll(urls: string[]) {
            for (const url of urls) store.set(resolve(url), new Response('cached'))
        },
        async add(url: string) {
            added.push(url)
            if (failing.has(url)) throw new Error('network')
            store.set(resolve(url), new Response('cached'))
        },
        async match(input: RequestLike): Promise<Response | undefined> {
            return store.get(resolve(input))
        },
        async put(input: RequestLike, response: Response) {
            store.set(resolve(input), response)
        },
    }
}

interface Sw {
    listeners: Map<string, Handler>
    cache: ReturnType<typeof createCache>
    state: { skipped: boolean; claimed: boolean }
}

function loadSw(): Sw {
    const listeners = new Map<string, Handler>()
    const cache = createCache()
    const state = { skipped: false, claimed: false }
    const self = {
        location: new URL(SW_URL),
        addEventListener(type: string, handler: Handler) {
            listeners.set(type, handler)
        },
        async skipWaiting() {
            state.skipped = true
        },
        clients: {
            async claim() {
                state.claimed = true
            },
        },
    }
    const caches = {
        async open() {
            return cache
        },
        async keys() {
            return ['rabik-current']
        },
        async delete() {
            return true
        },
    }
    new Function('self', 'caches', 'fetch', SCRIPT)(self, caches, async () => new Response('network'))
    return { listeners, cache, state }
}

async function fire(sw: Sw, type: string, event: Record<string, unknown> = {}): Promise<void> {
    const waiting: Promise<unknown>[] = []
    sw.listeners.get(type)?.({ ...event, waitUntil: (promise: Promise<unknown>) => waiting.push(promise) })
    await Promise.allSettled(waiting)
}

async function respond(sw: Sw, request: { method: string; url: string; mode: string }): Promise<Response> {
    const waiting: Promise<unknown>[] = []
    let response: Promise<Response> | undefined
    sw.listeners.get('fetch')?.({
        request,
        waitUntil: (promise: Promise<unknown>) => waiting.push(promise),
        respondWith: (promise: Promise<Response>) => {
            response = promise
        },
    })
    if (!response) throw new Error('fetch: обработчик не вернул ответ')
    const result = await response
    await Promise.allSettled(waiting)
    return result
}

describe('service worker', () => {
    test('install кэширует только оболочку и не ждёт уровни', async () => {
        const sw = loadSw()
        await fire(sw, 'install')
        const paths = [...sw.cache.store.keys()].map((url) => url.slice(BASE.length))
        expect(paths).toContain('index.html')
        expect(paths).toContain('index.js')
        expect(paths).toContain('public/data/levels/index.json')
        expect(paths.filter((path) => /^public\/data\/levels\/\d+\.json$/.test(path))).toEqual([])
        expect(sw.state.skipped).toBe(true)
    })

    test('warm докачивает отсутствующие уровни и переживает один сбой', async () => {
        const sw = loadSw()
        sw.cache.failing.add('./public/data/levels/001.json')
        await fire(sw, 'message', { data: 'warm' })
        expect(sw.cache.store.has(`${BASE}public/data/levels/001.json`)).toBe(false)
        expect(sw.cache.store.has(`${BASE}public/data/levels/002.json`)).toBe(true)
        expect(sw.cache.store.has(`${BASE}public/data/levels/200.json`)).toBe(true)
        expect(sw.cache.added).not.toContain('./index.html')
    })

    test('навигация офлайн отдаёт оболочку независимо от URL', async () => {
        const sw = loadSw()
        sw.cache.store.set(`${BASE}index.html`, new Response('shell'))
        const response = await respond(sw, {
            method: 'GET',
            url: `${BASE}index.html?utm_source=homescreen`,
            mode: 'navigate',
        })
        expect(await response.text()).toBe('shell')
    })

    test('остальные GET кэшируются после сети', async () => {
        const sw = loadSw()
        const response = await respond(sw, { method: 'GET', url: `${BASE}public/data/levels/007.json`, mode: 'cors' })
        expect(await response.text()).toBe('network')
        expect(sw.cache.store.has(`${BASE}public/data/levels/007.json`)).toBe(true)
    })
})
