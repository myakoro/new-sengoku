import { Rank, BanditRank, Command, AIBehavior } from '../types/game'

// 扶持米（月額）
export const SALARY_RICE: Record<Rank, number> = {
    徒士: 1.2,
    馬上衆: 3.5,
    小頭: 5.0,
}

export const FORMATION_SLOT_COUNT = 7

export const LOANED_ASHIGARU_GRANT = {
    count: 5,
    combat: 32,
}

// 家臣の扶持米（月額）
export const RETAINER_RICE = {
    若党: 0.3,
    徒士: 1.2,
    馬上衆: 3.5,
    小頭: 5.0,
}

// その他支出
export const LIVING_COST = 0.15 // 生活費（月額）
export const HORSE_COST = 0.6 // 馬維持費（月額）

// 借金上限（年収相当）
export const DEBT_LIMIT: Record<Rank, number> = {
    徒士: 14.4,      // 1.2石×12ヶ月
    馬上衆: 42,      // 3.5石×12ヶ月
    小頭: 60,        // 5石×12ヶ月
}

// 借金金利（月利、借入額で変動）
// 将来は商人との親密度で上限・金利が変動予定
export const INTEREST_RATE_BY_AMOUNT = {
    tier1: { maxAmount: 50, rate: 0.05 },   // 50貫まで：月5%
    tier2: { maxAmount: 100, rate: 0.04 },  // 100貫まで：月4%
}

// 出世条件
export const PROMOTION_REQUIREMENTS = {
    徒士_to_馬上衆: {
        merit: 250,
        minCombat: 40,
    },
    馬上衆_to_小頭_イベント: {
        merit: 500,
    },
    馬上衆_to_小頭_通常: {
        merit: 600,
        minCombat: 50,
    },
}

// 昇進時のステータス成長
// Version 0.1では昇進ボーナスなし（詳細設計書 4-4節準拠）
// 能力値は訓練・実戦・計略などの経験によってのみ成長する
// export const PROMOTION_BONUS = {} // 未使用

// 経験値獲得量
export const EXP_GAIN = {
    訓練: { combat: 5 },
    盗賊討伐成功: { combat: 20 },
    偵察成功: { intelligence: 15 },
    偵察失敗: { intelligence: 5 },
    計略成功: { intelligence: 20 },
    計略失敗: { intelligence: 10 },
    情報収集: { intelligence: 10 },
}

// 戦闘成功率
export const COMBAT_SUCCESS_RATE = {
    base: 50,
    diffMultiplier: 0.3,
    min: 5,
    max: 95,
}

// 夜襲
export const NIGHT_RAID = {
    successPenalty: -10,
    moraleDecrease: -20,
}

// 主命一覧
export const COMMANDS: Record<string, Command> = {
    訓練: {
        name: '訓練',
        duration: 1,
        merit: 5,
        expGain: { combat: 5 },
    },
    全体訓練: {
        name: '全体訓練',
        duration: 1,
        merit: 0,
        expGain: { combat: 5 },
        hidden: true,
    },
    巡察: {
        name: '巡察',
        duration: 1,
        merit: 3,
    },
    情報収集: {
        name: '情報収集',
        duration: 1,
        merit: 5,
        expGain: { intelligence: 10 },
    },
    賊軍偵察: {
        name: '賊軍偵察',
        duration: 1,
        merit: 0,
        expGain: { intelligence: 15 },
        hidden: true,
    },
    護衛任務: {
        name: '護衛任務',
        duration: 1,
        merit: 8,
    },
    '盗賊討伐（小規模）': {
        name: '盗賊討伐（小規模）',
        duration: 4,
        merit: 15,
        banditRank: 'D',
    },
    '盗賊討伐（中規模）': {
        name: '盗賊討伐（中規模）',
        duration: 4,
        merit: 30,
        banditRank: 'C',
    },
    '盗賊討伐（大規模）': {
        name: '盗賊討伐（大規模）',
        duration: 4,
        merit: 40,
        banditRank: 'B',
        requireRank: '馬上衆',
    },
    '盗賊討伐（討伐戦）': {
        name: '盗賊討伐（討伐戦）',
        duration: 4,
        merit: 60,
        banditRank: 'A',
        requireRank: '馬上衆',
    },
    '盗賊討伐（賊軍）': {
        name: '盗賊討伐（賊軍）',
        duration: 8,
        merit: 80,
        banditRank: 'S',
        requireRank: '小頭',
    },
}

// 盗賊ランク別設定
export const BANDIT_RANKS: Record<
    BanditRank,
    {
        count: [number, number]
        combatRange?: [number, number]
        baseCombat?: number
        moraleRange: [number, number]
        ricePerBanditRange: [number, number]
        moneyRatio: number
        merit: number
        bossReward: { rice: number; money: number }
    }
> = {
    D: {
        count: [1, 2],
        combatRange: [15, 50],
        moraleRange: [30, 40],
        ricePerBanditRange: [0.01, 0.02],
        moneyRatio: 0.3,
        merit: 15,
        bossReward: { rice: 0.05, money: 0.025 },
    },
    C: {
        count: [3, 5],
        combatRange: [70, 110],
        moraleRange: [35, 45],
        ricePerBanditRange: [0.03, 0.06],
        moneyRatio: 0.4,
        merit: 30,
        bossReward: { rice: 0.075, money: 0.05 },
    },
    B: {
        count: [6, 10],
        combatRange: [150, 250],
        moraleRange: [40, 50],
        ricePerBanditRange: [0.05, 0.08],
        moneyRatio: 0.5,
        merit: 40,
        bossReward: { rice: 0.125, money: 0.075 },
    },
    A: {
        count: [11, 15],
        combatRange: [300, 450],
        moraleRange: [45, 55],
        ricePerBanditRange: [0.08, 0.12],
        moneyRatio: 0.6,
        merit: 60,
        bossReward: { rice: 0.25, money: 0.125 },
    },
    S: {
        count: [20, 25],
        baseCombat: 800,
        moraleRange: [40, 50],
        ricePerBanditRange: [0.12, 0.18],
        moneyRatio: 0.7,
        merit: 80,
        bossReward: { rice: 0.75, money: 0.5 },
    },
}

// AIライバルの行動パターン
export const AI_BEHAVIORS: Record<AIBehavior, Record<string, number>> = {
    safe: {
        訓練: 0.4,
        巡察: 0.2,
        情報収集: 0.2,
        護衛任務: 0.1,
        '盗賊討伐（小規模）': 0.1,
    },
    balanced: {
        訓練: 0.2,
        情報収集: 0.2,
        護衛任務: 0.2,
        '盗賊討伐（小規模）': 0.2,
        '盗賊討伐（中規模）': 0.2,
    },
    aggressive: {
        訓練: 0.1,
        '盗賊討伐（中規模）': 0.3,
        '盗賊討伐（大規模）': 0.3,
        '盗賊討伐（討伐戦）': 0.3,
    },
}

// キャラメイク
export const CHAR_CREATE = {
    totalPotential: 300,
    minPotential: 10,
    maxPotential: 100,
    initialRatio: 0.8,
}

// 若党初期生成
// 別紙E準拠：初期若党は能力合計230〜280で生成（特例で高水準）
// 若党は4ステータス（武芸・統率・知略・政務）を持つ
export const INITIAL_JUUBOKU_COUNT = 2
export const MAX_JUUBOKU_COUNT = 2
export const INITIAL_JUUBOKU_TOTAL_RANGE: [number, number] = [230, 280]

// 若党雇用システム
export const JUUBOKU_RECRUITMENT = {
    maxCount: 2,
    refreshCost: 0.2,
    refreshPerMonth: 1,
    candidateCount: {
        徒士: [2, 3] as [number, number],
        馬上衆: [3, 4] as [number, number],
        小頭: [4, 5] as [number, number],
    },
    generalTotalRange: [200, 270] as [number, number],
}

// プレイヤー初期状態
export const INITIAL_PLAYER = {
    rank: '徒士' as Rank,
    merit: 0,
    rice: 0.5,
    money: 10,
    debt: 0,
    hasHorse: false,
    week: 1,
}

// 米の価格
export const RICE_PRICE = 1.0 // 米1石 = 1貫

// 購入費用
export const PURCHASE_COSTS = {
    馬: 8,
    徒士雇用: 4,
}

// 馬による戦闘補正
export const HORSE_COMBAT_BONUS = {
    // 攻撃時の戦闘力補正（1.2→1.5、つまり×1.25）
    attackMultiplier: 1.25,
    // 平常・防御時の疲労軽減
    fatigueReduction: 1,
    // 追撃時の手柄確率補正
    pursuitMeritMultiplier: 1.5,
    // 撤退時の被害軽減
    retreatDamageMultiplier: 0.6,
}
