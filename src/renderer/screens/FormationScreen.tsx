import React, { useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { Button } from '../components/Button'
import { Panel } from '../components/Panel'
import { FORMATION_SLOT_COUNT } from '../constants/game'
import type { FormationSlot, FormationUnitType } from '../types/game'

type SlotValue = '' | `${FormationUnitType}:${number}`

function parseSlotValue(v: SlotValue): FormationSlot | null {
    if (!v) return null
    const [type, idStr] = v.split(':')
    const id = Number(idStr)
    if (!type || !Number.isFinite(id)) return null
    return { type: type as FormationUnitType, id }
}

function toSlotValue(slot: FormationSlot | null): SlotValue {
    if (!slot) return ''
    return `${slot.type}:${slot.id}`
}

function uniqueFormation(formation: (FormationSlot | null)[]): (FormationSlot | null)[] {
    const seen = new Set<string>()
    return formation.map((s) => {
        if (!s) return null
        const key = `${s.type}:${s.id}`
        if (seen.has(key)) return null
        seen.add(key)
        return s
    })
}

export const FormationScreen: React.FC = () => {
    const { player, updatePlayer, setCurrentScreen } = useGameStore()

    const [formation, setFormation] = useState<(FormationSlot | null)[]>(() => {
        if (!player) return Array(FORMATION_SLOT_COUNT).fill(null)
        const base = Array.isArray(player.formation) ? [...player.formation] : []
        const resized = base.slice(0, FORMATION_SLOT_COUNT)
        while (resized.length < FORMATION_SLOT_COUNT) resized.push(null)
        return resized
    })

    const options = useMemo(() => {
        if (!player) return [] as { value: SlotValue; label: string }[]
        const list: { value: SlotValue; label: string }[] = []

        for (const j of player.juuboku) {
            list.push({ value: `juuboku:${j.id}`, label: `若党${j.id}` })
        }
        for (const a of player.loanedAshigaru) {
            list.push({ value: `loanedAshigaru:${a.id}`, label: `貸与足軽${a.id}` })
        }
        for (const a of player.ashigaru) {
            list.push({ value: `ashigaru:${a.id}`, label: `徒士${a.id}` })
        }

        return list
    }, [player])

    if (!player) return <div>Loading...</div>

    const canUse = player.rank !== '徒士'

    const handleAutoFill = () => {
        const next: (FormationSlot | null)[] = Array(FORMATION_SLOT_COUNT).fill(null)
        let idx = 0
        for (const j of player.juuboku) {
            if (idx >= next.length) break
            next[idx] = { type: 'juuboku', id: j.id }
            idx++
        }
        for (const a of player.loanedAshigaru) {
            if (idx >= next.length) break
            next[idx] = { type: 'loanedAshigaru', id: a.id }
            idx++
        }
        setFormation(uniqueFormation(next))
    }

    const handleSave = () => {
        const normalized = uniqueFormation(formation)
        updatePlayer({ ...player, formation: normalized })
        setCurrentScreen('main')
    }

    return (
        <div className="min-h-screen bg-sengoku-bg p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl text-sengoku-gold mb-6">編成</h1>

                {!canUse && (
                    <Panel className="mb-6">
                        <div className="text-sm text-sengoku-gray">徒士は編成を変更できません（馬上衆以上）</div>
                    </Panel>
                )}

                <Panel title="7スロット編成" className="mb-6">
                    <div className="space-y-2">
                        {Array.from({ length: FORMATION_SLOT_COUNT }, (_, idx) => {
                            const slot = formation[idx] ?? null
                            return (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className="w-12 text-xs text-sengoku-gray">枠{idx + 1}</div>
                                    <select
                                        className="flex-1 bg-sengoku-darker border border-sengoku-border px-2 py-1 text-sm"
                                        value={toSlotValue(slot)}
                                        onChange={(e) => {
                                            const next = [...formation]
                                            next[idx] = parseSlotValue(e.target.value as SlotValue)
                                            setFormation(next)
                                        }}
                                        disabled={!canUse}
                                    >
                                        <option value="">（未配置）</option>
                                        {options.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-4 text-xs text-sengoku-gray">
                        盗賊討伐などの戦闘で、この編成に入っている配下のみが戦闘に参加します。
                    </div>
                </Panel>

                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setCurrentScreen('main')} className="flex-1">
                        戻る
                    </Button>
                    <Button variant="secondary" onClick={handleAutoFill} className="flex-1" disabled={!canUse}>
                        自動編成
                    </Button>
                    <Button onClick={handleSave} className="flex-1" disabled={!canUse}>
                        保存
                    </Button>
                </div>
            </div>
        </div>
    )
}
