import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Stats } from '../types/game'
import { CHAR_CREATE, JUUBOKU_COMBAT_RANGE } from '../constants/game'

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateRandomPotential(): Stats {
    const total = CHAR_CREATE.totalPotential
    const min = CHAR_CREATE.minPotential
    const max = CHAR_CREATE.maxPotential

    // ランダムに配分
    let remaining = total
    const stats: Stats = {
        combat: 0,
        command: 0,
        intelligence: 0,
        administration: 0,
    }

    const keys: (keyof Stats)[] = ['combat', 'command', 'intelligence', 'administration']

    for (let i = 0; i < keys.length - 1; i++) {
        const maxAlloc = Math.min(max, remaining - min * (keys.length - i - 1))
        const value = randomInt(min, maxAlloc)
        stats[keys[i]] = value
        remaining -= value
    }

    // 最後のステータスも最大値を超えないようにクランプ
    stats[keys[keys.length - 1]] = Math.min(max, remaining)

    return stats
}

export const CharacterCreateScreen: React.FC = () => {
    const { initializeGame, setCurrentScreen } = useGameStore()

    const [name, setName] = useState('新九郎')
    const [potential, setPotential] = useState<Stats>({
        combat: 80,
        command: 70,
        intelligence: 80,
        administration: 70
    })
    const [juuboku, setJuuboku] = useState([
        randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
        randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
        randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
    ])

    const total =
        potential.combat +
        potential.command +
        potential.intelligence +
        potential.administration

    const remaining = CHAR_CREATE.totalPotential - total

    const handleRerollPotential = () => {
        setPotential(generateRandomPotential())
    }

    const handleRerollJuuboku = () => {
        setJuuboku([
            randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
            randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
            randomInt(JUUBOKU_COMBAT_RANGE[0], JUUBOKU_COMBAT_RANGE[1]),
        ])
    }

    const handleStart = () => {
        initializeGame(name, potential)
        setCurrentScreen('main')
    }

    const adjustStat = (key: keyof Stats, delta: number) => {
        const newValue = potential[key] + delta

        // 最小値・最大値チェック
        if (newValue < CHAR_CREATE.minPotential || newValue > CHAR_CREATE.maxPotential) {
            return
        }

        // 増加の場合は残りポイントをチェック
        if (delta > 0 && remaining < delta) {
            return
        }

        setPotential({ ...potential, [key]: newValue })
    }

    return (
        <div className="min-h-screen bg-sengoku-dark p-10">
            <div className="max-w-4xl mx-auto">
                {/* ヘッダー */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-sengoku-gold mb-2">
                        キャラクター作成
                    </h1>
                    <p className="text-sm text-sengoku-gray">
                        才能の上限を決めてください
                    </p>
                </div>

                {/* 名前入力 */}
                <div className="bg-sengoku-dark border border-sengoku-border p-6 mb-6">
                    <h2 className="text-sengoku-gold text-base mb-4 pb-2 border-b border-sengoku-border">
                        名前
                    </h2>
                    <div className="flex items-center gap-4">
                        <label className="text-sm text-sengoku-gray">主人公の名前：</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 px-4 py-3 text-base bg-sengoku-darker border border-sengoku-border text-white"
                            placeholder="名前を入力"
                        />
                    </div>
                </div>

                {/* ステータス配分 */}
                <div className="bg-sengoku-dark border border-sengoku-border p-6 mb-6">
                    <h2 className="text-sengoku-gold text-base mb-4 pb-2 border-b border-sengoku-border">
                        才能配分（上限値）
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        {(['combat', 'command', 'intelligence', 'administration'] as const).map(
                            (key) => {
                                const labels = {
                                    combat: '武芸',
                                    command: '統率',
                                    intelligence: '知略',
                                    administration: '政務',
                                }
                                return (
                                    <div key={key} className="flex items-center gap-3">
                                        <span className="w-16 text-sm text-sengoku-gray">
                                            {labels[key]}
                                        </span>
                                        <div className="flex-1 h-6 bg-sengoku-darker border border-sengoku-border relative">
                                            <div
                                                className="h-full bg-sengoku-gold"
                                                style={{ width: `${(potential[key] / CHAR_CREATE.maxPotential) * 100}%` }}
                                            />
                                        </div>
                                        <span className="w-10 text-right font-mono text-sm">
                                            {potential[key]}
                                        </span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => adjustStat(key, -1)}
                                                className="w-7 h-7 text-base font-bold border border-sengoku-border bg-sengoku-darker text-white hover:bg-sengoku-border"
                                            >
                                                -
                                            </button>
                                            <button
                                                onClick={() => adjustStat(key, 1)}
                                                className="w-7 h-7 text-base font-bold border border-sengoku-border bg-sengoku-darker text-white hover:bg-sengoku-border"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )
                            }
                        )}
                    </div>

                    {/* 残りポイント */}
                    <div className="mt-4 text-center p-3 bg-sengoku-darker border border-sengoku-border">
                        残りポイント:{' '}
                        <span className="text-2xl font-bold text-sengoku-gold font-mono">
                            {remaining}
                        </span>{' '}
                        / 合計: 300
                    </div>
                </div>

                {/* 従僕情報 */}
                <div className="bg-sengoku-dark border border-sengoku-border p-6 mb-6">
                    <h2 className="text-sengoku-gold text-base mb-2 pb-2 border-b border-sengoku-border">
                        従僕（3名）
                    </h2>
                    <p className="text-xs text-gray-500 mb-3">
                        ※武芸は40〜60のランダム
                    </p>
                    <div className="flex gap-4 mb-3">
                        {juuboku.map((combat, i) => (
                            <div
                                key={i}
                                className="flex-1 p-4 bg-sengoku-darker border border-sengoku-border text-center"
                            >
                                <div className="text-xs text-gray-500 mb-1">従僕{i + 1} 武芸</div>
                                <div className="text-lg font-mono">{combat}</div>
                            </div>
                        ))}
                    </div>
                    <div className="text-center">
                        <Button
                            variant="secondary"
                            onClick={handleRerollJuuboku}
                            className="px-6 py-2 text-sm"
                        >
                            従僕を振り直し
                        </Button>
                    </div>
                </div>

                {/* 初期状態 */}
                <div className="bg-sengoku-dark border border-sengoku-border p-6 mb-8">
                    <h2 className="text-sengoku-gold text-base mb-4 pb-2 border-b border-sengoku-border">
                        初期状態
                    </h2>
                    <div className="text-sm text-gray-400">
                        <div className="flex justify-between py-1">
                            <span>役職</span>
                            <span>徒士</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>扶持米</span>
                            <span>月1.8石</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>初期米</span>
                            <span>0.5石</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>初期金</span>
                            <span>10貫</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span>開始</span>
                            <span>1575年1月1週目</span>
                        </div>
                    </div>
                </div>

                {/* ボタンエリア */}
                <div className="flex justify-center gap-4">
                    <Button variant="secondary" onClick={handleRerollPotential}>
                        才能を振り直し
                    </Button>
                    <Button onClick={handleStart} disabled={remaining !== 0}>
                        決定
                    </Button>
                </div>
            </div>
        </div>
    )
}
