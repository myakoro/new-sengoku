import React, { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { StatBar } from '../components/StatBar'
import { weekToDate, formatDate } from '../utils/time'
import { PROMOTION_REQUIREMENTS } from '../constants/game'
import { checkPromotion } from '../utils/promotion'

export const MainScreen: React.FC = () => {
    const { player, rival, logs, setCurrentScreen } = useGameStore()

    useEffect(() => {
        if (!player) return

        // 出世判定
        const newRank = checkPromotion(player)
        if (newRank) {
            useGameStore.setState({
                currentScreen: 'promotion',
            })
                // PromotionScreenで使用するために新しいランクを保存
                ; (window as any).__promotionRank = newRank
        }

        // 小頭到達でエンディング
        if (player.rank === '小頭') {
            setCurrentScreen('ending')
        }
    }, [player?.merit, player?.rank])

    if (!player || !rival) return <div>Loading...</div>

    const gameTime = weekToDate(player.week)
    const meritDiff = player.merit - rival.merit

    // 次の昇進条件
    let nextRank = ''
    let requiredMerit = 0
    if (player.rank === '徒士') {
        nextRank = '馬上衆'
        requiredMerit = PROMOTION_REQUIREMENTS.徒士_to_馬上衆.merit
    } else if (player.rank === '馬上衆') {
        nextRank = '小頭'
        requiredMerit = PROMOTION_REQUIREMENTS.馬上衆_to_小頭_通常.merit
    }

    return (
        <div className="min-h-screen bg-sengoku-dark">
            {/* ヘッダー */}
            <header className="bg-sengoku-darker px-6 py-3 flex justify-between items-center border-b-2 border-sengoku-gold">
                <div className="flex items-center gap-6">
                    <div className="text-lg text-sengoku-gold font-bold">
                        {formatDate(gameTime)}
                    </div>
                    <div className="text-sm text-sengoku-gray">
                        役職: <span className="text-sengoku-gold font-bold">{player.rank}</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button className="px-4 py-2 text-xs border border-sengoku-border bg-transparent text-sengoku-gray hover:bg-sengoku-border">
                        セーブ
                    </button>
                    <button className="px-4 py-2 text-xs border border-sengoku-border bg-transparent text-sengoku-gray hover:bg-sengoku-border">
                        ロード
                    </button>
                    <button className="px-4 py-2 text-xs border border-sengoku-border bg-transparent text-sengoku-gray hover:bg-sengoku-border">
                        設定
                    </button>
                </div>
            </header>

            {/* メインコンテンツ */}
            <div className="grid grid-cols-[280px_1fr_280px] gap-6 p-6 min-h-[calc(100vh-60px)]">
                {/* 左サイドバー - プレイヤー情報 */}
                <aside className="flex flex-col gap-4">
                    {/* ステータス */}
                    <Panel title={player.name}>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">武芸</span>
                                <span className="font-mono">{player.stats.combat}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">統率</span>
                                <span className="font-mono">{player.stats.command}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">知略</span>
                                <span className="font-mono">{player.stats.intelligence}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">政務</span>
                                <span className="font-mono">{player.stats.administration}</span>
                            </div>

                            {/* 功績 */}
                            <div className="mt-4 pt-4 border-t border-sengoku-border">
                                {nextRank && (
                                    <StatBar
                                        label="功績"
                                        current={player.merit}
                                        max={requiredMerit}
                                    />
                                )}
                            </div>
                        </div>
                    </Panel>

                    {/* 経済 */}
                    <Panel title="経済">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">米</span>
                                <span className="font-mono">{player.rice.toFixed(2)}石</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">金</span>
                                <span className="font-mono">{player.money.toFixed(2)}貫</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">借金</span>
                                <span className="font-mono text-sengoku-danger">
                                    {player.debt.toFixed(2)}貫
                                </span>
                            </div>
                        </div>
                    </Panel>

                    {/* 家臣 */}
                    <Panel title="家臣">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">従僕</span>
                                <span className="font-mono">
                                    {player.juuboku.length}名
                                    {player.juuboku.length > 0 && (() => {
                                        const normal = player.juuboku.filter(j => j.injuryStatus === 'normal').length
                                        const light = player.juuboku.filter(j => j.injuryStatus === 'light').length
                                        const severe = player.juuboku.filter(j => j.injuryStatus === 'severe').length
                                        if (light > 0 || severe > 0) {
                                            return (
                                                <span className="text-xs ml-1">
                                                    ({normal > 0 && `正常${normal}`}
                                                    {light > 0 && `${normal > 0 ? '、' : ''}軽傷${light}`}
                                                    {severe > 0 && `${(normal > 0 || light > 0) ? '、' : ''}重傷${severe}`})
                                                </span>
                                            )
                                        }
                                        return null
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">徒士</span>
                                <span className="font-mono">{player.ashigaru.length}名</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">馬上衆</span>
                                <span className="font-mono">{player.bashoShu.length}名</span>
                            </div>
                        </div>
                    </Panel>
                </aside>

                {/* 中央エリア */}
                <main className="flex flex-col gap-4">
                    {/* 今週の行動 */}
                    <div className="bg-sengoku-dark border-2 border-sengoku-gold p-6 text-center">
                        <h2 className="text-lg text-sengoku-gold font-bold mb-4">
                            今週の行動
                        </h2>
                        <Button
                            onClick={() => setCurrentScreen('command-select')}
                            className="w-full text-lg py-5"
                        >
                            主命を選択する
                        </Button>
                    </div>

                    {/* ログ */}
                    <Panel title="行動ログ" className="flex-1 overflow-y-auto">
                        <div className="space-y-2">
                            {logs.slice(0, 20).map((log, i) => (
                                <div
                                    key={i}
                                    className={`text-sm py-1 border-b border-gray-700 ${log.type === 'success'
                                        ? 'text-sengoku-success'
                                        : log.type === 'warning'
                                            ? 'text-yellow-500'
                                            : log.type === 'danger'
                                                ? 'text-sengoku-danger'
                                                : 'text-sengoku-gray'
                                        }`}
                                >
                                    <span className="text-xs text-gray-500">
                                        [{formatDate(weekToDate(log.week))}]
                                    </span>{' '}
                                    {log.message}
                                </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="text-sm text-gray-500 text-center py-4">
                                    まだ行動していません
                                </div>
                            )}
                        </div>
                    </Panel>
                </main>

                {/* 右サイドバー - ライバル情報 */}
                <aside className="flex flex-col gap-4">
                    <Panel title="ライバル">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">名前</span>
                                <span className="font-mono">{rival.name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">役職</span>
                                <span className="font-mono text-sengoku-gold">{rival.rank}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-sengoku-gray">功績</span>
                                <span className="font-mono">{rival.merit}</span>
                            </div>

                            {/* 比較 */}
                            <div className="mt-4 text-center p-3 bg-sengoku-darker">
                                <div
                                    className={`text-lg font-bold font-mono ${meritDiff > 0 ? 'text-sengoku-success' : 'text-sengoku-danger'
                                        }`}
                                >
                                    {meritDiff > 0 ? '+' : ''}
                                    {meritDiff}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    {meritDiff > 20
                                        ? 'あなたが大きく優勢'
                                        : meritDiff > 0
                                            ? 'あなたがやや優勢'
                                            : meritDiff > -20
                                                ? 'ライバルがやや優勢'
                                                : 'ライバルが大きく優勢'}
                                </div>
                            </div>
                        </div>
                    </Panel>

                    {/* 次の昇進 */}
                    {nextRank && (
                        <Panel title="次の昇進">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-sengoku-gray">目標役職</span>
                                    <span className="font-mono text-sengoku-gold">{nextRank}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-sengoku-gray">必要功績</span>
                                    <span className="font-mono">{requiredMerit}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-sengoku-gray">あと</span>
                                    <span className="font-mono text-sengoku-gold">
                                        {Math.max(0, requiredMerit - player.merit)}
                                    </span>
                                </div>
                            </div>
                        </Panel>
                    )}
                </aside>
            </div>
        </div>
    )
}
