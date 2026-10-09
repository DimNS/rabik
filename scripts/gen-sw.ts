import { type Dirent, readdirSync, readFileSync } from 'node:fs'

const ROOT = new URL('../', import.meta.url).pathname
const SW = `${ROOT}sw.js`
const START = '// @generated:precache:start'
const END = '// @generated:precache:end'

function fail(message: string): never {
    console.error(`gen-sw: ${message}`)
    process.exit(1)
}

// Рекурсивно собирает относительные пути файлов с нужными расширениями.
function scan(dir: string, exts: string[]): string[] {
    let dirents: Dirent[]
    try {
        dirents = readdirSync(`${ROOT}${dir}`, { withFileTypes: true })
    } catch {
        fail(`нет каталога ${dir}`)
    }
    const out: string[] = []
    for (const entry of dirents) {
        const rel = `${dir}/${entry.name}`
        if (entry.isDirectory()) out.push(...scan(rel, exts))
        else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(`./${rel}`)
    }
    return out.sort()
}

const urls = [
    './index.html',
    './index.js',
    './manifest.webmanifest',
    ...scan('icons', ['.png']),
    ...scan('public/assets/sprites', ['.json', '.jpg', '.png']),
    ...scan('public/assets/ui', ['.png', '.jpg']),
    ...scan('public/data/levels', ['.json']),
]

let sw: string
try {
    sw = readFileSync(SW, 'utf8')
} catch {
    fail(`не удалось прочитать ${SW}`)
}
if (!sw.includes(START) || !sw.includes(END)) fail(`в ${SW} нет маркеров ${START} / ${END}`)
const block = [START, ...urls.map((url) => `    '${url}',`), `    ${END}`].join('\n')
const next = sw.replace(new RegExp(`${START}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), () => block)
await Bun.write(SW, next)
console.log(`sw.js: precache ${urls.length} файлов`)
