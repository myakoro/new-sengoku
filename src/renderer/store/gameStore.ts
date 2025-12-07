import { create } from 'zustand'
import {
    PlayerState,
    RivalState,
    MissionState,
    LogEntry,
    Rank,
    Stats,
    CommandType,
} from '../types/game'
import {
    INITIAL_PLAYER,
    CHAR_CREATE,
    INITIAL_JUUBOKU_COUNT,
    JUUBOKU_COMBAT_RANGE,
    PROMOTION_BONUS,
} from '../constants/game'
import { processWeeklyInjuryRecovery } from '../utils/injury'

interface GameState {
    // プレイヤー
    player: PlayerState | null
    // AIライバル
    rival: RivalState | null
    // 現在のミッション
    mission: MissionState | null
    // ログ
    logs: LogEntry[]
    // 画面遷移
    currentScreen: string
    // 選択された主命
    selectedCommand: CommandType | null

    // アクション
    initializeGame: (name: string, potential: Stats) => void
    setCurrentScreen: (screen: string) => void
    addLog: (message: string, type?: LogEntry['type']) => void
    advanceWeek: () => void
    setMission: (mission: MissionState | null) => void
    addMerit: (amount: number) => void
    promotePlayer: (newRank: Rank) => void
    updatePlayer: (updates: Partial<PlayerState>) => void
    updateRival: (updates: Partial<RivalState>) => void
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export const useGameStore = create<GameState>((set, get) => ({
    player: null,
    rival: null,
    mission: null,
    logs: [],
    currentScreen: 'title',
    selectedCommand: null,

    initializeGame: (name, potential) => {
        // プレイヤー初期化
        const stats: Stats = {
            combat: Math.floor(potential.combat * CHAR_CREATE.initialRatio),
            command: Math.floor(potential.command * CHAR_CREATE.initialRatio),
            intelligence: Math.floor(potential.intelligence * CHAR_CREATE.initialRatio),
            administration: Math.floor(
                potential.administration * CHAR_CREATE.initialRatio
            ),
        }

        const juuboku = Array.from({ length: INITIAL_JUUBOKU_COUNT }, (_, i) => ({
            id: i + 1,
            combat: randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
            injuryStatus: 'normal' as const,
            injuryWeeksRemaining: 0,
        }))

        const player: PlayerState = {
            name,
            rank: INITIAL_PLAYER.rank,
            stats,
            potential,
            exp: { combat: 0, intelligence: 0 },
            merit: INITIAL_PLAYER.merit,
            rice: INITIAL_PLAYER.rice,
            money: INITIAL_PLAYER.money,
            debt: INITIAL_PLAYER.debt,
            juuboku,
            ashigaru: [],
            bashoShu: [],
            hasHorse: INITIAL_PLAYER.hasHorse,
            week: INITIAL_PLAYER.week,
            rankDEventShown: false,
            rankDEventAccepted: false,
        }

        // ライバル初期化
        const rivalPotential: Stats = {
            combat: 60,
            command: 50,
            intelligence: 55,
            administration: 45,
        }

        const rivalStats: Stats = {
            combat: Math.floor(rivalPotential.combat * CHAR_CREATE.initialRatio),
            command: Math.floor(rivalPotential.command * CHAR_CREATE.initialRatio),
            intelligence: Math.floor(
                rivalPotential.intelligence * CHAR_CREATE.initialRatio
            ),
            administration: Math.floor(
                rivalPotential.administration * CHAR_CREATE.initialRatio
            ),
        }

        const rivalJuuboku = Array.from({ length: INITIAL_JUUBOKU_COUNT }, (_, i) => ({
            id: i + 1,
            combat: randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
            injuryStatus: 'normal' as const,
            injuryWeeksRemaining: 0,
        }))

        const rival: RivalState = {
            name: '源三郎',
            rank: INITIAL_PLAYER.rank,
            merit: 0,
            stats: rivalStats,
            behavior: 'balanced',
            rice: INITIAL_PLAYER.rice,
            money: INITIAL_PLAYER.money,
            debt: INITIAL_PLAYER.debt,
            juuboku: rivalJuuboku,
            ashigaru: [],
            bashoShu: [],
            hasHorse: false,
        }

        set({ player, rival, logs: [] })
    },

    setCurrentScreen: (screen) => set({ currentScreen: screen }),

    addLog: (message, type = 'normal') => {
        const { player } = get()
        if (!player) return

        const log: LogEntry = {
            week: player.week,
            message,
            type,
        }

        set((state) => ({ logs: [log, ...state.logs].slice(0, 50) }))
    },

    advanceWeek: () => {
        set((state) => {
            if (!state.player || !state.rival) return state

            // AIライバルの行動処理
            const rivalActions = [
                { name: '訓練', merit: 5 },
                { name: '巡察', merit: 3 },
                { name: '情報収集', merit: 5 },
            ]
            const randomAction = rivalActions[Math.floor(Math.random() * rivalActions.length)]

            const updatedRival = {
                ...state.rival,
                merit: state.rival.merit + randomAction.merit,
            }

            // ライバルの出世チェック
            if (updatedRival.rank === '徒士' && updatedRival.merit >= 250) {
                updatedRival.rank = '馬上衆'
            } else if (updatedRival.rank === '馬上衆' && updatedRival.merit >= 600) {
                updatedRival.rank = '小頭'
            }

            // 週次負傷回復処理
            const recoveredPlayer = processWeeklyInjuryRecovery(state.player)

            return {
                player: {
                    ...recoveredPlayer,
                    week: recoveredPlayer.week + 1,
                },
                rival: updatedRival,
            }
        })
    },

    setMission: (mission) => set({ mission }),

    addMerit: (amount) => {
        set((state) => {
            if (!state.player) return state

            return {
                player: {
                    ...state.player,
                    merit: state.player.merit + amount,
                },
            }
        })
    },

    promotePlayer: (newRank) => {
        set((state) => {
            if (!state.player) return state

            let bonus: Stats
            if (newRank === '馬上衆') {
                bonus = PROMOTION_BONUS.徒士_to_馬上衆
            } else if (newRank === '小頭') {
                bonus = PROMOTION_BONUS.馬上衆_to_小頭
            } else {
                return state
            }

            return {
                player: {
                    ...state.player,
                    rank: newRank,
                    stats: {
                        combat: state.player.stats.combat + bonus.combat,
                        command: state.player.stats.command + bonus.command,
                        intelligence: state.player.stats.intelligence + bonus.intelligence,
                        administration:
                            state.player.stats.administration + bonus.administration,
                    },
                },
            }
        })
    },

    updatePlayer: (updates) => {
        set((state) => {
            if (!state.player) return state

            return {
                player: {
                    ...state.player,
                    ...updates,
                },
            }
        })
    },

    updateRival: (updates) => {
        set((state) => {
            if (!state.rival) return state

            return {
                rival: {
                    ...state.rival,
                    ...updates,
                },
            }
        })
    },
}))
