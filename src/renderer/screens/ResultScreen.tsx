import React, { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { COMMANDS } from '../constants/game'
import { addExperience } from '../utils/experience'
import { isMonthlyProcessing } from '../utils/time'
import { CommandType } from '../types/game'

interface ResultScreenProps {
  commandName: CommandType
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ commandName }) => {
  const { player, addLog, advanceWeek, updatePlayer, setCurrentScreen } = useGameStore()
  const [growthResults, setGrowthResults] = useState<{ stat: string; oldValue: number; newValue: number }[]>([])

  useEffect(() => {
    if (!player) return

    const command = COMMANDS[commandName]
    const results: { stat: string; oldValue: number; newValue: number }[] = []
    let updatedPlayer = { ...player }

    // 功績付与（updatedPlayerに直接追加）
    updatedPlayer.merit += command.merit

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
    advanceWeek()
    addLog(`${commandName}を行った。功績+${command.merit}`, 'success')

    // 月次処理チェック
    if (isMonthlyProcessing(player.week + 1)) {
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
              <div>功績: +{command.merit}</div>
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
