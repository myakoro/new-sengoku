import { PlayerState } from '../types/game'

/**
 * 必要経験値を計算
 */
export function calculateRequiredExp(
    currentValue: number,
    potential: number
): number {
    const base = 100
    const levelPenalty = currentValue * 10
    const potentialPenalty = (currentValue / potential) * 300

    return Math.floor(base + levelPenalty + potentialPenalty)
}

/**
 * 経験値を追加してステータスを成長させる（不変性を保つ）
 */
export function addExperience(
    player: PlayerState,
    type: 'combat' | 'intelligence',
    amount: number
): { leveledUp: boolean; newValue: number; updatedPlayer: PlayerState } {
    const updatedPlayer = {
        ...player,
        exp: { ...player.exp, [type]: player.exp[type] + amount },
        stats: { ...player.stats }
    }

    const currentValue = updatedPlayer.stats[type]
    const potential = updatedPlayer.potential[type]

    // 上限チェック
    if (currentValue >= potential) {
        return { leveledUp: false, newValue: currentValue, updatedPlayer }
    }

    const requiredExp = calculateRequiredExp(currentValue, potential)

    if (updatedPlayer.exp[type] >= requiredExp) {
        updatedPlayer.exp[type] -= requiredExp
        updatedPlayer.stats = { ...updatedPlayer.stats, [type]: currentValue + 1 }
        return { leveledUp: true, newValue: updatedPlayer.stats[type], updatedPlayer }
    }

    return { leveledUp: false, newValue: currentValue, updatedPlayer }
}

/**
 * 複数回の成長判定を行う
 */
export function processExperience(
    player: PlayerState,
    type: 'combat' | 'intelligence',
    amount: number
): { levelUps: number[]; updatedPlayer: PlayerState } {
    const levelUps: number[] = []
    let updatedPlayer = player

    const firstResult = addExperience(updatedPlayer, type, amount)
    updatedPlayer = firstResult.updatedPlayer

    // 連続成長の可能性をチェック
    let result = addExperience(updatedPlayer, type, 0)
    while (result.leveledUp) {
        levelUps.push(result.newValue)
        updatedPlayer = result.updatedPlayer
        result = addExperience(updatedPlayer, type, 0)
    }

    return { levelUps, updatedPlayer }
}
