import { PlayerState, Rank } from '../types/game'
import {
    SALARY_RICE,
    RETAINER_RICE,
    LIVING_COST,
    HORSE_COST,
    RICE_PRICE,
    DEBT_LIMIT,
    INTEREST_RATE_BY_AMOUNT,
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

    // 若党の扶持米
    rice += player.juuboku.length * RETAINER_RICE.若党

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

/**
 * 借金上限を取得
 */
export function getDebtLimit(rank: Rank): number {
    return DEBT_LIMIT[rank]
}

/**
 * 金利を取得（借入額で変動）
 * 将来は商人との親密度で上限・金利が変動予定
 */
export function getInterestRate(amount: number): number {
    if (amount <= INTEREST_RATE_BY_AMOUNT.tier1.maxAmount) {
        return INTEREST_RATE_BY_AMOUNT.tier1.rate  // 50貫まで：月5%
    }
    return INTEREST_RATE_BY_AMOUNT.tier2.rate  // 100貫まで：月4%
}

/**
 * 借金を実行
 */
export function takeLoan(
    player: PlayerState,
    amount: number,
    monthlyRepayment: number
): { success: boolean; rate: number; message?: string } {
    const limit = getDebtLimit(player.rank)
    
    if (player.debt + amount > limit) {
        return { 
            success: false, 
            rate: 0, 
            message: `借金上限（${limit.toFixed(1)}貫）を超えています` 
        }
    }
    
    const rate = getInterestRate(player.debt + amount)
    
    player.debt += amount
    player.money += amount
    player.monthlyRepayment = monthlyRepayment
    player.interestRate = rate
    
    return { success: true, rate }
}

/**
 * 月次の利子計算と自動返済
 */
export function processMonthlyDebt(player: PlayerState): {
    interestAdded: number
    repaid: number
} {
    // 利子を加算
    const interestAdded = player.debt * player.interestRate
    player.debt += interestAdded
    
    // 設定された月額を返済
    const repayAmount = player.monthlyRepayment
    if (repayAmount > 0 && player.money >= repayAmount) {
        const actualRepay = Math.min(repayAmount, player.debt)
        player.money -= actualRepay
        player.debt -= actualRepay
        return { interestAdded, repaid: actualRepay }
    }
    
    return { interestAdded, repaid: 0 }
}
