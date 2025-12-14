import { GameTime } from '../types/game'

/**
 * 週数から年月週を計算
 * 引数の week は「ターン番号」として扱い、2ターン=1週で換算する。
 */
export function weekToDate(week: number): GameTime {
    // 実際のカレンダー上の「第何週目か」に変換（2ターン=1週）
    const calendarWeek = Math.ceil(week / 2)
    const year = 1575 + Math.floor((calendarWeek - 1) / 52)
    const weekOfYear = ((calendarWeek - 1) % 52) + 1
    const month = Math.floor((weekOfYear - 1) / 4) + 1
    const weekOfMonth = ((weekOfYear - 1) % 4) + 1

    return { week, year, month, weekOfMonth }
}

/**
 * 年月週を文字列に変換
 */
export function formatDate(time: GameTime): string {
    const half = time.week % 2 === 1 ? '前半' : '後半'
    return `${time.year}年${time.month}月${time.weekOfMonth}週目${half}`
}

/**
 * 小頭評定のタイミングかチェック
 * 1か月=8ターンのうち、1ターン目・5ターン目（=4ターン周期）でtrueとなる。
 */
export function isKochouEvaluationTurn(week: number): boolean {
    return week % 4 === 1
}

/**
 * 月次処理が必要かチェック（4週目の後）
 * 2ターン=1週とみなし、第4週の後半ターン（8ターンごと）でtrueとなる。
 */
export function isMonthlyProcessing(week: number): boolean {
    const calendarWeek = Math.ceil(week / 2)
    const isSecondHalf = week % 2 === 0
    return isSecondHalf && calendarWeek % 4 === 0
}

/**
 * ゲーム終了かチェック（3年 = 156週 = 312ターン）
 */
export function isGameEnd(week: number): boolean {
    return week > 312
}
