import { PlayerState, MissionState } from '../types/game'
import { getRetainerCombatPower } from './injury'

/**
 * プレイヤーの戦闘力を計算
 */
export function calculatePlayerCombatPower(
    player: PlayerState,
    mission?: MissionState
): number {
    let power = player.stats.combat

    // 若党（100%）
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

export interface BattleCasualties {
    deaths: number
    severeInjuries: number
    lightInjuries: number
}

/**
 * 戦力比に基づいて死亡・負傷を計算
 */
export function calculateCasualties(powerRatio: number, success: boolean): BattleCasualties {
    const casualties: BattleCasualties = {
        deaths: 0,
        severeInjuries: 0,
        lightInjuries: 0
    }

    if (!success) {
        // 敗北時: 1-2名死亡、2-4名重傷、1-3名軽傷
        casualties.deaths = Math.floor(Math.random() * 2) + 1
        casualties.severeInjuries = Math.floor(Math.random() * 3) + 2
        casualties.lightInjuries = Math.floor(Math.random() * 3) + 1
        return casualties
    }

    // 勝利時: 戦力比に応じて計算
    if (powerRatio >= 5.0) {
        // 5倍以上: 完全無傷
        return casualties
    } else if (powerRatio >= 3.0) {
        // 3倍以上: 0.5%死亡、2%重傷、8%軽傷
        if (Math.random() < 0.005) casualties.deaths = 1
        else if (Math.random() < 0.02) casualties.severeInjuries = 1
        else if (Math.random() < 0.08) casualties.lightInjuries = 1
    } else if (powerRatio >= 2.0) {
        // 2倍以上: 1%死亡、5%重傷、15%軽傷
        if (Math.random() < 0.01) casualties.deaths = 1
        else if (Math.random() < 0.05) casualties.severeInjuries = 1
        else if (Math.random() < 0.15) casualties.lightInjuries = 1
    } else if (powerRatio >= 1.5) {
        // 1.5倍以上: 3%死亡、10%+3%重傷、20%+8%軽傷
        if (Math.random() < 0.03) casualties.deaths = 1

        const severeRoll = Math.random()
        if (severeRoll < 0.03) casualties.severeInjuries = 2
        else if (severeRoll < 0.13) casualties.severeInjuries = 1

        const lightRoll = Math.random()
        if (lightRoll < 0.08) casualties.lightInjuries = 2
        else if (lightRoll < 0.28) casualties.lightInjuries = 1
    } else if (powerRatio >= 1.2) {
        // 1.2倍以上: 5%+2%死亡、15%+8%重傷、25%+12%軽傷
        const deathRoll = Math.random()
        if (deathRoll < 0.02) casualties.deaths = 2
        else if (deathRoll < 0.07) casualties.deaths = 1

        const severeRoll = Math.random()
        if (severeRoll < 0.08) casualties.severeInjuries = 2
        else if (severeRoll < 0.23) casualties.severeInjuries = 1

        const lightRoll = Math.random()
        if (lightRoll < 0.12) casualties.lightInjuries = 2
        else if (lightRoll < 0.37) casualties.lightInjuries = 1
    } else {
        // 1.2倍未満: 10%+5%死亡、20%+10%+5%重傷、25%+15%軽傷
        const deathRoll = Math.random()
        if (deathRoll < 0.05) casualties.deaths = 2
        else if (deathRoll < 0.15) casualties.deaths = 1

        const severeRoll = Math.random()
        if (severeRoll < 0.05) casualties.severeInjuries = 3
        else if (severeRoll < 0.15) casualties.severeInjuries = 2
        else if (severeRoll < 0.35) casualties.severeInjuries = 1

        const lightRoll = Math.random()
        if (lightRoll < 0.15) casualties.lightInjuries = 2
        else if (lightRoll < 0.40) casualties.lightInjuries = 1
    }

    return casualties
}

/**
 * 盗賊討伐の戦闘判定（損失計算含む）
 */
export function judgeBanditBattle(
    player: PlayerState,
    bandit: any,
    additionalAshigaru: number
): {
    success: boolean
    casualties: BattleCasualties
    banditLosses: number
} {
    const playerPower = calculatePlayerCombatPowerForBandit(player) + additionalAshigaru * 32
    const banditPower = calculateBanditCombatPower(bandit)
    const successRate = calculateSuccessRate(playerPower, banditPower)

    const success = Math.random() * 100 < successRate

    // 戦力比に基づいて損失を計算
    const powerRatio = playerPower / banditPower
    const casualties = calculateCasualties(powerRatio, success)

    const banditLosses = success
        ? bandit.count
        : Math.floor(bandit.count * 0.3)

    return { success, casualties, banditLosses }
}

/**
 * プレイヤーの戦闘力を計算（盗賊討伐専用 - 若党100%）
 */
export function calculatePlayerCombatPowerForBandit(player: PlayerState): number {
    let power = player.stats.combat

    // 馬の効果
    if (player.hasHorse) {
        power += 10
    }

    // 若党の戦闘力（盗賊討伐では100%、負傷状態を考慮）
    player.juuboku.forEach(j => {
        power += getRetainerCombatPower(j)
    })

    return power
}
