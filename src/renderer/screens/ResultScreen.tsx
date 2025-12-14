import React, { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { COMMANDS } from '../constants/game'
import { addExperience } from '../utils/experience'
import { isKochouEvaluationTurn, isMonthlyProcessing } from '../utils/time'
import { CommandType } from '../types/game'
import { generateBandit } from '../utils/bandit'

interface ResultScreenProps {
  commandName: CommandType
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ commandName }) => {
  const { player, mandate, addLog, advanceWeek, updatePlayer, setCurrentScreen, markMandateSucceeded, addBanditCard } = useGameStore()
  const [growthResults, setGrowthResults] = useState<{ stat: string; oldValue: number; newValue: number }[]>([])
  const [specialEvent, setSpecialEvent] = useState<{ type: string; message: string; success?: boolean } | null>(null)
  const [actualMerit, setActualMerit] = useState(0)

  useEffect(() => {
    if (!player) return

    const command = COMMANDS[commandName]
    const results: { stat: string; oldValue: number; newValue: number }[] = []
    let updatedPlayer = { ...player }
    let merit = command.merit
    let event: { type: string; message: string; success?: boolean } | null = null

    // 巡察：20%で盗賊遭遇イベント
    if (commandName === '巡察') {
      if (Math.random() < 0.2) {
        event = { type: 'bandit_encounter', message: '巡察中に盗賊の痕跡を発見した！盗賊討伐の機会を得た。' }
      }
    }

    // 護衛任務：10%で襲撃イベント
    if (commandName === '護衛任務') {
      if (Math.random() < 0.1) {
        const defended = Math.random() < 0.7
        if (defended) {
          merit += 5
          event = { type: 'escort_attack', message: '護衛中に賊に襲われたが、見事撃退した！', success: true }
        } else {
          merit = Math.floor(merit * 0.5)
          event = { type: 'escort_attack', message: '護衛中に賊に襲われ、苦戦した。', success: false }
        }
      }
    }

    // 情報収集：成功率判定（60% + 知略×0.7）
    if (commandName === '情報収集') {
      const successRate = Math.min(95, Math.max(5, 60 + Math.floor(updatedPlayer.stats.intelligence * 0.7)))
      const success = Math.random() * 100 < successRate
      if (success) {
        event = { type: 'intel_success', message: `情報収集に成功した（成功率${successRate}%）。`, success: true }
      } else {
        merit = 0
        event = { type: 'intel_fail', message: `情報収集に失敗した（成功率${successRate}%）。功績は得られなかった。`, success: false }
      }
    }

    setSpecialEvent(event)
    setActualMerit(merit)

    // 功績付与
    updatedPlayer.merit += merit

    // 経験値付与と成長判定
    if (command.expGain) {
      if (command.expGain.combat) {
        const oldCombat = updatedPlayer.stats.combat
        const result = addExperience(updatedPlayer, 'combat', command.expGain.combat)
        updatedPlayer = result.updatedPlayer
        if (result.leveledUp) {
          results.push({ stat: '武芸', oldValue: oldCombat, newValue: result.newValue })
        }
      }
      if (command.expGain.intelligence) {
        const oldIntelligence = updatedPlayer.stats.intelligence
        const result = addExperience(updatedPlayer, 'intelligence', command.expGain.intelligence)
        updatedPlayer = result.updatedPlayer
        if (result.leveledUp) {
          results.push({ stat: '知略', oldValue: oldIntelligence, newValue: result.newValue })
        }
      }
    }

    setGrowthResults(results)
    updatePlayer(updatedPlayer)
  }, [])

  if (!player) return <div>Loading...</div>

  const command = COMMANDS[commandName]

  const handleNext = () => {
    const completedTurn = player.week

    if (mandate && mandate.status === 'active' && mandate.target === commandName) {
      markMandateSucceeded()
      addLog('下知を達成した', 'success')
    }

    advanceWeek()
    const logType = actualMerit > 0 ? 'success' : 'warning'
    addLog(`${commandName}を行った。功績+${actualMerit}`, logType)

    // 巡察で盗賊遭遇した場合、盗賊カードとして保管（任意タイミングで対応）
    if (specialEvent?.type === 'bandit_encounter') {
      const ranks = ['D', 'C', 'B', 'A', 'S'] as const
      const weights = [45, 30, 17, 7, 1]
      const roll = Math.random() * weights.reduce((a, b) => a + b, 0)
      let acc = 0
      let selectedRank: typeof ranks[number] = 'D'
      for (let i = 0; i < ranks.length; i++) {
        acc += weights[i]
        if (roll <= acc) {
          selectedRank = ranks[i]
          break
        }
      }

      const bandit = generateBandit(selectedRank)
      const cardId = `card_${Date.now()}_${Math.floor(Math.random() * 100000)}`
      const foundCalendarWeek = Math.floor((player.week + 1) / 2)

      addBanditCard({
        id: cardId,
        bandit,
        foundCalendarWeek,
        escalated: false,
      })

      addLog(`盗賊情報を入手（${selectedRank}）。一覧で対応できる`, 'warning')
    }

    const nextTurn = completedTurn + 1

    if (isKochouEvaluationTurn(nextTurn)) {
      setCurrentScreen('kochou-evaluation')
    } else if (isMonthlyProcessing(completedTurn)) {
      setCurrentScreen('monthly-report')
    } else {
      setCurrentScreen('main')
    }
  }

  const getEvaluation = () => {
    const evaluations = [
      '「よく励んでいるな。この調子だ」',
      '「なかなかやるではないか」',
      '「引き続き精進せよ」',
      '「よい働きだ」',
    ]
    return evaluations[Math.floor(Math.random() * evaluations.length)]
  }

  return (
    <div className="min-h-screen bg-sengoku-dark flex items-center justify-center p-10">
      <div className="max-w-2xl w-full bg-sengoku-dark border border-sengoku-border p-8">
        <h1 className="text-2xl font-bold text-sengoku-gold mb-6">
          {commandName} - 結果
        </h1>

        <div className="mb-6">
          <p className="text-sengoku-gray mb-4">
            あなたは{commandName}を行いました。
          </p>

          <div className="bg-sengoku-darker border border-sengoku-border p-4">
            <div className="text-sm space-y-2">
              {specialEvent && (
                <div className={`p-2 mb-2 border ${specialEvent.success === false ? 'border-red-500 bg-red-900 bg-opacity-20' : 'border-yellow-500 bg-yellow-900 bg-opacity-20'}`}>
                  {specialEvent.message}
                </div>
              )}
              <div>功績: +{actualMerit}{actualMerit !== command.merit && ` (通常: ${command.merit})`}</div>
              {command.expGain?.combat && (
                <div>武芸経験値: +{command.expGain.combat}</div>
              )}
              {command.expGain?.intelligence && (
                <div>知略経験値: +{command.expGain.intelligence}</div>
              )}

              {growthResults.length > 0 && (
                <div className="mt-3 pt-3 border-t border-sengoku-border">
                  {growthResults.map((result, i) => (
                    <div key={i} className="text-sengoku-success">
                      {result.stat}: {result.oldValue} → {result.newValue} ⬆
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-sengoku-gray">上司からの評価：</p>
          <p className="text-sengoku-gray italic">{getEvaluation()}</p>
        </div>

        <div className="text-center">
          <Button onClick={handleNext}>次へ</Button>
        </div>
      </div>
    </div>
  )
}
