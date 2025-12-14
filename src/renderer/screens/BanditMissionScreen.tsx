import React, { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { Modal } from '../components/Modal'
import { calculatePlayerCombatPowerForBandit, calculateBanditCombatPower, calculateSuccessRate, judgeBanditBattle, initBanditBattleState, setBanditBattleUnitStance, swapBanditBattleUnits, retreatBanditBattleUnit, promoteBanditBattleUnitToFront, advanceBanditBattleTurn, judgeBanditBattleFromState, type BattleCasualties } from '../utils/combat'
import { applyScout, applyMisinformation, applyBribe, getStrategyCost, calculateStrategySuccessRate } from '../utils/bandit'
import { BANDIT_RANKS, EXP_GAIN } from '../constants/game'
import { formatDate, weekToDate, isKochouEvaluationTurn, isMonthlyProcessing } from '../utils/time'
import { applyBattleCasualties } from '../utils/injury'
import { addExperience } from '../utils/experience'
import type { ActionLogEntry, CommandType, BattleStance, BanditBattleState } from '../types/game'

export const BanditMissionScreen: React.FC = () => {
    const { player, mandate, mission, addLog, advanceWeek, updatePlayer, setCurrentScreen, markMandateSucceeded, removeBanditCard } = useGameStore()
    const [selectedStrategy, setSelectedStrategy] = useState<'scout' | 'misinformation' | 'bribe' | 'hire' | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)
    const [showResult, setShowResult] = useState(false)
    const [battleResult, setBattleResult] = useState<{ success: boolean; banditLosses: number; casualties: BattleCasualties } | null>(null)
    const lastCompletedTurnRef = useRef<number | null>(null)
    const [selectedDelegationJuubokuId, setSelectedDelegationJuubokuId] = useState<number | null>(null)
    const [swapFrontId, setSwapFrontId] = useState<string>('')
    const [swapReserveId, setSwapReserveId] = useState<string>('')
    const [promoteReserveId, setPromoteReserveId] = useState<string>('')

    if (!player || !mission || mission.type !== 'bandit_subjugation') {
        setCurrentScreen('main')
        return null
    }

    const actionLogs = mission.actionLogs || []
    const orderedActionLogs = [...actionLogs].sort((a, b) => {
        const toVal = (w: ActionLogEntry['week']) => (w === '開始' ? -1 : w)
        return toVal(b.week) - toVal(a.week)
    })
    const playerPower = calculatePlayerCombatPowerForBandit(player) + mission.additionalAshigaru * 32
    const banditPower = calculateBanditCombatPower(mission.bandit)
    const successRate = calculateSuccessRate(playerPower, banditPower)

    const powerRatio = banditPower > 0 ? playerPower / banditPower : 999
    const canAutoBattle = powerRatio >= 3 || powerRatio <= 0.33

    const delegatedThisTurn = mission.delegatedTurn === player.week

    const getBestJuubokuForIntelligence = () => {
        if (player.juuboku.length === 0) return null
        return player.juuboku.reduce((best, cur) => (cur.intelligence > best.intelligence ? cur : best))
    }

    useEffect(() => {
        // 初期は「向いている若党（知略最高）」を自動選択
        const best = getBestJuubokuForIntelligence()
        setSelectedDelegationJuubokuId(best?.id ?? null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mission.currentWeek, player.week, player.juuboku.length])

    const getSelectedJuuboku = () => {
        if (selectedDelegationJuubokuId == null) return null
        return player.juuboku.find(j => j.id === selectedDelegationJuubokuId) ?? null
    }

    const enemyCountDisplay = mission.bandit.investigated
        ? `${mission.bandit.count}名`
        : `${BANDIT_RANKS[mission.rank].count[0]}〜${BANDIT_RANKS[mission.rank].count[1]}名`

    const bribeCost = getStrategyCost('bribe')
    const hireCost = getStrategyCost('hire')
    const canBribe = mission.bandit.investigated && mission.bandit.count >= 10

    const getCommandNameForRank = (rank: string): CommandType => {
        switch (rank) {
            case 'D':
                return '盗賊討伐（小規模）'
            case 'C':
                return '盗賊討伐（中規模）'
            case 'B':
                return '盗賊討伐（大規模）'
            case 'A':
                return '盗賊討伐（討伐戦）'
            default:
                return '盗賊討伐（賊軍）'
        }
    }

    // 期限計算
    const currentDate = formatDate(weekToDate(player.week))
    const deadlineWeek = player.week + (mission.timeLimit - mission.currentWeek)
    const deadlineDate = formatDate(weekToDate(deadlineWeek))

    // フェーズ判定（ターンベース表示）
    const isLastWeek = mission.currentWeek === mission.timeLimit
    const phase = isLastWeek ? '最終ターン' : '準備期間'

    // プログレスバー
    const progress = (mission.currentWeek / mission.timeLimit) * 100

    const addActionLog = (
        actionName: string,
        result: "成功" | "失敗" | "―",
        detail: string,
        currentMission: typeof mission,
        weekOverride?: ActionLogEntry['week']
    ): typeof mission => {
        const baseLogs = currentMission.actionLogs || []
        const newLog: ActionLogEntry = {
            week: weekOverride ?? currentMission.currentWeek,
            actionName,
            result,
            detail,
        }

        return {
            ...currentMission,
            actionLogs: [newLog, ...baseLogs],
        }
    }

    const handleStrategySelect = (strategy: 'scout' | 'misinformation' | 'bribe' | 'hire') => {
        if (delegatedThisTurn) return
        setSelectedStrategy(strategy)
        setShowConfirm(true)
    }

    const handleConfirmStrategy = () => {
        if (!selectedStrategy) return
        if (delegatedThisTurn) return

        let updatedMission = { ...mission }
        let updatedPlayer = { ...player }

        switch (selectedStrategy) {
            case 'scout': {
                const { mission: missionAfter, success } = applyScout(updatedMission, updatedPlayer)
                updatedMission = missionAfter
                if (success) {
                    const scoutExp = EXP_GAIN['偵察成功'].intelligence
                    if (scoutExp) {
                        const result = addExperience(updatedPlayer, 'intelligence', scoutExp)
                        updatedPlayer = result.updatedPlayer
                    }
                    const revealedBandit = missionAfter.bandit
                    const revealedPower = calculateBanditCombatPower(revealedBandit)
                    updatedMission = addActionLog(
                        '偵察',
                        '成功',
                        `敵の詳細情報を入手。人数${revealedBandit.count}名、戦闘力${revealedPower}と判明。`,
                        updatedMission
                    )
                    addLog('偵察を行い、敵情報を得た', 'success')
                } else {
                    const scoutExp = EXP_GAIN['偵察失敗'].intelligence
                    if (scoutExp) {
                        const result = addExperience(updatedPlayer, 'intelligence', scoutExp)
                        updatedPlayer = result.updatedPlayer
                    }
                    updatedMission = addActionLog('偵察', '失敗', '敵の所在を特定できなかった。', updatedMission)
                    addLog('偵察に失敗した', 'danger')
                }
                break
            }
            case 'misinformation': {
                const { mission: missionAfter, success, moraleDecrease } = applyMisinformation(updatedMission, updatedPlayer)
                updatedMission = missionAfter
                if (success) {
                    const stratExp = EXP_GAIN['計略成功'].intelligence
                    if (stratExp) {
                        const result = addExperience(updatedPlayer, 'intelligence', stratExp)
                        updatedPlayer = result.updatedPlayer
                    }
                    updatedMission = addActionLog('偽情報', '成功', `敵の士気を${moraleDecrease}低下させた。`, updatedMission)
                    addLog('偽情報を流し、敵の士気を下げた', 'success')
                } else {
                    const stratExp = EXP_GAIN['計略失敗'].intelligence
                    if (stratExp) {
                        const result = addExperience(updatedPlayer, 'intelligence', stratExp)
                        updatedPlayer = result.updatedPlayer
                    }
                    updatedMission = addActionLog('偽情報', '失敗', '敵に見破られ、効果がなかった。', updatedMission)
                    addLog('偽情報は効果を発揮しなかった', 'danger')
                }
                break
            }
            case 'bribe': {
                if (!canBribe) {
                    updatedMission = addActionLog(
                        '内応者買収',
                        '失敗',
                        '小規模の盗賊には買収は通じない（偵察済み・10人以上で解禁）',
                        updatedMission
                    )
                    addLog('買収は実行できない', 'danger')
                    setShowConfirm(false)
                    setSelectedStrategy(null)
                    return
                }

                const bribeResult = applyBribe(updatedMission, updatedPlayer)
                updatedMission = bribeResult.mission
                updatedPlayer = bribeResult.player
                if (bribeResult.success) {
                    const stratExp = EXP_GAIN['計略成功'].intelligence
                    if (stratExp) {
                        const result = addExperience(updatedPlayer, 'intelligence', stratExp)
                        updatedPlayer = result.updatedPlayer
                    }
                    updatedMission = addActionLog('内応者買収', '成功', '内応者を得た（敵戦力-10%扱い）。', updatedMission)
                    addLog('内応者を買収し、敵戦力を削いだ', 'success')
                } else {
                    const cost = getStrategyCost('bribe')
                    if (player.money < cost) {
                        updatedMission = addActionLog('内応者買収', '失敗', `資金不足（${cost}貫必要）`, updatedMission)
                        addLog('買収に失敗した（資金不足）', 'danger')
                    } else {
                        const stratExp = EXP_GAIN['計略失敗'].intelligence
                        if (stratExp) {
                            const result = addExperience(updatedPlayer, 'intelligence', stratExp)
                            updatedPlayer = result.updatedPlayer
                        }
                        updatedMission = addActionLog('内応者買収', '失敗', '説得に失敗し、内応者は得られなかった。', updatedMission)
                        addLog('買収は失敗し、内応者は得られなかった', 'danger')
                    }
                }
                break
            }
            case 'hire': {
                const cost = getStrategyCost('hire')
                const count = 5
                if (updatedPlayer.money >= cost) {
                    updatedMission.additionalAshigaru += count
                    updatedPlayer.money -= cost
                    updatedMission = addActionLog('足軽雇用', '成功', `足軽${count}名を雇用。戦力+${count * 32}。`, updatedMission)
                    addLog(`足軽${count}名を雇用した`, 'success')
                } else {
                    updatedMission = addActionLog('足軽雇用', '失敗', `資金不足（${cost}貫必要）`, updatedMission)
                    addLog('足軽雇用に失敗した（資金不足）', 'danger')
                }
                break
            }
        }

        // 偵察は成功するまで「使用済み」にしない
        if (selectedStrategy !== 'scout') {
            updatedMission.strategies.push(selectedStrategy)
        }
        updatedMission.currentWeek += 1
        useGameStore.setState({ mission: updatedMission })
        updatePlayer(updatedPlayer)
        advanceWeek()

        setShowConfirm(false)
        setSelectedStrategy(null)
    }

    const handleWait = () => {
        if (isLastWeek) return
        if (delegatedThisTurn) return

        let updatedMission = { ...mission, currentWeek: mission.currentWeek + 1 }
        updatedMission = addActionLog(
            '様子を見る',
            '―',
            '状況を観察し、次の機会を待った。',
            updatedMission,
            mission.currentWeek
        )
        useGameStore.setState({ mission: updatedMission })
        addLog('様子を見た', 'normal')
        advanceWeek()
    }

    const finalizeBattleResult = (result: { success: boolean; banditLosses: number; casualties: BattleCasualties }, completedTurn: number) => {
        setBattleResult(result)
        setShowResult(true)

        const totalCasualties = result.casualties.deaths + result.casualties.severeInjuries + result.casualties.lightInjuries

        const missionCommand = getCommandNameForRank(mission.rank)
        const mandateAchieved =
            !!mandate &&
            mandate.status === 'active' &&
            mandate.target === missionCommand &&
            result.success

        // 死者はまず雇い足軽（additionalAshigaru）から差し引く
        const hiredAshigaruDeaths = Math.min(mission.additionalAshigaru, result.casualties.deaths)
        const remainingCasualties: BattleCasualties = {
            ...result.casualties,
            deaths: result.casualties.deaths - hiredAshigaruDeaths,
        }

        const applyToLoanedThenJuuboku = (p: typeof player, casualties: BattleCasualties) => {
            const updated = { ...p }

            const loanedBeforeLen = updated.loanedAshigaru.length
            const loanedAfter = applyBattleCasualties(updated.loanedAshigaru, casualties)
            const deathsAppliedLoaned = Math.min(casualties.deaths, loanedBeforeLen)
            const loanedSurvivorsLen = Math.max(0, loanedBeforeLen - deathsAppliedLoaned)
            const severeAppliedLoaned = Math.min(casualties.severeInjuries, loanedSurvivorsLen)
            const lightCapacityLoaned = Math.max(0, loanedSurvivorsLen - severeAppliedLoaned)
            const lightAppliedLoaned = Math.min(casualties.lightInjuries, lightCapacityLoaned)

            const remainingAfterLoaned: BattleCasualties = {
                deaths: Math.max(0, casualties.deaths - deathsAppliedLoaned),
                severeInjuries: Math.max(0, casualties.severeInjuries - severeAppliedLoaned),
                lightInjuries: Math.max(0, casualties.lightInjuries - lightAppliedLoaned),
            }

            updated.loanedAshigaru = loanedAfter
            updated.juuboku = applyBattleCasualties(updated.juuboku, remainingAfterLoaned)
            return updated
        }

        if (result.success) {
            const meritGain = BANDIT_RANKS[mission.rank].merit
            const bossReward = BANDIT_RANKS[mission.rank].bossReward
            const lootMultiplier = mission.lootMultiplier ?? 1
            const loot = {
                rice: mission.bandit.wealth.rice * 0.5 * lootMultiplier,
                money: mission.bandit.wealth.money * 0.5 * lootMultiplier,
            }
            const totalReward = {
                rice: loot.rice + bossReward.rice,
                money: loot.money + bossReward.money,
            }

            const updatedPlayer = { ...player }
            updatedPlayer.merit += meritGain
            updatedPlayer.rice += totalReward.rice
            updatedPlayer.money += totalReward.money

            const missionWithLog = addActionLog(
                '戦闘',
                '成功',
                `盗賊討伐成功！功績+${meritGain}、米+${totalReward.rice.toFixed(3)}石、金+${totalReward.money.toFixed(3)}貫`,
                mission
            )
            useGameStore.setState({ mission: { ...missionWithLog, battleState: null } })
            addLog(`盗賊討伐に成功！功績+${meritGain}`, 'success')

            const afterLoss = applyToLoanedThenJuuboku(updatedPlayer, remainingCasualties)
            updatedPlayer.juuboku = afterLoss.juuboku
            updatedPlayer.loanedAshigaru = afterLoss.loanedAshigaru

            // 雇い足軽の死者は功績ペナルティ（下知達成/未達で変動）
            if (hiredAshigaruDeaths > 0) {
                const perDeathPenalty = mandateAchieved ? 2 : 4
                const penalty = hiredAshigaruDeaths * perDeathPenalty
                updatedPlayer.merit = Math.max(0, updatedPlayer.merit - penalty)
                addLog(`雇い足軽${hiredAshigaruDeaths}名が死亡（功績-${penalty}）`, mandateAchieved ? 'warning' : 'danger')
            }

            if (totalCasualties > 0) {
                const deathLabel =
                    hiredAshigaruDeaths > 0
                        ? `死亡${result.casualties.deaths}名（雇い足軽${hiredAshigaruDeaths}名）`
                        : `死亡${result.casualties.deaths}名`
                addLog(`損失: ${deathLabel}、重傷${result.casualties.severeInjuries}名、軽傷${result.casualties.lightInjuries}名`, 'warning')
            }
            updatePlayer(updatedPlayer)

            if (mission.source === 'patrol_card' && mission.sourceCardId) {
                removeBanditCard(mission.sourceCardId)
            }

            if (mandate && mandate.status === 'active') {
                if (mandate.target === missionCommand) {
                    markMandateSucceeded()
                    addLog('下知を達成した', 'success')
                }
            }
        } else {
            const missionWithLog = addActionLog('戦闘', '失敗', `盗賊討伐失敗。味方損失${totalCasualties}名。`, mission)
            useGameStore.setState({ mission: { ...missionWithLog, battleState: null } })
            addLog('盗賊討伐に失敗した', 'danger')

            const updatedPlayer = { ...player }
            const afterLoss = applyToLoanedThenJuuboku(updatedPlayer, remainingCasualties)
            updatedPlayer.juuboku = afterLoss.juuboku
            updatedPlayer.loanedAshigaru = afterLoss.loanedAshigaru

            if (hiredAshigaruDeaths > 0) {
                const perDeathPenalty = mandateAchieved ? 2 : 4
                const penalty = hiredAshigaruDeaths * perDeathPenalty
                updatedPlayer.merit = Math.max(0, updatedPlayer.merit - penalty)
                addLog(`雇い足軽${hiredAshigaruDeaths}名が死亡（功績-${penalty}）`, mandateAchieved ? 'warning' : 'danger')
            }

            const deathLabel =
                hiredAshigaruDeaths > 0
                    ? `死亡${result.casualties.deaths}名（雇い足軽${hiredAshigaruDeaths}名）`
                    : `死亡${result.casualties.deaths}名`
            addLog(`損失: ${deathLabel}、重傷${result.casualties.severeInjuries}名、軽傷${result.casualties.lightInjuries}名`, 'danger')
            updatePlayer(updatedPlayer)
        }

        // 戦闘は最終ターンの行動として扱う
        advanceWeek()
        lastCompletedTurnRef.current = completedTurn
    }

    const handleAutoBattle = (attackType: 'normal' | 'night_raid') => {
        if (delegatedThisTurn) return
        if (!canAutoBattle) return

        const completedTurn = player.week
        const result = judgeBanditBattle(player, mission.bandit, mission.additionalAshigaru, attackType)
        finalizeBattleResult(result, completedTurn)
    }

    const handleBattle = (attackType: 'normal' | 'night_raid') => {
        if (delegatedThisTurn) return

        const battleState = initBanditBattleState(player, mission.bandit, mission.additionalAshigaru, attackType)
        useGameStore.setState({ mission: { ...mission, battleState } })
    }

    const battleState = (mission.battleState ?? null) as BanditBattleState | null

    const handleAdvanceBattleTurn = () => {
        if (!battleState) return
        if (battleState.resolved) return
        const next = advanceBanditBattleTurn(battleState, player.hasHorse)
        useGameStore.setState({ mission: { ...mission, battleState: next } })

        if (next.resolved) {
            const completedTurn = player.week
            const result = judgeBanditBattleFromState(next)
            finalizeBattleResult(result, completedTurn)
        }
    }

    const handleChangeStance = (unitId: string, stance: BattleStance) => {
        if (!battleState) return
        if (battleState.resolved) return
        const next = setBanditBattleUnitStance(battleState, unitId, stance)
        useGameStore.setState({ mission: { ...mission, battleState: next } })
    }

    const handleSwap = () => {
        if (!battleState) return
        if (battleState.resolved) return

        const frontId =
            swapFrontId ||
            battleState.playerUnits.find((u) => u.position === 'front' && u.hp > 0)?.id ||
            ''
        const reserveId =
            swapReserveId ||
            battleState.playerUnits.find((u) => u.position === 'reserve' && u.hp > 0)?.id ||
            ''

        if (!frontId || !reserveId) return

        const next = swapBanditBattleUnits(battleState, frontId, reserveId)
        useGameStore.setState({ mission: { ...mission, battleState: next } })
    }

    const handleRetreat = (frontUnitId: string) => {
        if (!battleState) return
        if (battleState.resolved) return
        const next = retreatBanditBattleUnit(battleState, frontUnitId)
        useGameStore.setState({ mission: { ...mission, battleState: next } })
    }

    const handlePromoteToFront = () => {
        if (!battleState) return
        if (battleState.resolved) return

        const reserveId =
            promoteReserveId ||
            battleState.playerUnits.find((u) => u.position === 'reserve' && u.hp > 0)?.id ||
            ''
        if (!reserveId) return

        const next = promoteBanditBattleUnitToFront(battleState, reserveId)
        useGameStore.setState({ mission: { ...mission, battleState: next } })
    }

    const handleResultClose = () => {
        useGameStore.setState({ mission: null, selectedCommand: null })
        const currentTurn = useGameStore.getState().player?.week
        const completedTurn = lastCompletedTurnRef.current ?? (currentTurn ? currentTurn - 1 : null)

        if (completedTurn && isMonthlyProcessing(completedTurn)) {
            setCurrentScreen('monthly-report')
        } else if (currentTurn && isKochouEvaluationTurn(currentTurn)) {
            setCurrentScreen('kochou-evaluation')
        } else {
            setCurrentScreen('main')
        }
    }

    const handleAbort = () => {
        useGameStore.setState({ mission: null, selectedCommand: null })
        const currentTurn = useGameStore.getState().player?.week
        if (currentTurn && isMonthlyProcessing(currentTurn)) {
            setCurrentScreen('monthly-report')
        } else if (currentTurn && isKochouEvaluationTurn(currentTurn)) {
            setCurrentScreen('kochou-evaluation')
        } else {
            setCurrentScreen('main')
        }
    }

    const canUseStrategy = (strategy: string) => {
        if (delegatedThisTurn) return false
        // 偵察は「成功して調査済み」になるまで再試行できる
        if (strategy === 'scout') return !mission.bandit.investigated
        return !mission.strategies.includes(strategy as any)
    }

    const handleDelegateStrategy = (strategy: 'scout' | 'misinformation' | 'bribe' | 'hire') => {
        if (battleState) return
        if (delegatedThisTurn) return
        if (strategy === 'scout' && mission.bandit.investigated) return

        const actor = getSelectedJuuboku() ?? getBestJuubokuForIntelligence()
        if (!actor) {
            addLog('若党がいないため、委任できない', 'danger')
            return
        }

        const addDelegationLog = (
            actionName: string,
            result: '成功' | '失敗' | '―',
            detail: string,
            currentMission: typeof mission
        ) => {
            return addActionLog(actionName, result, detail, currentMission)
        }

        let updatedMission = { ...mission }
        let updatedPlayer = { ...player }

        // 若党の能力で成功率を算出するため、プレイヤーの知略だけ差し替えた仮プレイヤーを作る
        const delegatedPlayer = {
            ...player,
            stats: {
                ...player.stats,
                intelligence: actor.intelligence,
            },
        }

        if (strategy === 'scout') {
            const { mission: missionAfter, success, successRate } = applyScout(updatedMission, delegatedPlayer)
            updatedMission = missionAfter
            if (success) {
                const revealed = missionAfter.bandit
                updatedMission = addDelegationLog(
                    '若党偵察',
                    '成功',
                    `若党${actor.id}が偵察に成功（成功率${Math.floor(successRate)}%）。人数${revealed.count}名、弱点:${revealed.weakness ?? '不明'}。`,
                    updatedMission
                )
                addLog(`若党${actor.id}が偵察成功（成功率${Math.floor(successRate)}%）`, 'success')
            } else {
                updatedMission = addDelegationLog(
                    '若党偵察',
                    '失敗',
                    `若党${actor.id}の偵察は失敗（成功率${Math.floor(successRate)}%）。`,
                    updatedMission
                )
                addLog(`若党${actor.id}が偵察失敗（成功率${Math.floor(successRate)}%）`, 'warning')
            }
        }

        if (strategy === 'misinformation') {
            const { mission: missionAfter, success, moraleDecrease, successRate } = applyMisinformation(updatedMission, delegatedPlayer)
            updatedMission = missionAfter
            if (success) {
                updatedMission = addDelegationLog(
                    '若党偽情報',
                    '成功',
                    `若党${actor.id}が偽情報成功（成功率${Math.floor(successRate)}%）。敵士気-${moraleDecrease}。`,
                    updatedMission
                )
                addLog(`若党${actor.id}が偽情報成功（成功率${Math.floor(successRate)}%）`, 'success')
            } else {
                updatedMission = addDelegationLog(
                    '若党偽情報',
                    '失敗',
                    `若党${actor.id}の偽情報は失敗（成功率${Math.floor(successRate)}%）。`,
                    updatedMission
                )
                addLog(`若党${actor.id}が偽情報失敗（成功率${Math.floor(successRate)}%）`, 'warning')
            }
        }

        if (strategy === 'bribe') {
            const rate = calculateStrategySuccessRate('bribe', delegatedPlayer, mission.bandit)
            const bribeResult = applyBribe(updatedMission, updatedPlayer)
            updatedMission = bribeResult.mission
            updatedPlayer = bribeResult.player
            if (bribeResult.success) {
                updatedMission = addDelegationLog(
                    '若党買収',
                    '成功',
                    `若党${actor.id}が買収成功（成功率${Math.floor(rate)}%）。内応者を得た（敵戦力-10%扱い）。`,
                    updatedMission
                )
                addLog(`若党${actor.id}が買収成功（成功率${Math.floor(rate)}%）`, 'success')
            } else {
                const cost = getStrategyCost('bribe')
                updatedMission = addDelegationLog(
                    '若党買収',
                    '失敗',
                    `若党${actor.id}の買収は失敗（成功率${Math.floor(rate)}%）。必要資金:${cost}貫。`,
                    updatedMission
                )
                addLog(`若党${actor.id}が買収失敗（成功率${Math.floor(rate)}%）`, 'warning')
            }
        }

        if (strategy === 'hire') {
            const cost = getStrategyCost('hire')
            const count = 5
            if (updatedPlayer.money >= cost) {
                updatedMission.additionalAshigaru += count
                updatedPlayer.money -= cost
                updatedMission = addDelegationLog(
                    '若党足軽雇用',
                    '成功',
                    `若党${actor.id}が足軽${count}名を雇用。戦力+${count * 32}。`,
                    updatedMission
                )
                addLog(`若党${actor.id}が足軽雇用成功`, 'success')
            } else {
                updatedMission = addDelegationLog(
                    '若党足軽雇用',
                    '失敗',
                    `若党${actor.id}の足軽雇用は失敗（資金不足：${cost}貫必要）`,
                    updatedMission
                )
                addLog(`若党${actor.id}が足軽雇用失敗（資金不足）`, 'warning')
            }
        }

        // 偵察は成功するまで「使用済み」にしない
        if (strategy !== 'scout') {
            updatedMission.strategies = [...updatedMission.strategies, strategy]
        }
        updatedMission.currentWeek += 1
        updatedMission.delegatedTurn = player.week

        useGameStore.setState({ mission: updatedMission })
        updatePlayer(updatedPlayer)
    }

    return (
    <div className="min-h-screen bg-sengoku-dark p-10">
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-sengoku-gold mb-6">
                盗賊討伐 - {mission.rank}ランク
            </h1>

            {/* ヘッダー情報 */}
            <Panel title="任務情報">
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-sengoku-gray">現在:</span>
                        <span>{currentDate}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-sengoku-gray">敵勢力:</span>
                        <span>{enemyCountDisplay}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-sengoku-gray">報酬功績:</span>
                        <span>+{BANDIT_RANKS[mission.rank].merit}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-sengoku-gray">期限:</span>
                        <span className="text-[#FF6B6B] font-bold">{deadlineDate}まで</span>
                    </div>
                    <div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-sengoku-gray">進行:</span>
                            <span>第{mission.currentWeek}ターン / {mission.timeLimit}ターン（{phase}）</span>
                        </div>
                        <div className="w-full h-2 bg-sengoku-darker border border-sengoku-border">
                            <div
                                className="h-full bg-sengoku-gold transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </Panel>

            {/* 若党委任（準備行動） */}
            {!isLastWeek && !battleState && (
                <Panel title="若党委任（準備行動）">
                    <div className="space-y-3">
                        <div className="text-xs text-sengoku-gray">
                            ※若党に準備行動を任せられます（主人公ターンは消費しません）。
                        </div>
                        <div className="text-xs text-sengoku-gray">
                            担当若党：
                            <select
                                className="ml-2 bg-sengoku-darker border border-sengoku-border px-2 py-1"
                                value={selectedDelegationJuubokuId ?? ''}
                                onChange={(e) => setSelectedDelegationJuubokuId(e.target.value ? Number(e.target.value) : null)}
                                disabled={player.juuboku.length === 0 || delegatedThisTurn}
                            >
                                {player.juuboku.map(j => (
                                    <option key={j.id} value={j.id}>
                                        若党{j.id}（知略{j.intelligence}）
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                className="text-sm"
                                variant="secondary"
                                onClick={() => handleDelegateStrategy('scout')}
                                disabled={delegatedThisTurn || mission.bandit.investigated}
                            >
                                若党に偵察
                            </Button>
                            <Button
                                className="text-sm"
                                variant="secondary"
                                onClick={() => handleDelegateStrategy('misinformation')}
                                disabled={delegatedThisTurn}
                            >
                                若党に偽情報
                            </Button>
                            <Button
                                className="text-sm"
                                variant="secondary"
                                onClick={() => handleDelegateStrategy('hire')}
                                disabled={delegatedThisTurn}
                            >
                                若党に足軽雇用
                            </Button>
                            <Button
                                className="text-sm"
                                variant="secondary"
                                onClick={() => handleDelegateStrategy('bribe')}
                                disabled={delegatedThisTurn || player.money < bribeCost || !canBribe}
                            >
                                若党に買収
                            </Button>
                        </div>
                        {delegatedThisTurn && (
                            <div className="text-xs text-sengoku-gray">
                                ※このターンは既に若党へ委任済みです
                            </div>
                        )}
                    </div>
                </Panel>
            )}

            {/* 行動ログ */}
            {orderedActionLogs.length > 0 && (
                <Panel title="行動ログ">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {orderedActionLogs.map((log, index) => (
                            <div key={index} className="text-sm flex items-start gap-2 p-2 bg-sengoku-darker border border-sengoku-border">
                                <span className="text-sengoku-gray whitespace-nowrap">
                                    [{log.week === "開始" ? "開始" : `第${log.week}ターン`}]
                                </span>
                                <span className="font-medium w-24">{log.actionName}</span>
                                <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${log.result === "成功" ? "bg-[#1B5E20] text-[#81C784]" :
                                    log.result === "失敗" ? "bg-[#B71C1C] text-[#EF9A9A]" :
                                        "bg-sengoku-border text-sengoku-gray"
                                    }`}>
                                    {log.result}
                                </span>
                                <span className="text-sengoku-gray flex-1">{log.detail}</span>
                            </div>
                        ))}
                    </div>
                </Panel>
            )}

            {delegatedThisTurn && (
                <Panel title="注意">
                    <div className="text-sm text-sengoku-gray">
                        このターンは若党に準備行動を委任済みのため、任務内の行動は選べません。
                    </div>
                </Panel>
            )}

            {/* 敵情報 */}
            <Panel title="敵情報">
                <div className="space-y-2 text-sm">
                    <div>盗賊ランク: {mission.rank}</div>
                    {mission.bandit.investigated ? (
                        <>
                            <div>兵力: {mission.bandit.count}名</div>
                            <div>士気: {mission.bandit.morale}</div>
                            <div>戦力: {banditPower}</div>
                            <div className="text-sengoku-success">
                                ※偵察済み - 詳細情報を把握
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="text-sengoku-gray">推定兵力: {enemyCountDisplay}</div>
                            <div className="text-sengoku-gray">※偵察を行うと詳細情報が判明します</div>
                        </>
                    )}
                </div>
            </Panel>

            {/* 自軍情報 */}
            <Panel title="自軍情報">
                <div className="space-y-2 text-sm">
                    <div>戦力: {playerPower}</div>
                    <div>
                        若党: {player.juuboku.length}名
                        {(() => {
                            const normal = player.juuboku.filter(j => j.injuryStatus === 'normal').length
                            const light = player.juuboku.filter(j => j.injuryStatus === 'light').length
                            const severe = player.juuboku.filter(j => j.injuryStatus === 'severe').length
                            if (light > 0 || severe > 0) {
                                return (
                                    <span className="text-xs ml-1">
                                        ({normal > 0 && `正常${normal}`}
                                        {light > 0 && <span className="text-yellow-500">{normal > 0 ? '、' : ''}軽傷{light}</span>}
                                        {severe > 0 && <span className="text-orange-500">{(normal > 0 || light > 0) ? '、' : ''}重傷{severe}</span>})
                                    </span>
                                )
                            }
                            return null
                        })()}
                    </div>
                    <div>徒士: {player.ashigaru.length}名</div>
                    {mission.additionalAshigaru > 0 && (
                        <div className="text-sengoku-success">
                            雇用足軽: +{mission.additionalAshigaru}名
                        </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-sengoku-border">
                        勝率: <span className={successRate >= 70 ? 'text-sengoku-success' : successRate >= 40 ? 'text-yellow-500' : 'text-sengoku-danger'}>
                            {successRate}%
                        </span>
                    </div>
                </div>
            </Panel>

            {/* 計略選択（戦闘開始前のみ） */}
            {!isLastWeek && !battleState && (
                <Panel title="計略">
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            onClick={() => handleStrategySelect('scout')}
                            disabled={!canUseStrategy('scout') || delegatedThisTurn}
                            variant="secondary"
                        >
                            偵察 {!canUseStrategy('scout') && '(使用済み)'}
                        </Button>
                        <Button
                            onClick={() => handleStrategySelect('misinformation')}
                            disabled={!canUseStrategy('misinformation') || delegatedThisTurn}
                            variant="secondary"
                        >
                            偽情報 {!canUseStrategy('misinformation') && '(使用済み)'}
                        </Button>
                        <Button
                            onClick={() => handleStrategySelect('bribe')}
                            disabled={!canUseStrategy('bribe') || player.money < bribeCost || !canBribe || delegatedThisTurn}
                            variant="secondary"
                        >
                            内応者買収 ({bribeCost}貫) {!canUseStrategy('bribe') && '(使用済み)'}
                        </Button>
                        <Button
                            onClick={() => handleStrategySelect('hire')}
                            disabled={!canUseStrategy('hire') || player.money < hireCost || delegatedThisTurn}
                            variant="secondary"
                        >
                            足軽雇用 ({hireCost}貫) {!canUseStrategy('hire') && '(使用済み)'}
                        </Button>

                        <Button
                            onClick={handleWait}
                            disabled={delegatedThisTurn}
                            variant="secondary"
                        >
                            様子を見る
                        </Button>
                    </div>
                </Panel>
            )}

            {/* 戦闘中UI */}
            {battleState && (
                <Panel title={`決戦（第${battleState.turn}ターン）`}>
                    <div className="space-y-4">
                        <div className="text-xs text-sengoku-gray">
                            交代残り: {battleState.swapsRemaining}（最大2） / 下げる残り: {battleState.retreatsRemaining}（最大2） / 上げる残り: {battleState.promotesRemaining}（最大2） / 自軍士気: {battleState.playerMorale} / 敵士気: {battleState.enemyMorale}
                        </div>

                        <div className="border border-sengoku-border bg-sengoku-darker p-2">
                            <Button onClick={handleAdvanceBattleTurn} className="w-full">
                                ターン進行
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-sm font-bold mb-2">敵前線（最大5）</div>
                                <div className="space-y-2">
                                    {battleState.enemyUnits
                                        .filter((u) => u.position === 'front')
                                        .slice(0, 5)
                                        .map((u) => (
                                            <div key={u.id} className="border border-sengoku-border bg-sengoku-darker p-2">
                                                <div className="flex justify-between text-sm">
                                                    <div>{u.name}</div>
                                                    <div className="text-xs text-sengoku-gray">HP {u.hp}/{u.maxHp} / 士気 {u.morale} / 疲労 {u.fatigue}</div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            <div>
                                <div className="text-sm font-bold mb-2">自軍前線（最大5）</div>
                                <div className="space-y-2">
                                    {battleState.playerUnits
                                        .filter((u) => u.position === 'front')
                                        .slice(0, 5)
                                        .map((u) => (
                                            <div key={u.id} className="border border-sengoku-border bg-sengoku-dark p-2">
                                                <div className="flex justify-between text-sm">
                                                    <div>{u.name}</div>
                                                    <div className="text-xs text-sengoku-gray">HP {u.hp}/{u.maxHp} / 士気 {u.morale} / 疲労 {u.fatigue}</div>
                                                </div>
                                                <div className="flex gap-2 mt-2">
                                                    <Button
                                                        variant={u.stance === 'attack' ? undefined : 'secondary'}
                                                        className="text-xs"
                                                        onClick={() => handleChangeStance(u.id, 'attack')}
                                                    >
                                                        攻撃
                                                    </Button>
                                                    <Button
                                                        variant={u.stance === 'normal' ? undefined : 'secondary'}
                                                        className="text-xs"
                                                        onClick={() => handleChangeStance(u.id, 'normal')}
                                                    >
                                                        平常
                                                    </Button>
                                                    <Button
                                                        variant={u.stance === 'defense' ? undefined : 'secondary'}
                                                        className="text-xs"
                                                        onClick={() => handleChangeStance(u.id, 'defense')}
                                                    >
                                                        防御
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="text-xs"
                                                        onClick={() => handleRetreat(u.id)}
                                                        disabled={battleState.retreatsRemaining <= 0}
                                                    >
                                                        下げる
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-bold mb-2">敵控え</div>
                            <div className="space-y-2">
                                {battleState.enemyUnits
                                    .filter((u) => u.position === 'reserve')
                                    .slice(0, 8)
                                    .map((u) => (
                                        <div key={u.id} className="border border-sengoku-border bg-sengoku-dark p-2 text-xs">
                                            {u.name} / HP {u.hp}/{u.maxHp} / 士気 {u.morale} / 疲労 {u.fatigue}
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <div>
                            <div className="text-sm font-bold mb-2">控え</div>
                            <div className="space-y-2">
                                {battleState.playerUnits
                                    .filter((u) => u.position === 'reserve')
                                    .slice(0, 8)
                                    .map((u) => (
                                        <div key={u.id} className="border border-sengoku-border bg-sengoku-darker p-2 text-xs">
                                            {u.name} / HP {u.hp}/{u.maxHp} / 士気 {u.morale} / 疲労 {u.fatigue}
                                        </div>
                                    ))}
                            </div>
                        </div>

                        <div className="border-t border-sengoku-border pt-3">
                            <div className="text-sm font-bold mb-2">交代（1ターン最大2）</div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    className="bg-sengoku-darker border border-sengoku-border px-2 py-1 text-xs"
                                    value={swapFrontId}
                                    onChange={(e) => setSwapFrontId(e.target.value)}
                                >
                                    <option value="">前線を選択</option>
                                    {battleState.playerUnits
                                        .filter((u) => u.position === 'front')
                                        .map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                </select>

                                <select
                                    className="bg-sengoku-darker border border-sengoku-border px-2 py-1 text-xs"
                                    value={swapReserveId}
                                    onChange={(e) => setSwapReserveId(e.target.value)}
                                >
                                    <option value="">控えを選択</option>
                                    {battleState.playerUnits
                                        .filter((u) => u.position === 'reserve')
                                        .map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="mt-2">
                                <Button
                                    variant="secondary"
                                    onClick={handleSwap}
                                    disabled={
                                        battleState.swapsRemaining <= 0 ||
                                        battleState.playerUnits.filter((u) => u.position === 'front' && u.hp > 0).length === 0 ||
                                        battleState.playerUnits.filter((u) => u.position === 'reserve' && u.hp > 0).length === 0
                                    }
                                >
                                    交代する
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-sengoku-border pt-3">
                            <div className="text-sm font-bold mb-2">前線投入（交代せず控え→前線）</div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    className="bg-sengoku-darker border border-sengoku-border px-2 py-1 text-xs"
                                    value={promoteReserveId}
                                    onChange={(e) => setPromoteReserveId(e.target.value)}
                                >
                                    <option value="">控えを選択</option>
                                    {battleState.playerUnits
                                        .filter((u) => u.position === 'reserve')
                                        .map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}
                                            </option>
                                        ))}
                                </select>
                                <Button
                                    variant="secondary"
                                    onClick={handlePromoteToFront}
                                    disabled={
                                        battleState.promotesRemaining <= 0 ||
                                        battleState.playerUnits.filter((u) => u.position === 'reserve' && u.hp > 0).length === 0 ||
                                        battleState.playerUnits.filter((u) => u.position === 'front' && u.hp > 0).length >= 5
                                    }
                                >
                                    前線投入
                                </Button>
                            </div>
                        </div>

                        <div className="border-t border-sengoku-border pt-3">
                            <div className="text-sm font-bold mb-2">戦闘ログ</div>
                            <div className="space-y-1 text-xs text-sengoku-gray">
                                {battleState.log.slice(0, 8).map((l, idx) => (
                                    <div key={idx}>{l}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                </Panel>
            )}

            {/* アクション（戦闘開始前） */}
            {!battleState && (
            <div className="flex gap-4 justify-center mt-6">
                <Button
                    variant="secondary"
                    onClick={() => setCurrentScreen('main')}
                >
                    一旦戻る
                </Button>
                <Button variant="secondary" onClick={handleAbort}>
                    中止
                </Button>
                {canAutoBattle && (
                    <Button
                        variant="secondary"
                        onClick={() => handleAutoBattle('normal')}
                        disabled={delegatedThisTurn}
                    >
                        自動戦闘（戦力差）
                    </Button>
                )}
                <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => handleBattle('normal')}
                    disabled={delegatedThisTurn}
                >
                    攻撃
                </Button>
                <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => handleBattle('night_raid')}
                    disabled={delegatedThisTurn}
                >
                    夜襲
                </Button>
            </div>
            )}

            {/* 計略確認モーダル */}
            <Modal
                isOpen={showConfirm}
                onClose={() => {
                    setShowConfirm(false)
                    setSelectedStrategy(null)
                }}
                title="確認"
                actions={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowConfirm(false)
                                setSelectedStrategy(null)
                            }}
                        >
                            キャンセル
                        </Button>
                        <Button onClick={handleConfirmStrategy}>実行</Button>
                    </>
                }
            >
                <p className="text-sengoku-gray">
                    {selectedStrategy === 'scout' && '偵察を行いますか？'}
                    {selectedStrategy === 'misinformation' && '偽情報を流しますか？'}
                    {selectedStrategy === 'bribe' && `内応者を買収しますか？（${bribeCost}貫）`}
                    {selectedStrategy === 'hire' && `足軽を雇用しますか？（${hireCost}貫）`}
                </p>
            </Modal>

            {/* 戦闘結果モーダル */}
            <Modal
                isOpen={showResult}
                onClose={handleResultClose}
                title={battleResult?.success ? '勝利！' : '敗北...'}
                actions={<Button onClick={handleResultClose}>閉じる</Button>}
            >
                {battleResult && (
                    <div className="space-y-4">
                        <p className={`text-lg font-bold ${battleResult.success ? 'text-sengoku-success' : 'text-sengoku-danger'}`}>
                            {battleResult.success ? '盗賊討伐に成功しました！' : '盗賊討伐に失敗しました...'}
                        </p>
                        <div className="space-y-2 text-sm">
                            <div className="font-bold">損失:</div>
                            <div className="text-sengoku-danger">死亡: {battleResult.casualties.deaths}名</div>
                            <div className="text-orange-500">重傷: {battleResult.casualties.severeInjuries}名（8週間で回復）</div>
                            <div className="text-yellow-500">軽傷: {battleResult.casualties.lightInjuries}名（4週間で回復）</div>
                            <div>敵損失: {battleResult.banditLosses}名</div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    </div>
    )
}
