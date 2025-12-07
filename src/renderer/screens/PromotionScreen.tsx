import React, { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Rank } from '../types/game'
import { SALARY_RICE } from '../constants/game'

interface PromotionScreenProps {
    newRank?: Rank
}

export const PromotionScreen: React.FC<PromotionScreenProps> = ({ newRank: propsNewRank }) => {
    const { player, promotePlayer, setCurrentScreen } = useGameStore()
    const [newRank] = useState<Rank>(() => {
        return propsNewRank || (window as any).__promotionRank || '馬上衆'
    })

    useEffect(() => {
        // ウィンドウから取得した場合はクリーンアップ
        if ((window as any).__promotionRank) {
            delete (window as any).__promotionRank
        }
    }, [])

    if (!player) return <div>Loading...</div>

    const handleAccept = () => {
        promotePlayer(newRank)
        setCurrentScreen('main')
    }

    const oldRank = player.rank
    const oldSalary = SALARY_RICE[oldRank]
    const newSalary = SALARY_RICE[newRank]

    return (
        <div className="min-h-screen bg-gradient-to-b from-yellow-900 to-sengoku-darker flex items-center justify-center p-10">
            <div className="max-w-2xl w-full bg-sengoku-dark border-2 border-sengoku-gold p-8">
                <div className="text-center mb-8">
                    <div className="text-4xl mb-4">🎉 出世 🎉</div>
                    <div className="text-2xl font-bold text-sengoku-gold">
                        {oldRank} → {newRank}
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-sengoku-gray text-center mb-4">
                        おめでとうございます！
                        <br />
                        あなたは{newRank}に昇進しました。
                    </p>

                    <div className="bg-sengoku-darker border border-sengoku-border p-4">
                        <h3 className="text-sengoku-gold mb-3">【変化】</h3>
                        <div className="text-sm space-y-2">
                            <div>
                                扶持米: {oldSalary}石/月 → {newSalary}石/月
                            </div>
                            <div>武芸: +15</div>
                            <div>統率: +{newRank === '馬上衆' ? 10 : 15}</div>
                            <div>知略: +10</div>
                            <div>政務: +10</div>
                            {newRank === '馬上衆' && <div>馬の購入が可能に</div>}
                            {newRank === '小頭' && <div>指揮権: 25人小隊を指揮</div>}
                        </div>
                    </div>
                </div>

                {newRank === '馬上衆' && (
                    <div className="mb-6">
                        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 p-4">
                            <h3 className="text-yellow-500 mb-2">⚠️ 推奨：馬と徒士の購入</h3>
                            <div className="text-sm text-sengoku-gray space-y-1">
                                <div>馬上衆として活躍するには：</div>
                                <div>・馬の購入（30貫）</div>
                                <div>・徒士の雇用（雇用費10貫 + 扶持米1.8石/月）</div>
                                <div className="mt-2 text-xs">※購入・雇用は任意です</div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    <p className="text-sm text-sengoku-gray italic text-center">
                        上司：「{newRank}になったか。{newRank === '馬上衆' ? 'これからが本番だぞ' : 'よく頑張ったな'}」
                    </p>
                </div>

                <div className="text-center">
                    <Button onClick={handleAccept}>次へ</Button>
                </div>
            </div>
        </div>
    )
}
