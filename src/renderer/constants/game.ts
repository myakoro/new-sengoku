import { Rank, BanditRank, Command, AIBehavior } from '../types/game'

// 扶持米（月額）
export const SALARY_RICE: Record<Rank, number> = {
    徒士: 1.8,
    馬上衆: 3.5,
    小頭: 5.0,
}

// 家臣の扶持米（月額）
export const RETAINER_RICE = {
    従僕: 0.3,
    徒士: 1.8,
    馬上衆: 3.5,
    小頭: 5.0,
}

// その他支出
export const LIVING_COST = 0.15 // 生活費（月額）
export const HORSE_COST = 0.3 // 馬維持費（月額）

// 借金上限
export const DEBT_LIMIT: Record<Rank, number> = {
    徒士: 10,
    馬上衆: 50,
    小頭: 100,
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
export const PROMOTION_BONUS = {
    徒士_to_馬上衆: {
        combat: 15,
        command: 10,
        intelligence: 10,
        administration: 10,
    },
    馬上衆_to_小頭: {
        combat: 15,
        command: 15,
        intelligence: 10,
        administration: 10,
    },
}

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
    護衛任務: {
        name: '護衛任務',
        duration: 1,
        merit: 8,
    },
    '盗賊討伐（小規模）': {
        name: '盗賊討伐（小規模）',
        duration: 2,
        merit: 8,
        banditRank: 'S',
    },
    '盗賊討伐（中規模）': {
        name: '盗賊討伐（中規模）',
        duration: 4,
        merit: 15,
        banditRank: 'A',
    },
    '盗賊討伐（大規模）': {
        name: '盗賊討伐（大規模）',
        duration: 4,
        merit: 30,
        banditRank: 'B',
        requireRank: '馬上衆',
    },
    '盗賊討伐（討伐戦）': {
        name: '盗賊討伐（討伐戦）',
        duration: 4,
        merit: 50,
        banditRank: 'C',
        requireRank: '馬上衆',
    },
    '盗賊討伐（賊軍）': {
        name: '盗賊討伐（賊軍）',
        duration: 8,
        merit: 80,
        banditRank: 'D',
    },
}

// 盗賊ランク別設定
export const BANDIT_RANKS: Record<
    BanditRank,
    {
        count: [number, number]
        combatRange?: [number, number]
        baseCombat?: number
        merit: number
        bossReward: { rice: number; money: number }
    }
> = {
    S: {
        count: [1, 2],
        combatRange: [15, 50],
        merit: 8,
        bossReward: { rice: 0.05, money: 0.025 },
    },
    A: {
        count: [3, 5],
        combatRange: [70, 110],
        merit: 15,
        bossReward: { rice: 0.075, money: 0.05 },
    },
    B: {
        count: [6, 10],
        combatRange: [150, 250],
        merit: 30,
        bossReward: { rice: 0.125, money: 0.075 },
    },
    C: {
        count: [11, 15],
        combatRange: [300, 450],
        merit: 50,
        bossReward: { rice: 0.25, money: 0.125 },
    },
    D: {
        count: [20, 25],
        baseCombat: 800,
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

// 従僕初期生成
export const INITIAL_JUUBOKU_COUNT = 3
export const JUUBOKU_COMBAT_RANGE: [number, number] = [40, 60]

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
    馬: 30,
    徒士雇用: 10,
}
