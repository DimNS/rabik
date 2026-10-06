import { describe, expect, test } from 'bun:test'
import { decodeJpg, encodeJpg } from './atlas-codec.ts'

describe('encodeJpg', () => {
    test('round-trip decode(encode(x)) держит размер и цвета в допуске JPG', () => {
        const w = 16
        const h = 16
        const rgba = new Uint8Array(w * h * 4)
        for (let i = 0; i < w * h; i++) {
            rgba[i * 4] = 120
            rgba[i * 4 + 1] = 180
            rgba[i * 4 + 2] = 90
            rgba[i * 4 + 3] = 255
        }
        const jpg = encodeJpg(w, h, rgba, 85)
        // Сигнатура JPEG.
        expect(jpg[0]).toBe(0xff)
        expect(jpg[1]).toBe(0xd8)
        const back = decodeJpg(jpg, 'round-trip.jpg')
        expect(back.w).toBe(w)
        expect(back.h).toBe(h)
        let diff = 0
        for (let i = 0; i < w * h * 4; i++) diff += Math.abs((back.data[i] ?? 0) - (rgba[i] ?? 0))
        expect(diff / (w * h * 4)).toBeLessThan(15)
    })
})
