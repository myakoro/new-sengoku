import { PlayerState, MissionState } from '../types/game'

/**
 * プレイヤーの戦闘力を計算
 */
export function calculatePlayerCombatPower(
    player: PlayerState,
    mission?: MissionState
): number {
    let power = player.stats.combat

    // 従僕（100%）
    player.juuboku.forEach((j) => (power += j.combat))

    // 徒士（100%）
    player.ashigaru.forEach((a) => (power += a.combat))

    // 馬上衆（100%）
    player.bashoShu.forEach((b) => (power += b.combat))

    // 臨時足軽（戦闘力32/人）
    if (mission) {
        power += mission.additionalAshigaru * 32
    }

    return Math.floor(power)
}

/**
 * 戦闘成功率を計算
 */
export function calculateSuccessRate(
    playerPower: number,
    enemyPower: number
): number {
    const base = 50
    const diff = playerPower - enemyPower
    const rate = base + diff * 0.3

    return Math.max(5, Math.min(95, rate))
}

/**
 * 戦闘判定
 */
export function judgeBattle(successRate: number): boolean {
    return Math.random() * 100 < successRate
}

export function calculateBanditCombatPower(bandit: any): number {
    // 士気による補正: 士気40が基準、±1ごとに±1%
    const moraleBonus = (bandit.morale - 40) * 0.01
    return Math.floor(bandit.baseCombatPower * (1 + moraleBonus))
}

/**
 * 盗賊討伐の戦闘判定（損失計算含む）
 */
export function judgeBanditBattle(
    player: PlayerState,
    bandit: any,
    additionalAshigaru: number
): { success: boolean; playerLosses: number; banditLosses: number } {
    const playerPower = calculatePlayerCombatPower(player) + additionalAshigaru * 32
    const banditPower = calculateBanditCombatPower(bandit)
    const successRate = calculateSuccessRate(playerPower, banditPower)

    const success = Math.random() * 100 < successRate

    // 損失計算（簡易版）
    const playerLosses = success
        ? Math.floor(Math.random() * 3)
        : Math.floor(Math.random() * 5) + 2
    const banditLosses = success
        ? bandit.count
        : Math.floor(bandit.count * 0.3)

    return { success, playerLosses, banditLosses }
}
