import React from 'react'
import { useGameStore } from './store/gameStore'
import { TitleScreen } from './screens/TitleScreen'
import { CharacterCreateScreen } from './screens/CharacterCreateScreen'
import { MainScreen } from './screens/MainScreen'
import { CommandSelectScreen } from './screens/CommandSelectScreen'
import { ResultScreen } from './screens/ResultScreen'
import { MonthlyReportScreen } from './screens/MonthlyReportScreen'
import { PromotionScreen } from './screens/PromotionScreen'
import { EndingScreen } from './screens/EndingScreen'
import { BanditMissionScreen } from './screens/BanditMissionScreen'

function App() {
    const currentScreen = useGameStore((state) => state.currentScreen)
    const selectedCommand = useGameStore((state) => state.selectedCommand)

    switch (currentScreen) {
        case 'title':
            return <TitleScreen />
        case 'character-create':
            return <CharacterCreateScreen />
        case 'main':
            return <MainScreen />
        case 'command-select':
            return <CommandSelectScreen />
        case 'result':
            return selectedCommand ? <ResultScreen commandName={selectedCommand} /> : <TitleScreen />
        case 'monthly-report':
            return <MonthlyReportScreen />
        case 'promotion':
            return <PromotionScreen newRank="馬上衆" />
        case 'ending':
            return <EndingScreen />
        case 'bandit-mission':
            return <BanditMissionScreen />
        default:
            return <TitleScreen />
    }
}

export default App
