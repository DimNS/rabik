import { findManifestDuplicates, parseManifest } from '../src/data/levels-loader.ts'

const MANIFEST = new URL('../public/data/levels/index.json', import.meta.url)

function fail(message: string): never {
    console.error(`check-levels: ${message}`)
    process.exit(1)
}

let data: unknown
try {
    data = await Bun.file(MANIFEST).json()
} catch {
    fail(`не удалось прочитать ${MANIFEST.pathname}`)
}

try {
    const manifest = parseManifest(data)
    const seeds = manifest.levels.filter((l) => l.seed !== undefined && l.seed !== '---').length
    console.log(`check-levels: ok, уровней ${manifest.levels.length}, уникальных seed ${seeds}`)
} catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const rawLevels = (data as { levels?: unknown })?.levels
    const dups = message.includes('дублирующийся') && Array.isArray(rawLevels) ? findManifestDuplicates(rawLevels) : []
    if (dups.length === 0) fail(message)
    console.error('check-levels: найдены дубликаты:')
    for (const dup of dups) {
        const where = dup.entries.map((e) => `№${e.index} (${e.id})`).join(', ')
        console.error(`  ${dup.kind} "${dup.value}": записи ${where}`)
    }
    process.exit(1)
}
