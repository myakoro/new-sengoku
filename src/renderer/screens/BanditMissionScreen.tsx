import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { Modal } from '../components/Modal'
import { calculatePlayerCombatPowerForBandit, calculateBanditCombatPower, calculateSuccessRate, judgeBanditBattle } from '../utils/combat'
import { applyScout, applyMisinformation, applyBribe } from '../utils/bandit'
import { BANDIT_RANKS } from '../constants/game'
import { formatDate, weekToDate } from '../utils/time'
import { applyBattleCasualties } from '../utils/injury'
import type { ActionLogEntry } from '../types/game'

export const BanditMissionScreen: React.FC = () => {
    const { player, mission, setCurrentScreen, addLog, updatePlayer, advanceWeek } = useGameStore()
    const [selectedStrategy, setSelectedStrategy] = useState<'scout' | 'misinformation' | 'bribe' | 'hire' | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)
    const [showResult, setShowResult] = useState(false)
    const [battleResult, setBattleResult] = useState<{ success: boolean; playerLosses: number; banditLosses: number } | null>(null)

    if (!player || !mission || mission.type !== 'bandit_subjugation') {
        setCurrentScreen('main')
        return null
    }

    const actionLogs = mission.actionLogs || []
    const playerPower = calculatePlayerCombatPowerForBandit(player) + mission.additionalAshigaru * 32
    const banditPower = calculateBanditCombatPower(mission.bandit)
    const successRate = calculateSuccessRate(playerPower, banditPower)

    // 期限計算
    const currentDate = formatDate(weekToDate(player.week))
    const deadlineWeek = player.week + (mission.timeLimit - mission.currentWeek)
    const deadlineDate = formatDate(weekToDate(deadlineWeek))

    // フェーズ判定
    const isLastWeek = mission.currentWeek === mission.timeLimit
    const phase = isLastWeek ? '最終週' : '準備期間'

    // プログレスバー
    const progress = (mission.currentWeek / mission.timeLimit) * 100

    const addActionLog = (actionName: string, result: "成功" | "失敗" | "―", detail: string) => {
        const newLog: ActionLogEntry = {
            week: mission.currentWeek,
            actionName,
            result,
            detail
        }
        const updatedLogs = [newLog, ...actionLogs]
        useGameStore.setState({
            mission: { ...mission, actionLogs: updatedLogs }
        })
    }

    const handleStrategySelect = (strategy: 'scout' | 'misinformation' | 'bribe' | 'hire') => {
        setSelectedStrategy(strategy)
        setShowConfirm(true)
    }

    const handleConfirmStrategy = () => {
        if (!selectedStrategy) return

        let updatedMission = { ...mission }
        let updatedPlayer = { ...player }

        switch (selectedStrategy) {
            case 'scout':
                updatedMission = applyScout(updatedMission)
                addActionLog('偵察', '成功', `敵の詳細情報を入手。人数${mission.bandit.count}名、戦闘力${banditPower}と判明。`)
                addLog('偵察を行い、敵情報を得た', 'success')
                break
            case 'misinformation':
                updatedMission = applyMisinformation(updatedMission)
                addActionLog('偽情報', '成功', `敵の士気を-10低下させた。`)
                addLog('偽情報を流し、敵の士気を下げた', 'success')
                break
            case 'bribe':
                const bribeResult = applyBribe(updatedMission, updatedPlayer)
                if (bribeResult.success) {
                    updatedMission = bribeResult.mission
                    updatedPlayer = bribeResult.player
                    const reduction = Math.floor(mission.bandit.count * 0.2)
                    addActionLog('内応者買収', '成功', `敵兵力を${reduction}名削減。戦力-${reduction * 32}。`)
                    addLog('内応者を買収し、敵戦力を削いだ', 'success')
                } else {
                    addActionLog('内応者買収', '失敗', '資金不足（100両必要）')
                    addLog('買収に失敗した（資金不足）', 'danger')
                }
                break
            case 'hire':
                if (updatedPlayer.money >= 50) {
                    updatedMission.additionalAshigaru += 10
                    updatedPlayer.money -= 50
                    addActionLog('足軽雇用', '成功', `足軽10名を雇用。戦力+320。`)
                    addLog('足軽10名を雇用した', 'success')
                } else {
                    addActionLog('足軽雇用', '失敗', '資金不足（50両必要）')
                    addLog('足軽雇用に失敗した（資金不足）', 'danger')
                }
                break
        }

        updatedMission.strategies.push(selectedStrategy)
        updatedMission.currentWeek += 1
        useGameStore.setState({ mission: updatedMission })
        updatePlayer(updatedPlayer)
        advanceWeek()
        setShowConfirm(false)
        setSelectedStrategy(null)
    }

    const handleBattle = () => {
        const result = judgeBanditBattle(player, mission.bandit, mission.additionalAshigaru)
        setBattleResult(result)
        setShowResult(true)

        if (result.success) {
            const meritGain = BANDIT_RANKS[mission.rank].merit
            const reward = BANDIT_RANKS[mission.rank].bossReward

            const updatedPlayer = { ...player }
            updatedPlayer.merit += meritGain
            updatedPlayer.rice += reward.rice
            updatedPlayer.money += reward.money

            addActionLog('戦闘', '成功', `盗賊討伐成功！功績+${meritGain}、米+${reward.rice}石、金+${reward.money}貫`)
            addLog(`盗賊討伐に成功！功績+${meritGain}`, 'success')

            // 損失を反映
            updatedPlayer.juuboku = applyBattleCasualties(updatedPlayer.juuboku, result.casualties)

            const totalCasualties = result.casualties.deaths + result.casualties.severeInjuries + result.casualties.lightInjuries
            if (totalCasualties > 0) {
                addLog(`損失: 死亡${result.casualties.deaths}名、重傷${result.casualties.severeInjuries}名、軽傷${result.casualties.lightInjuries}名`, 'warning')
            }
            updatePlayer(updatedPlayer)
        } else {
            addActionLog('戦闘', '失敗', `盗賊討伐失敗。味方損失${result.playerLosses}名。`)
            addLog('盗賊討伐に失敗した', 'danger')

            const updatedPlayer = { ...player }
            updatedPlayer.juuboku = applyBattleCasualties(updatedPlayer.juuboku, result.casualties)
            addLog(`損失: 死亡${result.casualties.deaths}名、重傷${result.casualties.severeInjuries}名、軽傷${result.casualties.lightInjuries}名`, 'danger')
            updatePlayer(updatedPlayer)
        }
    }

    const handleResultClose = () => {
        useGameStore.setState({ mission: null, selectedCommand: null })
        setCurrentScreen('main')
    }

    const canUseStrategy = (strategy: string) => {
        return !mission.strategies.includes(strategy as any)
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
                            <span className="text-sengoku-gray">期限:</span>
                            <span className="text-[#FF6B6B] font-bold">{deadlineDate}まで</span>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-sengoku-gray">進行:</span>
                                <span>第{mission.currentWeek}週 / {mission.timeLimit}週（{phase}）</span>
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

                {/* 行動ログ */}
                {actionLogs.length > 0 && (
                    <Panel title="行動ログ">
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {actionLogs.map((log, index) => (
                                <div key={index} className="text-sm flex items-start gap-2 p-2 bg-sengoku-darker border border-sengoku-border">
                                    <span className="text-sengoku-gray whitespace-nowrap">
                                        [{log.week === "開始" ? "開始" : `第${log.week}週`}]
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
                            <div className="text-sengoku-gray">
                                ※偵察を行うと詳細情報が判明します
                            </div>
                        )}
                    </div>
                </Panel>

                {/* 自軍情報 */}
                <Panel title="自軍情報">
                    <div className="space-y-2 text-sm">
                        <div>戦力: {playerPower}</div>
                        <div>
                            従僕: {player.juuboku.length}名
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

                {/* 計略選択 */}
                {!isLastWeek && (
                    <Panel title="計略">
                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={() => handleStrategySelect('scout')}
                                disabled={!canUseStrategy('scout')}
                                variant="secondary"
                            >
                                偵察 {!canUseStrategy('scout') && '(使用済み)'}
                            </Button>
                            <Button
                                onClick={() => handleStrategySelect('misinformation')}
                                disabled={!canUseStrategy('misinformation')}
                                variant="secondary"
                            >
                                偽情報 {!canUseStrategy('misinformation') && '(使用済み)'}
                            </Button>
                            <Button
                                onClick={() => handleStrategySelect('bribe')}
                                disabled={!canUseStrategy('bribe') || player.money < 100}
                                variant="secondary"
                            >
                                内応者買収 (100両) {!canUseStrategy('bribe') && '(使用済み)'}
                            </Button>
                            <Button
                                onClick={() => handleStrategySelect('hire')}
                                disabled={!canUseStrategy('hire') || player.money < 50}
                                variant="secondary"
                            >
                                足軽雇用 (50両) {!canUseStrategy('hire') && '(使用済み)'}
                            </Button>
                        </div>
                    </Panel>
                )}

                {/* アクション */}
                <div className="flex gap-4 justify-center mt-6">
                    <Button variant="secondary" onClick={() => setCurrentScreen('main')}>
                        中止
                    </Button>
                    <Button onClick={handleBattle}>
                        戦闘開始
                    </Button>
                </div>

                {/* 計略確認モーダル */}
                <Modal
                    isOpen={showConfirm}
                    onClose={() => setShowConfirm(false)}
                    title="確認"
                    actions={
                        <>
                            <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                                キャンセル
                            </Button>
                            <Button onClick={handleConfirmStrategy}>実行</Button>
                        </>
                    }
                >
                    <p className="text-sengoku-gray">
                        {selectedStrategy === 'scout' && '偵察を行いますか？'}
                        {selectedStrategy === 'misinformation' && '偽情報を流しますか？'}
                        {selectedStrategy === 'bribe' && '内応者を買収しますか？（100両）'}
                        {selectedStrategy === 'hire' && '足軽を雇用しますか？（50両）'}
                    </p>
                </Modal>

                {/* 戦闘結果モーダル */}
                <Modal
                    isOpen={showResult}
                    onClose={handleResultClose}
                    title={battleResult?.success ? '勝利！' : '敗北...'}
                    actions={
                        <Button onClick={handleResultClose}>閉じる</Button>
                    }
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
                                {battleResult.success && (
                                    <>
                                        <div className="text-sengoku-success mt-4">
                                            功績: +{BANDIT_RANKS[mission.rank].merit}
                                        </div>
                                        <div className="text-sengoku-success">
                                            米: +{BANDIT_RANKS[mission.rank].bossReward.rice}石
                                        </div>
                                        <div className="text-sengoku-success">
                                            金: +{BANDIT_RANKS[mission.rank].bossReward.money}貫
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    )
}
