import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { PURCHASE_COSTS, HORSE_COST } from '../constants/game'
import { getDebtLimit, getInterestRate, takeLoan } from '../utils/economy'

export const ShopScreen: React.FC = () => {
    const { player, updatePlayer, setCurrentScreen, addLog } = useGameStore()
    const [loanAmount, setLoanAmount] = useState<number>(5)
    const [monthlyRepayment, setMonthlyRepayment] = useState<number>(1)
    const [message, setMessage] = useState<string | null>(null)
    const [messageType, setMessageType] = useState<'success' | 'error'>('success')
    
    if (!player) return <div>Loading...</div>
    
    const debtLimit = getDebtLimit(player.rank)
    const availableDebt = Math.max(0, debtLimit - player.debt)
    const currentRate = getInterestRate(player.debt + loanAmount)
    
    const canBuyHorse =
        !player.hasHorse &&
        player.money >= PURCHASE_COSTS.馬 &&
        player.rank !== '徒士'
    
    const showMessage = (msg: string, type: 'success' | 'error') => {
        setMessage(msg)
        setMessageType(type)
        setTimeout(() => setMessage(null), 3000)
    }
    
    const handleTakeLoan = () => {
        if (loanAmount <= 0) {
            showMessage('借入額を入力してください', 'error')
            return
        }
        
        if (loanAmount > availableDebt) {
            showMessage(`借金上限（${debtLimit.toFixed(1)}貫）を超えています`, 'error')
            return
        }
        
        const result = takeLoan(player, loanAmount, monthlyRepayment)
        if (result.success) {
            updatePlayer({ ...player })
            addLog(`${loanAmount}貫を借金（月利${(result.rate * 100).toFixed(0)}%）`, 'warning')
            showMessage(`${loanAmount}貫を借りました（月利${(result.rate * 100).toFixed(0)}%）`, 'success')
            setLoanAmount(5)
        } else {
            showMessage(result.message || '借金に失敗しました', 'error')
        }
    }
    
    const handleBuyHorse = () => {
        if (!canBuyHorse) {
            showMessage('馬を購入できません', 'error')
            return
        }
        
        updatePlayer({
            ...player,
            money: player.money - PURCHASE_COSTS.馬,
            hasHorse: true
        })
        addLog(`馬を購入（${PURCHASE_COSTS.馬}貫）`, 'success')
        showMessage(`馬を購入しました！（維持費: 月${HORSE_COST}石）`, 'success')
    }
    
    const handleBack = () => {
        setCurrentScreen('main')
    }
    
    return (
        <div className="min-h-screen bg-sengoku-bg p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl text-sengoku-gold mb-6">商人・借金</h1>
                
                {message && (
                    <div className={`p-3 mb-4 text-sm border ${
                        messageType === 'success' 
                            ? 'bg-green-900/30 border-green-500 text-green-300'
                            : 'bg-red-900/30 border-red-500 text-red-300'
                    }`}>
                        {message}
                    </div>
                )}
                
                {/* 現在の状況 */}
                <Panel title="現在の状況" className="mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-sengoku-gray">所持金：</span>
                            <span className="font-mono">{player.money.toFixed(2)}貫</span>
                        </div>
                        <div>
                            <span className="text-sengoku-gray">借金：</span>
                            <span className="font-mono text-sengoku-danger">{player.debt.toFixed(2)}貫</span>
                        </div>
                        <div>
                            <span className="text-sengoku-gray">借金上限：</span>
                            <span className="font-mono">{debtLimit.toFixed(1)}貫</span>
                        </div>
                        <div>
                            <span className="text-sengoku-gray">追加借入可能：</span>
                            <span className="font-mono">{availableDebt.toFixed(1)}貫</span>
                        </div>
                    </div>
                </Panel>
                
                {/* 借金 */}
                <Panel title="借金" className="mb-6">
                    <div className="space-y-4">
                        <div className="text-xs text-sengoku-gray mb-2">
                            <p>・50貫まで：月利5%</p>
                            <p>・100貫まで：月利4%</p>
                            <p>・上限は年収（扶持米×12ヶ月）</p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <label className="text-sm text-sengoku-gray">借入額：</label>
                            <input
                                type="number"
                                value={loanAmount}
                                onChange={(e) => setLoanAmount(Math.max(0, Number(e.target.value)))}
                                className="w-24 px-2 py-1 bg-sengoku-darker border border-sengoku-border text-white"
                                min={0}
                                max={availableDebt}
                            />
                            <span className="text-sm">貫</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <label className="text-sm text-sengoku-gray">月々返済：</label>
                            <input
                                type="number"
                                value={monthlyRepayment}
                                onChange={(e) => setMonthlyRepayment(Math.max(0, Number(e.target.value)))}
                                className="w-24 px-2 py-1 bg-sengoku-darker border border-sengoku-border text-white"
                                min={0}
                            />
                            <span className="text-sm">貫</span>
                        </div>
                        
                        <div className="text-sm">
                            <span className="text-sengoku-gray">適用金利：</span>
                            <span className="font-mono text-yellow-400">月{(currentRate * 100).toFixed(0)}%</span>
                        </div>
                        
                        <Button
                            onClick={handleTakeLoan}
                            disabled={loanAmount <= 0 || loanAmount > availableDebt}
                            className="w-full"
                        >
                            借金する
                        </Button>
                    </div>
                </Panel>
                
                {/* 馬購入 */}
                <Panel title="馬購入" className="mb-6">
                    <div className="space-y-4">
                        {player.hasHorse ? (
                            <div className="text-center py-4">
                                <div className="text-sengoku-gold text-lg mb-2">🐴 馬を所持中</div>
                                <div className="text-xs text-sengoku-gray">
                                    維持費：月{HORSE_COST}石
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="text-sm">
                                    <p className="text-sengoku-gray mb-2">馬を購入すると：</p>
                                    <ul className="text-xs text-sengoku-gray space-y-1 ml-4">
                                        <li>・攻撃時の戦闘力 ×1.25</li>
                                        <li>・撤退時の被害 ×0.6</li>
                                        <li>・追撃時の手柄確率 ×1.5</li>
                                        <li>・維持費：月{HORSE_COST}石</li>
                                    </ul>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">
                                        価格：<span className="font-mono">{PURCHASE_COSTS.馬}貫</span>
                                    </span>
                                    <Button
                                        onClick={handleBuyHorse}
                                        disabled={!canBuyHorse}
                                    >
                                        馬を購入
                                    </Button>
                                </div>
                                
                                {!player.hasHorse && player.rank === '徒士' && (
                                    <div className="text-xs text-sengoku-danger">
                                        徒士は馬を購入できません（馬上衆以上）
                                    </div>
                                )}

                                {!canBuyHorse && player.money < PURCHASE_COSTS.馬 && (
                                    <div className="text-xs text-sengoku-danger">
                                        所持金が足りません（あと{(PURCHASE_COSTS.馬 - player.money).toFixed(1)}貫）
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Panel>
                
                {/* 戻るボタン */}
                <div className="text-center">
                    <Button variant="secondary" onClick={handleBack}>
                        戻る
                    </Button>
                </div>
            </div>
        </div>
    )
}
