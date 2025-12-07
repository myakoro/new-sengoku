import React from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'

export const EndingScreen: React.FC = () => {
    const { player, setCurrentScreen } = useGameStore()

    if (!player) return <div>Loading...</div>

    return (
        <div className="min-h-screen bg-gradient-to-b from-sengoku-gold to-sengoku-darker flex items-center justify-center p-10">
            <div className="max-w-2xl w-full bg-sengoku-dark border-2 border-sengoku-gold p-8 text-center">
                <div className="mb-8">
                    <div className="text-5xl mb-4">🎊</div>
                    <h1 className="text-4xl font-bold text-sengoku-gold mb-4">
                        エンディング
                    </h1>
                    <p className="text-xl text-sengoku-gray">
                        小頭到達おめでとうございます！
                    </p>
                </div>

                <div className="bg-sengoku-darker border border-sengoku-border p-6 mb-6">
                    <h3 className="text-sengoku-gold mb-4">【達成記録】</h3>
                    <div className="text-sm space-y-2 text-left">
                        <div className="flex justify-between">
                            <span className="text-sengoku-gray">最終役職</span>
                            <span className="text-sengoku-gold font-bold">{player.rank}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sengoku-gray">功績</span>
                            <span>{player.merit}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sengoku-gray">プレイ週数</span>
                            <span>{player.week}週</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sengoku-gray">最終武芸</span>
                            <span>{player.stats.combat}</span>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <p className="text-sengoku-gray mb-4">
                        あなたは身一つから始まり、小頭まで出世しました。
                        <br />
                        これからも戦国の世を生き抜いてください。
                    </p>
                    <p className="text-sm text-gray-500">
                        Version 0.1 はここまでです。
                        <br />
                        今後のアップデートをお楽しみに！
                    </p>
                </div>

                <div className="text-center">
                    <Button onClick={() => setCurrentScreen('title')}>
                        タイトルに戻る
                    </Button>
                </div>
            </div>
        </div>
    )
}
