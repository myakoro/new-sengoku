import { PlayerState, RivalState, Rank } from '../types/game'
import {
    SALARY_RICE,
    RETAINER_RICE,
    LIVING_COST,
    HORSE_COST,
    RICE_PRICE,
} from '../constants/game'

/**
 * 扶持米を取得
 */
export function getSalaryRice(rank: Rank): number {
    return SALARY_RICE[rank]
}

/**
 * 月次支出を計算
 */
export function calculateExpenses(player: PlayerState): {
    rice: number
    money: number
} {
    let rice = 0

    // 従僕の扶持米
    rice += player.juuboku.length * RETAINER_RICE.従僕

    // 徒士の扶持米
    rice += player.ashigaru.length * RETAINER_RICE.徒士

    // 馬上衆の扶持米
    rice += player.bashoShu.length * RETAINER_RICE.馬上衆

    // 生活費
    rice += LIVING_COST

    // 馬の維持費
    if (player.hasHorse) {
        rice += HORSE_COST
    }

    return { rice, money: 0 }
}

/**
 * 米を売却
 */
export function sellRice(amount: number): number {
    return amount * RICE_PRICE
}

/**
 * 米を購入（借金）
 */
export function buyRiceWithDebt(amount: number): number {
    return amount * RICE_PRICE
}

/**
 * 月次処理を実行
 */
export function processMonthly(
    player: PlayerState,
    sellChoice: 'all' | 'half' | 'none'
): {
    salaryRice: number
    expenses: { rice: number; money: number }
    soldRice: number
    gainedMoney: number
} {
    // 扶持米支給
    const salaryRice = getSalaryRice(player.rank)
    player.rice += salaryRice

    // 支出計算
    const expenses = calculateExpenses(player)

    // 米不足チェック
    if (player.rice < expenses.rice) {
        const shortage = expenses.rice - player.rice
        const cost = buyRiceWithDebt(shortage)
        player.debt += cost
        player.rice += shortage
    }

    // 支出
    player.rice -= expenses.rice
    player.money -= expenses.money

    // 米売却
    let soldRice = 0
    let gainedMoney = 0

    if (player.rice > 0) {
        if (sellChoice === 'all') {
            soldRice = player.rice
            gainedMoney = sellRice(soldRice)
            player.rice = 0
            player.money += gainedMoney
        } else if (sellChoice === 'half') {
            soldRice = player.rice * 0.5
            gainedMoney = sellRice(soldRice)
            player.rice -= soldRice
            player.money += gainedMoney
        }
    }

    return { salaryRice, expenses, soldRice, gainedMoney }
}

/**
 * 借金返済
 */
export function repayDebt(
    player: PlayerState,
    amount: number
): { repaid: number; remaining: number } {
    const repaid = Math.min(amount, player.debt, player.money)
    player.money -= repaid
    player.debt -= repaid

    return { repaid, remaining: player.debt }
}
