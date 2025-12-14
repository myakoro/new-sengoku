import React, { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { COMMANDS } from '../constants/game'
import { CommandType, Rank } from '../types/game'
import { weekToDate, formatDate } from '../utils/time'
import { calculatePlayerCombatPower } from '../utils/combat'
import { generateBandit } from '../utils/bandit'

export const CommandSelectScreen: React.FC = () => {
    const { player, mandate, setCurrentScreen, setMission } = useGameStore()
    const [selectedCommand, setSelectedCommand] = useState<CommandType | null>(null)
    const [showConfirm, setShowConfirm] = useState(false)

    if (!player) return <div>Loading...</div>

    const gameTime = weekToDate(player.week)
    const playerPower = calculatePlayerCombatPower(player)

    const hasActiveMandate = !!mandate && mandate.status === 'active'

    const rankOrder: Record<Rank, number> = {
        徒士: 0,
        馬上衆: 1,
        小頭: 2,
    }

    const canUseCommand = (playerRank: Rank, requireRank?: Rank): boolean => {
        if (!requireRank) return true
        return rankOrder[playerRank] >= rankOrder[requireRank]
    }

    const handleSelectCommand = (commandName: CommandType) => {
        setSelectedCommand(commandName)
        setShowConfirm(true)
    }

    const handleConfirm = () => {
        if (!selectedCommand) return

        const command = COMMANDS[selectedCommand]

        // 盗賊討伐の場合はミッション開始
        if (command.banditRank) {
            const bandit = generateBandit(command.banditRank)

            const timeLimit = 20
            const timeLimitWeeks = Math.ceil(timeLimit / 2)

            const initialLog = {
                week: "開始" as const,
                actionName: "任務開始",
                result: "―" as const,
                detail: `${selectedCommand}を開始。討伐まで: ${timeLimit}ターン（${timeLimitWeeks}週間）。`
            }

            setMission({
                type: 'bandit_subjugation',
                rank: command.banditRank,
                bandit,
                timeLimit,
                currentWeek: 1,
                additionalAshigaru: 0,
                strategies: [],
                delegatedTurn: null,
                actionLogs: [initialLog]
            })
            setCurrentScreen('bandit-mission')
        } else {
            // 1週完結型の主命 - 選択したコマンドを保存
            useGameStore.setState({ selectedCommand })
            setCurrentScreen('result')
        }
    }

    const availableCommands = Object.values(COMMANDS).filter((cmd) => !cmd.hidden)

    return (
        <div className="min-h-screen bg-sengoku-dark p-10">
            <div className="max-w-4xl mx-auto">
                {/* ヘッダー */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-sengoku-gold mb-2">
                        {formatDate(gameTime)} - 主命選択
                    </h1>
                    <p className="text-sengoku-gray">上司からの命令を選択してください</p>

                    {hasActiveMandate && (
                        <div className="mt-4 p-3 border border-sengoku-gold bg-sengoku-darker text-sm">
                            <div className="text-sengoku-gold font-bold">下知：{mandate.target}</div>
                            <div className="text-sengoku-gray text-xs mt-1">
                                期限までに下知目標を達成してください（必要なら準備ターンを使えます）。
                            </div>
                        </div>
                    )}
                </div>

                {/* 主命リスト */}
                <div className="space-y-4 mb-8">
                    {availableCommands.map((cmd) => {
                        const isDisabled = !canUseCommand(player.rank, cmd.requireRank)

                        return (
                            <div
                                key={cmd.name}
                                onClick={() => !isDisabled && handleSelectCommand(cmd.name)}
                                className={`bg-sengoku-dark border border-sengoku-border p-6 ${isDisabled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'cursor-pointer hover:border-sengoku-gold'
                                    }`}
                            >
                                <h3 className="text-lg font-bold text-white mb-2">{cmd.name}</h3>
                                <div className="flex gap-4 text-sm text-sengoku-gray mb-2">
                                    <span>功績: +{cmd.merit}</span>
                                    {cmd.duration > 1 && (
                                        <span>期間: {cmd.duration}ターン（{Math.ceil(cmd.duration / 2)}週間）</span>
                                    )}
                                    {cmd.expGain && (
                                        <span>
                                            {cmd.expGain.combat && `武芸経験値: +${cmd.expGain.combat}`}
                                            {cmd.expGain.intelligence &&
                                                `知略経験値: +${cmd.expGain.intelligence}`}
                                        </span>
                                    )}
                                </div>
                                {cmd.banditRank && (
                                    <div className="text-sm text-sengoku-gray">
                                        <span>自家戦力: {playerPower}</span>
                                    </div>
                                )}
                                {cmd.requireRank && (
                                    <div className="text-sm text-yellow-500 mt-2">
                                        ⚠️ {cmd.requireRank}以上のみ
                                    </div>
                                )}

                                {hasActiveMandate && cmd.name === mandate!.target && (
                                    <div className="text-sm text-sengoku-gold mt-2">
                                        下知目標
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* 戻るボタン */}
                <div className="text-center">
                    <Button variant="secondary" onClick={() => setCurrentScreen('main')}>
                        戻る
                    </Button>
                </div>

                {/* 確認モーダル */}
                <Modal
                    isOpen={showConfirm}
                    onClose={() => setShowConfirm(false)}
                    title="確認"
                    actions={
                        <>
                            <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                                キャンセル
                            </Button>
                            <Button onClick={handleConfirm}>決定</Button>
                        </>
                    }
                >
                    <p className="text-sengoku-gray">
                        {selectedCommand && `「${selectedCommand}」を選択しますか？`}
                    </p>
                </Modal>
            </div>
        </div>
    )
}
