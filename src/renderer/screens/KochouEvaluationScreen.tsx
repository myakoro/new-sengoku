import React, { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { formatDate, weekToDate } from '../utils/time'

export const KochouEvaluationScreen: React.FC = () => {
    const { player, mandate, addLog, updatePlayer, markMandateFailed, issueNextMandate, setCurrentScreen, setEvaluationTurnDone } = useGameStore()
    const [ready, setReady] = useState(false)

    if (!player) return <div>Loading...</div>

    const now = useMemo(() => formatDate(weekToDate(player.week)), [player.week])

    useEffect(() => {
        if (!player) return
        if (ready) return

        const shouldIssueNew = !mandate || player.week >= mandate.dueTurn

        if (mandate && mandate.status === 'active' && player.week >= mandate.dueTurn) {
            const penalty = Math.floor(mandate.successMerit * 0.4)
            const newMerit = Math.max(0, player.merit - penalty)
            updatePlayer({ merit: newMerit })
            markMandateFailed()
            addLog(`下知未達：功績-${penalty}（成功時功績の40%）`, 'danger')
        }

        if (shouldIssueNew) {
            issueNextMandate()
        }

        setReady(true)
    }, [ready, player?.week, mandate?.dueTurn, mandate?.status])

    const handleDone = () => {
        setEvaluationTurnDone(player.week)
        setCurrentScreen('main')
    }

    return (
        <div className="min-h-screen bg-sengoku-dark flex items-center justify-center p-10">
            <div className="max-w-2xl w-full bg-sengoku-dark border border-sengoku-border p-8">
                <h1 className="text-2xl font-bold text-sengoku-gold mb-6">小頭評定</h1>

                <div className="text-sm text-sengoku-gray mb-6">{now}</div>

                <Panel title="下知">
                    {mandate && mandate.status === 'active' ? (
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-sengoku-gray">目標</span>
                                <span>{mandate.target}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sengoku-gray">期限</span>
                                <span>{formatDate(weekToDate(mandate.dueTurn))}の評定で判定</span>
                            </div>
                            <div className="text-xs text-sengoku-gray">未達/失敗: 功績-{Math.floor(mandate.successMerit * 0.4)}</div>
                        </div>
                    ) : (
                        <div className="text-sm text-sengoku-gray">下知がありません</div>
                    )}
                </Panel>

                <div className="text-center mt-8">
                    <Button onClick={handleDone}>次へ</Button>
                </div>
            </div>
        </div>
    )
}
