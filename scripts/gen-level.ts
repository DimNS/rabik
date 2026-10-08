import { parseLevel } from '../src/data/levels-loader.ts'
import { type Difficulty, generateLevel } from '../src/gen/generator.ts'
import { solveLevel } from '../src/gen/solver.ts'

function fail(message: string): never {
    console.error(`gen-level: ${message}`)
    process.exit(1)
}

function argValue(name: string): string | undefined {
    const i = Bun.argv.indexOf(name)
    if (i < 0) return undefined
    const v = Bun.argv[i + 1]
    if (v === undefined || v.startsWith('--')) fail(`флаг ${name} требует значения`)
    return v
}

const difficulty = (argValue('--difficulty') ?? 'normal') as Difficulty
if (difficulty !== 'easy' && difficulty !== 'normal' && difficulty !== 'hard') {
    fail('--difficulty должен быть easy, normal или hard')
}
const seed = argValue('--seed')
const id = argValue('--id')
const out = argValue('--out')

const level = generateLevel({ difficulty, ...(seed === undefined ? {} : { seed }), ...(id ? { id } : {}) })
// Валидация формата перед выводом: падает с причиной при нарушении.
parseLevel({ id: level.id, width: level.width, height: level.height, tiles: level.tiles, start: level.start })
if (!solveLevel(level)) fail('сгенерированный уровень не решается солвером')

const json = `${JSON.stringify({ id: level.id, width: level.width, height: level.height, tiles: level.tiles, start: level.start }, null, 2)}\n`
console.error(`ok ${level.id} ${level.width}x${level.height} seed=${level.seed}${out ? ` -> ${out}` : ''}`)
if (out) {
    await Bun.write(out, json)
} else {
    process.stdout.write(json)
}
