import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { processMonthly, repayDebt } from '../utils/economy'
import { generateReplacementRetainer, canReplaceRetainer, RETAINER_REPLACEMENT_COST } from '../utils/retainer'
import { MAX_JUUBOKU_COUNT, RETAINER_RICE, LIVING_COST, HORSE_COST, SALARY_RICE, RICE_PRICE } from '../constants/game'
import { isKochouEvaluationTurn } from '../utils/time'

export const MonthlyReportScreen: React.FC = () => {
    const { player, mission, evaluationTurnDone, updatePlayer, setCurrentScreen, promotePlayer } = useGameStore()
    const [step, setStep] = useState<'income' | 'rice' | 'debt' | 'replacement' | 'promotion' | 'done'>('income')
    const [replacementCandidate, setReplacementCandidate] = useState<any>(null)
    const [promotionRank, setPromotionRank] = useState<any>(null)

    if (!player) return <div>Loading...</div>

    const handleRiceChoice = (choice: 'all' | 'half' | 'none') => {
        processMonthly(player, choice)
        updatePlayer({ ...player })
        setStep('debt')
    }

    const handleDebtRepay = (amount: number) => {
        if (amount > 0) {
            repayDebt(player, amount)
            updatePlayer({ ...player })
        }

        // 若党が上限未満なら補充ステップへ
        if (player.juuboku.length < MAX_JUUBOKU_COUNT) {
            const nextId = player.juuboku.length > 0
                ? Math.max(...player.juuboku.map(j => j.id)) + 1
                : 1
            setReplacementCandidate(generateReplacementRetainer(nextId))
            setStep('replacement')
        } else {
            checkPromotion()
        }
    }

    const checkPromotion = () => {
        // 昇進チェック
        if (player.rank === '徒士' && player.merit >= 250) {
            setPromotionRank('馬上衆')
            setStep('promotion')
        } else {
            setStep('done')
        }
    }

    const handleDone = () => {
        if (mission) {
            setCurrentScreen('bandit-mission')
            return
        }

        if (isKochouEvaluationTurn(player.week) && evaluationTurnDone !== player.week) {
            setCurrentScreen('kochou-evaluation')
            return
        }

        setCurrentScreen('main')
    }

    return (
        <div className="min-h-screen bg-sengoku-dark flex items-center justify-center p-10">
            <div className="max-w-2xl w-full bg-sengoku-dark border border-sengoku-border p-8">
                <h1 className="text-2xl font-bold text-sengoku-gold mb-6">
                    月次報告
                </h1>

                {step === 'income' && (
                    <div>
                        <div className="bg-sengoku-darker border border-sengoku-border p-4 mb-6">
                            <h3 className="text-sengoku-gold mb-2">【収入】</h3>
                            <div className="text-sm">扶持米: +{SALARY_RICE[player.rank].toFixed(2)}石</div>
                        </div>

                        <div className="bg-sengoku-darker border border-sengoku-border p-4 mb-6">
                            <h3 className="text-sengoku-gold mb-2">【支出】</h3>
                            <div className="text-sm space-y-1">
                                <div>若党{player.juuboku.length}名: -{(player.juuboku.length * RETAINER_RICE.若党).toFixed(2)}石</div>
                                <div>徒士{player.ashigaru.length}名: -{(player.ashigaru.length * RETAINER_RICE.徒士).toFixed(2)}石</div>
                                <div>馬上衆{player.bashoShu.length}名: -{(player.bashoShu.length * RETAINER_RICE.馬上衆).toFixed(2)}石</div>
                                {player.hasHorse && <div>馬維持費: -{HORSE_COST.toFixed(2)}石</div>}
                                <div>生活費: -{LIVING_COST.toFixed(2)}石</div>
                                <div>
                                    合計: -{(
                                        player.juuboku.length * RETAINER_RICE.若党 +
                                        player.ashigaru.length * RETAINER_RICE.徒士 +
                                        player.bashoShu.length * RETAINER_RICE.馬上衆 +
                                        (player.hasHorse ? HORSE_COST : 0) +
                                        LIVING_COST
                                    ).toFixed(2)}石
                                </div>
                            </div>
                        </div>

                        <div className="text-center">
                            <Button onClick={() => setStep('rice')}>次へ</Button>
                        </div>
                    </div>
                )}

                {step === 'rice' && (
                    <div>
                        <div className="bg-sengoku-darker border border-sengoku-border p-4 mb-6">
                            <h3 className="text-sengoku-gold mb-2">【余剰米の使い道】</h3>
                            {(() => {
                                const salary = SALARY_RICE[player.rank]
                                const expenses =
                                    player.juuboku.length * RETAINER_RICE.若党 +
                                    player.ashigaru.length * RETAINER_RICE.徒士 +
                                    player.bashoShu.length * RETAINER_RICE.馬上衆 +
                                    (player.hasHorse ? HORSE_COST : 0) +
                                    LIVING_COST
                                const riceAfterExpenses = Math.max(0, player.rice + salary - expenses)
                                const gainedAll = riceAfterExpenses * RICE_PRICE
                                const gainedHalf = riceAfterExpenses * 0.5 * RICE_PRICE

                                return (
                                    <>
                                        <div className="text-sm mb-4 space-y-1">
                                            <div>月初備蓄: {player.rice.toFixed(2)}石</div>
                                            <div>扶持米: +{salary.toFixed(2)}石</div>
                                            <div>支出: -{expenses.toFixed(2)}石</div>
                                            <div>
                                                支出後残（売却対象 / 備蓄含む）: {riceAfterExpenses.toFixed(2)}石
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Button
                                                onClick={() => handleRiceChoice('all')}
                                                className="w-full"
                                                disabled={riceAfterExpenses <= 0}
                                            >
                                                全て売却 (+{gainedAll.toFixed(2)}貫)
                                            </Button>
                                            <Button
                                                onClick={() => handleRiceChoice('half')}
                                                className="w-full"
                                                variant="secondary"
                                                disabled={riceAfterExpenses <= 0}
                                            >
                                                半分売却 (+{gainedHalf.toFixed(2)}貫)
                                            </Button>
                                            <Button
                                                onClick={() => handleRiceChoice('none')}
                                                className="w-full"
                                                variant="secondary"
                                            >
                                                売却しない（備蓄）
                                            </Button>
                                        </div>
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                )}

                {step === 'debt' && player.debt > 0 && (
                    <div>
                        <div className="bg-sengoku-darker border border-sengoku-border p-4 mb-6">
                            <h3 className="text-sengoku-gold mb-2">【借金返済】</h3>
                            <div className="text-sm mb-4">
                                <div>現在の借金: {player.debt.toFixed(2)}貫</div>
                                <div>所持金: {player.money.toFixed(2)}貫</div>
                            </div>

                            <div className="space-y-2">
                                <Button
                                    onClick={() => handleDebtRepay(player.money)}
                                    className="w-full"
                                    disabled={player.money === 0}
                                >
                                    全額返済 (-{Math.min(player.money, player.debt).toFixed(2)}貫)
                                </Button>
                                <Button
                                    onClick={() => handleDebtRepay(player.money * 0.5)}
                                    className="w-full"
                                    variant="secondary"
                                    disabled={player.money === 0}
                                >
                                    半分返済 (-{(Math.min(player.money, player.debt) * 0.5).toFixed(2)}貫)
                                </Button>
                                <Button
                                    onClick={() => handleDebtRepay(1)}
                                    className="w-full"
                                    variant="secondary"
                                    disabled={player.money < 1}
                                >
                                    少額返済 (-1貫)
                                </Button>
                                <Button
                                    onClick={() => handleDebtRepay(0)}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    返済しない
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'debt' && player.debt === 0 && (
                    <div>
                        <div className="text-center mb-6">
                            <p className="text-sengoku-gray">借金はありません</p>
                        </div>
                        <div className="text-center">
                            <Button onClick={() => {
                                if (player.juuboku.length < MAX_JUUBOKU_COUNT) {
                                    const nextId = player.juuboku.length > 0
                                        ? Math.max(...player.juuboku.map(j => j.id)) + 1
                                        : 1
                                    setReplacementCandidate(generateReplacementRetainer(nextId))
                                    setStep('replacement')
                                } else {
                                    checkPromotion()
                                }
                            }}>次へ</Button>
                        </div>
                    </div>
                )}

                {step === 'replacement' && replacementCandidate && (
                    <div>
                        <div className="bg-red-900 bg-opacity-20 border-2 border-red-500 p-4 mb-6">
                            <h3 className="text-red-400 mb-4 flex items-center gap-2">
                                <span>⚠️</span>
                                <span className="font-bold">若党の補充</span>
                            </h3>

                            <div className="text-sm space-y-3">
                                <div className="bg-black bg-opacity-30 p-3 border-l-4 border-red-500">
                                    <div className="text-sengoku-gray mb-1">現在の若党:</div>
                                    <div className="text-red-400 font-bold">{player.juuboku.length}名（{MAX_JUUBOKU_COUNT}名未満）</div>
                                </div>

                                <div className="bg-green-900 bg-opacity-10 p-3 border-l-4 border-green-500">
                                    <div className="text-sengoku-gray mb-2">補充候補</div>
                                    <div className="text-green-400">武芸: {replacementCandidate.combat}</div>
                                </div>

                                <div className="bg-black bg-opacity-30 p-3">
                                    <div className="text-sengoku-gray mb-1">費用:</div>
                                    <div className="text-yellow-400">金{RETAINER_REPLACEMENT_COST.money}貫、米{RETAINER_REPLACEMENT_COST.rice}石</div>
                                </div>

                                <div className="bg-black bg-opacity-30 p-3">
                                    <div className="text-sengoku-gray mb-1">現在の資金:</div>
                                    <div>金{player.money.toFixed(2)}貫、米{player.rice.toFixed(2)}石</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Button
                                onClick={() => {
                                    const canReplace = canReplaceRetainer(player.juuboku.length, player.money, player.rice)
                                    if (canReplace) {
                                        const updatedPlayer = { ...player }
                                        updatedPlayer.money -= RETAINER_REPLACEMENT_COST.money
                                        updatedPlayer.rice -= RETAINER_REPLACEMENT_COST.rice
                                        updatedPlayer.juuboku.push(replacementCandidate)
                                        updatePlayer(updatedPlayer)
                                    }
                                    checkPromotion()
                                }}
                                className="w-full"
                                disabled={!canReplaceRetainer(player.juuboku.length, player.money, player.rice)}
                            >
                                補充する
                            </Button>
                            <Button
                                onClick={() => checkPromotion()}
                                className="w-full"
                                variant="secondary"
                            >
                                見送る
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'promotion' && promotionRank && (
                    <div>
                        <div className="bg-sengoku-darker border-2 border-sengoku-gold p-6 mb-6 text-center">
                            <h3 className="text-2xl text-sengoku-gold mb-4 font-bold">㊗️ 昇進</h3>

                            <p className="mb-4 text-lg">
                                おめでとうございます！<br />
                                功績が認められ、<span className="text-sengoku-gold font-bold">{promotionRank}</span>への昇進が決まりました。
                            </p>

                            <div className="bg-black bg-opacity-30 p-4 rounded mb-4 text-left">
                                <div className="text-sm text-sengoku-gray mb-1">新しい身分:</div>
                                <div className="text-xl font-bold text-sengoku-gold mb-3">{promotionRank}</div>

                                <div className="text-sm text-sengoku-gray mb-1">特典:</div>
                                <ul className="list-disc list-inside text-sm space-y-1">
                                    <li>俸禄の増加</li>
                                    <li>より高度な任務の受命</li>
                                    <li>配下兵力の増加</li>
                                </ul>
                            </div>
                        </div>

                        <div className="text-center">
                            <Button onClick={() => {
                                promotePlayer(promotionRank)
                                setStep('done')
                            }} className="w-full text-lg py-3">
                                謹んでお受けします
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'done' && (
                    <div>
                        <div className="bg-sengoku-darker border border-sengoku-border p-4 mb-6">
                            <h3 className="text-sengoku-gold mb-2">【状況】</h3>
                            <div className="text-sm space-y-1">
                                <div>米: {player.rice.toFixed(2)}石</div>
                                <div>金: {player.money.toFixed(2)}貫</div>
                                <div>借金: {player.debt.toFixed(2)}貫</div>
                            </div>
                        </div>

                        <div className="text-center">
                            <Button onClick={handleDone}>次へ</Button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    )
}
