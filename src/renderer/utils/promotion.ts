import { PlayerState, RivalState } from '../types/game'
import { PROMOTION_REQUIREMENTS } from '../constants/game'

/**
 * 出世判定
 */
export function checkPromotion(player: PlayerState): '馬上衆' | '小頭' | null {
    if (player.rank === '徒士' && player.merit >= PROMOTION_REQUIREMENTS.徒士_to_馬上衆) {
        return '馬上衆'
    }
    if (player.rank === '馬上衆' && player.merit >= PROMOTION_REQUIREMENTS.馬上衆_to_小頭) {
        return '小頭'
    }
    return null
}

/**
 * AIライバルの行動決定
 */
export function decideRivalAction(rival: RivalState): {
    action: string
    meritGain: number
} {
    const { behavior } = rival

    // 行動パターンに基づいて行動を決定
    const actions = [
        { name: '訓練', merit: 5, weight: behavior === 'aggressive' ? 2 : 1 },
        { name: '巡察', merit: 3, weight: behavior === 'balanced' ? 2 : 1 },
        { name: '情報収集', merit: 5, weight: behavior === 'cautious' ? 2 : 1 },
        { name: '護衛任務', merit: 8, weight: behavior === 'aggressive' ? 3 : 1 },
    ]

    // 重み付きランダム選択
    const totalWeight = actions.reduce((sum, a) => sum + a.weight, 0)
    let random = Math.random() * totalWeight

    for (const action of actions) {
        random -= action.weight
        if (random <= 0) {
            return {
                action: action.name,
                meritGain: action.merit,
            }
        }
    }

    return actions[0]
}

/**
 * AIライバルの週次処理
 */
export function processRivalWeek(rival: RivalState): RivalState {
    const action = decideRivalAction(rival)

    return {
        ...rival,
        merit: rival.merit + action.meritGain,
    }
}
