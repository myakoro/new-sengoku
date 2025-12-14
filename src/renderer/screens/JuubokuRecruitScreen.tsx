import React, { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { JUUBOKU_RECRUITMENT, MAX_JUUBOKU_COUNT } from '../constants/game'
import type { Juuboku, Rank } from '../types/game'
import { distributeJuubokuStats } from '../utils/juuboku'

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function getCandidateCount(rank: Rank): number {
    const range = JUUBOKU_RECRUITMENT.candidateCount[rank] || [2, 5]
    return randomInt(range[0], range[1])
}

function generateCandidate(id: number): Juuboku {
    const total = randomInt(
        JUUBOKU_RECRUITMENT.generalTotalRange[0],
        JUUBOKU_RECRUITMENT.generalTotalRange[1]
    )
    const stats = distributeJuubokuStats(total, 100)
    
    return {
        id,
        combat: stats.combat,
        command: stats.command,
        intelligence: stats.intelligence,
        administration: stats.administration,
        injuryStatus: 'normal',
        injuryWeeksRemaining: 0
    }
}

function generateCandidates(rank: Rank, startId: number): Juuboku[] {
    const count = getCandidateCount(rank)
    return Array.from({ length: count }, (_, i) => generateCandidate(startId + i))
}

export const JuubokuRecruitScreen: React.FC = () => {
    const { player, updatePlayer, setCurrentScreen } = useGameStore()
    const [candidates, setCandidates] = useState<Juuboku[]>([])
    const [refreshedThisMonth, setRefreshedThisMonth] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    
    const nextId = player && player.juuboku.length > 0 
        ? Math.max(...player.juuboku.map(j => j.id)) + 1 
        : 1
    
    useEffect(() => {
        if (player) {
            setCandidates(generateCandidates(player.rank, nextId + 100))
        }
    }, [])
    
    if (!player) return <div>Loading...</div>
    
    const canHire = player.juuboku.length < MAX_JUUBOKU_COUNT
    const canRefresh = !refreshedThisMonth && player.money >= JUUBOKU_RECRUITMENT.refreshCost
    
    const handleHire = (candidate: Juuboku) => {
        if (!canHire) {
            setMessage('若党の雇用上限に達しています')
            return
        }
        
        const newJuuboku: Juuboku = {
            ...candidate,
            id: nextId
        }
        
        updatePlayer({
            ...player,
            juuboku: [...player.juuboku, newJuuboku]
        })
        
        setCandidates(candidates.filter(c => c.id !== candidate.id))
        setMessage(`若党を雇用しました（合計能力: ${candidate.combat + candidate.command + candidate.intelligence + candidate.administration}）`)
    }
    
    const handleRefresh = () => {
        if (!canRefresh) {
            setMessage('募集更新は月に1回のみです')
            return
        }
        
        updatePlayer({
            ...player,
            money: player.money - JUUBOKU_RECRUITMENT.refreshCost
        })
        
        setCandidates(generateCandidates(player.rank, nextId + 200))
        setRefreshedThisMonth(true)
        setMessage(`新しい候補を募集しました（-${JUUBOKU_RECRUITMENT.refreshCost}貫）`)
    }
    
    const handleBack = () => {
        setCurrentScreen('main')
    }
    
    const getTotal = (j: Juuboku) => j.combat + j.command + j.intelligence + j.administration
    
    return (
        <div className="min-h-screen bg-sengoku-bg p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl text-sengoku-gold mb-6">若党雇用</h1>
                
                {message && (
                    <div className="bg-sengoku-dark border border-sengoku-gold p-3 mb-4 text-sm">
                        {message}
                    </div>
                )}
                
                {/* 現在の若党 */}
                <div className="bg-sengoku-dark border border-sengoku-border p-4 mb-6">
                    <h2 className="text-sengoku-gold text-lg mb-3">
                        現在の若党 ({player.juuboku.length}/{MAX_JUUBOKU_COUNT}名)
                    </h2>
                    
                    {player.juuboku.length === 0 ? (
                        <p className="text-gray-500">若党がいません</p>
                    ) : (
                        <div className="flex gap-4 flex-wrap">
                            {player.juuboku.map((j, i) => (
                                <div
                                    key={j.id}
                                    className="p-4 bg-sengoku-darker border border-sengoku-border min-w-[140px]"
                                >
                                    <div className="text-xs text-gray-500 mb-2">若党{i + 1}</div>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        <div>武芸: <span className="font-mono">{j.combat}</span></div>
                                        <div>統率: <span className="font-mono">{j.command}</span></div>
                                        <div>知略: <span className="font-mono">{j.intelligence}</span></div>
                                        <div>政務: <span className="font-mono">{j.administration}</span></div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        合計: {getTotal(j)}
                                    </div>
                                    {j.injuryStatus !== 'normal' && (
                                        <div className="text-xs text-sengoku-danger mt-1">
                                            {j.injuryStatus === 'severe' ? '重傷' : '軽傷'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* 雇用候補 */}
                <div className="bg-sengoku-dark border border-sengoku-border p-4 mb-6">
                    <h2 className="text-sengoku-gold text-lg mb-3">
                        雇用候補 ({candidates.length}名)
                    </h2>
                    
                    {candidates.length === 0 ? (
                        <p className="text-gray-500">候補がいません。募集更新してください。</p>
                    ) : (
                        <div className="flex gap-4 flex-wrap">
                            {candidates.map((c, i) => (
                                <div
                                    key={c.id}
                                    className="p-4 bg-sengoku-darker border border-sengoku-border min-w-[140px]"
                                >
                                    <div className="text-xs text-gray-500 mb-2">候補{String.fromCharCode(65 + i)}</div>
                                    <div className="grid grid-cols-2 gap-1 text-xs">
                                        <div>武芸: <span className="font-mono">{c.combat}</span></div>
                                        <div>統率: <span className="font-mono">{c.command}</span></div>
                                        <div>知略: <span className="font-mono">{c.intelligence}</span></div>
                                        <div>政務: <span className="font-mono">{c.administration}</span></div>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        合計: {getTotal(c)}
                                    </div>
                                    <Button
                                        onClick={() => handleHire(c)}
                                        disabled={!canHire}
                                        className="w-full mt-2 text-xs"
                                    >
                                        雇用
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* アクションボタン */}
                <div className="flex gap-4">
                    <Button
                        onClick={handleRefresh}
                        disabled={!canRefresh}
                        variant="secondary"
                    >
                        募集更新 ({JUUBOKU_RECRUITMENT.refreshCost}貫)
                        {refreshedThisMonth && ' ※今月は更新済み'}
                    </Button>
                    
                    <Button onClick={handleBack} variant="secondary">
                        戻る
                    </Button>
                </div>
                
                <div className="mt-4 text-xs text-gray-500">
                    <p>・若党は最大{MAX_JUUBOKU_COUNT}名まで雇用可能</p>
                    <p>・雇用費用は無料（毎月の扶持米0.3石が発生）</p>
                    <p>・募集更新は月に1回のみ（{JUUBOKU_RECRUITMENT.refreshCost}貫）</p>
                    <p>・候補数は役職が上がると増える</p>
                </div>
            </div>
        </div>
    )
}
