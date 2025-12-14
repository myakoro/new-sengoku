// ゲームの型定義

export type Rank = '徒士' | '馬上衆' | '小頭'

export type InjuryStatus = 'normal' | 'light' | 'severe'

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
    command: number
    intelligence: number
    administration: number
    injuryStatus: InjuryStatus
    injuryWeeksRemaining: number
}

export interface Ashigaru {
    id: number
    combat: number
    injuryStatus: InjuryStatus
    injuryWeeksRemaining: number
}

export interface BashoShu {
    id: number
    combat: number
    command: number
    intelligence: number
    administration: number
    injuryStatus: InjuryStatus
    injuryWeeksRemaining: number
}

export type FormationUnitType = 'juuboku' | 'ashigaru' | 'loanedAshigaru'

export interface FormationSlot {
    type: FormationUnitType
    id: number
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
    monthlyRepayment: number
    interestRate: number
    juuboku: Juuboku[]
    ashigaru: Ashigaru[]
    loanedAshigaru: Ashigaru[]
    bashoShu: BashoShu[]
    formation: (FormationSlot | null)[]
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

export interface BanditCardState {
    id: string
    bandit: BanditState
    foundCalendarWeek: number
    escalated: boolean
    strategies?: StrategyType[]
    delegatedTurn?: number | null
    additionalAshigaru?: number
    delegatedJuubokuId?: number | null
}

export type StrategyType = 'scout' | 'misinformation' | 'bribe' | 'hire'

export type BattleStance = 'attack' | 'normal' | 'defense'

export interface BanditBattleUnitState {
    id: string
    name: string
    side: 'player' | 'enemy'
    combat: number
    hp: number
    maxHp: number
    morale: number
    fatigue: number
    stance: BattleStance
    position: 'front' | 'reserve'
}

export interface BanditBattleState {
    turn: number
    maxTurns: number
    playerMorale: number
    enemyMorale: number
    playerUnits: BanditBattleUnitState[]
    enemyUnits: BanditBattleUnitState[]
    swapsRemaining: number
    retreatsRemaining: number
    promotesRemaining: number
    log: string[]
    attackType: 'normal' | 'night_raid'
    resolved: boolean
    outcome?: 'win' | 'lose' | 'draw'
}

export interface ActionLogEntry {
    week: number | "開始"
    actionName: string
    result: "成功" | "失敗" | "―"
    detail: string
}

export interface MissionState {
    type: 'bandit_subjugation'
    rank: BanditRank
    bandit: BanditState
    timeLimit: number
    currentWeek: number
    additionalAshigaru: number
    strategies: StrategyType[]
    delegatedTurn?: number | null
    actionLogs?: ActionLogEntry[]
    source?: 'mandate' | 'patrol_card' | 'command'
    sourceCardId?: string | null
    lootMultiplier?: number
    battleState?: BanditBattleState | null
}

export interface MandateState {
    target: CommandType
    issuedTurn: number
    dueTurn: number
    successMerit: number
    status: 'active' | 'succeeded' | 'failed'
    fixedStartTurn?: number
    fixedDuration?: number
}

export interface GameTime {
    week: number
    year: number
    month: number
    weekOfMonth: number
}

export type CommandType =
    | '訓練'
    | '全体訓練'
    | '巡察'
    | '情報収集'
    | '護衛任務'
    | '賊軍偵察'
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
    hidden?: boolean
}

export interface LogEntry {
    week: number
    message: string
    type: 'normal' | 'success' | 'warning' | 'danger'
}
