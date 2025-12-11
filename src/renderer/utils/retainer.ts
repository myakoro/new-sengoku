import type { Juuboku } from '../types/game'

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
 * 補充用の若党を生成
 */
export function generateReplacementRetainer(nextId: number): Juuboku {
    return {
        id: nextId,
        combat: randomInt(35, 55),  // 平均45（初期若党よりやや低め）
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
    // 若党が3名未満で、資金が足りる場合のみ補充可能
    return currentJuubokuCount < 3 &&
        money >= RETAINER_REPLACEMENT_COST.money &&
        rice >= RETAINER_REPLACEMENT_COST.rice
}
