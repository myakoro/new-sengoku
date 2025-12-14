import type { Stats } from '../types/game'

export const JUUBOKU_STAT_KEYS = ['combat', 'command', 'intelligence', 'administration'] as const

/**
 * 合計値を4ステータスにランダム配分する（各ステータスは上限cap）
 */
export function distributeJuubokuStats(total: number, cap = 100): Stats {
    const stats: Stats = {
        combat: 0,
        command: 0,
        intelligence: 0,
        administration: 0,
    }

    const keys = JUUBOKU_STAT_KEYS

    for (let i = 0; i < total; i++) {
        const available = keys.filter((k) => stats[k] < cap)
        if (available.length === 0) break
        const k = available[Math.floor(Math.random() * available.length)]
        stats[k] += 1
    }

    return stats
}
