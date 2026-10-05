import type { CellType } from './level-types.ts'

export function countSoil(grid: CellType[][]): number {
    let n = 0
    for (const row of grid) {
        for (const cell of row) {
            if (cell === 'soil') n++
        }
    }
    return n
}
