import { GameTime } from '../types/game'

/**
 * 週数から年月週を計算
 */
export function weekToDate(week: number): GameTime {
    const year = 1575 + Math.floor((week - 1) / 52)
    const weekOfYear = ((week - 1) % 52) + 1
    const month = Math.floor((weekOfYear - 1) / 4) + 1
    const weekOfMonth = ((weekOfYear - 1) % 4) + 1

    return { week, year, month, weekOfMonth }
}

/**
 * 年月週を文字列に変換
 */
export function formatDate(time: GameTime): string {
    return `${time.year}年${time.month}月${time.weekOfMonth}週目`
}

/**
 * 月次処理が必要かチェック
 */
export function isMonthlyProcessing(week: number): boolean {
    return week % 4 === 0
}

/**
 * ゲーム終了かチェック（3年 = 156週）
 */
export function isGameEnd(week: number): boolean {
    return week > 156
}
