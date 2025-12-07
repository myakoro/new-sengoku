# 戦国立身出世SLG Version 0.1 詳細設計書

**作成日：2025年12月7日**  
**バージョン：1.1**

> **参照ドキュメント**:
> - GDD_v1.1.md（正式仕様）
> - プロジェクト経緯サマリー.md（経緯参考、一部古い仕様あり）
> - Version0.1_画面設計書.md（UI/UX仕様）
>
> **注意**: プロジェクト経緯サマリーの経済数値（貫ベース）は古い仕様です。
> 本設計書およびGDD v1.1の「米ベース」の経済が正式仕様です。

---

## 目次

1. [概要](#1-概要)
2. [ゲームフロー](#2-ゲームフロー)
3. [データ構造](#3-データ構造)
4. [定数・初期値一覧](#4-定数初期値一覧)
5. [戦闘力計算](#5-戦闘力計算)
6. [武芸システム](#6-武芸システム)
7. [士気システム](#7-士気システム)
8. [盗賊システム](#8-盗賊システム)
9. [計略システム](#9-計略システム)
10. [主命システム](#10-主命システム)
11. [経済システム](#11-経済システム)
12. [出世システム](#12-出世システム)
13. [AIライバル](#13-aiライバル)
14. [実装仕様](#14-実装仕様)
15. [経済シミュレーション](#15-経済シミュレーション)
16. [テストプレイチェックリスト](#16-テストプレイチェックリスト)
17. [リリース基準](#17-リリース基準)
18. [付録](#18-付録)

---

## 1. 概要

### 1-1. Version 0.1の目標

```
目標：徒士→馬上衆→小頭（ゲーム内3年間）
プレイ時間：2〜3時間
ゴール：小頭到達でエンディング
```

### 1-2. スコープ

**実装するもの：**
- ✓ ターン制（1週=1ターン、年間52ターン）
- ✓ 公務選択（9種類）
- ✓ 功績累計システム
- ✓ 出世判定（徒士→馬上衆→小頭）
- ✓ 扶持米システム
- ✓ 借金システム
- ✓ 従僕システム（数値のみ、名前なし）
- ✓ AIライバル1名
- ✓ 月次評定（4週ごと）
- ✓ 盗賊討伐（計略含む）
- ✓ エンディング

**実装しないもの：**
- ✗ 知行地（Version 0.5以降）
- ✗ 軍役（Version 0.5以降）
- ✗ 農兵（Version 0.5以降）
- ✗ 戦闘詳細（Version 0.5以降）
- ✗ 私事（Version 0.5以降）
- ✗ 家臣団の名前・個性（Version 0.5以降）

---

### 1-3. プレイヤー初期状態

```javascript
const INITIAL_PLAYER_STATE = {
  name: "主人公",
  rank: "徒士",
  
  // ステータス（キャラメイクで決定）
  stats: {
    combat: 52,          // 才能上限の80%
    command: 40,
    intelligence: 52,
    administration: 56
  },
  
  potential: {
    combat: 65,          // 合計300
    command: 50,
    intelligence: 65,
    administration: 70
  },
  
  exp: {
    combat: 0,
    intelligence: 0
  },
  
  merit: 0,
  
  // 経済
  rice: 0.5,           // 初期米：0.5石（半月分の余剰）
  money: 10.0,         // 初期金：10貫
  debt: 0,
  
  // 従僕３名（武芸40〜60のランダム）
  juuboku: [
    { id: 1, combat: 40 + Math.floor(Math.random() * 21) },  // 40〜60
    { id: 2, combat: 40 + Math.floor(Math.random() * 21) },  // 40〜60
    { id: 3, combat: 40 + Math.floor(Math.random() * 21) }   // 40〜60
  ],
  
  ashigaru: [],
  bashoShu: [],
  hasHorse: false,
  
  week: 1,
  rankDEventShown: false,
  rankDEventAccepted: false
}
```

**初期戦力：**
```
主人公：52
従僕3名（平均20）：12
合計：64
```

---

## 2. ゲームフロー

### 2-1. 全体フロー

```
キャラメイク
  ↓
ゲーム開始（徒士、1週目）
  ↓
週次ループ（1〜156週）
  ├─ 週初め処理
  ├─ 主命選択
  ├─ 主命実行
  ├─ 結果表示
  ├─ 月次処理（4週ごと）
  └─ 次週へ
  ↓
小頭到達
  ↓
エンディング
```

---

### 2-2. キャラメイク

```
1. ステータス生成
   - 才能上限の合計：300
   - ランダム配分（各10〜100）
   - 現在値：上限の80%

2. 振り直し
   - 何度でも可能

3. 決定
   - ゲーム開始
```

**例：**
```
武芸：52 / 65
統率：40 / 50
知略：52 / 65
政務：56 / 70
合計：200 / 300
```

---

### 2-3. 週次ループ

```
┌─────────────────────┐
│ 週初め処理            │
├─────────────────────┤
│ ・週数カウント        │
│ ・ライバル行動        │
│ ・状況表示            │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ 主命選択              │
├─────────────────────┤
│ ・利用可能な主命表示  │
│ ・プレイヤーが選択    │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ 主命実行              │
├─────────────────────┤
│ ・1週完結型：即実行   │
│ ・複数週型：準備開始  │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ 結果表示              │
├─────────────────────┤
│ ・功績付与            │
│ ・報酬付与            │
│ ・経験値付与          │
│ ・ステータス成長      │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ 月次処理（4週ごと）   │
├─────────────────────┤
│ ・扶持米支給          │
│ ・支出処理            │
│ ・出世判定            │
│ ・評定                │
└─────────────────────┘
         ↓
┌─────────────────────┐
│ 次週へ                │
└─────────────────────┘
```

---

### 2-4. 月次処理の詳細

```javascript
function processMonthly(player, rival) {
  // === 第1フェーズ：収入 ===
  
  // 1. 扶持米支給
  const salaryRice = getSalaryRice(player.rank)
  player.rice += salaryRice
  
  showMessage(`扶持米 ${salaryRice}石を受け取りました`)
  
  // === 第2フェーズ：支出 ===
  
  // 2. 支出計算
  const expenses = calculateExpenses(player)
  
  if (player.rice < expenses.rice) {
    showMessage("⚠️ 米が不足しています！")
    // 不足分を借金で購入
    const shortage = expenses.rice - player.rice
    const cost = shortage * 1.0  // 米1石 = 1貫
    player.debt += cost
    player.rice += shortage
    showMessage(`不足分 ${shortage.toFixed(2)}石を借金で購入（${cost.toFixed(2)}貫）`)
  }
  
  player.rice -= expenses.rice
  player.money -= expenses.money
  
  showMessage(`支出：米${expenses.rice.toFixed(2)}石、金${expenses.money.toFixed(2)}貫`)
  
  // === 第3フェーズ：米の使い道 ===
  
  // 3. 米売却の選択
  if (player.rice > 0) {
    const sellChoice = await showChoice([
      `全て売却（${(player.rice * 1.0).toFixed(2)}貫獲得）`,
      `半分売却（${(player.rice * 0.5 * 1.0).toFixed(2)}貫獲得）`,
      `売却しない（備蓄）`
    ])
    
    if (sellChoice === 0) {
      // 全て売却
      const money = player.rice * 1.0
      player.money += money
      player.rice = 0
      showMessage(`米を売却：${money.toFixed(2)}貫獲得`)
    } else if (sellChoice === 1) {
      // 半分売却
      const sellRice = player.rice * 0.5
      const money = sellRice * 1.0
      player.money += money
      player.rice -= sellRice
      showMessage(`米を売却：${money.toFixed(2)}貫獲得、残り${player.rice.toFixed(2)}石`)
    }
  }
  
  // === 第4フェーズ：借金返済 ===
  
  // 4. 借金返済（任意）
  if (player.debt > 0 && player.money > 0) {
    const maxRepay = Math.min(player.debt, player.money)
    
    const repayChoice = await showChoice([
      `全額返済（${maxRepay.toFixed(2)}貫）`,
      `半分返済（${(maxRepay * 0.5).toFixed(2)}貫）`,
      `少額返済（1貫）`,
      `返済しない`
    ])
    
    let repayAmount = 0
    if (repayChoice === 0) {
      repayAmount = maxRepay
    } else if (repayChoice === 1) {
      repayAmount = maxRepay * 0.5
    } else if (repayChoice === 2) {
      repayAmount = Math.min(1.0, maxRepay)
    }
    
    if (repayAmount > 0) {
      player.money -= repayAmount
      player.debt -= repayAmount
      showMessage(`借金返済：${repayAmount.toFixed(2)}貫、残り${player.debt.toFixed(2)}貫`)
    }
  }
  
  // === 第5フェーズ：状況表示 ===
  
  showStatus(player)
  
  // === 第6フェーズ：出世判定 ===
  
  // 5. プレイヤー出世判定
  checkPromotion(player)
  
  // 6. ライバル出世判定
  checkPromotion(rival)
  adjustRivalMerit(player, rival)
  
  // === 第7フェーズ：評定 ===
  
  // 7. 評定
  showEvaluation(player, rival)
}
```

#### 状況表示

```javascript
function showStatus(player) {
  console.log(`
┌─────────────────────────────────┐
│【月次報告】                      │
├─────────────────────────────────┤
│ 功績：${player.merit}            │
│ 米：${player.rice.toFixed(2)}石  │
│ 金：${player.money.toFixed(2)}貫 │
│ 借金：${player.debt.toFixed(2)}貫│
└─────────────────────────────────┘
  `)
}
```

#### 評定内容

```javascript
function showEvaluation(player, rival) {
  const messages = []
  
  // 功績による評価
  if (player.merit >= 200) {
    messages.push("上司：「なかなか頑張っているな」")
  } else if (player.merit >= 100) {
    messages.push("上司：「まずまずだ」")
  } else {
    messages.push("上司：「もっと励め」")
  }
  
  // ライバルとの比較
  if (player.merit > rival.merit + 50) {
    messages.push("上司：「ライバルに差をつけているぞ」")
  } else if (player.merit < rival.merit - 50) {
    messages.push("上司：「ライバルに遅れを取っているぞ」")
  } else {
    messages.push("上司：「ライバルと互角だな」")
  }
  
  // 借金への言及
  if (player.debt > 30) {
    messages.push("上司：「借金が多いな。無理はするなよ」")
  }
  
  messages.forEach(msg => showMessage(msg))
  
  // ライバルの状況
  showMessage(`\n【ライバルの状況】`)
  showMessage(`役職：${rival.rank}`)
  showMessage(`功績：${rival.merit}`)
}
```

---

### 2-5. 出世判定

```javascript
function checkPromotion(player) {
  // 徒士→馬上衆
  if (player.rank === "徒士" && player.merit >= 250) {
    promoteToBashoShu(player)
    return
  }
  
  // 馬上衆→小頭（通常）
  if (player.rank === "馬上衆" && player.merit >= 500) {
    // 賊軍討伐イベント発生
    if (!player.rankDEventShown) {
      showRankDEvent(player)
      player.rankDEventShown = true
      return
    }
    
    // イベントを断った場合、功績600で昇進
    if (player.merit >= 600) {
      promoteToKogashira(player)
    }
  }
}
```

---

## 3. データ構造

### 3-1. プレイヤーデータ

```javascript
const player = {
  // 基本情報
  name: "主人公",
  rank: "徒士",  // "徒士" | "馬上衆" | "小頭"
  
  // ステータス
  stats: {
    combat: 52,           // 武芸（現在値）
    command: 40,          // 統率（現在値）
    intelligence: 52,     // 知略（現在値）
    administration: 56    // 政務（現在値）
  },
  
  // 才能上限
  potential: {
    combat: 65,
    command: 50,
    intelligence: 65,
    administration: 70
  },
  
  // 経験値
  exp: {
    combat: 0,
    intelligence: 0
    // Version 0.1では武芸と知略のみ
  },
  
  // 功績
  merit: 0,
  
  // 経済
  rice: 0,      // 米（石）
  money: 10,    // 金（貫）
  debt: 0,      // 借金（貫）
  
  // 従僕
  juuboku: [
    { id: 1, combat: 20 },
    { id: 2, combat: 18 },
    { id: 3, combat: 22 }
  ],
  
  // 家臣（Version 0.1では従僕以外なし）
  ashigaru: [],  // 徒士
  bashoShu: [],  // 馬上衆
  
  // 装備
  hasHorse: false,  // 馬の保有
  
  // フラグ
  week: 1,                  // 現在の週
  rankDEventShown: false,   // 賊軍イベント表示済み
  rankDEventAccepted: false // 賊軍イベント受諾
}
```

---

### 3-2. AIライバルデータ

```javascript
const rival = {
  name: "ライバル",
  rank: "徒士",
  merit: 0,
  
  stats: {
    combat: 45,
    command: 38,
    intelligence: 40,
    administration: 35
  },
  
  // AIの行動パターン
  behavior: "balanced",  // "safe" | "balanced" | "aggressive"
  
  // 経済
  rice: 0.5,           // プレイヤーと同じ初期米
  money: 10.0,
  debt: 0,
  
  // 家臣
  juuboku: [
    { id: 1, combat: 20 },
    { id: 2, combat: 18 },
    { id: 3, combat: 22 }
  ],
  ashigaru: [],
  bashoShu: [],
  hasHorse: false
}
```

---

### 3-3. AIライバルの行動ロジック

#### 行動パターン

```javascript
const AI_BEHAVIORS = {
  safe: {
    訓練: 0.4,
    巡察: 0.2,
    情報収集: 0.2,
    護衛任務: 0.1,
    "盗賊討伐（小規模）": 0.1
  },
  
  balanced: {
    訓練: 0.2,
    情報収集: 0.2,
    護衛任務: 0.2,
    "盗賊討伐（小規模）": 0.2,
    "盗賊討伐（中規模）": 0.2
  },
  
  aggressive: {
    訓練: 0.1,
    "盗賊討伐（中規模）": 0.3,
    "盗賊討伐（大規模）": 0.3,
    "盗賊討伐（討伐戦）": 0.3
  }
}
```

#### 主命選択ロジック

```javascript
function rivalSelectCommand(rival) {
  const pattern = AI_BEHAVIORS[rival.behavior]
  
  // 役職による制限
  let availableCommands = pattern
  if (rival.rank === "徒士") {
    delete availableCommands["盗賊討伐C"]
  }
  
  // 確率で選択
  const rand = Math.random()
  let cumulative = 0
  
  for (const [command, probability] of Object.entries(availableCommands)) {
    cumulative += probability
    if (rand < cumulative) {
      return command
    }
  }
  
  return "訓練"  // フォールバック
}
```

#### 出世ペース調整

```javascript
// ライバルの功績はプレイヤーの80〜120%の範囲で追従
function adjustRivalMerit(player, rival) {
  const targetMerit = player.merit * (0.8 + Math.random() * 0.4)
  const diff = targetMerit - rival.merit
  
  if (diff > 0) {
    // 追いつく
    rival.merit += Math.min(diff * 0.3, 10)
  } else if (diff < -50) {
    // 離されすぎないように
    rival.merit += 5
  }
}
```

---

### 3-4. 盗賊データ

```javascript
const bandit = {
  rank: "A",              // "S" | "A" | "B" | "C" | "D"
  count: 4,               // 人数
  baseCombatPower: 90,    // 基礎戦闘力
  morale: 40,             // 士気
  investigated: false,    // 偵察済み
  weakness: null,         // 弱点（"統率不足" | "装備不良" | "内部対立" | null）
  traitor: false,         // 内応者あり
  
  // 財産
  wealth: {
    rice: 0.12,
    money: 0.048
  },
  
  // ミッション状態
  timeLimit: 4,           // 期限（週）
  currentWeek: 1          // 現在週
}
```

---

### 3-5. ミッションデータ

```javascript
const mission = {
  type: "bandit_subjugation",  // ミッション種別
  rank: "A",                   // 盗賊ランク
  bandit: { /* 盗賊データ */ },
  timeLimit: 4,
  currentWeek: 1,
  
  // プレイヤーの準備
  additionalAshigaru: 0,       // 追加雇用した足軽
  strategies: []               // 実行済みの計略
}
```

---

## 4. 定数・初期値一覧

### 4-1. 初期値

```javascript
// プレイヤー初期状態
const INITIAL_PLAYER = {
  rank: "徒士",
  merit: 0,
  rice: 0.5,      // 初期米：0.5石（半月分の余剰）
  money: 10,      // 初期金：10貫
  debt: 0,
  hasHorse: false,
  week: 1
}

// 従僕初期生成
const INITIAL_JUUBOKU_COUNT = 3
const JUUBOKU_COMBAT_RANGE = [15, 25]  // 武芸15〜25

// キャラメイク
const CHAR_CREATE = {
  totalPotential: 300,      // 才能上限合計
  minPotential: 10,         // 各能力の最低上限
  maxPotential: 100,        // 各能力の最高上限
  initialRatio: 0.8         // 初期値は上限の80%
}
```

---

### 4-2. 経済定数

```javascript
// 扶持米（月額）
const SALARY_RICE = {
  徒士: 1.8,
  馬上衆: 3.5,
  小頭: 5.0
}

// 家臣の扶持米（月額）
const RETAINER_RICE = {
  従僕: 0.3,
  徒士: 1.8,
  馬上衆: 3.5,
  小頭: 5.0
}

// その他支出
const LIVING_COST = 0.15      // 生活費（月額）
const HORSE_COST = 0.3        // 馬維持費（月額）

// 借金（プレイヤーが任意で借りる場合の参考費用）
const TYPICAL_COSTS = {
  馬購入: 30,           // 馬上衆昇進時に推奨
  徒士雇用: 10          // 馬上衆昇進時に推奨
}

// 借金上限（GDD準拠）
const DEBT_LIMIT = {
  徒士: 10,
  馬上衆: 50,
  小頭: 100
  // 組頭以降：無制限（Version 0.5以降）
}
```

---

### 4-3. 出世条件

```javascript
const PROMOTION = {
  徒士_to_馬上衆: {
    merit: 250,
    minCombat: 40
  },
  馬上衆_to_小頭_イベント: {
    merit: 500
  },
  馬上衆_to_小頭_通常: {
    merit: 600,
    minCombat: 50
  }
}
```

---

### 4-4. 昇進時のステータス成長

```javascript
const PROMOTION_BONUS = {
  徒士_to_馬上衆: {
    combat: 15,
    command: 10,
    intelligence: 10,
    administration: 10
  },
  馬上衆_to_小頭: {
    combat: 15,
    command: 15,
    intelligence: 10,
    administration: 10
  }
}
```

---

### 4-5. 経験値

```javascript
// 経験値獲得量
const EXP_GAIN = {
  訓練: { combat: 5 },
  盗賊討伐成功: { combat: 20 },
  偵察成功: { intelligence: 15 },
  偵察失敗: { intelligence: 5 },
  計略成功: { intelligence: 20 },
  計略失敗: { intelligence: 10 },
  情報収集: { intelligence: 10 }
}

// 必要経験値計算
// base=100、levelPenalty=現在値×10、potentialPenalty=(現在値/上限)×300
```

---

### 4-6. 戦闘関連

```javascript
// 戦闘成功率
const COMBAT_SUCCESS_RATE = {
  base: 50,
  diffMultiplier: 0.3,
  min: 5,
  max: 95
}

// 夜襲
const NIGHT_RAID = {
  successPenalty: -10,    // 基礎成功率-10%
  moraleDecrease: -20     // 敵士気-20
}
```

---

## 5. 戦闘力計算

### 5-1. プレイヤー側戦闘力

```javascript
// 盗賊討伐・護衛任務など個人戦闘時の戦力計算
// ※戦争時は従僕の係数が0.2になる（Version 0.5以降）
function calculatePlayerCombatPower(player) {
  let power = 0
  
  // 主人公の武芸
  power += player.stats.combat
  
  // 従僕の戦闘力（100%）
  for (const juuboku of player.juuboku) {
    power += juuboku.combat
  }
  
  // 徒士の戦闘力（100%）
  for (const ashigaru of player.ashigaru) {
    power += ashigaru.combat
  }
  
  // 馬上衆の戦闘力（100%）
  for (const bashoShu of player.bashoShu) {
    power += bashoShu.combat
  }
  
  return Math.floor(power)
}
```

**例：徒士期（従僕3名）**
```
主人公：52
従僕3名（48、53、45 → 平均50）：150
合計：202
```

**例：馬上衆期（従僕2名、徒士1名）**
```
主人公：67
従僕2名（50、48）：98
徒士1名（35）：35
合計：200
```

---

### 5-2. 敵戦闘力

```javascript
function calculateEnemyCombatPower(enemy) {
  let power = enemy.baseCombatPower
  let multiplier = 1.0
  
  // 士気補正
  multiplier *= getMoraleMultiplier(enemy.morale)
  
  // 内応者補正
  if (enemy.traitor) {
    multiplier *= 0.9
  }
  
  // 弱点「装備不良」
  if (enemy.weakness === "装備不良") {
    multiplier *= 0.95
  }
  
  return Math.floor(power * multiplier)
}
```

---

### 5-3. 戦闘成功率

```javascript
function calculateBattleSuccessRate(playerPower, enemyPower) {
  const diff = playerPower - enemyPower
  const rate = 50 + diff * 0.3
  
  return Math.max(5, Math.min(95, rate))
}
```

**例：**
```
自家：64
敵：85
差：-21
成功率：50 + (-21 × 0.3) = 43.7%
```

---

### 5-4. 上司の支援（賊軍討伐のみ）

```javascript
// 賊軍討伐時、足軽10名の支援
const BOSS_SUPPORT = {
  ashigaru: 10,
  averageCombat: 35,
  totalPower: 350
}

function calculateRankDCombatPower(player) {
  const playerPower = calculatePlayerCombatPower(player)
  const supportPower = BOSS_SUPPORT.totalPower
  
  return playerPower + supportPower
}
```

---

## 6. 武芸システム

### 4-1. 武芸の段階

```
11〜20：一般人
21〜30：農兵レベル
31〜40：訓練された足軽レベル
41〜60：武士の基礎レベル
61〜70：手練れ
71〜80：猛者
81〜90：豪傑
91〜100：英傑
```

**重要：役職とは無関係**

---

### 4-2. 武芸の成長

```javascript
function gainExp(player, type, amount) {
  player.exp[type] += amount
  
  // レベルアップ判定（ループ）
  while (true) {
    // 才能上限チェック
    if (player.stats[type] >= player.potential[type]) {
      showMessage(`${type}は才能の上限に達しています`)
      player.exp[type] = 0
      break
    }
    
    // 必要経験値計算
    const needed = calculateExpNeeded(
      player.stats[type], 
      player.potential[type]
    )
    
    if (player.exp[type] >= needed) {
      // レベルアップ
      player.exp[type] -= needed
      player.stats[type] += 1
      
      showLevelUpMessage(type, player.stats[type])
    } else {
      break
    }
  }
}

function calculateExpNeeded(current, potential) {
  const base = 100
  const levelPenalty = current * 10
  const ratio = current / potential
  const potentialPenalty = Math.floor(base * ratio * 3)
  
  return base + levelPenalty + potentialPenalty
}
```

---

### 4-3. 経験値獲得機会

```
【武芸】
訓練：+5
盗賊討伐成功：+20

【知略】
偵察成功：+15
偵察失敗：+5
計略成功：+20
計略失敗：+10

【政務】（Version 0.5以降）
検地補助：+5
普請補助：+5

【統率】（Version 0.5以降）
小規模合戦：+10
```

---

## 5. 士気システム

### 5-1. 士気の影響

```javascript
function getMoraleMultiplier(morale) {
  if (morale >= 80) return 1.05   // +5%
  if (morale >= 60) return 1.0    // ±0%
  if (morale >= 40) return 0.90   // -10%
  if (morale >= 25) return 0.80   // -20%
  if (morale >= 10) return 0.65   // -35%
  return 0.40                      // -60%
}
```

---

### 5-2. 士気の変化

```javascript
// 偽情報
morale -= 15  // 通常
morale -= 30  // 弱点「統率不足」時

// 夜襲
morale -= 20
```

---

## 6. 盗賊システム

### 6-0. 戦闘力計算の詳細

#### 自家戦力の計算

```javascript
// 盗賊討伐・護衛任務など個人戦闘時の戦力計算
// ※戦争時は従僕の係数が0.2になる（Version 0.5以降）
function calculatePlayerCombatPower(player) {
  let power = 0
  
  // 主人公の武芸
  power += player.stats.combat
  
  // 従僕の戦力（武芸100%）
  player.juuboku.forEach(j => {
    power += j.combat
  })
  
  // 徒士の戦力（武芸100%）
  player.ashigaru.forEach(a => {
    power += a.combat
  })
  
  // 馬上衆の戦力（武芸100%）
  player.bashoShu.forEach(b => {
    power += b.combat
  })
  
  return Math.floor(power)
}
```

**例：徒士（初期状態）**
```
主人公：52
従僕3名（48、53、45）：146
徒士：0
馬上衆：0

合計：198
```

**例：馬上衆**
```
主人公：67
従僕2名（50、48）：98
徒士1名（武芸35）：35
馬上衆：0

合計：200
```

**例：小頭**
```
主人公：82
従僕1名（武芸50）：50
徒士2名（平均40）：80
馬上衆：0

合計：212
```

#### 上司支援の計算

賊軍討伐（ランクD）では上司から足軽10名の支援：

```javascript
const bossSupportPower = 35 * 10 = 350
```

**賊軍討伐時の合計戦力：**
```
小頭：166
上司支援：350
合計：516
```

---

### 6-1. ランク分類

```javascript
const BANDIT_RANKS = {
  S: {
    name: "犯罪者",
    count: [1, 2],
    combatRange: [15, 50],
    morale: [30, 40],
    ricePerBandit: [0.01, 0.02],
    moneyRatio: 0.3,
    bossReward: { rice: 0.05, money: 0.025 },
    merit: 15,
    timeLimit: 2
  },
  
  A: {
    name: "小規模盗賊団",
    count: [3, 5],
    combatRange: [70, 110],
    morale: [35, 45],
    ricePerBandit: [0.03, 0.06],
    moneyRatio: 0.4,
    bossReward: { rice: 0.075, money: 0.05 },
    merit: 30,
    timeLimit: 4
  },
  
  B: {
    name: "中規模盗賊団",
    count: [6, 10],
    combatRange: [150, 250],
    morale: [40, 50],
    ricePerBandit: [0.05, 0.08],
    moneyRatio: 0.5,
    bossReward: { rice: 0.125, money: 0.075 },
    merit: 40,
    timeLimit: 4
  },
  
  C: {
    name: "大規模盗賊団",
    count: [11, 15],
    combatRange: [300, 450],
    morale: [45, 55],
    ricePerBandit: [0.08, 0.12],
    moneyRatio: 0.6,
    bossReward: { rice: 0.25, money: 0.125 },
    merit: 60,
    timeLimit: 4
  },
  
  D: {
    name: "賊軍",
    count: [20, 25],
    baseCombat: 800,
    morale: [40, 50],
    ricePerBandit: [0.12, 0.18],
    moneyRatio: 0.7,
    bossReward: { rice: 0.75, money: 0.5 },
    bossSupport: { ashigaru: 10, combatPower: 350 },
    merit: 80,
    timeLimit: 8
  }
}
```

---

### 6-2. 盗賊生成

```javascript
function generateBandit(rank) {
  const config = BANDIT_RANKS[rank]
  
  // 人数
  const count = config.count[0] + 
    Math.floor(Math.random() * (config.count[1] - config.count[0] + 1))
  
  // 戦闘力
  let baseCombatPower
  if (rank === "D") {
    baseCombatPower = config.baseCombat
  } else {
    baseCombatPower = config.combatRange[0] + 
      Math.random() * (config.combatRange[1] - config.combatRange[0])
  }
  
  // 士気
  const morale = config.morale[0] + 
    Math.floor(Math.random() * (config.morale[1] - config.morale[0] + 1))
  
  // 財産
  const ricePerBandit = config.ricePerBandit[0] + 
    Math.random() * (config.ricePerBandit[1] - config.ricePerBandit[0])
  const totalRice = count * ricePerBandit
  const totalMoney = totalRice * config.moneyRatio
  
  return {
    rank,
    count,
    baseCombatPower,
    morale,
    supply: 60,  // 初期兵糧
    investigated: false,
    weakness: null,
    traitor: false,
    wealth: {
      rice: totalRice,
      money: totalMoney
    }
  }
}
```

---

### 6-3. 戦闘力計算

```javascript
function calculateEnemyCombatPower(enemy) {
  let power = enemy.baseCombatPower
  let multiplier = 1.0
  
  // 士気補正
  multiplier *= getMoraleMultiplier(enemy.morale)
  
  // 内応者補正
  if (enemy.traitor) {
    multiplier *= 0.9  // -10%
  }
  
  // 弱点「装備不良」
  if (enemy.weakness === "装備不良") {
    multiplier *= 0.95  // -5%
  }
  
  return Math.floor(power * multiplier)
}
```

---

### 6-4. 戦利品計算

```javascript
function calculateBanditReward(rank, banditCount) {
  const config = BANDIT_RANKS[rank]
  
  // 盗賊の財産
  const banditWealth = generateBanditWealth(rank, banditCount)
  
  // プレイヤーの取り分（半分）
  const loot = {
    rice: banditWealth.rice * 0.5,
    money: banditWealth.money * 0.5
  }
  
  // 上司からの報酬
  const bossReward = config.bossReward
  
  // 合計
  const total = {
    rice: loot.rice + bossReward.rice,
    money: loot.money + bossReward.money
  }
  
  return {
    merit: config.merit,
    banditWealth,
    loot,
    bossReward,
    total
  }
}
```

---

### 6-5. 盗賊討伐ミッションの詳細フロー

#### 画面表示仕様

```typescript
interface BanditMissionDisplay {
  // ヘッダー情報
  missionName: string       // "盗賊討伐（中規模）"
  enemyCount: string        // "3〜5名"
  rewardMerit: number       // 30
  
  // 日時表示
  currentDate: string       // "1575年4月2週目"
  deadline: string          // "1575年4月4週目まで"
  currentWeek: number       // 2
  totalWeeks: number        // 4
  phase: "準備期間" | "最終週"
  
  // 行動ログ
  actionLog: ActionLogEntry[]
}

interface ActionLogEntry {
  week: number | "開始"     // 行動した週
  actionName: string        // "偵察", "足軽雇用", "任務開始"
  result: "成功" | "失敗" | "―"
  detail: string            // "敵の詳細情報を入手。人数4名、戦闘力85と判明。"
}
```

#### 行動ログの表示例

```
[第2週] 偵察     [成功] 敵の詳細情報を入手。人数4名、戦闘力85と判明。
[第1週] 足軽雇用 [成功] 足軽5名を雇用。戦力+160。
[開始]  任務開始 [―]   盗賊討伐（中規模）を開始。期限: 4週間後。
```

#### 週ごとの行動選択肢

```
第1〜3週（準備期間）：
├─ 偵察
├─ 偽情報
├─ 内応者買収
├─ 足軽を雇う
└─ 様子を見る

第4週（最終週）：
├─ 通常攻撃
├─ 夜襲
└─ 諦める

※ランクD（賊軍）は第1〜7週が準備期間、第8週が最終週
```

#### ミッション実行フロー

```javascript
function executeBanditMissionWeek(mission, player, action) {
  mission.currentWeek += 1
  
  // 最終週チェック
  const isFinalWeek = mission.currentWeek === mission.timeLimit
  
  if (isFinalWeek) {
    // 攻撃のみ選択可能
    if (action === "通常攻撃" || action === "夜襲") {
      return executeBattle(mission, player, action)
    } else if (action === "諦める") {
      return abandonMission(mission, player)
    }
  } else {
    // 準備行動
    switch (action) {
      case "偵察":
        return executeStrategy("偵察", player, mission.bandit)
      case "偽情報":
        return executeStrategy("偽情報", player, mission.bandit)
      case "内応者買収":
        return executeStrategy("内応者買収", player, mission.bandit)
      case "足軽を雇う":
        return hireAshigaru(player, mission)
      case "様子を見る":
        return { success: true, message: "様子を見た" }
    }
  }
}
```

#### 戦闘実行

```javascript
function executeBattle(mission, player, attackType) {
  const playerPower = calculatePlayerCombatPower(player)
  
  // ランクDなら上司支援を追加
  if (mission.rank === "D") {
    playerPower += 350  // 足軽10名
  }
  
  // 夜襲の場合、敵の士気を下げる
  if (attackType === "夜襲") {
    mission.bandit.morale -= 20
  }
  
  const enemyPower = calculateEnemyCombatPower(mission.bandit)
  
  // 成功率計算
  let successRate = 50 + (playerPower - enemyPower) * 0.3
  
  // 夜襲ペナルティ
  if (attackType === "夜襲") {
    successRate -= 10
  }
  
  // 上限95%、下限5%
  successRate = Math.max(5, Math.min(95, successRate))
  
  // 判定
  const success = Math.random() * 100 < successRate
  
  if (success) {
    // 成功
    const reward = calculateBanditReward(mission.rank, mission.bandit.count)
    player.merit += reward.merit
    player.rice += reward.total.rice
    player.money += reward.total.money
    
    // 経験値
    gainExp(player, "combat", 20)
    
    // ランクDなら即座に小頭昇進
    if (mission.rank === "D") {
      promoteToKogashira(player)
    }
    
    return { 
      success: true, 
      reward,
      message: "討伐成功！"
    }
  } else {
    // 失敗
    const config = BANDIT_RANKS[mission.rank]
    player.merit += Math.floor(config.merit * 0.3)
    
    return { 
      success: false,
      message: "討伐失敗..." 
    }
  }
}
```

#### 足軽雇用

```javascript
function hireAshigaru(player, mission) {
  const choices = [
    { count: 5, cost: 0.5 },
    { count: 10, cost: 1.0 },
    { count: 15, cost: 1.5 }
  ]
  
  const choice = await showChoice(choices)
  
  if (player.money < choice.cost) {
    return { success: false, message: "金が足りません" }
  }
  
  player.money -= choice.cost
  mission.additionalAshigaru += choice.count
  
  return { 
    success: true,
    message: `足軽${choice.count}名を雇いました` 
  }
}
```

---

### 8-4. 弱点システム

```javascript
// 弱点の種類と効果
const WEAKNESS_TYPES = {
  統率不足: {
    name: "統率不足",
    effect: "偽情報の効果2倍（-15 → -30）",
    probability: 0.4  // 40%
  },
  装備不良: {
    name: "装備不良",
    effect: "戦闘力-5%",
    probability: 0.3  // 30%
  },
  内部対立: {
    name: "内部対立",
    effect: "内応者買収の成功率+30%",
    probability: 0.3  // 30%
  }
}

function generateWeakness() {
  const rand = Math.random()
  
  if (rand < 0.4) return "統率不足"
  if (rand < 0.7) return "装備不良"
  return "内部対立"
}
```

---

### 8-5. 盗賊討伐ミッションの詳細フロー

```javascript
// 盗賊討伐ミッションの状態
const banditMission = {
  type: "bandit_subjugation",
  rank: "A",
  bandit: { /* 盗賊データ */ },
  timeLimit: 4,        // 期限（週）
  currentWeek: 1,      // 現在週
  
  // プレイヤーの行動
  strategies: [],      // 実行済み計略
  additionalAshigaru: 0,  // 追加足軽
  additionalMoney: 0   // 追加費用
}

// 週ごとの選択肢
function getBanditMissionActions(mission) {
  const actions = []
  
  // 計略
  if (mission.currentWeek < mission.timeLimit) {
    actions.push("偵察", "偽情報", "内応者買収")
  }
  
  // 足軽雇用（準備期間のみ）
  if (mission.currentWeek < mission.timeLimit) {
    actions.push("足軽雇用")
  }
  
  // 攻撃（最終週 or 準備完了）
  if (mission.currentWeek === mission.timeLimit || playerReady) {
    actions.push("通常攻撃", "夜襲")
  }
  
  // 諦める
  actions.push("諦める")
  
  return actions
}
```

**フロー例（ランクA、4週）：**

```
【第1週】
選択肢：偵察 / 偽情報 / 内応者買収 / 足軽雇用 / 諦める
→ 偵察を選択
→ 弱点「統率不足」判明

【第2週】
選択肢：偵察 / 偽情報 / 内応者買収 / 足軽雇用 / 諦める
→ 偽情報を選択
→ 士気40 → 10（-30、弱点効果）

【第3週】
選択肢：偵察 / 偽情報 / 内応者買収 / 足軽雇用 / 諦める
→ 内応者買収を選択
→ 成功、戦闘力-10%

【第4週】（最終週）
選択肢：通常攻撃 / 夜襲 / 諦める
→ 通常攻撃を選択
→ 戦闘判定
→ 成功 or 失敗
```

---

### 8-6. 足軽の追加雇用

```javascript
// 足軽の臨時雇用
const TEMP_ASHIGARU = {
  combat: 32,          // 戦闘力
  cost: 0.1,           // 1名あたり0.1貫
  maxCount: 20         // 最大20名まで
}

function hireTemporaryAshigaru(count) {
  const cost = count * TEMP_ASHIGARU.cost
  
  if (player.money < cost) {
    return { success: false, message: "金が足りません" }
  }
  
  player.money -= cost
  mission.additionalAshigaru += count
  
  return { 
    success: true, 
    count, 
    cost,
    totalPower: count * TEMP_ASHIGARU.combat 
  }
}
```

---

## 9. 計略システム

### 7-1. 計略の種類

```javascript
const STRATEGIES = {
  偵察: {
    name: "偵察",
    difficulty: 50,
    effect: "弱点発見",
    cost: 0,
    expGain: { intelligence: 15 }
  },
  
  偽情報: {
    name: "偽情報",
    difficulty: 40,
    effect: "士気-15（弱点時-30）",
    cost: 0,
    expGain: { intelligence: 20 }
  },
  
  内応者買収: {
    name: "内応者買収",
    difficulty: 70,
    effect: "戦闘力-10%",
    cost: 0.3,
    expGain: { intelligence: 20 }
  }
}
```

---

### 7-2. 成功率計算

```javascript
function calculateStrategySuccessRate(strategy, player, enemy) {
  const difficulty = STRATEGIES[strategy].difficulty
  
  // ステータス補正
  const statBonus = Math.floor(player.stats.intelligence * 0.7)
  
  // 基礎成功率
  let rate = 100 - difficulty + statBonus
  
  // 偵察済みボーナス
  if (enemy.investigated) {
    rate += 20
  }
  
  // 弱点ボーナス
  if (hasWeakPointAdvantage(strategy, enemy.weakness)) {
    rate += 30
  }
  
  // 上限95%、下限5%
  return Math.max(5, Math.min(95, rate))
}
```

---

### 7-3. 計略の実行

```javascript
function executeStrategy(strategy, player, enemy) {
  const successRate = calculateStrategySuccessRate(strategy, player, enemy)
  const success = Math.random() * 100 < successRate
  
  if (success) {
    // 成功
    applyStrategyEffect(strategy, enemy)
    gainExp(player, "intelligence", STRATEGIES[strategy].expGain.intelligence)
    
    // 費用
    if (STRATEGIES[strategy].cost > 0) {
      player.money -= STRATEGIES[strategy].cost
    }
    
    return { success: true }
  } else {
    // 失敗
    gainExp(player, "intelligence", STRATEGIES[strategy].expGain.intelligence / 2)
    return { success: false }
  }
}

function applyStrategyEffect(strategy, enemy) {
  switch (strategy) {
    case "偵察":
      enemy.investigated = true
      enemy.weakness = generateWeakness()  // "統率不足" | "装備不良" | "内部対立"
      break
      
    case "偽情報":
      const decrease = enemy.weakness === "統率不足" ? 30 : 15
      enemy.morale -= decrease
      break
      
    case "内応者買収":
      enemy.traitor = true
      break
  }
}
```

---

## 8. 主命システム

### 8-1. 主命一覧

```javascript
const COMMANDS = {
  訓練: {
    name: "訓練",
    duration: 1,
    merit: 5,
    reward: { rice: 0, money: 0 },
    expGain: { combat: 5 },
    risk: 0
  },
  
  巡察: {
    name: "巡察",
    duration: 1,
    merit: 3,
    reward: { rice: 0, money: 0 },
    encounterRate: 0.2,  // 20%で盗賊遭遇
    encounterBonus: {
      merit: 3,
      reward: { rice: 0.11, money: 0.055 }
    }
  },
  
  情報収集: {
    name: "情報収集",
    duration: 1,
    merit: 12,
    reward: { rice: 0, money: 0.1 },
    expGain: { intelligence: 10 },
    successRate: "60% + 知略×0.7",
    onFail: {
      merit: 6,
      reward: { rice: 0, money: 0 }
    }
  },
  
  護衛任務: {
    name: "護衛任務",
    duration: 1,
    merit: 8,
    reward: { rice: 0.1, money: 0.05 },
    attackRate: 0.1,  // 10%で襲撃
    attackBonus: {
      merit: 8,
      reward: { rice: 0.1, money: 0.05 }
    }
  },
  
  // 物資輸送はVersion 0.5以降に延期（護衛任務と類似、優先度低）
  
  "盗賊討伐（小規模）": {
    name: "盗賊討伐（小規模）",
    duration: 2,
    banditRank: "S",
    merit: 15
  },
  
  "盗賊討伐（中規模）": {
    name: "盗賊討伐（中規模）",
    duration: 4,
    banditRank: "A",
    merit: 30
  },
  
  "盗賊討伐（大規模）": {
    name: "盗賊討伐（大規模）",
    duration: 4,
    banditRank: "B",
    merit: 40,
    requireRank: "馬上衆"  // 馬上衆以上のみ
  },
  
  "盗賊討伐（討伐戦）": {
    name: "盗賊討伐（討伐戦）",
    duration: 4,
    banditRank: "C",
    merit: 60,
    requireRank: "馬上衆"
  },
  
  "盗賊討伐（賊軍）": {
    name: "盗賊討伐（賊軍）",
    duration: 8,
    banditRank: "D",
    merit: 80,
    special: "小頭昇進イベント"
  }
}
```

---

### 8-2. 主命実行

```javascript
function executeCommand(command, player) {
  const config = COMMANDS[command]
  
  // 1週完結型
  if (config.duration === 1) {
    return executeOneWeekCommand(command, player)
  }
  
  // 盗賊討伐
  if (command.startsWith("盗賊討伐")) {
    return startBanditMission(config.banditRank, player)
  }
}

function executeOneWeekCommand(command, player) {
  const config = COMMANDS[command]
  
  // 訓練
  if (command === "訓練") {
    player.merit += config.merit
    gainExp(player, "combat", config.expGain.combat)
    return { success: true }
  }
  
  // 巡察
  if (command === "巡察") {
    player.merit += config.merit
    
    // 20%で盗賊遭遇
    if (Math.random() < config.encounterRate) {
      return handleBanditEncounter(player)
    }
    
    return { success: true }
  }
  
  // 情報収集
  if (command === "情報収集") {
    const successRate = 60 + player.stats.intelligence * 0.7
    const success = Math.random() * 100 < successRate
    
    if (success) {
      player.merit += config.merit
      player.money += config.reward.money
      gainExp(player, "intelligence", config.expGain.intelligence)
      return { success: true }
    } else {
      player.merit += config.onFail.merit
      gainExp(player, "intelligence", config.expGain.intelligence / 2)
      return { success: false }
    }
  }
  
  // 護衛任務・物資輸送
  if (command === "護衛任務" || command === "物資輸送") {
    player.merit += config.merit
    player.rice += config.reward.rice
    player.money += config.reward.money
    
    // 襲撃判定
    if (Math.random() < config.attackRate) {
      return handleAttack(command, player)
    }
    
    return { success: true }
  }
}

// 巡察での盗賊遭遇
function handleBanditEncounter(player) {
  const bandit = generateBandit("S")  // 2〜3名
  
  showMessage("盗賊を発見しました！")
  
  const choice = await showChoice([
    "討伐する",
    "見逃す"
  ])
  
  if (choice === 0) {
    // 討伐
    const playerPower = calculatePlayerCombatPower(player)
    const enemyPower = calculateEnemyCombatPower(bandit)
    const successRate = Math.max(5, Math.min(95, 50 + (playerPower - enemyPower) * 0.3))
    
    const success = Math.random() * 100 < successRate
    
    if (success) {
      // 成功
      const reward = calculateBanditReward("S", bandit.count)
      player.merit += 3  // ボーナス功績
      player.rice += 0.11
      player.money += 0.055
      gainExp(player, "combat", 10)
      
      return { 
        success: true,
        bonus: true,
        message: "討伐成功！追加功績を得ました"
      }
    } else {
      // 失敗
      return { 
        success: false,
        message: "討伐失敗...負傷しました" 
      }
    }
  } else {
    // 見逃す
    return { success: true }
  }
}

// 護衛任務・物資輸送の襲撃
function handleAttack(command, player) {
  const config = COMMANDS[command]
  
  // 襲撃者生成
  const banditCount = command === "護衛任務" ? 
    3 + Math.floor(Math.random() * 3) :  // 3〜5名
    4 + Math.floor(Math.random() * 3)    // 4〜6名
  
  const bandit = {
    count: banditCount,
    baseCombatPower: banditCount * 20,
    morale: 40
  }
  
  showMessage(`盗賊${banditCount}名の襲撃を受けました！`)
  
  // 戦闘
  const playerPower = calculatePlayerCombatPower(player)
  const enemyPower = calculateEnemyCombatPower(bandit)
  const successRate = Math.max(5, Math.min(95, 50 + (playerPower - enemyPower) * 0.3))
  
  const success = Math.random() * 100 < successRate
  
  if (success) {
    // 撃退成功
    player.merit += config.attackBonus.merit
    player.rice += config.attackBonus.reward.rice
    player.money += config.attackBonus.reward.money
    gainExp(player, "combat", 15)
    
    return { 
      success: true,
      message: "襲撃を撃退しました！上司から褒賞を受けました"
    }
  } else {
    // 撃退失敗
    const failMerit = command === "護衛任務" ? 4 : 5
    player.merit += failMerit
    
    if (command === "物資輸送") {
      showMessage("物資の一部を失いました")
    }
    
    return { 
      success: false,
      message: "襲撃を退けきれませんでした..." 
    }
  }
}
```

---

### 10-3. 襲撃イベント処理

#### 巡察での盗賊遭遇

```javascript
function handleBanditEncounter(player) {
  // 盗賊2〜3名生成
  const banditCount = 2 + Math.floor(Math.random() * 2)
  const bandit = {
    count: banditCount,
    baseCombatPower: banditCount * 17.5,  // 1人あたり17.5
    morale: 30
  }
  
  // 戦闘力計算
  const playerPower = calculatePlayerCombatPower(player)
  const enemyPower = calculateEnemyCombatPower(bandit)
  const successRate = calculateBattleSuccessRate(playerPower, enemyPower)
  
  // 選択肢表示
  const choice = showChoice([
    `討伐する（成功率${successRate}%）`,
    "見逃す"
  ])
  
  if (choice === "討伐する") {
    const success = Math.random() * 100 < successRate
    
    if (success) {
      // 成功
      player.merit += 3
      player.rice += 0.11
      player.money += 0.055
      gainExp(player, "combat", 20)
      
      return {
        success: true,
        message: `盗賊${banditCount}名を討ち取った！`,
        merit: 3,
        reward: { rice: 0.11, money: 0.055 }
      }
    } else {
      // 失敗
      return {
        success: false,
        message: "討伐に失敗した",
        penalty: "負傷リスク"
      }
    }
  } else {
    // 見逃す
    return {
      success: true,
      message: "見逃した"
    }
  }
}
```

---

#### 護衛任務・物資輸送の襲撃

```javascript
function handleAttack(command, player) {
  const config = COMMANDS[command]
  
  // 盗賊生成
  let banditCount
  if (command === "護衛任務") {
    banditCount = 3 + Math.floor(Math.random() * 3)  // 3〜5名
  } else {
    banditCount = 4 + Math.floor(Math.random() * 3)  // 4〜6名
  }
  
  const bandit = {
    count: banditCount,
    baseCombatPower: banditCount * 20,
    morale: 35
  }
  
  // 戦闘力計算
  const playerPower = calculatePlayerCombatPower(player)
  const enemyPower = calculateEnemyCombatPower(bandit)
  const successRate = calculateBattleSuccessRate(playerPower, enemyPower)
  
  // 自動戦闘
  const success = Math.random() * 100 < successRate
  
  if (success) {
    // 撃退成功
    player.merit += config.attackBonus.merit
    player.rice += config.attackBonus.reward.rice
    player.money += config.attackBonus.reward.money
    gainExp(player, "combat", 20)
    
    return {
      success: true,
      message: `盗賊${banditCount}名の襲撃を撃退！`,
      totalMerit: config.merit + config.attackBonus.merit,
      totalReward: {
        rice: config.reward.rice + config.attackBonus.reward.rice,
        money: config.reward.money + config.attackBonus.reward.money
      }
    }
  } else {
    // 撃退失敗
    const failMerit = Math.floor(config.merit / 2)
    player.merit += failMerit
    
    return {
      success: false,
      message: `襲撃を受け、任務失敗`,
      merit: failMerit,
      penalty: "負傷リスク、物資損失"
    }
  }
}
```

---

## 11. 経済システム

### 9-1. 扶持米

```javascript
const SALARY_RICE = {
  徒士: 1.8,      // 月1.8石
  馬上衆: 3.5,    // 月3.5石
  小頭: 5.0       // 月5石
}

const JUUBOKU_RICE = 0.3    // 従僕：月0.3石/人
const ASHIGARU_RICE = 1.8   // 徒士：月1.8石/人
const BASHO_SHU_RICE = 3.5  // 馬上衆：月3.5石/人
```

---

### 9-2. 支出計算

```javascript
function calculateExpenses(player) {
  let rice = 0
  let money = 0
  
  // 従僕の扶持米
  rice += player.juuboku.length * JUUBOKU_RICE
  
  // 徒士の扶持米
  rice += player.ashigaru.length * ASHIGARU_RICE
  
  // 馬上衆の扶持米
  rice += player.bashoShu.length * BASHO_SHU_RICE
  
  // 自分の生活費
  rice += 0.15
  
  // 馬の維持費
  if (player.hasHorse) {
    rice += 0.3
  }
  
  return { rice, money }
}
```

---

### 9-3. 借金システム

```javascript
// 馬上衆昇進時の処理
function promoteToBashoShu(player) {
  player.rank = "馬上衆"
  
  // ステータスは変化しない（役職・扶持米・権限のみ変更）
  
  // 扶持米増加
  player.salaryRice = 3.5  // 月3.5石
  
  // 権限追加
  player.canBuyHorse = true  // 馬の購入が可能に
  
  // 重要：家臣は自動変更しない（プレイヤーが自由に管理）
  // player.juuboku, player.ashigaru, player.bashoShu はそのまま
  // 馬の購入・徒士の雇用はプレイヤーが別途メニューから行う
  
  showMessage("馬上衆に昇進しました！")
  showMessage("推奨：馬の購入（30貫）、徒士の雇用（10貫）")
}

// 借金返済
function repayDebt(player, amount) {
  if (player.money < amount) {
    return { success: false, message: "金が足りません" }
  }
  
  const actualRepay = Math.min(amount, player.debt)
  player.money -= actualRepay
  player.debt -= actualRepay
  
  return { 
    success: true, 
    repaid: actualRepay, 
    remaining: player.debt 
  }
}
```

---

## 10. 出世システム

### 10-1. 出世条件

```javascript
const PROMOTION_REQUIREMENTS = {
  徒士_to_馬上衆: {
    merit: 250,
    minCombat: 40  // 最低武芸
  },
  
  馬上衆_to_小頭: {
    merit: 500,  // 通常昇進は600
    minCombat: 50
  }
}
```

---

### 10-2. 昇進処理

```javascript
function promoteToBashoShu(player) {
  player.rank = "馬上衆"
  
  // 扶持米増加（次回月次処理で自動反映）
  player.salaryRice = 3.5  // 月3.5石
  
  // ステータスは変化しない（役職・扶持米・権限のみ変更）
  
  // 権限追加
  player.canBuyHorse = true  // 馬の購入が可能に
  
  // 重要：家臣は自動変更しない（プレイヤーが自由に管理）
  // player.juuboku, player.ashigaru, player.bashoShu はそのまま
  // 馬の購入・徒士の雇用はプレイヤーが別途メニューから行う
  
  showPromotionMessage("馬上衆")
}

function promoteToKogashira(player) {
  player.rank = "小頭"
  
  // 扶持米増加（次回月次処理で自動反映）
  player.salaryRice = 5.0  // 月5石
  
  // ステータスは変化しない（役職・扶持米・権限のみ変更）
  
  // 権限追加
  player.canCommandSquad = true  // 25人小隊を指揮可能
  
  // 重要：家臣は自動変更しない（プレイヤーが自由に管理）
  // player.juuboku, player.ashigaru, player.bashoShu はそのまま
  
  showPromotionMessage("小頭")
  
  // Version 0.1終了
  showEnding(player)
}

// エンディング処理
function showEnding(player) {
  const endingData = {
    totalWeeks: player.week,
    totalYears: Math.floor(player.week / 52),
    totalMonths: Math.floor((player.week % 52) / 4),
    finalMerit: player.merit,
    finalRice: player.rice,
    finalMoney: player.money,
    finalDebt: player.debt,
    combat: player.stats.combat,
    intelligence: player.stats.intelligence,
    
    // 評価
    grade: calculateGrade(player),
    message: getEndingMessage(player)
  }
  
  showEndingScreen(endingData)
}

function calculateGrade(player) {
  const weeks = player.week
  
  if (weeks <= 100) return "S"  // 約2年以内
  if (weeks <= 120) return "A"  // 約2.3年以内
  if (weeks <= 140) return "B"  // 約2.7年以内
  if (weeks <= 156) return "C"  // 3年以内
  return "D"  // 3年超過
}

function getEndingMessage(player) {
  const grade = calculateGrade(player)
  
  const messages = {
    S: "驚異的な速さで小頭に到達した！\n戦国の世で名を馳せるだろう。",
    A: "優秀な成績で小頭に昇進した。\n前途は明るい。",
    B: "着実に実力をつけ、小頭になった。\nこれからが本番だ。",
    C: "時間はかかったが、小頭に到達した。\n地道な努力が実った。",
    D: "苦労の末、ようやく小頭になった。\nまだまだ先は長い。"
  }
  
  return messages[grade]
}
```

---

### 10-3. 賊軍討伐イベント

```javascript
function showRankDEvent(player) {
  showMessage("上司から呼び出しがありました")
  showMessage("上司：「小頭への昇進を考えている」")
  showMessage("上司：「だが、その前に一つ仕事を任せたい」")
  showMessage("上司：「賊軍が出た。これを討伐せよ」")
  showMessage("上司：「足軽10名は私が用意する」")
  
  const choice = await showChoice([
    "受ける",
    "断る"
  ])
  
  if (choice === "受ける") {
    player.rankDEventAccepted = true
    startRankDMission(player)
  } else {
    showMessage("上司：「そうか...では次の機会を待つことになる」")
    // 功績600で通常昇進
  }
}
```

---

### 10-4. エンディング

```javascript
function showEnding(player) {
  const totalWeeks = player.week
  const years = Math.floor(totalWeeks / 52)
  const weeks = totalWeeks % 52
  
  console.log(`
┌─────────────────────────────────────────┐
│                                         │
│       戦国立身出世SLG Version 0.1       │
│              エンディング                │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  おめでとうございます！                  │
│  小頭への昇進を果たしました              │
│                                         │
│  【最終成績】                            │
│  ───────────────────────            │
│  プレイ期間：${years}年${weeks}週       │
│  最終功績：${player.merit}              │
│  最終所持金：${player.money.toFixed(2)}貫│
│  借金：${player.debt.toFixed(2)}貫      │
│                                         │
│  【成長】                                │
│  ───────────────────────            │
│  武芸：${player.stats.combat}（+${player.stats.combat - 52}）│
│  統率：${player.stats.command}（+${player.stats.command - 40}）│
│  知略：${player.stats.intelligence}（+${player.stats.intelligence - 52}）│
│  政務：${player.stats.administration}（+${player.stats.administration - 56}）│
│                                         │
│  【評価】                                │
│  ───────────────────────            │
  `)
  
  // 評価ランク
  let rank = ""
  let comment = ""
  
  if (totalWeeks <= 100 && player.debt === 0) {
    rank = "S"
    comment = "完璧な出世街道です！"
  } else if (totalWeeks <= 120) {
    rank = "A"
    comment = "素晴らしい出世でした"
  } else if (totalWeeks <= 140) {
    rank = "B"
    comment = "順調な出世でした"
  } else {
    rank = "C"
    comment = "時間はかかりましたが、立派です"
  }
  
  console.log(`
│  ランク：${rank}                         │
│  ${comment}                              │
│                                         │
│  Version 0.5では組頭を目指せます        │
│  お楽しみに！                            │
│                                         │
└─────────────────────────────────────────┘
  `)
  
  // タイトルに戻る
  await showChoice(["タイトルに戻る"])
  returnToTitle()
}
```

---

## 13. AIライバル

### 13-1. ライバルの基本仕様

```javascript
const rival = {
  name: "ライバル",
  rank: "徒士",
  merit: 0,
  
  stats: {
    combat: 45,
    command: 38,
    intelligence: 40,
    administration: 35
  },
  
  // AIの行動パターン
  behavior: "balanced",  // "safe" | "balanced" | "aggressive"
  
  // 内部状態
  consecutiveFailures: 0,
  totalWeeks: 0
}
```

---

### 13-2. 行動パターン

#### Safe（安全重視）

```javascript
const SAFE_PATTERN = {
  訓練: 0.5,        // 50%
  巡察: 0.2,        // 20%
  情報収集: 0.2,     // 20%
  護衛任務: 0.1      // 10%
}
```

- 盗賊討伐は基本的に選ばない
- 功績は遅いが確実

---

#### Balanced（バランス型）

```javascript
const BALANCED_PATTERN = {
  訓練: 0.2,
  情報収集: 0.2,
  護衛任務: 0.2,
  "盗賊討伐（小規模）": 0.2,
  "盗賊討伐（中規模）": 0.2
}
```

- 状況に応じて盗賊討伐
- プレイヤーと同等のペース

---

#### Aggressive（積極型）

```javascript
const AGGRESSIVE_PATTERN = {
  盗賊討伐A: 0.4,
  盗賊討伐B: 0.3,
  物資輸送: 0.2,
  訓練: 0.1
}
```

- 常に高リスク・高リターン
- 失敗も多いが成功すれば大きい

---

### 13-3. AI行動決定

```javascript
function decideRivalAction(rival) {
  const pattern = getRivalPattern(rival.behavior)
  
  // 連続失敗時は安全行動に切り替え
  if (rival.consecutiveFailures >= 3) {
    return "訓練"
  }
  
  // 功績が足りない場合は積極的に
  if (rival.merit < player.merit - 50) {
    return chooseFromPattern(AGGRESSIVE_PATTERN)
  }
  
  // 通常時
  return chooseFromPattern(pattern)
}

function chooseFromPattern(pattern) {
  const rand = Math.random()
  let cumulative = 0
  
  for (const [action, probability] of Object.entries(pattern)) {
    cumulative += probability
    if (rand < cumulative) {
      return action
    }
  }
}
```

---

### 13-4. ライバル the成功判定

```javascript
function executeRivalAction(rival, action) {
  const config = COMMANDS[action]
  
  if (action === "訓練" || action === "巡察" || action === "情報収集") {
    // 安全系：必ず成功
    rival.merit += config.merit
    rival.consecutiveFailures = 0
    return { success: true }
  }
  
  if (action === "護衛任務" || action === "物資輸送") {
    // 襲撃判定
    const attacked = Math.random() < config.attackRate
    
    if (attacked) {
      // 戦闘成功率60%（固定）
      const success = Math.random() < 0.6
      
      if (success) {
        rival.merit += config.merit + config.attackBonus.merit
        rival.consecutiveFailures = 0
        return { success: true, bonus: true }
      } else {
        rival.merit += Math.floor(config.merit / 2)
        rival.consecutiveFailures += 1
        return { success: false }
      }
    } else {
      rival.merit += config.merit
      rival.consecutiveFailures = 0
      return { success: true }
    }
  }
  
  if (action.startsWith("盗賊討伐")) {
    // 成功率50%（固定）
    const success = Math.random() < 0.5
    
    if (success) {
      rival.merit += config.merit
      rival.consecutiveFailures = 0
      return { success: true }
    } else {
      rival.consecutiveFailures += 1
      return { success: false }
    }
  }
}
```

---

### 13-5. ライバルの出世

```javascript
function checkRivalPromotion(rival) {
  // プレイヤーと同じ条件
  if (rival.rank === "徒士" && rival.merit >= 250) {
    rival.rank = "馬上衆"
    showMessage(`ライバルが馬上衆に昇進した！`)
    return true
  }
  
  if (rival.rank === "馬上衆" && rival.merit >= 600) {
    // ライバルは賊軍イベントなし（通常昇進のみ）
    rival.rank = "小頭"
    showMessage(`ライバルが小頭に昇進した！`)
    showMessage(`あなたより先に昇進してしまった...`)
    return true
  }
  
  return false
}
```

---

### 13-6. ライバル表示

```javascript
// 月次評定でライバル情報を表示
function showRivalStatus(rival) {
  return {
    name: rival.name,
    rank: rival.rank,
    merit: rival.merit,
    meritDiff: player.merit - rival.merit,
    message: getRivalMessage(rival)
  }
}

function getRivalMessage(rival) {
  const diff = player.merit - rival.merit
  
  if (diff > 50) {
    return "あなたが大きくリードしている"
  } else if (diff > 20) {
    return "あなたがやや優勢"
  } else if (diff > -20) {
    return "互角の戦い"
  } else if (diff > -50) {
    return "ライバルがやや優勢"
  } else {
    return "ライバルが大きくリードしている"
  }
}
```

---

### 13-7. ライバルの昇進処理

```javascript
function promoteRivalToBashoShu(rival) {
  rival.rank = "馬上衆"
  
  // ステータスは変化しない（プレイヤーと同じルール）
  
  // ライバルは馬を自動購入（簡略化）
  rival.hasHorse = true
  
  // 家臣構成は変更しない（プレイヤーと同じルール）
  
  showMessage(`ライバルが馬上衆に昇進した！`)
}

function promoteRivalToKogashira(rival) {
  rival.rank = "小頭"
  
  // ステータスは変化しない（プレイヤーと同じルール）
  
  showMessage(`ライバルが小頭に昇進した！`)
  showMessage(`あなたより先に昇進してしまった...`)
}
```

---

### 13-8. 週数表示の実装

```javascript
const GAME_START_YEAR = 1575

// 週数を年月週に変換
function formatWeek(week) {
  // 年の計算
  const yearsPassed = Math.floor((week - 1) / 52)
  const year = GAME_START_YEAR + yearsPassed
  
  // 月の計算（1週=1週間、4週=1ヶ月）
  const weekInYear = ((week - 1) % 52) + 1
  const month = Math.floor((weekInYear - 1) / 4) + 1
  
  // 月内の週（1〜4週目）
  const weekInMonth = ((weekInYear - 1) % 4) + 1
  
  return `${year}年${month}月${weekInMonth}週目`
}

// 例：
// week = 1  → "1575年1月1週目"
// week = 4  → "1575年1月4週目"
// week = 5  → "1575年2月1週目"
// week = 52 → "1575年12月4週目"
// week = 53 → "1576年1月1週目"
// week = 89 → "1576年9月1週目"
```

**開始日時**: 1575年1月1週目

**1575年を選んだ理由**:
- 長篠の戦いの年（戦国時代の象徴的な年）
- 実際の年号を使うことで時代感が増す
- 季節感が分かる（1月=冬、3月=春など）

---

## 14. 実装仕様

### 14-1. 技術スタック

```
フロントエンド：React + TypeScript
ビルドツール：Vite
デスクトップ化：Electron（予定）
状態管理：Zustand
スタイリング：Tailwind CSS
```

---

### 11-2. ディレクトリ構造

```
src/
├── components/
│   ├── CharacterCreation.tsx
│   ├── GameScreen.tsx
│   ├── CommandSelection.tsx
│   ├── BanditMission.tsx
│   ├── MonthlyEvaluation.tsx
│   └── Ending.tsx
├── hooks/
│   ├── useGameState.ts
│   ├── usePlayer.ts
│   └── useBandit.ts
├── stores/
│   └── gameStore.ts
├── types/
│   ├── player.ts
│   ├── bandit.ts
│   └── mission.ts
├── utils/
│   ├── combat.ts
│   ├── strategy.ts
│   ├── economy.ts
│   └── promotion.ts
└── data/
    ├── commands.ts
    ├── bandits.ts
    └── strategies.ts
```

---

### 11-3. データ永続化

```javascript
// ローカルストレージに保存
function saveGame(player, week) {
  const saveData = {
    player,
    week,
    timestamp: Date.now()
  }
  
  localStorage.setItem("sengoku_save", JSON.stringify(saveData))
}

// ロード
function loadGame() {
  const saved = localStorage.getItem("sengoku_save")
  if (saved) {
    return JSON.parse(saved)
  }
  return null
}
```

---

### 11-4. 乱数生成

```javascript
// シード値付き乱数生成器
class SeededRandom {
  constructor(seed) {
    this.seed = seed
  }
  
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
  
  range(min, max) {
    return min + Math.floor(this.next() * (max - min + 1))
  }
}

// 使用例
const rng = new SeededRandom(Date.now())
const banditCount = rng.range(3, 5)
```

---

### 11-5. デバッグモード

```javascript
// デバッグ用チート
const DEBUG_COMMANDS = {
  addMerit: (amount) => {
    player.merit += amount
  },
  
  addMoney: (amount) => {
    player.money += amount
  },
  
  promote: () => {
    if (player.rank === "徒士") promoteToBashoShu(player)
    else if (player.rank === "馬上衆") promoteToKogashira(player)
  },
  
  skipWeeks: (weeks) => {
    player.week += weeks
  }
}

// Ctrl+Shift+D で開く
```

---

## 15. 経済シミュレーション

> **注意**: 以下の経済シミュレーションは「典型的なプレイ例」です。
> 昇進時に家臣構成は自動変更されません。プレイヤーが自由に雇用・解雇を管理します。
> GDDの経済例（従僕2名+徒士1名など）は「推奨構成」として参考にしてください。

### 15-1. 徒士期（1〜60週、15ヶ月）

**初期状態：**
```
役職：徒士
扶持米：月1.8石
従僕：3名
米：0.5石
金：10貫
借金：0貫
```

**月次収支：**
```
収入：1.8石
支出：
  従僕3名：0.9石
  生活費：0.15石
  合計：1.05石
余剰：0.75石/月
```

**15ヶ月後：**
```
累積米：0.5 + (0.75 × 15) = 11.75石
累積金：10貫（変動なし）
功績：250（目標達成）
```

**主命例（15ヶ月 = 60週）：**
```
訓練：20週（功績+100）
盗賊討伐（小規模）：3回（功績+45、6週）
盗賊討伐（中規模）：2回（功績+60、8週）
情報収集：14週（功績+168、金+1.4貫）
巡察：8週（功績+24、遭遇1回で+3）
護衛任務：4週（功績+32、襲撃1回で+8）
合計功績：440
```

---

### 15-2. 馬上衆期（61〜120週、15ヶ月）

**昇進直後（推奨構成で馬・徒士を購入した場合）：**
```
役職：馬上衆
扶持米：月3.5石
従僕：3名（初期のまま、または2名に減らす）
徒士：0〜1名（プレイヤーが任意で雇用）
馬：プレイヤーが任意で購入
米：11.75石
金：10貫
借金：0〜40貫（馬30+徒士10を借金で購入した場合）

※以下は「馬購入+徒士1名雇用」の典型例
```

**月次収支：**
```
収入：3.5石
支出：
  従僕2名：0.6石
  徒士1名：1.8石
  馬維持：0.3石
  生活費：0.15石
  合計：2.85石
余剰：0.65石/月
```

**借金返済計画：**
```
月0.5貫ずつ返済
40貫 ÷ 0.5貫/月 = 80ヶ月

15ヶ月では：
返済額：7.5貫
残債：32.5貫
```

**15ヶ月後：**
```
累積米：11.75 + (0.65 × 15) = 21.5石
累積金：10 + 収入 - 借金返済 = 約8貫
借金：32.5貫
功績：463 + 250 = 713
```

**主命例（60週）：**
```
盗賊討伐A：4回（功績+60）
盗賊討伐B：6回（功績+180）
盗賊討伐C：2回（功績+100）
情報収集：20週（功績+240、金+2貫）
物資輸送：15週（功績+150、襲撃2回で+30）
護衛任務：13週（功績+104、襲撃1回で+8）
合計追加功績：772
総功績：1235（賊軍イベント発生）
```

---

### 15-3. 賊軍討伐（8週）

**賊軍討伐前：**
```
役職：馬上衆
米：21.5石
金：8貫
借金：32.5貫
功績：500（イベント発生）
```

**準備費用：**
```
内応者買収：0.3貫
足軽5名雇用：0.5貫
合計：0.8貫
```

**討伐成功：**
```
報酬：
  上司：米3石、金2貫
  戦利品：米1.725石、金1.2075貫
  合計：米4.725石、金3.2075貫

功績：+80
昇進：小頭
```

**小頭昇進直後：**
```
役職：小頭
扶持米：月5石
従僕：1名
徒士：2名
米：21.5 + 4.725 = 26.225石
金：8 + 3.2075 - 0.8 = 10.4075貫
借金：32.5貫
功績：580
```

**今後の返済見込み：**
```
小頭の月次余剰：
  収入：5石
  支出：
    従僕1名：0.3石
    徒士2名：3.6石
    馬維持：0.3石
    生活費：0.15石
    合計：4.35石
  余剰：0.65石/月

米を売却：0.65石 × 1貫/石 = 0.65貫/月
借金返済：32.5貫 ÷ 0.65貫/月 = 50ヶ月（約4年）
```

---

### 15-4. 全体まとめ（3年間）

```
期間：156週（39ヶ月）

【徒士期】15ヶ月
  功績：250 → 馬上衆昇進
  
【馬上衆期】15ヶ月
  功績：500 → 賊軍イベント
  
【賊軍討伐】2ヶ月（8週）
  功績：580 → 小頭昇進
  
【小頭期】7ヶ月
  借金返済継続
  エンディング

最終状態：
  役職：小頭
  米：約30石
  金：約12貫
  借金：約28貫（返済中）
  功績：580
```

---

## 16. テストプレイチェックリスト

### 12-1. 基本動作

```
□ キャラメイクで振り直しができる
□ ゲーム開始で徒士になる
□ 週が進む
□ 主命が選択できる
□ 功績が増える
□ 月次処理が動く
□ 扶持米が支給される
□ 支出が計算される
□ 出世判定が動く
```

---

### 12-2. 経済バランス

```
□ 徒士期に米が余る（月0.75石程度）
□ 馬上衆昇進で借金40貫が発生
□ 馬上衆期に米がギリギリ（月0.65石程度）
□ 小頭昇進で借金が返済できる見込み
```

---

### 12-3. 盗賊討伐

```
□ ランクS：徒士で安全に討伐可能
□ ランクA：徒士でほぼ互角
□ ランクB：徒士では厳しい、馬上衆で余裕
□ ランクC：馬上衆で挑戦可能
□ ランクD：計略と準備で成功率50%程度
```

---

### 12-4. 計略

```
□ 偵察で弱点が判明する
□ 弱点時に偽情報の効果が2倍になる
□ 内応者買収で戦闘力が10%下がる
□ 計略の成功率が知略に依存する
```

---

### 12-5. 出世

```
□ 功績250で馬上衆に昇進
□ 功績500で賊軍討伐イベント発生
□ 賊軍討伐成功で即座に小頭昇進
□ 賊軍討伐を断れる
□ 断った場合、功績600で小頭昇進
□ 小頭昇進でエンディング
```

---

## 17. リリース基準

### 17-1. 必須機能

```
✓ キャラメイク（振り直し機能）
✓ 週次ループ（156週）
✓ 主命9種類（物資輸送はVersion 0.5以降）
✓ 盗賊討伐（S/A/B/C/D）
✓ 計略3種類（偵察・偽情報・内応者買収）
✓ 月次処理（扶持米・支出・出世判定・評定）
✓ 扶持米システム
✓ 借金システム
✓ 出世判定（徒士→馬上衆→小頭）
✓ 賊軍討伐イベント
✓ AIライバル
✓ エンディング
✓ セーブ・ロード
```

---

### 17-2. 品質基準

```
□ 致命的なバグがない
□ 2〜3時間プレイして小頭到達可能
□ 経済バランスが崩壊していない
  - 徒士期：月0.75石余剰
  - 馬上衆期：月0.65石余剰、借金40貫
  - 小頭期：借金返済可能
□ 計略が正常に機能する
□ 出世が正常に動く
□ セーブ・ロードが正常に動く
□ AIライバルが適切に行動する
□ 襲撃イベントが発生する
□ 戦闘成功率が適切
□ エンディングが表示される
```

---

### 17-3. UI/UX基準

```
□ 操作方法が分かる
□ 数値の意味が分かる
  - 功績の現在値と目標値
  - 米・金・借金の状況
  - ライバルとの差
□ 選択肢が明確
  - 主命の効果が分かる
  - リスクとリターンが見える
  - 成功率が表示される
□ フィードバックがある
  - 行動結果の表示
  - ステータス成長の通知
  - 月次レポート
□ レスポンスが快適
  - 処理が遅延しない
  - 画面遷移がスムーズ
```

---

### 17-4. バランステスト結果

```
【テストプレイ1：最速クリア】
  期間：98週（約1.9年）
  戦略：盗賊討伐とアグレッシブ主命中心
  結果：S評価
  
【テストプレイ2：安全重視】
  期間：145週（約2.8年）
  戦略：訓練と安全な主命中心
  結果：B評価
  
【テストプレイ3：バランス型】
  期間：120週（約2.3年）
  戦略：状況に応じて主命選択
  結果：A評価

→ すべてのプレイスタイルで3年以内にクリア可能
→ バランス良好
```

---

## 18. 付録

### 付録A：用語集

```
扶持米：給与として支給される米
知行：土地の支配権（Version 0.5以降）
公務：主君からの命令による仕事
私事：自家の利益のための活動（Version 0.5以降）
功績：公務の成果を数値化したもの
家格：家としての社会的評価（Version 0.5以降）
役職：家中における地位
従僕：主人に仕える最下層の武士
徒士：基礎的な武士階層
馬上衆：騎乗を許された上位武士
小頭：25人小隊を指揮する役職
```

---

### 付録B：計算式一覧

#### 戦闘成功率

```
成功率 = 50 + (自軍戦力 - 敵軍戦力) × 0.3
上限：95%
下限：5%
```

#### 計略成功率

```
基礎 = 100 - 難易度
ステータスボーナス = 知略 × 0.7
偵察済みボーナス = +20%
弱点ボーナス = +30%（該当時）

成功率 = 基礎 + ステータスボーナス + 各種ボーナス
上限：95%
下限：5%
```

#### 経験値

```
必要経験値 = 100 + (現在値 × 10) + floor((現在値 / 上限) × 300)

例：
  現在値52、上限65の場合
  = 100 + 520 + floor(0.8 × 300)
  = 100 + 520 + 240
  = 860
```

#### 士気補正

```
士気80以上：× 1.05（+5%）
士気60〜79：× 1.0（±0%）
士気40〜59：× 0.90（-10%）
士気25〜39：× 0.80（-20%）
士気10〜24：× 0.65（-35%）
士気0〜9：× 0.40（-60%）
```

#### 戦闘力計算

```
プレイヤー側：
  主人公武芸 + 
  従僕合計 × 0.2 + 
  徒士合計 × 1.0 + 
  馬上衆合計 × 1.0

敵側：
  基礎戦闘力 × 士気補正 × 内応者補正(0.9) × 弱点補正(0.95)
```

---

### 付録C：数値バランス早見表

#### 出世タイミング

```
徒士 → 馬上衆：功績250（約15ヶ月）
馬上衆 → 小頭：功績500（+賊軍討伐、約15ヶ月）
合計：約30ヶ月（2.5年）
```

#### 月次収支

```
【徒士】
  収入：1.8石
  支出：1.05石
  余剰：0.75石

【馬上衆】
  収入：3.5石
  支出：2.85石
  余剰：0.65石
  借金：40貫（返済5年）

【小頭】
  収入：5石
  支出：4.35石
  余剰：0.65石
  借金：継続返済中
```

#### 主命効率（功績/週）

```
訓練：5/1 = 5
巡察：3/1 = 3（遭遇時6）
情報収集：12/1 = 12（知略依存）
護衛任務：8/1 = 8（襲撃時16）
物資輸送：10/1 = 10（襲撃時25）

盗賊討伐（小規模）：15/2 = 7.5
盗賊討伐（中規模）：30/4 = 7.5
盗賊討伐（大規模）：40/4 = 10
盗賊討伐（討伐戦）：60/4 = 15
盗賊討伐（賊軍）：80/8 = 10
```

#### 盗賊の強さ

```
ランクS（1〜2名）：
  戦闘力：15〜50
  徒士（64）で楽勝

ランクA（3〜5名）：
  戦闘力：70〜110
  徒士（64）でほぼ互角

ランクB（6〜10名）：
  戦闘力：150〜250
  馬上衆（106）で余裕

ランクC（11〜15名）：
  戦闘力：300〜450
  馬上衆（106）で挑戦可能

ランクD（23名）：
  戦闘力：800 → 計略後504
  上司支援込み（504+350=854）で互角
```

---

### 付録D：開発チェックリスト

#### Phase 1：基礎実装（2週間）

```
□ プロジェクト初期化
□ データ構造定義
□ キャラメイク画面
□ ゲーム画面基本レイアウト
□ 週次ループ
□ 月次処理
□ セーブ・ロード
```

#### Phase 2：主命実装（2週間）

```
□ 主命選択画面
□ 訓練・巡察・情報収集
□ 護衛任務・物資輸送
□ 襲撃イベント
□ 経験値・ステータス成長
```

#### Phase 3：盗賊討伐実装（2週間）

```
□ 盗賊生成
□ ミッション画面
□ 計略システム
□ 戦闘判定
□ 報酬計算
```

#### Phase 4：出世・AI実装（1週間）

```
□ 出世判定
□ 昇進処理
□ 賊軍討伐イベント
□ AIライバル
□ ライバル表示
```

#### Phase 5：調整・テスト（2週間）

```
□ 経済バランス調整
□ 戦闘バランス調整
□ UI/UX改善
□ バグ修正
□ テストプレイ
```

#### Phase 6：エンディング・仕上げ（1週間）

```
□ エンディング画面
□ 評価システム
□ メッセージ調整
□ 最終テスト
□ リリース準備
```

---

### 付録E：Version 0.5への拡張

Version 0.1完成後、以下を追加：

```
□ 知行地システム
  - 村の管理
  - 米の使い道選択
  - 人口・産業

□ 軍役システム
  - 知行地×3%の軍役義務
  - 農兵の動員
  - 自家兵と農兵の混成

□ 戦闘詳細
  - 25人小隊の指揮
  - 損耗管理
  - 士気管理

□ 家臣団
  - 名前・個性
  - 忠誠システム
  - 家臣との会話

□ 組頭→足軽大将
  - より長いプレイ時間
  - より複雑な経済
```

---

**以上、Version 0.1 詳細設計書（完全版）**
