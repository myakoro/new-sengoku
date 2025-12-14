import type { PlayerState, Juuboku, Ashigaru, BashoShu } from '../types/game'

/**
 * 家臣の実効戦闘力を取得（負傷状態を考慮）
 */
export function getRetainerCombatPower(retainer: Juuboku | Ashigaru | BashoShu): number {
    if (retainer.injuryStatus === 'severe') {
        return 0  // 重傷は戦闘不可
    } else if (retainer.injuryStatus === 'light') {
        return Math.floor(retainer.combat * 0.8)  // 軽傷は20%減
    } else {
        return retainer.combat  // 正常は100%
    }
}

/**
 * 週次負傷回復処理
 */
export function processWeeklyInjuryRecovery(player: PlayerState): PlayerState {
    const updatedPlayer = { ...player }

    // 若党の回復処理
    updatedPlayer.juuboku = updatedPlayer.juuboku.map(j => {
        if (j.injuryWeeksRemaining > 0) {
            const remaining = j.injuryWeeksRemaining - 1
            return {
                ...j,
                injuryWeeksRemaining: remaining,
                injuryStatus: remaining === 0 ? 'normal' : j.injuryStatus
            }
        }
        return j
    })

    // 徒士の回復処理
    updatedPlayer.ashigaru = updatedPlayer.ashigaru.map(a => {
        if (a.injuryWeeksRemaining > 0) {
            const remaining = a.injuryWeeksRemaining - 1
            return {
                ...a,
                injuryWeeksRemaining: remaining,
                injuryStatus: remaining === 0 ? 'normal' : a.injuryStatus
            }
        }
        return a
    })

    // 馬上衆の回復処理
    updatedPlayer.bashoShu = updatedPlayer.bashoShu.map(b => {
        if (b.injuryWeeksRemaining > 0) {
            const remaining = b.injuryWeeksRemaining - 1
            return {
                ...b,
                injuryWeeksRemaining: remaining,
                injuryStatus: remaining === 0 ? 'normal' : b.injuryStatus
            }
        }
        return b
    })

    // 貸与足軽の回復処理
    updatedPlayer.loanedAshigaru = updatedPlayer.loanedAshigaru.map(a => {
        if (a.injuryWeeksRemaining > 0) {
            const remaining = a.injuryWeeksRemaining - 1
            return {
                ...a,
                injuryWeeksRemaining: remaining,
                injuryStatus: remaining === 0 ? 'normal' : a.injuryStatus
            }
        }
        return a
    })

    return updatedPlayer
}

/**
 * 戦闘損失を若党に適用
 */
export function applyBattleCasualties<T extends { id: number; injuryStatus: any; injuryWeeksRemaining: number }>(
    retainers: T[],
    casualties: { deaths: number; severeInjuries: number; lightInjuries: number }
): T[] {
    const updated = [...retainers]
    let processed = 0

    // 死亡処理（配列から削除）
    for (let i = 0; i < casualties.deaths && updated.length > 0; i++) {
        updated.splice(0, 1)
    }

    // 重傷処理
    for (let i = 0; i < casualties.severeInjuries && processed < updated.length; i++) {
        updated[processed].injuryStatus = 'severe'
        updated[processed].injuryWeeksRemaining = 8
        processed++
    }

    // 軽傷処理
    for (let i = 0; i < casualties.lightInjuries && processed < updated.length; i++) {
        updated[processed].injuryStatus = 'light'
        updated[processed].injuryWeeksRemaining = 4
        processed++
    }

    return updated
}
