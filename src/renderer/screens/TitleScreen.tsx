import React from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'

export const TitleScreen: React.FC = () => {
    const setCurrentScreen = useGameStore((state) => state.setCurrentScreen)

    return (
        <div className="min-h-screen bg-sengoku-darker flex flex-col items-center justify-center">
            <div className="text-center p-10">
                {/* タイトルロゴ */}
                <div className="mb-16">
                    <h1 className="text-6xl font-bold text-sengoku-gold mb-4 tracking-widest drop-shadow-lg">
                        戦国立身出世
                    </h1>
                    <p className="text-lg text-sengoku-gray tracking-wider">
                        ― 身一つから始まる、戦国の階段 ―
                    </p>
                </div>

                {/* メニュー */}
                <div className="flex flex-col gap-4 items-center">
                    <Button
                        onClick={() => setCurrentScreen('character-create')}
                        className="w-72"
                    >
                        新規ゲーム
                    </Button>
                    <Button variant="secondary" disabled className="w-72">
                        続きから
                    </Button>
                    <Button variant="secondary" disabled className="w-72">
                        設定
                    </Button>
                </div>
            </div>

            {/* バージョン情報 */}
            <div className="fixed bottom-5 right-5 text-xs text-gray-600">
                Version 0.1
            </div>

            {/* コピーライト */}
            <div className="fixed bottom-5 left-5 text-xs text-gray-600">
                © 2025
            </div>
        </div>
    )
}
