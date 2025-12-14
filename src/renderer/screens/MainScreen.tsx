import React, { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { StatBar } from '../components/StatBar'
import { weekToDate, formatDate, isKochouEvaluationTurn } from '../utils/time'
import { BANDIT_RANKS, COMMANDS, PROMOTION_REQUIREMENTS } from '../constants/game'
import { checkPromotion } from '../utils/promotion'
import { generateBandit } from '../utils/bandit'
import { applyScout, applyMisinformation, applyBribe, calculateStrategySuccessRate, getStrategyCost } from '../utils/bandit'

export const MainScreen: React.FC = () => {
    const { player, rival, mandate, mission, banditCards, evaluationTurnDone, logs, setCurrentScreen, setMission, addLog, removeBanditCard, updateBanditCard, updatePlayer, saveGame, loadGame } = useGameStore()

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

    }, [player?.merit, player?.rank, player?.week])

    if (!player || !rival) return <div>Loading...</div>

    const gameTime = weekToDate(player.week)
    const meritDiff = player.merit - rival.merit
    const canSelectCommand = isKochouEvaluationTurn(player.week) && evaluationTurnDone !== player.week

    const canExecuteMandate = !!mandate && mandate.status === 'active'
    const isBanditMandate = !!mandate && mandate.status === 'active' && mandate.target.includes('盗賊討伐')

    const delegatedAnyCardThisTurn = banditCards.some((c) => c.delegatedTurn === player.week)

    const getBestJuubokuForIntelligence = () => {
        if (player.juuboku.length === 0) return null
        return player.juuboku.reduce((best, cur) => (cur.intelligence > best.intelligence ? cur : best))
    }

    const resolveCardDelegationActor = (card: (typeof banditCards)[number]) => {
        if (card.delegatedJuubokuId != null) {
            const selected = player.juuboku.find((j) => j.id === card.delegatedJuubokuId) ?? null
            if (selected) return selected
        }
        return getBestJuubokuForIntelligence()
    }

    const handleDelegateCardStrategy = (
        cardId: string,
        strategy: 'scout' | 'misinformation' | 'bribe' | 'hire'
    ) => {
        if (!player) return
        const card = banditCards.find((c) => c.id === cardId)
        if (!card) return

        if (delegatedAnyCardThisTurn) return
        if (card.delegatedTurn === player.week) return
        if (strategy === 'scout' && card.bandit.investigated) return

        if (strategy === 'bribe') {
            if (!card.bandit.investigated || card.bandit.count < 10) {
                addLog('買収は実行できない（偵察済み・10人以上で解禁）', 'warning')
                return
            }
        }

        const actor = resolveCardDelegationActor(card)
        if (!actor) {
            addLog('若党がいないため、委任できない', 'danger')
            return
        }

        // 若党の知略で成功率を算出する
        const delegatedPlayer = {
            ...player,
            stats: {
                ...player.stats,
                intelligence: actor.intelligence,
            },
        }

        const strategies = card.strategies ?? []
        const additionalAshigaru = card.additionalAshigaru ?? 0
        let updatedCard = { ...card, strategies: [...strategies], additionalAshigaru }
        let updatedPlayer = { ...player }

        if (strategy === 'scout') {
            const { mission: after, success, successRate } = applyScout({ bandit: updatedCard.bandit }, delegatedPlayer)
            updatedCard = { ...updatedCard, bandit: after.bandit }
            if (success) {
                addLog(`若党${actor.id}が偵察成功（成功率${Math.floor(successRate)}%）`, 'success')
            } else {
                addLog(`若党${actor.id}が偵察失敗（成功率${Math.floor(successRate)}%）`, 'warning')
            }
        }

        if (strategy === 'misinformation') {
            const { mission: after, success, moraleDecrease, successRate } = applyMisinformation(
                { bandit: updatedCard.bandit },
                delegatedPlayer
            )
            updatedCard = { ...updatedCard, bandit: after.bandit }
            if (success) {
                addLog(`若党${actor.id}が偽情報成功（成功率${Math.floor(successRate)}%・士気-${moraleDecrease}）`, 'success')
            } else {
                addLog(`若党${actor.id}が偽情報失敗（成功率${Math.floor(successRate)}%）`, 'warning')
            }
        }

        if (strategy === 'bribe') {
            const rate = calculateStrategySuccessRate('bribe', delegatedPlayer as any, updatedCard.bandit)
            const bribeResult = applyBribe({ bandit: updatedCard.bandit }, updatedPlayer)
            updatedCard = { ...updatedCard, bandit: bribeResult.mission.bandit }
            updatedPlayer = bribeResult.player
            if (bribeResult.success) {
                addLog(`若党${actor.id}が買収成功（成功率${Math.floor(rate)}%）`, 'success')
            } else {
                addLog(`若党${actor.id}が買収失敗（成功率${Math.floor(rate)}%）`, 'warning')
            }
        }

        if (strategy === 'hire') {
            const cost = getStrategyCost('hire')
            const count = 5
            if (updatedPlayer.money >= cost) {
                updatedPlayer.money -= cost
                updatedCard.additionalAshigaru = (updatedCard.additionalAshigaru ?? 0) + count
                addLog(`若党${actor.id}が足軽${count}名を雇用（資金-${cost}貫）`, 'success')
            } else {
                addLog(`若党${actor.id}の足軽雇用は失敗（資金不足：${cost}貫必要）`, 'warning')
            }
        }

        updatedCard.strategies = [...(updatedCard.strategies ?? []), strategy]
        updatedCard.delegatedTurn = player.week
        updatedCard.delegatedJuubokuId = actor.id

        updatePlayer(updatedPlayer)
        updateBanditCard(cardId, updatedCard)
    }

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
                    <button 
                        className="px-4 py-2 text-xs border border-sengoku-border bg-transparent text-sengoku-gray hover:bg-sengoku-border"
                        onClick={() => {
                            if (saveGame()) {
                                alert('セーブしました')
                            } else {
                                alert('セーブに失敗しました')
                            }
                        }}
                    >
                        セーブ
                    </button>
                    <button 
                        className="px-4 py-2 text-xs border border-sengoku-border bg-transparent text-sengoku-gray hover:bg-sengoku-border"
                        onClick={() => {
                            if (loadGame()) {
                                alert('ロードしました')
                            } else {
                                alert('セーブデータがありません')
                            }
                        }}
                    >
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
                                <span className="text-sengoku-gray">若党</span>
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

                        <div className="mt-4 pt-4 border-t border-sengoku-border">
                            <Button
                                variant="secondary"
                                onClick={() => setCurrentScreen('juuboku-recruit')}
                                className="w-full text-xs"
                            >
                                人事（若党雇用）
                            </Button>
                        </div>
                    </Panel>
                </aside>

                {/* 中央エリア */}
                <main className="flex flex-col gap-4">
                    {banditCards.length > 0 && (
                        <Panel title="盗賊情報（巡察）">
                            <div className="space-y-3">
                                {delegatedAnyCardThisTurn && (
                                    <div className="text-xs text-yellow-500">
                                        ※このターンは既に若党を委任済みです（カードの委任は1回まで）
                                    </div>
                                )}
                                {banditCards.slice(0, 5).map((card) => {
                                    const meritGain = Math.floor(BANDIT_RANKS[card.bandit.rank].merit * 0.4)
                                    const actor = resolveCardDelegationActor(card)
                                    const delegatedThisCardThisTurn = card.delegatedTurn === player.week

                                    return (
                                        <div
                                            key={card.id}
                                            className="border border-sengoku-border bg-sengoku-darker p-3"
                                        >
                                            <div className="flex justify-between items-center text-sm">
                                                <div>
                                                    盗賊ランク: <span className="text-sengoku-gold font-bold">{card.bandit.rank}</span>
                                                </div>
                                                <div className="text-xs text-sengoku-gray">
                                                    発見: {card.foundCalendarWeek}週
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                <div className="text-xs text-sengoku-gray">
                                                    若党委任（主人公ターン消費なし）
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="text-xs text-sengoku-gray">担当:</div>
                                                    <select
                                                        className="bg-sengoku-darker border border-sengoku-border px-2 py-1 text-xs"
                                                        value={card.delegatedJuubokuId ?? actor?.id ?? ''}
                                                        onChange={(e) => {
                                                            const id = e.target.value ? Number(e.target.value) : null
                                                            updateBanditCard(card.id, { delegatedJuubokuId: id })
                                                        }}
                                                    >
                                                        {player.juuboku.map((j) => (
                                                            <option key={j.id} value={j.id}>
                                                                若党{j.id}（知略{j.intelligence}）
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="grid grid-cols-4 gap-2 mt-2">
                                                    <Button
                                                        variant="secondary"
                                                        className="text-xs"
                                                        disabled={
                                                            delegatedAnyCardThisTurn ||
                                                            delegatedThisCardThisTurn ||
                                                            card.bandit.investigated
                                                        }
                                                        onClick={() => handleDelegateCardStrategy(card.id, 'scout')}
                                                    >
                                                        偵察
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="text-xs"
                                                        disabled={delegatedAnyCardThisTurn || delegatedThisCardThisTurn}
                                                        onClick={() => handleDelegateCardStrategy(card.id, 'misinformation')}
                                                    >
                                                        偽情報
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="text-xs"
                                                        disabled={delegatedAnyCardThisTurn || delegatedThisCardThisTurn}
                                                        onClick={() => handleDelegateCardStrategy(card.id, 'bribe')}
                                                    >
                                                        買収
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="text-xs"
                                                        disabled={delegatedAnyCardThisTurn || delegatedThisCardThisTurn}
                                                        onClick={() => handleDelegateCardStrategy(card.id, 'hire')}
                                                    >
                                                        雇用
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                <Button
                                                    variant="secondary"
                                                    className="text-xs"
                                                    onClick={() => {
                                                        removeBanditCard(card.id)
                                                        const timeLimit = 20
                                                        const timeLimitWeeks = Math.ceil(timeLimit / 2)
                                                        setMission({
                                                            type: 'bandit_subjugation',
                                                            rank: card.bandit.rank,
                                                            bandit: card.bandit,
                                                            timeLimit,
                                                            currentWeek: 1,
                                                            additionalAshigaru: card.additionalAshigaru ?? 0,
                                                            strategies: card.strategies ?? [],
                                                            delegatedTurn: null,
                                                            actionLogs: [
                                                                {
                                                                    week: '開始',
                                                                    actionName: '任務開始',
                                                                    result: '―',
                                                                    detail: `巡察で得た情報（${card.bandit.rank}）を元に討伐を開始。討伐まで: ${timeLimit}ターン（${timeLimitWeeks}週間）。`,
                                                                },
                                                            ],
                                                            source: 'patrol_card',
                                                            sourceCardId: card.id,
                                                            lootMultiplier: 2,
                                                        })
                                                        addLog(`盗賊カード（${card.bandit.rank}）の討伐に着手した（戦利品2倍）`, 'warning')
                                                        setCurrentScreen('bandit-mission')
                                                    }}
                                                >
                                                    討伐する（戦利品2倍）
                                                </Button>

                                                <Button
                                                    className="text-xs"
                                                    onClick={() => {
                                                        if (!player) return
                                                        updatePlayer({ merit: player.merit + meritGain })
                                                        removeBanditCard(card.id)
                                                        addLog(`盗賊情報（${card.bandit.rank}）を上申した。功績+${meritGain}`, 'success')
                                                    }}
                                                >
                                                    報告する（功績+{meritGain}）
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </Panel>
                    )}
                    {mandate && mandate.status === 'active' && (
                        <Panel title="下知（次の小頭評定まで）">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-sengoku-gray">目標</span>
                                    <span>{mandate.target}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sengoku-gray">判定</span>
                                    <span>{formatDate(weekToDate(mandate.dueTurn))}の評定</span>
                                </div>
                                <div className="text-xs text-sengoku-gray">
                                    未達/失敗: 功績-{Math.floor(mandate.successMerit * 0.4)}
                                </div>
                            </div>
                        </Panel>
                    )}

                    {/* 今週の行動 */}
                    <div className="bg-sengoku-dark border-2 border-sengoku-gold p-6 text-center">
                        <h2 className="text-lg text-sengoku-gold font-bold mb-4">
                            今週の行動
                        </h2>
                        {canSelectCommand ? (
                            <Button
                                onClick={() => setCurrentScreen('kochou-evaluation')}
                                className="w-full text-lg py-5"
                            >
                                小頭評定へ
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-sm text-sengoku-gray">
                                    評定外のターン：自主的な活動
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        onClick={() => {
                                            useGameStore.setState({ selectedCommand: '訓練', currentScreen: 'result' })
                                        }}
                                        className="text-sm"
                                    >
                                        訓練
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            useGameStore.setState({ selectedCommand: '巡察', currentScreen: 'result' })
                                        }}
                                        className="text-sm"
                                    >
                                        巡察
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            useGameStore.setState({ selectedCommand: '情報収集', currentScreen: 'result' })
                                        }}
                                        className="text-sm"
                                    >
                                        情報収集
                                    </Button>
                                </div>

                                {isBanditMandate && (
                                    <>
                                        {!mission && (
                                            <Button
                                                onClick={() => {
                                                    const cmd = COMMANDS[mandate!.target]
                                                    if (!cmd?.banditRank) return
                                                    const bandit = generateBandit(cmd.banditRank)
                                                    const timeLimit = 20
                                                    const timeLimitWeeks = Math.ceil(timeLimit / 2)
                                                    setMission({
                                                        type: 'bandit_subjugation',
                                                        rank: cmd.banditRank,
                                                        bandit,
                                                        timeLimit,
                                                        currentWeek: 1,
                                                        additionalAshigaru: 0,
                                                        strategies: [],
                                                        delegatedTurn: null,
                                                        actionLogs: [
                                                            {
                                                                week: '開始',
                                                                actionName: '任務開始',
                                                                result: '―',
                                                                detail: `${mandate!.target}を開始。討伐まで: ${timeLimit}ターン（${timeLimitWeeks}週間）。`,
                                                            },
                                                        ],
                                                    })
                                                    addLog(`下知「${mandate!.target}」を開始した`, 'warning')
                                                    setCurrentScreen('bandit-mission')
                                                }}
                                                className="w-full text-sm py-3"
                                                variant="secondary"
                                            >
                                                討伐任務を開始
                                            </Button>
                                        )}

                                        {mission && mission.type === 'bandit_subjugation' && (
                                            <Button
                                                onClick={() => setCurrentScreen('bandit-mission')}
                                                className="w-full text-sm py-3"
                                                variant="secondary"
                                            >
                                                討伐任務へ
                                            </Button>
                                        )}
                                    </>
                                )}

                                {mission && mission.type === 'bandit_subjugation' && !isBanditMandate && (
                                    <Button
                                        onClick={() => setCurrentScreen('bandit-mission')}
                                        className="w-full text-sm py-3"
                                        variant="secondary"
                                    >
                                        討伐任務へ
                                    </Button>
                                )}

                                {canExecuteMandate && (
                                    <div className="text-xs text-yellow-500">
                                        ※下知がある場合は、下知達成を優先してください
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2 mt-4">
                            <Button
                                variant="secondary"
                                onClick={() => setCurrentScreen('shop')}
                                className="flex-1"
                            >
                                商人・借金
                            </Button>
                        </div>
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
