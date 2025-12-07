import { BanditState, BanditRank, StrategyType } from '../types/game'
import { BANDIT_RANKS } from '../constants/game'

/**
 * ランダムな整数を生成
 */
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 盗賊を生成
 */
export function generateBandit(rank: BanditRank): BanditState {
    const config = BANDIT_RANKS[rank]

    // 人数
    const count = randomInt(config.count[0], config.count[1])

    // 基礎戦闘力
    let baseCombatPower: number
    if (config.baseCombat !== undefined) {
        baseCombatPower = config.baseCombat
    } else if (config.combatRange) {
        baseCombatPower = randomInt(config.combatRange[0], config.combatRange[1])
    } else {
        baseCombatPower = 100
    }

    // 士気
    const morale = randomInt(30, 50)

    // 弱点（30%の確率）
    const weaknesses = ['統率不足', '装備不良', '内部対立']
    const weakness = Math.random() < 0.3 ? weaknesses[randomInt(0, 2)] : null

    // 財産
    const wealth = {
        rice: baseCombatPower * config.bossReward.rice,
        money: baseCombatPower * config.bossReward.money,
    }

    return {
        rank,
        count,
        baseCombatPower,
        morale,
        investigated: false,
        weakness,
        traitor: false,
        wealth,
    }
}

export function applyScout(mission: any): any {
    const bandit = { ...mission.bandit }
    bandit.investigated = true

    // 70%の確率で成功
    const success = Math.random() < 0.7

    if (success) {
        // 戦闘力10%減少
        const reduction = Math.floor(bandit.baseCombatPower * 0.1)
        bandit.baseCombatPower -= reduction
    }

    return { ...mission, bandit }
}

export function applyMisinformation(mission: any): any {
    const bandit = { ...mission.bandit }

    // 60%の確率で成功
    const success = Math.random() < 0.6

    if (success) {
        // 士気15減少
        const reduction = 15
        bandit.morale = Math.max(0, bandit.morale - reduction)
    }

    return { ...mission, bandit }
}

export function applyBribe(
    mission: any,
    player: any
): { success: boolean; mission: any; player: any } {
    const cost = 100

    if (player.money < cost) {
        return { success: false, mission, player }
    }

    // 50%の確率で成功
    const success = Math.random() < 0.5

    if (success) {
        const bandit = { ...mission.bandit }
        bandit.traitor = true
        // 戦闘力20%減少
        const reduction = Math.floor(bandit.baseCombatPower * 0.2)
        bandit.baseCombatPower -= reduction

        return {
            success: true,
            mission: { ...mission, bandit },
            player: { ...player, money: player.money - cost },
        }
    }

    return {
        success: false,
        mission,
        player: { ...player, money: player.money - cost },
    }
}

/**
 * 計略のコストを計算
 */
export function getStrategyCost(strategy: StrategyType): number {
    switch (strategy) {
        case 'scout':
            return 0
        case 'misinformation':
            return 0.5
        case 'bribe':
            return 2.0
        case 'hire':
            return 1.0 // 足軽1人あたり
        default:
            return 0
    }
}
