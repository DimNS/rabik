export type Rng = () => number

// Хеш строкового seed в uint32 (FNV-1a).
export function hashSeed(seed: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

export function mulberry32(seed: number): Rng {
    let a = seed >>> 0
    return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function randomUint32(): number {
    const cryptoObj = globalThis.crypto as Crypto | undefined
    if (cryptoObj?.getRandomValues) {
        return cryptoObj.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 0x100000000)
    }
    return Math.floor(Math.random() * 0x100000000)
}

export function createRng(seed?: string): Rng {
    return mulberry32(seed === undefined ? randomUint32() : hashSeed(seed))
}

// Случайный seed строкой: подставляется в generateLevel при отсутствии seed,
// чтобы фактическое значение было видно в id и поле seed уровня.
export function randomSeed(): string {
    return randomUint32().toString(16).padStart(8, '0')
}
