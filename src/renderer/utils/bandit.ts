import { BanditState, BanditRank, StrategyType, PlayerState } from '../types/game'
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
    const morale = randomInt(config.moraleRange[0], config.moraleRange[1])

    const weakness = null

    // 財産
    const ricePerBandit =
        config.ricePerBanditRange[0] +
        Math.random() * (config.ricePerBanditRange[1] - config.ricePerBanditRange[0])
    const totalRice = count * ricePerBandit
    const totalMoney = totalRice * config.moneyRatio
    const wealth = {
        rice: totalRice,
        money: totalMoney,
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

function generateWeakness(): string {
    const rand = Math.random()
    if (rand < 0.4) return '統率不足'
    if (rand < 0.7) return '装備不良'
    return '内部対立'
}

function hasWeakPointAdvantage(strategy: StrategyType, weakness: string | null): boolean {
    if (!weakness) return false
    if (strategy === 'misinformation') return weakness === '統率不足'
    if (strategy === 'bribe') return weakness === '内部対立'
    return false
}

export function calculateStrategySuccessRate(
    strategy: StrategyType,
    player: PlayerState,
    bandit: BanditState
): number {
    let difficulty = 50
    if (strategy === 'misinformation') difficulty = 40
    if (strategy === 'bribe') difficulty = 70

    const statBonus = Math.floor(player.stats.intelligence * 0.7)
    let rate = 100 - difficulty + statBonus

    if (bandit.investigated) {
        rate += 20
    }

    if (hasWeakPointAdvantage(strategy, bandit.weakness)) {
        rate += 30
    }

    return Math.max(5, Math.min(95, rate))
}

export function applyScout(
    mission: any,
    player: PlayerState
): { mission: any; success: boolean; successRate: number } {
    const bandit = { ...mission.bandit }
    const successRate = calculateStrategySuccessRate('scout', player, bandit)
    const success = Math.random() * 100 < successRate

    if (success) {
        bandit.investigated = true
        bandit.weakness = generateWeakness()
    }

    return { mission: { ...mission, bandit }, success, successRate }
}

export function applyMisinformation(
    mission: any,
    player: PlayerState
): { mission: any; success: boolean; moraleDecrease: number; successRate: number } {
    const bandit = { ...mission.bandit }
    const successRate = calculateStrategySuccessRate('misinformation', player, bandit)
    const success = Math.random() * 100 < successRate
    let moraleDecrease = 0

    if (success) {
        moraleDecrease = bandit.weakness === '統率不足' ? 18 : 10
        bandit.morale = Math.max(0, bandit.morale - moraleDecrease)
    }

    return { mission: { ...mission, bandit }, success, moraleDecrease, successRate }
}

export function applyBribe(
    mission: any,
    player: PlayerState
): { success: boolean; mission: any; player: PlayerState } {
    const cost = 0.3

    if (player.money < cost) {
        return { success: false, mission, player }
    }

    const successRate = calculateStrategySuccessRate('bribe', player, mission.bandit)
    const success = Math.random() * 100 < successRate

    if (success) {
        const bandit = { ...mission.bandit }
        bandit.traitor = true

        return {
            success: true,
            mission: { ...mission, bandit },
            player: { ...player, money: player.money - cost },
        }
    }

    return {
        success: false,
        mission,
        player,
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
            return 0
        case 'bribe':
            return 0.3
        case 'hire':
            return 0.5 // 足軽5名雇用のコスト
        default:
            return 0
    }
}
