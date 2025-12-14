import type { Juuboku } from '../types/game'
import { distributeJuubokuStats } from './juuboku'

/**
 * 若党補充のコスト
 */
export const RETAINER_REPLACEMENT_COST = {
    money: 100,  // 100両
    rice: 0.2    // 0.2石
}

/**
 * ランダムな整数を生成
 */
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 補充用の若党を生成（4ステータス、能力合計200〜270）
 */
export function generateReplacementRetainer(nextId: number): Juuboku {
    const total = randomInt(200, 270)
    const stats = distributeJuubokuStats(total, 100)
    
    return {
        id: nextId,
        combat: stats.combat,
        command: stats.command,
        intelligence: stats.intelligence,
        administration: stats.administration,
        injuryStatus: 'normal',
        injuryWeeksRemaining: 0
    }
}

/**
 * 若党を補充できるかチェック
 */
export function canReplaceRetainer(
    currentJuubokuCount: number,
    money: number,
    rice: number
): boolean {
    // 若党が2名未満で、資金が足りる場合のみ補充可能
    return currentJuubokuCount < 2 &&
        money >= RETAINER_REPLACEMENT_COST.money &&
        rice >= RETAINER_REPLACEMENT_COST.rice
}
