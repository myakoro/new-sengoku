import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { Modal } from '../components/Modal'
import { calculatePlayerCombatPower, calculateBanditCombatPower, calculateSuccessRate, judgeBanditBattle } from '../utils/combat'
import { applyScout, applyMisinformation, applyBribe } from '../utils/bandit'
import { BANDIT_RANKS } from '../constants/game'

export const BanditMissionScreen: React.FC = () => {
    const { player, mission, setCurrentScreen, addLog, addMerit, updatePlayer } = useGameStore()
    const [selectedStrategy, setSelectedStrategy] = useState<'scout' | 'misinformation' | 'bribe' | 'hire' | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)
    const [showResult, setShowResult] = useState(false)
    const [battleResult, setBattleResult] = useState<{ success: boolean; playerLosses: number; banditLosses: number } | null>(null)

    if (!player || !mission || mission.type !== 'bandit_subjugation') {
        setCurrentScreen('main')
        return null
    }

    const playerPower = calculatePlayerCombatPower(player, mission)
    const banditPower = calculateBanditCombatPower(mission.bandit)
    const successRate = calculateSuccessRate(playerPower, banditPower)

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
                addLog('偵察を行い、敵情報を得た', 'success')
                break
            case 'misinformation':
                updatedMission = applyMisinformation(updatedMission)
                addLog('偽情報を流し、敵の士気を下げた', 'success')
                break
            case 'bribe':
                const bribeResult = applyBribe(updatedMission, updatedPlayer)
                if (bribeResult.success) {
                    updatedMission = bribeResult.mission
                    updatedPlayer = bribeResult.player
                    addLog('内応者を買収し、敵戦力を削いだ', 'success')
                } else {
                    addLog('買収に失敗した（資金不足）', 'danger')
                }
                break
            case 'hire':
                if (updatedPlayer.money >= 50) {
                    updatedMission.additionalAshigaru += 10
                    updatedPlayer.money -= 50
                    addLog('足軽10名を雇用した', 'success')
                } else {
                    addLog('足軽雇用に失敗した（資金不足）', 'danger')
                }
                break
        }

        updatedMission.strategies.push(selectedStrategy)
        useGameStore.setState({ mission: updatedMission })
        updatePlayer(updatedPlayer)
        setShowConfirm(false)
        setSelectedStrategy(null)
    }

    const handleBattle = () => {
        const result = judgeBanditBattle(player, mission.bandit, mission.additionalAshigaru)
        setBattleResult(result)
        setShowResult(true)

        if (result.success) {
            // 成功時の報酬
            const meritGain = BANDIT_RANKS[mission.rank].merit
            addMerit(meritGain)
            addLog(`盗賊討伐に成功！功績+${meritGain}`, 'success')

            // 損失を反映
            const updatedPlayer = { ...player }
            if (result.playerLosses > 0) {
                // 従僕から損失を適用
                const juubokuLosses = Math.min(result.playerLosses, updatedPlayer.juuboku.length)
                updatedPlayer.juuboku = updatedPlayer.juuboku.slice(0, -juubokuLosses)

                const remainingLosses = result.playerLosses - juubokuLosses
                if (remainingLosses > 0) {
                    // 徒士から損失を適用
                    const ashigaruLosses = Math.min(remainingLosses, updatedPlayer.ashigaru.length)
                    updatedPlayer.ashigaru = updatedPlayer.ashigaru.slice(0, -ashigaruLosses)
                }
                addLog(`損失: ${result.playerLosses}名`, 'warning')
            }
            updatePlayer(updatedPlayer)
        } else {
            addLog('盗賊討伐に失敗した', 'danger')
            // 失敗時も損失を反映
            const updatedPlayer = { ...player }
            if (result.playerLosses > 0) {
                const juubokuLosses = Math.min(result.playerLosses, updatedPlayer.juuboku.length)
                updatedPlayer.juuboku = updatedPlayer.juuboku.slice(0, -juubokuLosses)

                const remainingLosses = result.playerLosses - juubokuLosses
                if (remainingLosses > 0) {
                    const ashigaruLosses = Math.min(remainingLosses, updatedPlayer.ashigaru.length)
                    updatedPlayer.ashigaru = updatedPlayer.ashigaru.slice(0, -ashigaruLosses)
                }
                addLog(`損失: ${result.playerLosses}名`, 'danger')
            }
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

                {/* 敵情報 */}
                <Panel title="敵情報">
                    <div className="space-y-2 text-sm">
                        <div>盗賊ランク: {mission.rank}</div>
                        <div>兵力: {mission.bandit.count}名</div>
                        <div>士気: {mission.bandit.morale}</div>
                        <div>戦力: {banditPower}</div>
                        {mission.bandit.investigated && (
                            <div className="text-sengoku-success">
                                ※偵察済み - 詳細情報を把握
                            </div>
                        )}
                    </div>
                </Panel>

                {/* 自軍情報 */}
                <Panel title="自軍情報">
                    <div className="space-y-2 text-sm">
                        <div>戦力: {playerPower}</div>
                        <div>従僕: {player.juuboku.length}名</div>
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
                                <div>味方損失: {battleResult.playerLosses}名</div>
                                <div>敵損失: {battleResult.banditLosses}名</div>
                                {battleResult.success && (
                                    <div className="text-sengoku-success">
                                        功績: +{BANDIT_RANKS[mission.rank].merit}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </div>
    )
}
