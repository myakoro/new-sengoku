import { create } from 'zustand'
import {
    PlayerState,
    RivalState,
    MissionState,
    MandateState,
    LogEntry,
    Rank,
    Stats,
    CommandType,
    BanditCardState,
    BanditRank,
} from '../types/game'
import {
    INITIAL_PLAYER,
    CHAR_CREATE,
    INITIAL_JUUBOKU_COUNT,
    INITIAL_JUUBOKU_TOTAL_RANGE,
    COMMANDS,
} from '../constants/game'
import { processWeeklyInjuryRecovery } from '../utils/injury'
import { distributeJuubokuStats } from '../utils/juuboku'
import { generateBandit } from '../utils/bandit'

interface GameState {
    // プレイヤー
    player: PlayerState | null
    // AIライバル
    rival: RivalState | null
    // 現在のミッション
    mission: MissionState | null

    // 巡察で発見した盗賊カード
    banditCards: BanditCardState[]
    // ログ
    logs: LogEntry[]
    // 画面遷移
    currentScreen: string
    // 選択された主命
    selectedCommand: CommandType | null

    // 評定（次の月次）までの下知
    mandate: MandateState | null

    // 評定ターンで「評定を完了した」ターン番号（同ターン中の二重評定防止と行動解放用）
    evaluationTurnDone: number | null

    // アクション
    initializeGame: (name: string, potential: Stats) => void
    setCurrentScreen: (screen: string) => void
    addLog: (message: string, type?: LogEntry['type']) => void
    advanceWeek: () => void
    setMission: (mission: MissionState | null) => void
    addBanditCard: (card: BanditCardState) => void
    removeBanditCard: (cardId: string) => void
    updateBanditCard: (cardId: string, updates: Partial<BanditCardState>) => void
    addMerit: (amount: number) => void
    setMandate: (mandate: MandateState | null) => void
    markMandateSucceeded: () => void
    markMandateFailed: () => void
    issueNextMandate: () => void
    setEvaluationTurnDone: (turn: number | null) => void
    promotePlayer: (newRank: Rank) => void
    updatePlayer: (updates: Partial<PlayerState>) => void
    updateRival: (updates: Partial<RivalState>) => void
    saveGame: () => boolean
    loadGame: () => boolean
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function turnToCalendarWeek(turn: number): number {
    return Math.floor((turn + 1) / 2)
}

function nextBanditRank(rank: BanditRank): BanditRank {
    if (rank === 'D') return 'C'
    if (rank === 'C') return 'B'
    if (rank === 'B') return 'A'
    if (rank === 'A') return 'S'
    return 'S'
}

function nextKochouEvaluationTurn(turn: number): number {
    // 小頭評定は1,5,9,...（4ターン周期）
    return (Math.floor((turn - 1) / 4) + 1) * 4 + 1
}

function generateMandateForPlayer(player: PlayerState): MandateState | null {
    if (player.rank === '小頭') return null

    const issuedTurn = player.week
    const dueTurn = nextKochouEvaluationTurn(issuedTurn)

    const target: CommandType = player.rank === '徒士' ? '盗賊討伐（小規模）' : '盗賊討伐（中規模）'
    const successMerit = COMMANDS[target].merit

    return {
        target,
        issuedTurn,
        dueTurn,
        successMerit,
        status: 'active',
    }
}

export const useGameStore = create<GameState>((set, get) => ({
    player: null,
    rival: null,
    mission: null,
    banditCards: [],
    logs: [],
    currentScreen: 'title',
    selectedCommand: null,
    mandate: null,
    evaluationTurnDone: null,

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

        // 初期若党生成（4ステータス、能力合計230〜280の特例）
        const juuboku = Array.from({ length: INITIAL_JUUBOKU_COUNT }, (_, i) => {
            const total = randomInt(INITIAL_JUUBOKU_TOTAL_RANGE[0], INITIAL_JUUBOKU_TOTAL_RANGE[1])
            const stats = distributeJuubokuStats(total, 100)
            return {
                id: i + 1,
                combat: stats.combat,
                command: stats.command,
                intelligence: stats.intelligence,
                administration: stats.administration,
                injuryStatus: 'normal' as const,
                injuryWeeksRemaining: 0,
            }
        })

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
            monthlyRepayment: 0,
            interestRate: 0,
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

        // ライバル若党生成（4ステータス、能力合計230〜280の特例）
        const rivalJuuboku = Array.from({ length: INITIAL_JUUBOKU_COUNT }, (_, i) => {
            const total = randomInt(INITIAL_JUUBOKU_TOTAL_RANGE[0], INITIAL_JUUBOKU_TOTAL_RANGE[1])
            const stats = distributeJuubokuStats(total, 100)
            return {
                id: i + 1,
                combat: stats.combat,
                command: stats.command,
                intelligence: stats.intelligence,
                administration: stats.administration,
                injuryStatus: 'normal' as const,
                injuryWeeksRemaining: 0,
            }
        })

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

        set({ player, rival, logs: [], mandate: null, evaluationTurnDone: null })
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

            const nextTurn = state.player.week + 1
            const isEndOfCalendarWeek = nextTurn % 2 === 0
            const prevCalendarWeek = turnToCalendarWeek(state.player.week)
            const nextCalendarWeek = turnToCalendarWeek(nextTurn)
            const isCalendarWeekAdvanced = nextCalendarWeek !== prevCalendarWeek

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
            const recoveredPlayer = isEndOfCalendarWeek
                ? processWeeklyInjuryRecovery(state.player)
                : state.player

            let updatedBanditCards = state.banditCards
            let updatedLogs = state.logs

            if (isCalendarWeekAdvanced) {
                const nowCalendarWeek = nextCalendarWeek

                const toRemove: string[] = []
                const toUpdate: BanditCardState[] = []

                for (const card of state.banditCards) {
                    const ageWeeks = nowCalendarWeek - card.foundCalendarWeek

                    if (ageWeeks >= 16) {
                        toRemove.push(card.id)
                        const expireLog: LogEntry = {
                            week: nextTurn,
                            message: `盗賊情報（${card.bandit.rank}）は他勢力に討伐された（カード消滅）`,
                            type: 'warning',
                        }
                        updatedLogs = [expireLog, ...updatedLogs].slice(0, 50)
                        continue
                    }

                    if (!card.escalated && ageWeeks >= 8) {
                        const newRank = nextBanditRank(card.bandit.rank)
                        const nextBandit = generateBandit(newRank)

                        const updatedCard: BanditCardState = {
                            ...card,
                            bandit: {
                                ...nextBandit,
                                investigated: card.bandit.investigated,
                                weakness: card.bandit.weakness,
                                traitor: card.bandit.traitor,
                            },
                            escalated: true,
                        }

                        toUpdate.push(updatedCard)

                        const escalateLog: LogEntry = {
                            week: nextTurn,
                            message: `盗賊情報が悪化した：${card.bandit.rank}→${newRank}`,
                            type: 'warning',
                        }
                        updatedLogs = [escalateLog, ...updatedLogs].slice(0, 50)
                    }
                }

                if (toRemove.length > 0) {
                    updatedBanditCards = updatedBanditCards.filter((c) => !toRemove.includes(c.id))
                }
                if (toUpdate.length > 0) {
                    const map = new Map(toUpdate.map((c) => [c.id, c]))
                    updatedBanditCards = updatedBanditCards.map((c) => map.get(c.id) ?? c)
                }
            }

            return {
                player: {
                    ...recoveredPlayer,
                    week: nextTurn,
                },
                rival: updatedRival,
                banditCards: updatedBanditCards,
                logs: updatedLogs,
                evaluationTurnDone: state.evaluationTurnDone === state.player.week ? null : state.evaluationTurnDone,
            }
        })
    },

    setMission: (mission) => set({ mission }),

    addBanditCard: (card) => {
        set((state) => ({
            banditCards: [card, ...state.banditCards],
        }))
    },

    removeBanditCard: (cardId) => {
        set((state) => ({
            banditCards: state.banditCards.filter((c) => c.id !== cardId),
        }))
    },

    updateBanditCard: (cardId, updates) => {
        set((state) => ({
            banditCards: state.banditCards.map((c) =>
                c.id === cardId ? { ...c, ...updates } : c
            ),
        }))
    },

    setMandate: (mandate) => set({ mandate }),

    setEvaluationTurnDone: (turn) => set({ evaluationTurnDone: turn }),

    markMandateSucceeded: () => {
        set((state) => {
            if (!state.mandate) return state
            if (state.mandate.status !== 'active') return state
            return {
                mandate: {
                    ...state.mandate,
                    status: 'succeeded',
                },
            }
        })
    },

    markMandateFailed: () => {
        set((state) => {
            if (!state.mandate) return state
            if (state.mandate.status !== 'active') return state
            return {
                mandate: {
                    ...state.mandate,
                    status: 'failed',
                },
            }
        })
    },

    issueNextMandate: () => {
        const player = get().player
        if (!player) return
        set({ mandate: generateMandateForPlayer(player) })
    },

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

    // Version 0.1では昇進ボーナスなし（詳細設計書 4-4節準拠）
    // 能力値は訓練・実戦・計略などの経験によってのみ成長する
    promotePlayer: (newRank) => {
        set((state) => {
            if (!state.player) return state

            return {
                player: {
                    ...state.player,
                    rank: newRank,
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

    saveGame: () => {
        const state = get()
        const saveData = {
            player: state.player,
            rival: state.rival,
            mission: state.mission,
            banditCards: state.banditCards,
            logs: state.logs,
            currentScreen: state.currentScreen,
            mandate: state.mandate,
            savedAt: new Date().toISOString(),
        }
        try {
            localStorage.setItem('sengoku_save', JSON.stringify(saveData))
            return true
        } catch (e) {
            console.error('Save failed:', e)
            return false
        }
    },

    loadGame: () => {
        try {
            const saved = localStorage.getItem('sengoku_save')
            if (!saved) return false
            
            const saveData = JSON.parse(saved)
            set({
                player: saveData.player,
                rival: saveData.rival,
                mission: saveData.mission,
                banditCards: saveData.banditCards || [],
                logs: saveData.logs || [],
                currentScreen: saveData.currentScreen || 'main',
                mandate: saveData.mandate,
            })
            return true
        } catch (e) {
            console.error('Load failed:', e)
            return false
        }
    },
}))
