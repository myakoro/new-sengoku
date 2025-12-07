// ゲームの型定義

export type Rank = '徒士' | '馬上衆' | '小頭'

export interface Stats {
    combat: number
    command: number
    intelligence: number
    administration: number
}

export interface Potential {
    combat: number
    command: number
    intelligence: number
    administration: number
}

export interface Experience {
    combat: number
    intelligence: number
}

export interface Juuboku {
    id: number
    combat: number
}

export interface Ashigaru {
    id: number
    combat: number
}

export interface BashoShu {
    id: number
    combat: number
}

export interface PlayerState {
    name: string
    rank: Rank
    stats: Stats
    potential: Potential
    exp: Experience
    merit: number
    rice: number
    money: number
    debt: number
    juuboku: Juuboku[]
    ashigaru: Ashigaru[]
    bashoShu: BashoShu[]
    hasHorse: boolean
    week: number
    rankDEventShown: boolean
    rankDEventAccepted: boolean
}

export type AIBehavior = 'safe' | 'balanced' | 'aggressive'

export interface RivalState {
    name: string
    rank: Rank
    merit: number
    stats: Stats
    behavior: AIBehavior
    rice: number
    money: number
    debt: number
    juuboku: Juuboku[]
    ashigaru: Ashigaru[]
    bashoShu: BashoShu[]
    hasHorse: boolean
}

export type BanditRank = 'S' | 'A' | 'B' | 'C' | 'D'

export interface BanditState {
    rank: BanditRank
    count: number
    baseCombatPower: number
    morale: number
    investigated: boolean
    weakness: string | null
    traitor: boolean
    wealth: {
        rice: number
        money: number
    }
}

export type StrategyType = 'scout' | 'misinformation' | 'bribe' | 'hire'

export interface MissionState {
    type: 'bandit_subjugation'
    rank: BanditRank
    bandit: BanditState
    timeLimit: number
    currentWeek: number
    additionalAshigaru: number
    strategies: StrategyType[]
}

export interface GameTime {
    week: number
    year: number
    month: number
    weekOfMonth: number
}

export type CommandType =
    | '訓練'
    | '巡察'
    | '情報収集'
    | '護衛任務'
    | '盗賊討伐（小規模）'
    | '盗賊討伐（中規模）'
    | '盗賊討伐（大規模）'
    | '盗賊討伐（討伐戦）'
    | '盗賊討伐（賊軍）'

export interface Command {
    name: CommandType
    duration: number
    merit: number
    requireRank?: Rank
    banditRank?: BanditRank
    expGain?: {
        combat?: number
        intelligence?: number
    }
}

export interface LogEntry {
    week: number
    message: string
    type: 'normal' | 'success' | 'warning' | 'danger'
}
