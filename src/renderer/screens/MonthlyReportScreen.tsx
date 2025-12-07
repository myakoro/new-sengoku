import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { processMonthly, repayDebt } from '../utils/economy'

export const MonthlyReportScreen: React.FC = () => {
    const { player, updatePlayer, setCurrentScreen } = useGameStore()
    const [step, setStep] = useState<'income' | 'rice' | 'debt' | 'done'>('income')
    const [monthlyData, setMonthlyData] = useState<any>(null)

    if (!player) return <div>Loading...</div>

    const handleRiceChoice = (choice: 'all' | 'half' | 'none') => {
        const data = processMonthly(player, choice)
        setMonthlyData(data)
        updatePlayer({ ...player })
        setStep('debt')
    }

    const handleDebtRepay = (amount: number) => {
        if (amount > 0) {
            repayDebt(player, amount)
            updatePlayer({ ...player })
        }
        setStep('done')
    }

    const handleDone = () => {
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
                            <div className="text-sm">扶持米: +1.8石</div>
                        </div>

                        <div className="bg-sengoku-darker border border-sengoku-border p-4 mb-6">
                            <h3 className="text-sengoku-gold mb-2">【支出】</h3>
                            <div className="text-sm space-y-1">
                                <div>従僕3名: -0.9石</div>
                                <div>生活費: -0.15石</div>
                                <div>合計: -1.05石</div>
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
                            <div className="text-sm mb-4">
                                余剰: {player.rice.toFixed(2)}石
                            </div>

                            <div className="space-y-2">
                                <Button
                                    onClick={() => handleRiceChoice('all')}
                                    className="w-full"
                                >
                                    全て売却 (+{(player.rice * 1.0).toFixed(2)}貫)
                                </Button>
                                <Button
                                    onClick={() => handleRiceChoice('half')}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    半分売却 (+{(player.rice * 0.5 * 1.0).toFixed(2)}貫)
                                </Button>
                                <Button
                                    onClick={() => handleRiceChoice('none')}
                                    className="w-full"
                                    variant="secondary"
                                >
                                    売却しない（備蓄）
                                </Button>
                            </div>
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
                            <Button onClick={handleDone}>次へ</Button>
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
        </div>
    )
}
