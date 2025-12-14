import { PlayerState, MissionState, type BanditBattleState, type BanditBattleUnitState, type BattleStance } from '../types/game'
import { getRetainerCombatPower } from './injury'
import { NIGHT_RAID, HORSE_COMBAT_BONUS } from '../constants/game'

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
    const moraleAdjusted = bandit.baseCombatPower * (1 + moraleBonus)

    const weaknessMultiplier = bandit.weakness === '装備不良' ? 0.95 : 1
    const traitorMultiplier = bandit.traitor ? 0.9 : 1

    return Math.floor(moraleAdjusted * weaknessMultiplier * traitorMultiplier)
}

export interface BattleCasualties {
    deaths: number
    severeInjuries: number
    lightInjuries: number
}

function clamp(n: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, n))
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function getMoraleMultiplier(morale: number): number {
    if (morale >= 80) return 1.05
    if (morale >= 60) return 1.0
    if (morale >= 40) return 0.9
    if (morale >= 25) return 0.8
    if (morale >= 10) return 0.65
    return 0.4
}

function getFatigueMultiplier(fatigue: number): number {
    if (fatigue <= 34) return 1.0
    if (fatigue <= 49) return 0.95
    if (fatigue <= 69) return 0.85
    if (fatigue <= 80) return 0.75
    if (fatigue <= 99) return 0.65
    return 0.55
}

function applyFatigueMoralePenalty(unit: BanditBattleUnitState, moraleChange: number): number {
    if (moraleChange >= 0) return moraleChange
    let penalty = 0
    if (unit.fatigue >= 86) penalty = -8
    else if (unit.fatigue >= 71) penalty = -5
    else if (unit.fatigue >= 50) penalty = -3
    return moraleChange + penalty
}

function getStanceCombatMultiplier(stance: BattleStance, hasHorse: boolean): number {
    if (stance === 'attack') return hasHorse ? 1.5 : 1.2
    if (stance === 'defense') return 0.9
    return 1.0
}

function getStanceDamageMultiplier(stance: BattleStance): number {
    if (stance === 'attack') return 1.1
    if (stance === 'defense') return 0.8
    return 1.0
}

function getFrontFatigueIncrease(stance: BattleStance, hasHorse: boolean): number {
    let inc = 6
    if (stance === 'attack') inc += 3
    else if (stance === 'defense') inc -= 2

    if (hasHorse && (stance === 'normal' || stance === 'defense')) {
        inc -= 1
    }
    return inc
}

function getDamageAbsorptionMultiplier(combat: number): number {
    // 武芸が高いほど被ダメが減る（初期案）
    return clamp(1.1 - combat * 0.004, 0.6, 1.1)
}

type BattleResultRank =
    | '大きく優勢'
    | '優勢'
    | 'やや優勢'
    | '互角'
    | 'やや劣勢'
    | '劣勢'
    | '大きく劣勢'

function getBattleResultRank(ratio: number): BattleResultRank {
    if (ratio >= 1.6) return '大きく優勢'
    if (ratio >= 1.3) return '優勢'
    if (ratio >= 1.1) return 'やや優勢'
    if (ratio >= 0.9) return '互角'
    if (ratio >= 0.7) return 'やや劣勢'
    if (ratio >= 0.5) return '劣勢'
    return '大きく劣勢'
}

function calculateTotalDamage(P_self: number, P_enemy: number, result: BattleResultRank): { D_toEnemy: number; D_toSelf: number } {
    const BASE_DAMAGE = 0.2
    const factors: Record<BattleResultRank, { selfToEnemy: number; enemyToSelf: number }> = {
        大きく優勢: { selfToEnemy: 1.4, enemyToSelf: 0.6 },
        優勢: { selfToEnemy: 1.2, enemyToSelf: 0.8 },
        やや優勢: { selfToEnemy: 1.1, enemyToSelf: 0.9 },
        互角: { selfToEnemy: 1.0, enemyToSelf: 1.0 },
        やや劣勢: { selfToEnemy: 0.9, enemyToSelf: 1.1 },
        劣勢: { selfToEnemy: 0.8, enemyToSelf: 1.2 },
        大きく劣勢: { selfToEnemy: 0.6, enemyToSelf: 1.4 },
    }
    const f = factors[result]
    const randSelf = 0.9 + Math.random() * 0.2
    const randEnemy = 0.9 + Math.random() * 0.2
    return {
        D_toEnemy: P_self * BASE_DAMAGE * f.selfToEnemy * randSelf,
        D_toSelf: P_enemy * BASE_DAMAGE * f.enemyToSelf * randEnemy,
    }
}

function getFrontUnits(units: BanditBattleUnitState[]): BanditBattleUnitState[] {
    return units.filter((u) => u.position === 'front' && u.hp > 0)
}

function applyDamageToFront(units: BanditBattleUnitState[], totalDamage: number): BanditBattleUnitState[] {
    const front = getFrontUnits(units)
    if (front.length === 0) return units

    const base = totalDamage / front.length
    const updated = units.map((u) => {
        if (u.position !== 'front' || u.hp <= 0) return u
        const stanceMult = getStanceDamageMultiplier(u.stance)
        const absorb = getDamageAbsorptionMultiplier(u.combat)
        const dmg = Math.max(0, Math.floor(base * stanceMult * absorb))
        const nextHp = Math.max(0, u.hp - dmg)
        return { ...u, hp: nextHp }
    })
    return updated
}

function applyFatigueAndRecovery(units: BanditBattleUnitState[], hasHorse: boolean): BanditBattleUnitState[] {
    return units.map((u) => {
        if (u.hp <= 0) return u
        if (u.position === 'front') {
            const inc = getFrontFatigueIncrease(u.stance, hasHorse)
            return { ...u, fatigue: clamp(u.fatigue + inc, 0, 100) }
        }
        // reserve
        return {
            ...u,
            fatigue: clamp(u.fatigue - 5, 0, 100),
            morale: clamp(u.morale + 3, 0, 100),
        }
    })
}

function applyMoraleChangeByRank(units: BanditBattleUnitState[], rank: BattleResultRank, side: 'player' | 'enemy'): BanditBattleUnitState[] {
    const table: Record<BattleResultRank, { enemy: [number, number]; ally: [number, number] }> = {
        大きく優勢: { enemy: [-12, -10], ally: [4, 8] },
        優勢: { enemy: [-9, -7], ally: [2, 5] },
        やや優勢: { enemy: [-6, -3], ally: [0, 2] },
        互角: { enemy: [-1, 1], ally: [-1, 1] },
        やや劣勢: { enemy: [0, 2], ally: [-6, -3] },
        劣勢: { enemy: [2, 5], ally: [-9, -7] },
        大きく劣勢: { enemy: [4, 8], ally: [-12, -10] },
    }
    const range = table[rank]
    // rank は「自軍視点」。sideがenemyのときは視点を反転
    const enemyChange = randomInt(range.enemy[0], range.enemy[1])
    const allyChange = randomInt(range.ally[0], range.ally[1])
    const myChange = side === 'player' ? allyChange : enemyChange

    return units.map((u) => {
        if (u.hp <= 0) return u
        const rawChange = u.side === side ? myChange : -myChange
        const adjusted = applyFatigueMoralePenalty(u, rawChange)
        return { ...u, morale: clamp(u.morale + adjusted, 0, 100) }
    })
}

export function initBanditBattleState(
    player: PlayerState,
    bandit: any,
    additionalAshigaru: number,
    attackType: 'normal' | 'night_raid'
): BanditBattleState {
    const FRONT_SIZE = 5
    const playerUnits: BanditBattleUnitState[] = []

    playerUnits.push({
        id: 'player',
        name: player.name,
        side: 'player',
        combat: player.stats.combat,
        hp: 100,
        maxHp: 100,
        morale: 60,
        fatigue: 0,
        stance: 'normal',
        position: 'reserve' as const,
    })

    player.juuboku.forEach((j) => {
        playerUnits.push({
            id: `juuboku-${j.id}`,
            name: `若党${j.id}`,
            side: 'player',
            combat: getRetainerCombatPower(j),
            hp: 100,
            maxHp: 100,
            morale: 60,
            fatigue: 0,
            stance: 'normal',
            position: 'reserve' as const,
        })
    })

    // 雇い足軽は個別ユニットとして追加（6人を超える場合は控え）
    for (let i = 0; i < additionalAshigaru; i++) {
        playerUnits.push({
            id: `temp-ashigaru-${i + 1}`,
            name: `雇い足軽${i + 1}`,
            side: 'player',
            combat: 32,
            hp: 100,
            maxHp: 100,
            morale: 60,
            fatigue: 0,
            stance: 'normal',
            position: 'reserve' as const,
        })
    }

    const enemyUnitCount = Math.max(FRONT_SIZE, Math.min(12, bandit.count))
    const enemyPerCombat = Math.max(1, Math.floor(bandit.baseCombatPower / enemyUnitCount))
    const enemyUnits: BanditBattleUnitState[] = Array.from({ length: enemyUnitCount }, (_, idx) => ({
        id: `bandit-${idx + 1}`,
        name: `盗賊${idx + 1}`,
        side: 'enemy',
        combat: enemyPerCombat,
        hp: 100,
        maxHp: 100,
        morale: clamp(bandit.morale, 0, 100),
        fatigue: 0,
        stance: 'normal',
        position: 'reserve' as const,
    }))

    // 初期前線配置（最大FRONT_SIZE）
    const setFront = (units: BanditBattleUnitState[]): BanditBattleUnitState[] => {
        let frontCount = 0
        return units.map((u) => {
            if (u.hp <= 0) return u
            if (frontCount < FRONT_SIZE) {
                frontCount++
                return { ...u, position: 'front' as const }
            }
            return u
        })
    }

    let seededPlayerUnits = setFront(playerUnits)
    let seededEnemyUnits = setFront(enemyUnits)

    // 夜襲は開始時に敵士気を下げる（v0.1簡易仕様を踏襲）
    if (attackType === 'night_raid') {
        seededEnemyUnits = seededEnemyUnits.map((u) => ({ ...u, morale: clamp(u.morale + NIGHT_RAID.moraleDecrease, 0, 100) }))
    }

    return {
        turn: 1,
        maxTurns: 30,
        playerMorale: 60,
        enemyMorale: clamp(bandit.morale + (attackType === 'night_raid' ? NIGHT_RAID.moraleDecrease : 0), 0, 100),
        playerUnits: seededPlayerUnits,
        enemyUnits: seededEnemyUnits,
        swapsRemaining: 2,
        log: ['戦闘開始'],
        attackType,
        resolved: false,
    }
}

export function setBanditBattleUnitStance(
    state: BanditBattleState,
    unitId: string,
    stance: BattleStance
): BanditBattleState {
    if (state.resolved) return state
    const update = (units: BanditBattleUnitState[]) =>
        units.map((u) => (u.id === unitId ? { ...u, stance } : u))
    return { ...state, playerUnits: update(state.playerUnits) }
}

export function swapBanditBattleUnits(
    state: BanditBattleState,
    frontUnitId: string,
    reserveUnitId: string
): BanditBattleState {
    if (state.resolved) return state
    if (state.swapsRemaining <= 0) return state

    const front = state.playerUnits.find((u) => u.id === frontUnitId)
    const reserve = state.playerUnits.find((u) => u.id === reserveUnitId)
    if (!front || !reserve) return state
    if (front.position !== 'front') return state
    if (reserve.position !== 'reserve') return state
    if (front.hp <= 0 || reserve.hp <= 0) return state

    const updated = state.playerUnits.map((u) => {
        if (u.id === frontUnitId) return { ...u, position: 'reserve' as const }
        if (u.id === reserveUnitId) return { ...u, position: 'front' as const }
        return u
    })

    return {
        ...state,
        playerUnits: updated,
        swapsRemaining: state.swapsRemaining - 1,
        log: [`交代: ${front.name} → 控え / ${reserve.name} → 前線`, ...state.log],
    }
}

export function retreatBanditBattleUnit(state: BanditBattleState, frontUnitId: string): BanditBattleState {
    if (state.resolved) return state
    if (state.swapsRemaining <= 0) return state

    const front = state.playerUnits.find((u) => u.id === frontUnitId)
    if (!front) return state
    if (front.position !== 'front') return state
    if (front.hp <= 0) return state

    const updated = state.playerUnits.map((u) =>
        u.id === frontUnitId ? { ...u, position: 'reserve' as const } : u
    )

    return {
        ...state,
        playerUnits: updated,
        swapsRemaining: state.swapsRemaining - 1,
        log: [`退避: ${front.name} を控えへ`, ...state.log],
    }
}

export function advanceBanditBattleTurn(state: BanditBattleState, playerHasHorse: boolean): BanditBattleState {
    if (state.resolved) return state

    const frontPlayer = getFrontUnits(state.playerUnits)
    const frontEnemy = getFrontUnits(state.enemyUnits)
    if (frontPlayer.length === 0) {
        return { ...state, resolved: true, outcome: 'lose', log: ['自軍前線が壊滅した', ...state.log] }
    }
    if (frontEnemy.length === 0) {
        return { ...state, resolved: true, outcome: 'win', log: ['敵前線が壊滅した', ...state.log] }
    }

    const P_self = frontPlayer.reduce((sum, u) => {
        const m = getMoraleMultiplier(u.morale)
        const f = getFatigueMultiplier(u.fatigue)
        const s = getStanceCombatMultiplier(u.stance, playerHasHorse)
        return sum + u.combat * m * f * s
    }, 0)

    const P_enemy = frontEnemy.reduce((sum, u) => {
        const m = getMoraleMultiplier(u.morale)
        const f = getFatigueMultiplier(u.fatigue)
        const s = getStanceCombatMultiplier(u.stance, false)
        return sum + u.combat * m * f * s
    }, 0)

    const ratio = P_enemy > 0 ? P_self / P_enemy : 999
    const rank = getBattleResultRank(ratio)
    const { D_toEnemy, D_toSelf } = calculateTotalDamage(P_self, P_enemy, rank)

    let nextPlayerUnits = applyDamageToFront(state.playerUnits, D_toSelf)
    let nextEnemyUnits = applyDamageToFront(state.enemyUnits, D_toEnemy)

    nextPlayerUnits = applyMoraleChangeByRank(nextPlayerUnits, rank, 'player')
    nextEnemyUnits = applyMoraleChangeByRank(nextEnemyUnits, rank, 'enemy')

    nextPlayerUnits = applyFatigueAndRecovery(nextPlayerUnits, playerHasHorse)
    nextEnemyUnits = applyFatigueAndRecovery(nextEnemyUnits, false)

    const playerMoraleAvg = Math.floor(
        nextPlayerUnits.filter((u) => u.hp > 0).reduce((sum, u) => sum + u.morale, 0) /
            Math.max(1, nextPlayerUnits.filter((u) => u.hp > 0).length)
    )
    const enemyMoraleAvg = Math.floor(
        nextEnemyUnits.filter((u) => u.hp > 0).reduce((sum, u) => sum + u.morale, 0) /
            Math.max(1, nextEnemyUnits.filter((u) => u.hp > 0).length)
    )

    const logLine = `第${state.turn}ターン: ${rank}`

    let resolved = false
    let outcome: BanditBattleState['outcome'] = undefined

    const playerFrontAlive = getFrontUnits(nextPlayerUnits).length > 0
    const enemyFrontAlive = getFrontUnits(nextEnemyUnits).length > 0

    if (!playerFrontAlive || playerMoraleAvg <= 0) {
        resolved = true
        outcome = 'lose'
    } else if (!enemyFrontAlive || enemyMoraleAvg <= 0) {
        resolved = true
        outcome = 'win'
    } else if (state.turn >= state.maxTurns) {
        resolved = true
        outcome = 'draw'
    }

    return {
        ...state,
        turn: state.turn + 1,
        swapsRemaining: 2,
        playerUnits: nextPlayerUnits,
        enemyUnits: nextEnemyUnits,
        playerMorale: playerMoraleAvg,
        enemyMorale: enemyMoraleAvg,
        resolved,
        outcome,
        log: [logLine, ...state.log],
    }
}

export function judgeBanditBattleFromState(state: BanditBattleState): { success: boolean; casualties: BattleCasualties; banditLosses: number } {
    if (!state.resolved) {
        return { success: false, casualties: { deaths: 0, severeInjuries: 0, lightInjuries: 0 }, banditLosses: 0 }
    }
    const success = state.outcome === 'win'

    const playerCasualties: BattleCasualties = { deaths: 0, severeInjuries: 0, lightInjuries: 0 }
    const playerTargets = state.playerUnits.filter((u) => u.side === 'player' && u.id.startsWith('juuboku-'))
    playerTargets.forEach((u) => {
        const hpRate = (u.hp / u.maxHp) * 100
        if (u.hp <= 0) playerCasualties.deaths += 1
        else if (hpRate < 50) playerCasualties.severeInjuries += 1
        else if (hpRate < 80) playerCasualties.lightInjuries += 1
    })

    const banditLosses = success
        ? state.enemyUnits.filter((u) => u.hp <= 0).length
        : Math.floor(state.enemyUnits.length * 0.3)

    return { success, casualties: playerCasualties, banditLosses }
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
    additionalAshigaru: number,
    attackType: 'normal' | 'night_raid' = 'normal'
): {
    success: boolean
    casualties: BattleCasualties
    banditLosses: number
} {
    const playerPower = calculatePlayerCombatPowerForBandit(player) + additionalAshigaru * 32

    const adjustedBandit =
        attackType === 'night_raid'
            ? { ...bandit, morale: Math.max(0, bandit.morale + NIGHT_RAID.moraleDecrease) }
            : bandit

    const banditPower = calculateBanditCombatPower(adjustedBandit)

    let successRate = calculateSuccessRate(playerPower, banditPower)
    if (attackType === 'night_raid') {
        successRate = Math.max(5, Math.min(95, successRate + NIGHT_RAID.successPenalty))
    }

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

    // 若党の戦闘力（盗賊討伐では100%、負傷状態を考慮）
    player.juuboku.forEach(j => {
        power += getRetainerCombatPower(j)
    })

    // 馬の効果（攻撃時×1.25）
    if (player.hasHorse) {
        power = Math.floor(power * HORSE_COMBAT_BONUS.attackMultiplier)
    }

    return power
}

/**
 * 馬による撤退時の被害軽減を計算
 */
export function applyHorseRetreatBonus(
    casualties: BattleCasualties,
    hasHorse: boolean
): BattleCasualties {
    if (!hasHorse) return casualties
    
    const multiplier = HORSE_COMBAT_BONUS.retreatDamageMultiplier
    return {
        deaths: Math.floor(casualties.deaths * multiplier),
        severeInjuries: Math.floor(casualties.severeInjuries * multiplier),
        lightInjuries: Math.floor(casualties.lightInjuries * multiplier),
    }
}

/**
 * 馬による追撃時の手柄確率を取得
 */
export function getPursuitMeritChance(hasHorse: boolean): number {
    const baseChance = 0.3  // 基本30%
    return hasHorse ? baseChance * HORSE_COMBAT_BONUS.pursuitMeritMultiplier : baseChance
}
