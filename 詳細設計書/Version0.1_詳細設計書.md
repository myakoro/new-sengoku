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
7A. [戦闘システム詳細](#7a-戦闘システム詳細)
7B. [負傷システム（小隊戦闘版）](#7b-負傷システム小隊戦闘版)
7C. [戦闘UI仕様（小隊戦闘版）](#7c-戦闘ui仕様小隊戦闘版)
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
- ✓ ターン制（1週=前半・後半の2ターン、年間52週×2ターン）
- ✓ 公務選択（9種類）
- ✓ 功績累計システム
- ✓ 出世判定（徒士→馬上衆→小頭）
- ✓ 扶持米システム
- ✓ 借金システム
- ✓ 若党システム（Version 0.1では武芸数値のみ、名前なしの簡易実装）
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
  money: 0.5,         // 初期金：0.5貫
  debt: 0,
  
  // 若党2名（別紙E準拠：初期若党は能力合計230〜280で生成）
  // Version 0.1では武芸のみ使用するため、武芸単体ではなく合計値を基準に生成
  // 武芸は合計の約20-30%程度を想定（約50〜80）
  juuboku: [
    { id: 1, combat: 50 + Math.floor(Math.random() * 31) },  // 50〜80
    { id: 2, combat: 50 + Math.floor(Math.random() * 31) },  // 50〜80
    { id: 3, combat: 50 + Math.floor(Math.random() * 31) }   // 50〜80
  ],
  
  ashigaru: [],
  bashoShu: [],
  hasHorse: false,
  
  week: 1,
  rankDEventShown: false,
  rankDEventAccepted: false
}
```

※v0.1では、盗賊討伐ミッション進行中に月次（評定）画面へ強制割り込みはしない。
月次境界に到達した場合は、ミッション終了（結果を閉じる）または中止で画面を離れるタイミングで月次へ遷移する。

---

### 7-4. 夜襲準備（政務）

夜襲を仕掛ける前に行う「事前準備」を表す行動。  
主に**政務**を用いて、兵站・連絡・集合時間などを整えることで、夜襲の成功率を高める。

- 判定には隊長本人の政務（`administration`）と、状況に応じた難易度を用いる。
- 成功した場合、夜襲成功率の式中の「夜襲準備ボーナス」に**`+15`**が付与される。
- 失敗または実施していない場合、ボーナスは**`0`**のまま。

※政務を使った成功率の具体的な計算式は、別途拡張可能なものとして本バージョンでは記載しない。

**初期戦力：**
```
主人公：52
若党2名（平均20）：12
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
小頭到達 または 312ターン経過（3年）
  ↓
エンディング
```

#### ゲーム終了条件

1. **小頭到達**: 功績条件を満たして小頭に昇進した場合
2. **期間終了**: 312ターン（3年 = 156週 × 2ターン）経過した場合

どちらの条件でもエンディング画面へ遷移する。エンディング画面では終了理由に応じたメッセージを表示する。

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
│ 月次処理              │
│ （4週目の行動後）     │
├─────────────────────┤
│ ・扶持米支給          │
│ ・支出処理            │
│ ・出世判定            │
│ ・評定                │
└─────────────────────┘

※月次処理タイミング:
  1週目 → 2週目 → 3週目 → 4週目 → [月次処理] → 1週目...
         ↓
┌─────────────────────┐
│ 次週へ                │
└─────────────────────┘
```

※1週は「前半ターン」「後半ターン」の2回の行動フェーズから成る。実際のゲームでは、この週次ループを**各週につき2回（前半・後半）繰り返す**ことで、1週=2ターン制を表現する。

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

#### 下知（次の小頭評定までの期限付き目標）

- 徒士・馬上衆の間は、小頭から「次の小頭評定で〇〇の達成状況を判定する」という下知が与えられる。
- 小頭評定は「1か月=8ターン」のうち **1ターン目・5ターン目**（=4ターン周期）で発生する。
- 下知は次の小頭評定まで有効。
- 達成できなかった場合（未実行・失敗を問わない）は、小頭評定時点で **成功時功績の40%** を功績から減算する。
  - 例: 成功時功績が15なら、未達時は功績-6
  - 功績が0未満にならないよう下限を0とする。

##### 開始ターン固定の下知（例外）

稀に「開始ターン固定」の下知が発行される。

```javascript
const mandate = {
  target: "全体訓練",       // 目標主命
  issuedTurn: 5,            // 発行ターン
  dueTurn: 9,               // 期限ターン（次の小頭評定）
  successMerit: 0,          // 成功時功績（固定開始型は0が多い）
  status: "active",         // "active" | "succeeded" | "failed"
  fixedStartTurn: 5,        // 開始ターン固定（このターンで強制開始）
  fixedDuration: 1          // 拘束ターン数
}
```

- `fixedStartTurn` を持つ下知は、**そのターンに入った瞬間に強制的に開始**される。
- プレイヤーは主命選択画面へ進まず、直接結果画面へ遷移する。
- Version 0.1 の例：
  - `全体訓練`（5%の確率で発行、強制開始、1ターン拘束）
  - `賊軍偵察`（馬上衆のみ、5%の確率で発行、強制開始、1ターン拘束）

##### 盗賊討伐中の下知発行

盗賊討伐ミッション進行中に小頭評定ターンを迎えた場合：

1. **下知は失敗扱い**となる（討伐未完了のため）
2. 失敗ペナルティ（成功時功績の40%減算）が適用される
3. **討伐対象の盗賊は1ランク規模拡大**して次の評定で再登場する
   - 例：Dランク未討伐 → Cランクとして再出現
   - Sランク未討伐 → Sランクのまま再出現（上限）
4. 新しい下知が発行される（通常通り）

この仕様により、盗賊討伐を放置すると脅威が増大するリスクを表現する。

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

### 2-6. 徒士期の任務と行動構造

徒士は、原則として **直属の馬上衆または小頭が率いる隊の一員** として任務に参加する。任務中に徒士が単独で行動し、単騎で戦闘を行うことはない。

1か月は4週、1週は「前半」「後半」の **2ターン** に分割される。1任務のスパンは **最大2週間（=4ターン）** とし、そのうち実際に任務で拘束されるのは **2〜4ターン程度** を基本とする。任務の発生判定は毎月 **第1週前半・第3週前半** の2回のみ行う。

徒士の行動は、大きく以下の二層で構成される。

- **メイン任務枠（強制）**  
  直属の上司（馬上衆／小頭）が受けた任務に応じて、自動的に埋まる。徒士本人は内容を選択できない。
  - 小隊訓練（模擬戦）
  - 盗賊討伐（小規模）
  - 盗賊討伐（討伐戦）（2週間作戦の一部隊として参加）
  - 門番任務（3ターン拘束／3か月に1回程度）
  - 土木工事（3〜4ターン拘束）
  - 荷駄護衛・巡回 など

- **自由行動枠**  
  メイン任務で埋まっていないターンに、徒士が自ら選択する行動。
  - 商人護衛などの副業（少額〜中額の金銭収入）
  - 自主練（武芸・弓術・馬術などの鍛錬）
  - 自主巡回（領内の見回り・噂集め・功績のタネ探し）
  - 内職・雑用
  - 療治・休養 など

**報酬・功績の扱い:**

- 門番・土木工事・荷駄護衛・巡回などの強制任務は、扶持米に含まれる **本来業務** とみなし、原則として **追加の手当は発生しない**。任務の重さに応じた「任務ごとの基礎功績」のみが加算される。
- これらの任務の遂行中に、盗賊・ならず者などとの **戦闘が発生した場合** は、以下を別枠で追加加算する。
  - 戦闘での撃破数・勝利による **戦闘功績**
  - 略奪品の分け前としての **戦利品（少額の金銭）**
  - 盗賊討伐任務の場合の **危険手当（少額の追加金銭）**
- 小隊訓練（模擬戦）で目立った働きをした場合には、小さな褒美や少量の功績が与えられることがあるが、本番の盗賊討伐ほど大きなリターンにはしない。

徒士は、一定期間の任務を通じて **功績が一定値を超える** と、直属の馬上衆から **「徒士分隊長」として小さな分隊を任される** ことがある。この時点では身分は徒士のままだが、馬上衆隊の中の一分隊の隊長として、門番・巡回・荷駄護衛などの軽い任務を預かることができる。

### 2-7. 馬上衆期の任務と分隊運用

馬上衆は、自身が率いる小隊の一部として **徒士を最大7人まで雇用** できる。徒士を雇うことで戦力と任務の幅は広がるが、そのぶん **毎月の扶持米負担が増え、金銭は溜まりにくくなる**。

馬上衆隊は、内部的に「本隊」と「分隊」に分かれる。ただし、**同時に編成・運用できる分隊は常に1つだけ** とする。分隊の構成は以下の固定メンバーとする。

- 徒士1名（分隊リーダー）
- 足軽1名
- 上記徒士に付属する若党（1名）

分隊行動時には、この徒士が分隊長として現場指揮を執るが、任務全体の責任・最終評価・功績の主な配分は、あくまで隊長である馬上衆に紐づく。

**分隊運用のメリットとリスク:**

- 馬上衆は、門番・巡回・一部の荷駄護衛などの **比較的軽い任務を分隊に任せ**、そのあいだ本隊を別の任務に投入することができる。これにより、1か月あたりにこなせる任務数が増え、**功績を稼ぎやすくなる**。
- 一方で、分隊を外へ出しているあいだは、その徒士・足軽・若党が **本隊から抜けるため、本隊の戦力は目に見えて低下する**。特に盗賊討伐など重い任務で分隊を外しすぎると、討伐作戦自体の成功率が下がるリスクがある。
- したがって、馬上衆は「功績を増やすために分隊を活用するか」「重い任務に備えて全戦力を温存するか」というトレードオフを、毎月の状況に応じて選択することになる。

徒士期に「徒士分隊長」として軽い任務を預かった経験は、馬上衆に昇進した後の **自隊・分隊の運用判断** にそのまま活きてくる。プレイヤーは、徒士時代に分隊としてどれだけ任務をこなしたか、分隊出撃中に本隊側でどのようなリスクや結果が生じたかを体験したうえで、自らが馬上衆になって分隊を編成・運用していくことになる。

---

### 2-7-2. 若党雇用システム

若党は主命選択画面から「若党雇用」を選択することで雇用できる。

#### 雇用上限

- **最大2名**まで雇用可能（初期から上限2名）
- 若党が死亡・離脱した場合、空き枠ができれば再雇用可能

#### 若党の能力

若党は4つのステータスを持つ（武芸・統率・知略・政務）。

```javascript
// 若党データ構造
const juuboku = {
  id: 1,
  combat: 50,         // 武芸
  command: 40,        // 統率
  intelligence: 35,   // 知略
  administration: 30, // 政務
  injuryStatus: 'normal',
  injuryWeeksRemaining: 0
}

// 初期若党（特例）：能力合計230〜280
// 一般若党（雇用）：能力合計200〜270（世界の能力分布に従う）
```

#### 若党雇用画面

```javascript
// 若党雇用画面の状態
const recruitmentState = {
  candidates: [],           // 現在の候補リスト（2〜5名）
  refreshCost: 0.2,         // 募集費用：0.2貫
  refreshedThisMonth: false, // 今月リスト更新済みか
  hireCost: 0,              // 雇用費用：無料（扶持米のみ）
}

// 候補数の決定（役職が上がると候補が増える）
function getCandidateCount(rank) {
  switch (rank) {
    case "徒士":     return randomInt(2, 3)  // 2〜3名
    case "馬上衆":   return randomInt(3, 4)  // 3〜4名
    case "小頭":     return randomInt(4, 5)  // 4〜5名
    default:         return randomInt(2, 5)
  }
}

// 候補リスト生成（世界の能力分布に従う）
function generateCandidates(rank) {
  const count = getCandidateCount(rank)
  return Array.from({ length: count }, () => {
    const totalAbility = generateByWorldDistribution()  // 200〜270程度
    return {
      id: generateId(),
      combat: Math.floor(totalAbility * randomRatio(0.2, 0.3)),
      command: Math.floor(totalAbility * randomRatio(0.2, 0.3)),
      intelligence: Math.floor(totalAbility * randomRatio(0.2, 0.3)),
      administration: Math.floor(totalAbility * randomRatio(0.2, 0.3)),
    }
  })
}
```

#### 画面フロー

1. **若党雇用画面を開く**
   - 現在の若党一覧を表示（4ステータス表示）
   - 雇用可能な候補リスト（2〜5名）を表示
   - 各候補の4ステータスを表示

2. **候補を選んで雇用**
   - 雇用費用：無料（ただし毎月の扶持米0.3石が発生）
   - 雇用上限（2名）に達している場合は雇用不可

3. **リストを更新（募集）**
   - 費用：0.2貫
   - **月に1回のみ**更新可能
   - 新しい候補（2〜5名）が生成される
   - 「より良い若党を探す」ためのコスト

4. **画面を閉じる**
   - 主命選択画面に戻る

#### 注意事項

- 若党の扶持米は月0.3石（GDD準拠）
- 若党が負傷・死亡した場合の補充として使用
- 候補リストは月次処理時に自動更新される（無料）
- 月途中での追加更新は0.2貫かかり、月1回のみ

---

### 2-8. 小隊任務の種類と基本フロー

本作の Version 0.1 では、徒士〜馬上衆期の「小隊任務」として、以下の3種類を扱う。

- 小隊訓練（模擬戦）
- 盗賊討伐（小規模）
- 盗賊討伐（討伐戦）

これらはすべて **週単位の任務スロット** の中で発生し、必要に応じて小隊戦闘システム（7A〜7C）を用いる。

#### 2-8-1. 小隊訓練（模擬戦）

- **目的**: 小隊同士の模擬戦を通じて、武芸・統率の実戦感覚を養う。
- **期間**: 原則1週間以内（1〜2ターン拘束）
  - 典型例:
    - 第1週前半: 小隊訓練（模擬戦）を1回実施
    - 第1週後半: 自由行動
- **参加形態**:
  - 徒士期: 直属の馬上衆隊または小頭直属隊の一兵として参加。
  - 馬上衆期: 自隊と、別部隊（小頭直属隊など）との合同訓練として参加。
- **戦闘システム**:
  - 小隊戦闘（7A〜7C）を用いるが、「訓練扱い」として以下の制約を設ける。
    - 死亡・古傷は発生しない。
    - 戦闘終了時、受けたダメージの多くはその場で回復し、実戦ダメージの一部のみが残る（負傷システム7Bの簡易版扱い）。
- **功績・報酬**:
  - 基本的には「小さな功績」と「ステータス経験値（武芸・統率）」が中心。
  - 顕著な戦果（模擬戦での圧勝など）があった場合、小さな褒美や追加功績を与えてよいが、盗賊討伐ほど大きくはしない。

#### 2-8-2. 盗賊討伐（小規模）

- **目的**: 村周辺や街道に出没する少人数の盗賊集団を討伐し、治安を維持する。
- **期間**: 1〜2週間（3〜4ターン拘束を想定）
  - 典型例:
    - 第1週前半: 任務発生・準備行軍／状況把握
    - 第1週後半: 盗賊との小隊戦闘
    - 第2週前半: 戦後処理・帰還（場合によってはここで戦闘を行うこともある）
    - 第2週後半: 自由行動
- **参加形態**:
  - 徒士期: 馬上衆隊または小頭隊の一員として参加（単独行動はしない）。
  - 馬上衆期: 自身が率いる小隊として任務を受ける。必要に応じて、分隊を別任務に出すこともできる。
- **戦闘システム**:
  - 小隊戦闘（7A〜7C）を用い、盗賊データ（ランク・人数・士気など）は8章の盗賊システムに従う。
  - 偵察・偽情報・内応などの計略が事前に成功している場合、戦闘前の敵戦力・士気に補正がかかる（9章参照）。
- **功績・報酬**:
  - 任務としての基礎功績（小〜中程度）に加え、戦闘での撃破数・勝利に応じた戦闘功績が加算される。
  - 盗賊の所持財産に応じた戦利品（米・金）が得られるほか、盗賊討伐任務であるため、少額の危険手当を上乗せしてよい。

#### 2-8-3. 盗賊討伐（討伐戦）

- **目的**: 広範囲に被害を出している盗賊勢力（拠点持ち）を、複数部隊による2週間規模の作戦で討伐する。
- **期間**: 固定で2週間（3〜4ターン拘束を想定）
  - 典型例:
    - 第1週前半: 任務発生・作戦下命（足軽大将／小頭からの命令）
    - 第1週後半: 偵察・準備行動（必要に応じて小規模交戦）
    - 第2週前半: 本隊による決戦小隊戦闘
    - 第2週後半: 戦後処理・帰還（掃討・捕縛・戦利品整理など）
- **参加形態**:
  - 徒士期: 上位部隊（小頭隊・馬上衆隊）の一員として参加し、前線の一部を担う。
  - 馬上衆期: 自隊として作戦に参加し、場合によっては分隊を別行動（側面警戒・別ルートの荷駄護衛など）に出すこともある。
- **戦闘システム**:
  - 決戦時には小隊戦闘（7A〜7C）を用いる。
  - 偵察・偽情報・内応・夜襲準備など、9章・7-4節で定義される計略の成功状況に応じて、敵戦力・士気・夜襲成功率が変動する。
- **功績・報酬**:
  - 任務としての基礎功績は大きく、作戦全体の戦果に応じて功績ボーナスが付与される（他の小隊任務より高め）。
  - 盗賊本拠地の財産に応じた戦利品（米・金）が配分されるほか、危険度に見合った危険手当が支給される。
  - 討伐作戦の成否は、その後の評定や出世判定（12章）にも影響しうる。

---

## 3. データ構造

### 3-0. 若党（旧：従僕）の呼称と内部キー

- 本作における正式な呼称は **「若党」** とする。
- 過去資料や旧バージョンでは「従僕」と表記していたが、本詳細設計書以降は原則使用しない。
- 実装上のプロパティ名・内部キーは互換性のため **`juuboku`** を用いる。
  - 例：`player.juuboku: Juuboku[]`
- UIラベル・ログ・説明文など、プレイヤーが目にする文言はすべて **「若党」** で統一する。

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
  
  // 若党（実装キー juuboku）
  juuboku: [
    { id: 1, combat: 20 },
    { id: 2, combat: 18 },
    { id: 3, combat: 22 }
  ],
  
  // 家臣（Version 0.1では若党以外なし）
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
  
  // 家臣（若党はプレイヤーと同様に juuboku で管理）
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
    "盗賊討伐（討伐戦)": 0.2
  },
  
  aggressive: {
    訓練: 0.1,
    "盗賊討伐（小規模）": 0.3,
    "盗賊討伐（討伐戦)": 0.3,
    "盗賊討伐（賊軍)": 0.3
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
    // 徒士期のAIは討伐戦・賊軍討伐の主命は選ばない
    delete availableCommands["盗賊討伐（討伐戦)"]
    delete availableCommands["盗賊討伐（賊軍)"]
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
  
  // ミッション状態（行動ターン単位。4ターン=2週間の作戦）
  timeLimit: 4            // 期限（ターン）
}
```

---

### 3-5. ミッションデータ

```javascript
const mission = {
  type: "bandit_subjugation",  // ミッション種別
  rank: "A",                   // 盗賊ランク
  bandit: { /* 盗賊データ */ },
  timeLimit: 4,                  // 行動ターン数（4ターン=2週間の作戦）
  currentTurn: 1,                // 現在ターン
  
  // プレイヤーの準備
  additionalAshigaru: 0,       // 追加雇用した足軽
  strategies: [],              // 実行済みの計略

  // 若党委任（並行処理）
  delegatedTurn: null          // 当該ターンに若党へ準備行動を委任したか（ターン番号 or null）
}
```

- 若党委任の担当若党は、デフォルトで「適任者（例：知略が高い若党）」を自動選択する。
- プレイヤーはUI上で担当若党を手動で切り替え可能。
- 委任結果は行動ログに「担当若党」「成功率」「効果量（例：士気低下値）」が分かる形で出力する。

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

// 若党（旧：従僕）初期生成
// 別紙E準拠：初期若党は能力合計230〜280で生成（特例で高水準）
// 4ステータス（武芸・統率・知略・政務）を持つ
const INITIAL_JUUBOKU_COUNT = 2        // 初期若党数：2名
const MAX_JUUBOKU_COUNT = 2            // 若党の雇用上限：2名
const INITIAL_JUUBOKU_TOTAL_RANGE = [230, 280]  // 初期若党の能力合計範囲

// 若党雇用システム
const JUUBOKU_RECRUITMENT = {
  maxCount: 2,              // 雇用上限：2名
  refreshCost: 0.2,         // 募集費用（リスト更新）：0.2貫
  refreshPerMonth: 1,       // 月に1回のみ更新可能
  candidateCount: {         // 候補数（役職で変動）
    徒士: [2, 3],           // 2〜3名
    馬上衆: [3, 4],         // 3〜4名
    小頭: [4, 5],           // 4〜5名
  },
  generalTotalRange: [200, 270],  // 一般若党の能力合計範囲
}

// キャラメイク
const CHAR_CREATE = {
  totalPotential: 300,      // 才能上限合計
  minPotential: 10,         // 各能力の最低上限
  maxPotential: 100,        // 各能力の最高上限
  initialRatio: 0.8         // 初期値は上限の80%
}

// 世界の能力分布（人口全体の能力合計値の分布）
// 別紙E準拠：他家の若党や一般武士はこの分布に基づいて生成
const WORLD_ABILITY_DISTRIBUTION = {
  // 能力合計値の閾値と累積確率
  tiers: [
    { min: 300, probability: 0.02 },  // 300以上：2%（英傑級）
    { min: 280, probability: 0.05 },  // 280以上：5%（優秀）
    { min: 260, probability: 0.10 },  // 260以上：10%（有能）
    { min: 240, probability: 0.15 },  // 240以上：15%（平均以上）
    { min: 200, probability: 0.30 },  // 200以上：30%（平均）
    { min: 180, probability: 0.23 },  // 180以上：23%（平均以下）
    { min: 160, probability: 0.10 },  // 160以上：10%（凡庸）
    { min: 0,   probability: 0.05 }   // 160未満：5%（無能）
  ],
  
  // 参考：プレイヤー初期若党は230〜280（特例で高水準）
  // 参考：一般若党は200〜270
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
  若党: 0.3,
  徒士: 1.8,
  馬上衆: 3.5,
  小頭: 5.0
}

// その他支出
const LIVING_COST = 0.15      // 生活費（月額）
const HORSE_COST = 0.3        // 馬維持費（月額）

// 借金（プレイヤーが任意で借りる場合の参考費用）
const TYPICAL_COSTS = {
  馬購入: 8,            // 馬上衆昇進時に推奨
  徒士雇用: 4           // 馬上衆昇進時に推奨
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

Version 0.1 では、昇進そのものによる自動的な能力値上昇（ボーナス）は行わない。
能力値はあくまで訓練・実戦・計略などの経験によってのみ成長する。

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
// ※戦争時は若党の係数が0.2になる（Version 0.5以降）
function calculatePlayerCombatPower(player) {
  let power = 0
  
  // 主人公の武芸
  power += player.stats.combat
  
  // 若党の戦闘力（100%）
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

**例：徒士期（若党3名）**
```
主人公：52
若党3名（48、53、45 → 平均50）：150
合計：202
```

**例：馬上衆期（若党2名、徒士1名）**
```
主人公：67
若党2名（50、48）：98
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

### 5-4. 負傷システム

#### 5-4-1. 負傷状態の定義

家臣は以下の4つの状態を持つ：

| 状態 | 戦闘力 | 回復期間 | 説明 |
|------|--------|----------|------|
| **正常** | 100% | - | 通常状態 |
| **軽傷** | 80% | 4週間 | 戦闘力20%減、4週間で正常に回復 |
| **重傷** | 0% | 8週間 | 戦闘不可、8週間で正常に回復 |
| **死亡** | - | - | 永久に失う |

#### 5-4-2. データ構造

```typescript
interface Retainer {
    name: string
    combat: number
    injuryStatus: 'normal' | 'light' | 'severe'
    injuryWeeksRemaining: number  // 回復までの残り週数
}
```

#### 5-4-3. 戦力比による損失確率

**戦力比5倍以上（圧倒的優勢）:**
- 死亡: 0%
- 重傷: 0%
- 軽傷: 2%で1名
- 無傷: 98%

**戦力比3倍以上（大幅優勢）:**
- 死亡: 0.5%で1名
- 重傷: 2%で1名
- 軽傷: 8%で1名
- 無傷: 89.5%

**戦力比2倍以上（優勢）:**
- 死亡: 1%で1名
- 重傷: 5%で1名
- 軽傷: 15%で1名
- 無傷: 79%

**戦力比1.5倍以上（やや優勢）:**
- 死亡: 3%で1名
- 重傷: 10%で1名、3%で2名
- 軽傷: 20%で1名、8%で2名
- 無傷: 56%

**戦力比1.2倍以上（互角）:**
- 死亡: 5%で1名、2%で2名
- 重傷: 15%で1名、8%で2名
- 軽傷: 25%で1名、12%で2名
- 無傷: 33%

**戦力比1.2倍未満（劣勢）:**
- 死亡: 10%で1名、5%で2名
- 重傷: 20%で1名、10%で2名、5%で3名
- 軽傷: 25%で1名、15%で2名
- 無傷: 10%

**敗北時:**
- 死亡: 1-2名
- 重傷: 2-4名
- 軽傷: 1-3名

#### 5-4-3A. 雇い足軽（足軽雇用）の扱い（Version 0.1）

- 盗賊討伐ミッションで「足軽雇用」により増えた足軽（`additionalAshigaru`）は、家臣リストに恒久追加されない。
- 死者数が発生した場合、死亡は **雇い足軽 → 若党（従僕）** の順に割り当てる（雇い足軽が残っている限り、若党の死亡を優先しない）。
- 雇い足軽の死亡は、功績ペナルティを発生させる。
  - 判定は戦闘の勝敗ではなく「下知（mandate）を達成したか」で分岐する。
  - 下知達成：死亡1名につき `功績-2`
  - 下知未達：死亡1名につき `功績-4`
- 若党/徒士/馬上衆の死亡では功績を減らさない（戦力低下のみ）。

#### 5-4-4. 回復処理

毎週の処理で、負傷者の`injuryWeeksRemaining`を1減らす。0になったら`injuryStatus`を`'normal'`に戻す。

```javascript
function processWeeklyInjuryRecovery(player) {
    for (const retainer of [...player.juuboku, ...player.ashigaru, ...player.bashoShu]) {
        if (retainer.injuryWeeksRemaining > 0) {
            retainer.injuryWeeksRemaining--
            if (retainer.injuryWeeksRemaining === 0) {
                retainer.injuryStatus = 'normal'
            }
        }
    }
}
```

#### 5-4-5. 戦闘力計算への影響

```javascript
function getRetainerCombatPower(retainer) {
    if (retainer.injuryStatus === 'severe') {
        return 0  // 重傷は戦闘不可
    } else if (retainer.injuryStatus === 'light') {
        return Math.floor(retainer.combat * 0.8)  // 軽傷は20%減
    } else {
        return retainer.combat  // 正常は100%
    }
}
```

#### 5-4-6. ゲームバランスへの影響

負傷システムにより：
1. **戦闘リスクの増加**: 連続して戦闘を行うと戦力が低下
2. **戦略的選択**: 内政と戦闘のバランスが重要に
3. **回復期間の管理**: 重傷者が出た場合、8週間は戦力が大幅に低下

これにより、戦闘系の仕事ばかりするのではなく、内政とのバランスを取る必要が生まれる。

---

### 5-5. 若党補充システム（Version 0.1簡易版）

#### 5-5-1. 概要

Version 0.1では若党の自由雇用はできないが、死亡者が出た場合の補充システムを用意する。

#### 5-5-2. 補充条件

- 若党が死亡した場合のみ補充可能
- 月次処理時に自動的に補充候補が提示される
- プレイヤーが承認すると補充される

#### 5-5-3. 補充コスト

```javascript
const RETAINER_REPLACEMENT_COST = {
    money: 100,  // 100両
    rice: 0.2    // 0.2石（紹介料・準備費用）
}
```

#### 5-5-4. 補充される若党の能力

```javascript
function generateReplacementRetainer() {
    return {
        name: generateRandomName(),
        combat: randomInt(35, 55),  // 平均45（やや低め）
        injuryStatus: 'normal',
        injuryWeeksRemaining: 0
    }
}
```

**特徴:**
- 初期若党（平均50）よりやや能力が低い
- 死亡リスクを考慮したバランス調整

#### 5-5-5. 月次処理での表示

```
【月次報告】

若党の補充候補
  死亡者: 山田太郎（武芸48）
  
  補充候補: 田中四郎（武芸42）
  費用: 金100両、米0.2石
  
  [補充する] [見送る]
```

#### 5-5-6. 補充を見送った場合

- 若党の人数が減ったまま継続
- 次の月次処理でも補充候補が提示される
- 戦力が低下するため、難易度が上がる

#### 5-5-7. Version 0.5以降との違い

| 項目 | Version 0.1 | Version 0.5以降 |
|------|-------------|-----------------|
| 雇用タイミング | 月次処理のみ | いつでも可能 |
| 雇用条件 | 死亡者がいる場合のみ | 自由 |
| 能力選択 | ランダム | 複数候補から選択 |
| 給与 | なし | 毎月支払い必要 |

---

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
morale -= 10  // 通常
morale -= 18  // 弱点「統率不足」時

// 夜襲
morale -= 20
```

---

## 7A. 戦闘システム詳細

### 7A-1. 概要

Version 0.5以降で実装予定の「ターン制戦闘」の詳細仕様。  
小規模部隊（馬上衆8人、小頭25人）での戦闘を想定し、個人ごとのHP・士気・疲労を管理する。

**主な要素：**
- 前線6人 vs 敵前線6人のターン制戦闘
- 個人ごとの方針（攻撃・平常・防御）
- 士気による戦闘力補正と士気変動
- 疲労による戦闘力低下と士気ペナルティ
- 前列・後列の入れ替え（1ターン最大2人）

---

### 7A-2. 士気変動テーブル

#### 7A-2-1. 戦闘前の士気補正

計略による初期士気への補正：

| 計略 | 敵士気への影響 |
|------|----------------|
| **偽情報** | −15 |
| **夜襲** | −20 |
| **内応工作** | −10（成功時） |

※これらは戦闘開始時の初期士気に加算される。

---

#### 7A-2-2. ターンごとの士気変動

各ターンの戦闘結果に応じて、双方の士気が変動する。  
変動量はランダム幅を持ち、以下の範囲内で決定される。

| 戦果 | 敵士気変化 | 自軍士気変化 |
|------|------------|-------------|
| **大きく優勢** | −10〜−12 | +4〜+8 |
| **優勢** | −7〜−9 | +2〜+5 |
| **やや優勢** | −3〜−6 | 0〜+2 |
| **互角** | −1〜+1 | −1〜+1 |
| **やや劣勢** | 0〜+2 | −3〜−6 |
| **劣勢** | +2〜+5 | −7〜−9 |
| **大きく劣勢** | +4〜+8 | −10〜−12 |

**実装例：**
```javascript
function applyMoraleChange(result, attacker, defender) {
  const tables = {
    '大きく優勢': { enemy: [-12, -10], ally: [4, 8] },
    '優勢': { enemy: [-9, -7], ally: [2, 5] },
    'やや優勢': { enemy: [-6, -3], ally: [0, 2] },
    '互角': { enemy: [-1, 1], ally: [-1, 1] },
    'やや劣勢': { enemy: [0, 2], ally: [-6, -3] },
    '劣勢': { enemy: [2, 5], ally: [-9, -7] },
    '大きく劣勢': { enemy: [4, 8], ally: [-12, -10] }
  }
  
  const range = tables[result]
  const enemyChange = randomInt(range.enemy[0], range.enemy[1])
  const allyChange = randomInt(range.ally[0], range.ally[1])
  
  defender.morale += enemyChange
  attacker.morale += allyChange
  
  // 士気は0〜100の範囲
  defender.morale = Math.max(0, Math.min(100, defender.morale))
  attacker.morale = Math.max(0, Math.min(100, attacker.morale))
}
```

---

### 7A-3. 疲労システム

#### 7A-3-1. 疲労の影響

疲労は0〜100の範囲で管理され、以下の2つに影響する。

##### (1) combat（戦闘力）への補正

| 疲労 | combat補正 |
|------|------------|
| 0〜34 | ×1.00 |
| 35〜49 | ×0.95 |
| 50〜69 | ×0.85 |
| 70〜80 | ×0.75 |
| 80〜99 | ×0.65 |
| 100 | ×0.55 |

**実装例：**
```javascript
function getFatigueMultiplier(fatigue) {
  if (fatigue <= 34) return 1.00
  if (fatigue <= 49) return 0.95
  if (fatigue <= 69) return 0.85
  if (fatigue <= 80) return 0.75
  if (fatigue <= 99) return 0.65
  return 0.55
}
```

##### (2) 士気減少への追加ペナルティ

疲労が高いと、ターンごとの士気減少量が増加する。  
※士気**増加**には影響しない（負の方向にのみ働く）。

| 疲労 | 士気減少への追加 |
|------|------------------|
| 0〜49 | 0 |
| 50〜70 | −3 |
| 71〜85 | −5 |
| 86〜100 | −8 |

**実装例：**
```javascript
function applyFatigueMoralePenalty(character, moraleChange) {
  if (moraleChange >= 0) {
    // 士気増加時はペナルティなし
    return moraleChange
  }
  
  // 士気減少時のみ追加ペナルティ
  let penalty = 0
  if (character.fatigue >= 86) penalty = -8
  else if (character.fatigue >= 71) penalty = -5
  else if (character.fatigue >= 50) penalty = -3
  
  return moraleChange + penalty
}
```

---

#### 7A-3-2. 疲労の増加・回復

##### 前線での疲労増加

前線にいるキャラクターは、毎ターン以下の疲労が蓄積する：

```
疲労増加 = 基礎疲労(6) + 方針による補正
```

| 方針 | 疲労補正 | 合計疲労増加 |
|------|----------|-------------|
| **攻撃** | +3 | +9 / ターン |
| **平常** | +0 | +6 / ターン |
| **防御** | −2 | +4 / ターン |

**実装例：**
```javascript
function updateFatigue(character, position, stance) {
  if (position === '前線') {
    let increase = 6  // 基礎疲労
    
    if (stance === '攻撃') increase += 3
    else if (stance === '防御') increase -= 2
    // '平常' は +0
    
    character.fatigue += increase
  } else if (position === '後列') {
    character.fatigue -= 5  // 後列での回復
    character.morale += 3   // 士気も回復
  }
  
  // 疲労は0〜100の範囲
  character.fatigue = Math.max(0, Math.min(100, character.fatigue))
}
```

##### 後列での回復

後列（控え）にいるキャラクターは、毎ターン以下の回復を得る：

- **疲労**：−5 / ターン
- **士気**：+3 / ターン

---

#### 7A-3-3. 双方のダメージ総量の計算

各ターンの「双方のダメージ総量」は、以下の手順で決定する。

1. 前線メンバーごとの実効 combat を求め、
   - 自軍総戦闘力 `P_self` 
   - 敵軍総戦闘力 `P_enemy` 
   を算出する。
2. 比率 `R = P_self / P_enemy` から、このターンの戦果ランク（大きく優勢〜大きく劣勢）を決定する。
3. `P_self` と `P_enemy`、戦果ランクに応じた係数から、双方のダメージ総量を計算する。
4. 得られたダメージ総量を前線メンバー人数で均等割りし、各個人の武芸による吸収係数で最終的なHP減少量に変換する。

##### 戦果ランクの決定

まず、`R = P_self / P_enemy` を用いて戦果ランクを決定する（数値は初期案、要調整）：

```text
R >= 1.6        : 自軍「大きく優勢」
1.3 <= R < 1.6  : 自軍「優勢」
1.1 <= R < 1.3  : 自軍「やや優勢」
0.9 <= R < 1.1  : 「互角」
0.7 <= R < 0.9  : 自軍「やや劣勢」
0.5 <= R < 0.7  : 自軍「劣勢」
R < 0.5         : 自軍「大きく劣勢」
```

この戦果ランクは、7A-2-2 の士気変動テーブルと共有する。

##### ダメージ総量の計算式

基準となる係数 `BASE_DAMAGE` を用いて、

- 自軍 → 敵のダメージ総量 `D_toEnemy` 
- 敵 → 自軍のダメージ総量 `D_toSelf` 

を以下のように計算する（初期案として `BASE_DAMAGE = 0.20` を想定）：

```javascript
const BASE_DAMAGE = 0.20

function calculateTotalDamage(P_self, P_enemy, result) {
  const damageFactors = {
    '大きく優勢': { selfToEnemy: 1.4, enemyToSelf: 0.6 },
    '優勢':       { selfToEnemy: 1.2, enemyToSelf: 0.8 },
    'やや優勢':   { selfToEnemy: 1.1, enemyToSelf: 0.9 },
    '互角':       { selfToEnemy: 1.0, enemyToSelf: 1.0 },
    'やや劣勢':   { selfToEnemy: 0.9, enemyToSelf: 1.1 },
    '劣勢':       { selfToEnemy: 0.8, enemyToSelf: 1.2 },
    '大きく劣勢': { selfToEnemy: 0.6, enemyToSelf: 1.4 }
  }

  const f = damageFactors[result]
  const randSelf = 0.9 + Math.random() * 0.2   // 0.9〜1.1
  const randEnemy = 0.9 + Math.random() * 0.2

  const D_toEnemy = P_self * BASE_DAMAGE * f.selfToEnemy * randSelf
  const D_toSelf  = P_enemy * BASE_DAMAGE * f.enemyToSelf * randEnemy

  return { D_toEnemy, D_toSelf }
}
```

##### 個人へのダメージ配分

1. `D_toSelf`（敵 → 自軍のダメージ総量）を、自軍前線人数で単純に均等割りして「基礎ダメージ」を決める。
2. 各前線メンバーについて、武芸に応じた「ダメージ吸収係数」を掛け、最終的なHP減少量とする。
   - 例：武芸が高いほど吸収係数が小さくなり、同じ基礎ダメージでも実HP減少が少なくなる。

これにより、

- ターンごとの殴り合いの激しさ … `P_self / P_enemy` と `BASE_DAMAGE`、戦果ランクの係数で決定
- 各個人がどれだけダメージを受けるか … 均等割り＋武芸による吸収係数で決定

という役割分担になる。

---

### 7A-4. 前線個人方針

#### 7A-4-1. 方針の種類

前線の各キャラクターには、以下の3つの方針を設定できる。

| 方針 | 戦闘力補正 | 被ダメージ補正 | 疲労増加 |
|------|------------|----------------|----------|
| **攻撃** | ×1.20 | ×1.10 | +9 / ターン |
| **平常** | ×1.00 | ×1.00 | +6 / ターン |
| **防御** | ×0.90 | ×0.80 | +4 / ターン |

**特徴：**
- **攻撃**：火力重視。早く疲れるが与ダメージが大きい。
- **平常**：バランス型。標準的な疲労ペース。
- **防御**：長期戦向き。火力は落ちるが疲労が溜まりにくく、被ダメージも少ない。

---

#### 7A-4-2. 馬による補正

馬を所持しているキャラクターは、以下の補正を受ける。

**戦闘時の補正：**

| 方針 | 戦闘力補正 | 疲労増加補正 | 備考 |
|------|------------|--------------|------|
| **攻撃** | ×1.5（通常×1.2） | ±0 | 騎馬突撃で火力大幅UP |
| **平常** | ×1.0 | −1 | 馬上からの安定した戦闘 |
| **防御** | ×1.0 | −1 | 機動力で疲労を抑える |

**その他の補正：**

| 状況 | 補正 | 備考 |
|------|------|------|
| **追撃時** | 手柄確率 ×1.5 | 逃げる敵を追いやすい |
| **撤退時** | 被害軽減 ×0.6 | 歩兵より明らかに逃げやすい |

**設計意図：**
- 馬上衆でも馬に乗る義務はない（維持費0.6石/月がかかる）
- 馬を持つメリット：
  - **攻撃時**：戦闘力×1.5（騎馬突撃）
  - **平常・防御時**：疲労−1（機動力）
  - **追撃時**：手柄確率×1.5
  - **撤退時**：被害軽減×0.6

```javascript
// 馬による戦闘補正
function applyHorseModifier(character, stance) {
  if (!character.hasHorse) {
    return { combatBonus: 1.0, fatigueReduction: 0 }
  }
  
  switch (stance) {
    case '攻撃':
      return { combatBonus: 1.25, fatigueReduction: 0 }  // 1.2→1.5 (×1.25)
    case '平常':
    case '防御':
      return { combatBonus: 1.0, fatigueReduction: 1 }
    default:
      return { combatBonus: 1.0, fatigueReduction: 0 }
  }
}

// 馬による追撃時の手柄確率補正
function getPursuitMeritChance(character) {
  const baseChance = 0.3  // 基本30%
  const horseBonus = character.hasHorse ? 1.5 : 1.0
  return baseChance * horseBonus
}

// 馬による撤退時の被害軽減
function getRetreatDamageMultiplier(character) {
  return character.hasHorse ? 0.6 : 1.0
}
```

---

#### 7A-4-3. 実装例（方針）

```javascript
function applyStanceModifier(character, stance) {
  const modifiers = {
    '攻撃': { combat: 1.20, damage: 1.10, fatigue: 9 },
    '平常': { combat: 1.00, damage: 1.00, fatigue: 6 },
    '防御': { combat: 0.90, damage: 0.80, fatigue: 4 }
  }
  
  const mod = modifiers[stance]
  
  return {
    effectiveCombat: character.combat * mod.combat,
    damageMultiplier: mod.damage,
    fatigueIncrease: mod.fatigue
  }
}
```

---

### 7A-5. 前列・後列のルール

#### 7A-5-1. 前線と後列の定義

- **前線**：実際に戦闘を行う6人（最大）
  - 毎ターン疲労が蓄積
  - 方針（攻撃・平常・防御）を設定可能
  
- **後列（控え）**：戦闘に参加しない予備メンバー
  - 毎ターン疲労 −5、士気 +3
  - 前線との入れ替えが可能

---

#### 7A-5-2. 入れ替えルール

- **1ターンに最大2人まで**入れ替え可能
- 入れ替えはターン開始時に実行
- 入れ替えたキャラクターは、そのターンから新しい位置のルールが適用される

**実装例：**
```javascript
function swapFrontlineMembers(frontline, reserve, swapList) {
  if (swapList.length > 2) {
    throw new Error('1ターンに入れ替えできるのは最大2人まで')
  }
  
  swapList.forEach(swap => {
    const frontIdx = frontline.findIndex(c => c.id === swap.frontId)
    const reserveIdx = reserve.findIndex(c => c.id === swap.reserveId)
    
    if (frontIdx === -1 || reserveIdx === -1) {
      throw new Error('入れ替え対象が見つかりません')
    }
    
    // 入れ替え
    const temp = frontline[frontIdx]
    frontline[frontIdx] = reserve[reserveIdx]
    reserve[reserveIdx] = temp
  })
}
```

---

#### 7A-5-3. 戦闘の終了条件

以下のいずれかで戦闘が終了する：

1. **敵の士気が0になる** → プレイヤー勝利
2. **自軍の士気が0になる** → プレイヤー敗北
3. **敵の前線が全滅する** → プレイヤー勝利
4. **自軍の前線が全滅する** → プレイヤー敗北
5. **制限ターン数に到達** → 引き分け（実装による）

---

### 7A-6. 戦闘フロー（1ターンの流れ）

```
1. ターン開始
   ├─ プレイヤーが入れ替えを指示（最大2人）
   └─ プレイヤーが各前線メンバーの方針を設定

2. 戦闘力計算
   ├─ 各キャラの実効combat = 基礎combat × 疲労係数 × 方針係数
   └─ 双方の総戦闘力を算出

3. 戦闘判定
   ├─ 戦闘力差に基づいて「戦果」を判定（大きく優勢〜大きく劣勢）
   └─ ダメージ分配（前線6人に分散）

4. 士気・疲労の更新
   ├─ 士気変動テーブルに基づいて士気を増減
   ├─ 疲労による士気減少ペナルティを適用
   └─ 前線：疲労増加、後列：疲労・士気回復

5. 終了判定
   ├─ 士気0 or 全滅 → 戦闘終了
   └─ 継続 → 次ターンへ
```

---

### 7A-7. 設計上の注意点

#### 7A-7-1. 数値バランス

- 上記の数値は**初期案**であり、テストプレイで調整する前提。
- 特に「士気変動の幅」「疲労の蓄積速度」は、戦闘の長さに直結するため要調整。

#### 7A-7-2. UI/UX

- 前線（最大5人）の「HP・士気・疲労」を一目で把握できる表示が必須。
- 決戦画面では「敵（最大5） vs 自軍（最大5）」が向き合う配置で表示する。
- 敵側も、前線/控えの「HP・士気・疲労」を参照できる表示を用意する（閲覧のみ）。
- 方針変更と入れ替えは、直感的な操作で行えるようにする。
- 控えがいない場合でも、前線ユニットを「退避（前線→控え）」できる操作を用意する（交代回数を消費）。

#### 7A-7-3. Version 0.1での扱い

Version 0.1では、盗賊討伐に限り、本システムの要素（前線/後列、個人HP・士気・疲労、方針、交代）を用いたターン制戦闘を実装する。  
ただし、戦力差が大きい場合はゲームテンポを優先し「自動戦闘（即時決着）」による簡易解決を選択できる（強制ではない）。

- 盗賊討伐の決戦フェーズでは、前線（最大5人）・後列（控え）を編成し、前線ユニットごとに方針（攻撃/平常/防御）を設定できる。
- 交代はターン開始時に最大2人まで。
- 各ターンは 7A-6 の流れに従って進行し、HP/士気/疲労を更新する。
- 自動戦闘は、戦力比が極端な場合に選択肢として提示される（閾値は実装で調整可能）。

---

### 7A-8. 夜襲の成功率

夜襲の成功率は、隊長（指揮官）の**知略・統率**と、敵統率者の**知略・平均士気**によって決まる。  
戦力差には依存しない。

- 隊長: 小隊を率いる武将（小頭が引き入れていれば小頭）
- 敵統率者: 敵側の頭目

成功率は以下の式で計算し、最終的に 5〜95% に丸める。

```text
successRate = 40
            + ⌊隊長知略 × 0.4⌋
            + ⌊隊長統率 × 0.3⌋
            − ( ⌊敵知略 × 0.4⌋ + ⌊(敵平均士気 / 100) × 10⌋ )
            + 夜襲準備ボーナス   // 0 または +15
→ 5〜95% にクリップ
```

- 夜襲準備ボーナス:
  - 準備なし／失敗: `0` 
  - 政務による夜襲準備が成功している場合: `+15`

※Version 0.1 では、この夜襲成功率（7A-8）は採用せず、簡易モデルとして「通常の戦闘成功率に `-10` の補正」および「敵士気 `-20`」を適用する。

---

## 7B. 負傷システム（小隊戦闘版）

### 7B-1. 概要

ターン制小隊戦闘における、個人のHP・死亡・後遺症・回復の扱いを定義する。  
Version 0.5以降で実装予定の詳細負傷システムであり、Version 0.1では簡易的な戦力損失のみを扱う。

---

### 7B-2. HP帯と負傷状態

最大HP=100を前提とし、戦闘終了時のHP％に応じて以下の状態を持つ。

| HP％ | 状態 | 説明 |
|------|------|------|
| 80〜100 | 正常 | ほぼ万全。性能低下なし |
| 50〜79 | 軽傷 | 若干の傷。戦闘参加は可能だが、必要に応じて控えめに運用する |
| 20〜49 | 重傷 | 原則として次戦には出さないレベルの傷。戦闘参加不可扱い |
| 1〜19 | 瀕死（重傷内） | 戦闘不能寸前。死亡判定と後遺症判定の対象 |
| 0 | 死亡 | 即死亡。以後ゲームから除外 |

実装上は、以下のように管理する：

- `injuryStatus`: `'normal' | 'light' | 'severe' | 'dead'` 
- 1〜19 のHPは `injuryStatus = 'severe'` かつ「瀕死フラグ付き」とし、死亡・後遺症の処理対象とする。

HPが0になった場合、その時点で死亡が確定し、戦闘後の確率判定は行わない。

---

### 7B-3. 瀕死時の死亡率と後遺症

#### 7B-3-1. 勝利時

戦闘に勝利した場合でも、瀕死状態（HP1〜19）のキャラクターは一定確率で死亡する。

- HP1〜19（瀕死）のキャラクター：
  - 死亡率：**8％**
  - 生存した場合：**後遺症が必ず付与される**

HP20以上のキャラクターは、勝利時には死亡判定も後遺症判定も行わない。

#### 7B-3-2. 敗北・撤退時

戦闘に敗北、もしくは撤退した場合、瀕死からの死亡率は上昇する。

- HP1〜19（瀕死）のキャラクター：
  - 死亡率：**20％**
  - 生存した場合：**後遺症が必ず付与される**

HP20以上のキャラクターは、敗北時でも死亡・後遺症判定の対象外とする。

#### 7B-3-3. 即死条件

戦闘中にHPが0になったキャラクターは、その場で即死亡とし、戦闘後の確率判定は行わない。

---

### 7B-4. 退却（撤退）コマンド

プレイヤーは各ターン開始時に「退却」コマンドを選択できる。

- 退却を選ぶと、その時点のHP・士気状態で戦闘を終了する。
- 戦闘結果は「敗北／撤退」として扱い、7B-3-2の敗北時ルールを適用する。
- この時点でHP1〜19のキャラクターのみが、死亡率20％＋後遺症確定の対象となる。

これにより、プレイヤーは「HPが0になる前に退却するか」を判断する意味が明確になる。

---

### 7B-5. 戦闘後の処理フロー（擬似コード）

```javascript
function resolvePostBattleInjury(character, battleResult) {
  if (character.hp <= 0) {
    // 即死
    character.dead = true
    return
  }

  const hpRate = (character.hp / character.maxHp) * 100

  // 瀕死帯（HP1〜19）のみ死亡・後遺症判定
  if (hpRate < 20) {
    const deathRate = battleResult === 'win' ? 0.08 : 0.20
    if (Math.random() < deathRate) {
      character.dead = true
      return
    }

    // 生存した場合は後遺症付与
    applyAftereffect(character)
  }

  // 状態更新（UI用）
  if (hpRate >= 80) {
    character.injuryStatus = 'normal'
  } else if (hpRate >= 50) {
    character.injuryStatus = 'light'
  } else {
    character.injuryStatus = 'severe'
  }
}
```

---

### 7B-6. 回復と医者

#### 7B-6-1. 自然回復

毎週のターン終了時に、全ての生存キャラクターはHPが自然回復する。

- 自然回復量：**HP +6 / 週**
- 上限：最大HPまで（それ以上は回復しない）

```javascript
function weeklyHpRecovery(character) {
  if (character.dead) return
  character.hp = Math.min(character.maxHp, character.hp + 6)
}
```

#### 7B-6-2. 医者

医者にかかることで、追加回復を得られる。

- その週に医者にかかったキャラクター：**追加で HP +7**
- 費用：**1人につき 0.4貫**

これにより、その週の合計回復量は `6 + 7 = 13` となる。

```javascript
function applyDoctorTreatment(character) {
  if (character.dead) return
  character.hp = Math.min(character.maxHp, character.hp + 7)
  // 費用0.4貫の処理は別途
}
```

---

### 7B-7. 後遺症（恒久的ペナルティ）

瀕死（HP1〜19）から生存したキャラクターには、恒久的な後遺症が残る。

- 後遺症スタック数 `aftereffectCount` を管理し、瀕死から生存するたびに1加算する。
- 1スタックごとに以下のペナルティを受ける（初期案）：
  - 最大HP（`maxHp`）：**−10**
  - 武芸（`combat`）：**−3**
- 後遺症スタック数には上限を設ける（例：**最大3スタック**）。
  - 上限時の最大ペナルティ：`maxHp −30`、`combat −9` 

```javascript
function applyAftereffect(character) {
  if (character.aftereffectCount >= 3) return

  character.aftereffectCount = (character.aftereffectCount || 0) + 1
  character.maxHp = Math.max(10, character.maxHp - 10)
  character.combat = Math.max(1, character.combat - 3)
}
```

これにより、

- 一度の瀕死生還では軽いペナルティですむが、
- 何度も瀕死になると「古傷持ち」として明確に弱くなる、

という挙動を表現できる。

---

### 7B-8. Version 0.1での扱い

Version 0.1では、本負傷システムは**実装しない**。  
Version 0.1の盗賊討伐などでは、旧5-4節の簡易的な負傷・死亡処理、もしくはさらに単純化した戦力損失のみを扱う。  
本システムはVersion 0.5以降での詳細戦闘実装時に適用する。

---

## 7C. 戦闘UI仕様（小隊戦闘版）

### 7C-1. 戦況ヘッダーと手番表示

小隊戦闘画面の最上部には「戦況ヘッダー」を配置し、以下をまとめて表示する。

- 合戦名（例：`【○○合戦】`）
- 手番（ターン数）
  - 例：`手番：三手目`
- 戦況（7A-3-3 で定義した戦果ランク）
  - 例：`戦況：やや優勢` / `戦況：互角` / `戦況：大きく劣勢`
- 自軍・敵軍それぞれの士気バー＋数値（0〜100）

戦況表示は 7A-3-3「双方のダメージ総量の計算」で定義した戦果ランク
（大きく優勢／優勢／やや優勢／互角／やや劣勢／劣勢／大きく劣勢）をそのまま用い、
プレイヤーが一目で現在の流れを把握できるようにする。

### 7C-2. 簡易ログ

画面下部には、直近数手分（目安：3手）の「簡易ログ」領域を設ける。

- 各手番について 1 行の短い文章で、「この手番でどちらが押したか」「損耗が大きかったか」を示す。
- 数値は出しすぎず、プレイヤーが戦況を感覚的に掴める程度の抽象度に留める。

**ログ文言の例：**

- `一手目：味方やや優勢。敵の列、乱れはじめる。`
- `二手目：敵の反撃激しく、味方に深手多し。`

最新の手番が最上段に来るような並び順とし、古いログは自動的に押し出される想定とする。

### 7C-3. 前線ユニット表示と方針設定

自軍前線 6 人については、各キャラクターごとにカード（あるいは行）を用意し、以下の情報を表示する。

- 名前（＋役職）
  - 例：`山田太郎（馬上衆）`
- HP：バー＋数値（0〜100）
- 士気：数値（必要に応じて簡易バー併用）
- 疲労：数値（0〜100）
- 状態ラベル：`健在／かすり傷／深手／瀕死／討死` など（7B のしきい値に基づく）
- 方針：
  - `攻めかかれ`（攻撃）
  - `常の構え`（平常）
  - `守りを固めよ`（防御）

方針の扱いは以下の通りとする。

- 戦闘開始時、全員の初期方針は **「常の構え」** とする。
- 各ターン開始時、方針は自動リセットされず、
  何も操作しなければ前ターンと同じ方針で戦う。
- UI上では 3 つの方針ボタンを並べ、選択中の方針を視覚的に強調する。内部的には前線の各ユニットが必ずいずれか1つの方針を保持しており、「方針なし」という状態は存在しない。
- プレイヤーがそのターン中に一度も方針ボタンを押さなかった場合でも、前ターンの方針がそのまま適用される。したがって、「誰の方針も選ばれていない」ことを理由にターン終了をブロックするチェックは行わない。

### 7C-4. 控え一覧パネル

画面下部または右側に「控え一覧」パネルを常時表示し、控えにいる家臣の状態をいつでも確認できるようにする。

- 各行には以下の情報を表示する。
  - 名前（＋役職）
  - HP：簡易バー＋数値（例：`82/100`）
  - 士気：数値（0〜100）
  - 疲労：数値（0〜100）
  - 状態：`健在／かすり傷／深手／瀕死` など
- 控えに下げた家臣には、毎ターン「疲労 −5／士気 +3」の効果がある（7A-3-2）。控えにいる間は戦闘行動を行わず、個別の方針（攻めかかれ／常の構え／守りを固めよ）も持たない、常に「待機・休養」状態として扱う。
- プレイヤーはこのパネルを見ることで、控えの回復状況を逐一確認できる。
- 前線との交代操作は、この控え一覧から対象を選んで行う設計とする。

### 7C-5. 交代UIと制限表示

7A-5-2 で定義した通り、一度の手番で入れ替えできる人数は **最大 2 人** である。

- 戦闘画面内に「本手番での交代状況」を数値で表示する。
  - 例：`交代：1/2人`
- 規定人数を超えて交代しようとした場合は、エラーメッセージを表示し、処理は行わない。
  - メッセージ例：`「殿、一度の手番で替えられるのは二人までにござる。」`

これにより、プレイヤーは「今手番であと何人まで入れ替え可能か」を常に把握できる。

### 7C-6. HPバーと負傷しきい値の視覚化

HP バーは 0〜100 を横棒で表現し、7B-2 で定義した負傷しきい値に従って色分けする。

- 80〜100：正常ゾーン（緑）
- 50〜79：軽傷ゾーン（黄）
- 20〜49：重傷ゾーン（橙）
- 1〜19：瀕死ゾーン（赤）
- 0：討死（バーは表示せず、「討死」の文字を強調表示）

現在 HP の位置までを、そのゾーンの色で塗る。
（例：HP 65 であれば、バーの 0〜65% を軽傷ゾーン色（黄）で表示する。）

さらに、80／50／20 の位置には薄い縦線や段差を入れ、
「正常⇔軽傷」「軽傷⇔重傷」「重傷⇔瀕死」の境目が視覚的に分かるようにする。

### 7C-7. 退却ボタン

戦闘画面の分かりやすい位置（例：右下）に「退却」ボタンを配置する。

- 退却ボタン押下時は確認ダイアログを表示し、プレイヤーに最終確認を促す。
  - メッセージ例：
    - `「このままでは味方の損耗、いよいよ深くなりましょう。ここは軍をまとめ、退くべきかと。」`
  - 選択肢：`ここで退く`／`なおも戦う`
- 退却を選んだ場合、その時点の HP・士気状態で戦闘を終了し、
  結果は「敗北／撤退」として扱い、7B-3-2 のルール（瀕死時の死亡率など）を適用する。

### 7C-8. フォントサイズと視認性の方針

小隊戦闘画面では、情報量の多さを理由にフォントを極端に小さくすることは避け、
メイン画面と同等、もしくはそれ以上の視認性を確保する。

特に以下の情報は、十分な大きさで表示することを原則とする。

- 各武将の名前
- HP／士気／疲労の数値
- 状態ラベル（健在／かすり傷／深手／瀕死／討死）
- 各種ボタンラベル（攻めかかれ／常の構え／守りを固めよ／退却する など）

情報が 1 画面に収まりきらない場合は、文字サイズを縮小するのではなく、
行の折り返しやツールチップによる補足、レイアウトの分割などで対応し、
プレイヤーが「誰がどの状態か」「次に何を指示できるか」を直感的に把握できる UI を目指す。

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

---
### 6-1. ランク分類

```javascript
const BANDIT_RANKS = {
  D: {
    name: "小規模盗賊（旧S相当)",
    count: [1, 2],
    combatRange: [15, 50],
    morale: [30, 40],
    ricePerBandit: [0.01, 0.02],
    moneyRatio: 0.3,
    bossReward: { rice: 0.05, money: 0.025 },
    merit: 15,
    timeLimit: 4,        // 4ターン（次の評定まで）
    description: "犯罪者1〜2名。次の評定までに処理すべき軽微な事件。"
  },
  C: {
    name: "小規模盗賊団（旧A相当)",
    count: [3, 5],
    combatRange: [70, 110],
    morale: [35, 45],
    ricePerBandit: [0.03, 0.06],
    moneyRatio: 0.4,
    bossReward: { rice: 0.075, money: 0.05 },
    merit: 30,
    timeLimit: 4,        // 4ターン（次の評定まで）
    description: "小規模盗賊団3〜5名。次の評定までに討伐する。"
  },
  B: {
    name: "中規模盗賊団（旧B相当)",
    count: [6, 10],
    combatRange: [150, 250],
    morale: [40, 50],
    ricePerBandit: [0.05, 0.08],
    moneyRatio: 0.5,
    bossReward: { rice: 0.125, money: 0.075 },
    merit: 40,
    timeLimit: 4,        // 4ターン（2週間作戦）
    description: "中規模盗賊団6〜10名。2週間規模の討伐作戦。"
  },
  A: {
    name: "大規模盗賊団（旧C相当)",
    count: [11, 15],
    combatRange: [300, 450],
    morale: [45, 55],
    ricePerBandit: [0.08, 0.12],
    moneyRatio: 0.6,
    bossReward: { rice: 0.25, money: 0.125 },
    merit: 60,
    timeLimit: 4,        // 4ターン（2週間作戦）
    description: "大規模盗賊団11〜15名。2週間規模の討伐戦。"
  },
  
  S: {
    name: "賊軍（旧D相当）",
    count: [20, 25],
    baseCombat: 800,
    morale: [40, 50],
    ricePerBandit: [0.12, 0.18],
    moneyRatio: 0.7,
    bossReward: { rice: 0.75, money: 0.5 },
    merit: 80,
    timeLimit: 8,        // 8ターン（1か月=4週の大隊任務）
    description: "賊軍20〜25名規模。1か月スパンの大規模討伐作戦（大隊任務・イベント）。"
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
  if (rank === "S") {
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

※巡察で得た盗賊情報（カード）由来で討伐した場合は、戦利品（loot）に倍率を適用してよい。

```javascript
// 例：巡察カード由来は戦利品2倍
const lootMultiplier = source === "patrol_card" ? 2 : 1
loot.rice *= lootMultiplier
loot.money *= lootMultiplier
```

---

### 6-5. 盗賊討伐ミッションの詳細フロー

#### 画面表示仕様

```typescript
interface BanditMissionDisplay {
  // ヘッダー情報
  missionName: string       // "盗賊討伐（大規模）" など
  enemyCount: string        // "3〜5名"
  rewardMerit: number       // 30
  
  // 日時表示
  currentDate: string       // "1575年4月1週目前半" など
  deadline: string          // "1575年4月2週目後半（4ターン目）まで"
  currentTurn: number       // 現在の行動ターン（1〜4）
  totalTurns: number        // 全行動ターン数（4）
  phase: "準備フェーズ" | "決戦フェーズ"
  
  // 行動ログ
  actionLog: ActionLogEntry[]
}

interface ActionLogEntry {
  turn: number | "開始"     // 行動したターン
  actionName: string        // "偵察", "足軽雇用", "任務開始"
  result: "成功" | "失敗" | "―"
  detail: string            // "敵の詳細情報を入手。人数4名、戦闘力85と判明。"
}
```

#### 行動ログの表示例

```
[第2ターン] 偵察     [成功] 敵の詳細情報を入手。人数4名、戦闘力85と判明。
[第1ターン] 足軽雇用 [成功] 足軽5名を雇用。戦力+160。
[開始]      任務開始 [―]   盗賊討伐（大規模）を開始。期限: 4ターン後まで。
```

#### 週ごとの行動選択肢

```
最終ターン以外（準備フェーズ）：
├─ 偵察
├─ 偽情報
├─ 内応者買収
├─ 足軽を雇う
└─ （なし）

最終ターン（決戦フェーズ）：
├─ 通常攻撃
├─ 夜襲
└─ 諦める

※ランクS（賊軍）は8ターン構成（第1〜7ターンが準備フェーズ、第8ターンが決戦フェーズ）で、敵戦力と報酬が特に大きい
※世界観上、徒士/馬上衆の盗賊調査・盗賊討伐（D〜A）は「小頭が上位から受けた治安関連タスク（治安回復/賊軍討伐など）」を分割して配下に下知したものとして扱う。
※S（賊軍）は、そのうち上位から賊軍を名指しで討伐指示されるケースであり、タスクの位置づけとしては治安回復と同列。
```

#### ミッション実行フロー

```javascript
function executeBanditMissionTurn(mission, player, action) {
  mission.currentTurn += 1
  
  // 最終ターンチェック
  const isFinalTurn = mission.currentTurn === mission.timeLimit
  
  if (isFinalTurn) {
    // 攻撃のみ選択可能（決戦フェーズ）
    if (action === "通常攻撃" || action === "夜襲") {
      return executeBattle(mission, player, action)
    } else if (action === "諦める") {
      return abandonMission(mission, player)
    }
  } else {
    // 準備行動（最終ターン以外）
    switch (action) {
      case "偵察":
        return executeStrategy("偵察", player, mission.bandit)
      case "偽情報":
        return executeStrategy("偽情報", player, mission.bandit)
      case "内応者買収":
        return executeStrategy("内応者買収", player, mission.bandit)
      case "足軽を雇う":
        return hireAshigaru(player, mission)
    }
  }
}
```

#### 戦闘実行

```javascript
function executeBattle(mission, player, attackType) {
  const playerPower = calculatePlayerCombatPower(player)
  
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
  timeLimit: 4,        // 期限（ターン）。4ターン=2週間の作戦
  currentTurn: 1,      // 現在ターン
  
  // プレイヤーの行動
  strategies: [],      // 実行済み計略
  additionalAshigaru: 0,  // 追加足軽
  additionalMoney: 0   // 追加費用
}

// 週ごとの選択肢
function getBanditMissionActions(mission) {
  const actions = []
  
  // 計略
  if (mission.currentTurn < mission.timeLimit) {
    actions.push("偵察", "偽情報", "内応者買収")
  }
  
  // 足軽雇用（準備期間のみ）
  if (mission.currentTurn < mission.timeLimit) {
    actions.push("足軽雇用")
  }
  
  // 攻撃（最終週 or 準備完了）
  if (mission.currentTurn === mission.timeLimit || playerReady) {
    actions.push("通常攻撃", "夜襲")
  }
  
  // 諦める
  actions.push("諦める")
  
  return actions
}
```

**フロー例（ランクA、4ターン=2週間）：**

```
【第1ターン】
選択肢：偵察 / 偽情報 / 内応者買収 / 足軽雇用 / 諦める
→ 偵察を選択
→ 弱点「統率不足」判明

【第2ターン】
選択肢：偵察 / 偽情報 / 内応者買収 / 足軽雇用 / 諦める
→ 偽情報を選択
→ 士気40 → 10（-30、弱点効果）

【第3ターン】
選択肢：偵察 / 偽情報 / 内応者買収 / 足軽雇用 / 諦める
→ 内応者買収を選択
→ 成功、戦闘力-10%

【第4ターン】（最終ターン）
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
    effect: "士気-10（弱点『統率不足』時-18）",
    cost: 0,
    expGain: { intelligence: 20 }
  },
  
  内応者買収: {
    name: "内応者買収",
    difficulty: 70,
    effect: "戦闘力-10%",
    cost: 0.3,
    expGain: { intelligence: 20 }
  },

  足軽雇用: {
    name: "足軽雇用",
    effect: "足軽5名を雇用（戦力+160）",
    cost: 0.5
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
  if (strategy === "足軽雇用") {
    if (player.money >= 0.5) {
      player.money -= 0.5
      mission.additionalAshigaru += 5
      return { success: true }
    }
    return { success: false }
  }

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
      // 敵の弱点が「統率不足」のとき効果が増す
      {
        const decrease = enemy.weakness === "統率不足" ? 18 : 10
        enemy.morale -= decrease
      }
      break
      
    case "内応者買収":
      enemy.traitor = true
      break
  }
}
```

※内応者買収は、v0.1では「偵察済み」かつ「敵勢力10名以上」の場合のみ選択可能とする。

---

## 8. 主命システム

### 8-1. 主命一覧

主命は「1ターン=週の前半または後半の行動1回分」として扱う。以下の`duration`は、**その主命が消費する行動ターン数**を表す。例えば`duration: 1`は1ターン（週の前半か後半いずれか片方）、`duration: 2`は1週間相当、`duration: 4`は2週間相当の主命を意味する。

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
    onEncounter: {
      // 盗賊遭遇時はCランク討伐ミッションを自動開始
      banditRank: "C",
      timeLimit: 4
    }
  },
  
  情報収集: {
    name: "情報収集",
    duration: 1,
    merit: 5,
    reward: { rice: 0, money: 0 },
    expGain: { intelligence: 10 },
    successRate: "60% + 知略×0.7",
    onFail: {
      merit: 0,
      reward: { rice: 0, money: 0 }
    }
  },
  
  護衛任務: {
    name: "護衛任務",
    duration: 1,
    merit: 8,
    reward: { rice: 0, money: 0 },
    attackRate: 0.1,  // 10%で襲撃
    onAttackSuccess: {
      merit: 5  // 撃退成功で+5
    },
    onAttackFail: {
      merit: 0  // 撃退失敗で功績なし
    }
  },
  
  // 物資輸送はVersion 0.5以降に延期（護衛任務と類似、優先度低）
  
  "盗賊討伐（小規模）": {
    name: "盗賊討伐（小規模）",
    duration: 4,
    banditRank: "D",
    merit: 15
  },
  
  "盗賊討伐（中規模）": {
    name: "盗賊討伐（中規模）",
    duration: 4,
    banditRank: "C",
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
    banditRank: "A",
    merit: 60,
    requireRank: "馬上衆"
  },
  
  "盗賊討伐（賊軍）": {
    name: "盗賊討伐（賊軍）",
    duration: 8,
    banditRank: "S",
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
  
  // 1ターン完結型（週の前半または後半の片方で完結する主命）
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
    return {
      success: true,
      message: "見逃した"
    }
  }
}

// 護衛任務・物資輸送の襲撃
function handleAttack(command, player) {
  const config = COMMANDS[command]
  
  // 襲撃者生成
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

巡察中に盗賊遭遇（20%）した場合、盗賊討伐ミッションを自動開始せず、**盗賊情報（カード）**として保持する。

```javascript
function handleBanditEncounter(player) {
  // ランクはまちまちでよい（D/C/B/A/S）
  const rank = weightedRandom(["D", "C", "B", "A", "S"], [45, 30, 17, 7, 1])
  const bandit = generateBandit(rank)

  addBanditCard({
    id: `card_${Date.now()}`,
    bandit,
    foundCalendarWeek: getCalendarWeek(player.turn),
    escalated: false
  })

  addLog(`盗賊情報を入手（${rank}）。一覧で対応できる`, "warning")
}
```

#### 盗賊カードの経過ルール

- 発見から2か月（=16ターン、8週）で盗賊ランクが1段階上昇する（D→C→B→A→S）。
- 発見から4か月（=32ターン、16週）で他勢力に討伐された扱いとしてカードは消滅する。
- 経過イベント（ランク上昇/消滅）は行動ログに通知してよい。

#### 盗賊カードの処理（報告/討伐）

- **報告する**：討伐功績の40%を即時獲得し、カードは消滅する。
- **討伐する**：カード由来で討伐した場合、戦利品（盗賊財産の取り分）を2倍にしてよい。

---

#### 護衛任務・物資輸送の襲撃

```javascript
function handleAttack(command, player) {
  const config = COMMANDS[command]
  
  // 襲撃者生成
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
  徒士: 1.2,      // 月1.2石
  馬上衆: 3.5,    // 月3.5石
  小頭: 5.0       // 月5石
}

const JUUBOKU_RICE = 0.3    // 従僕：月0.3石/人
const ASHIGARU_RICE = 1.2   // 徒士：月1.2石/人
const BASHO_SHU_RICE = 3.5  // 馬上衆：月3.5石/人
const HORSE_COST = 0.6      // 馬維持費：月0.6石
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
  showMessage("推奨：馬の購入（8貫）、徒士の雇用（4貫）")
}

// 借金返済（毎月自動で設定額を返済）
function repayDebt(player) {
  const repayAmount = player.monthlyRepayment || 0
  if (repayAmount === 0) return
  
  const actualRepay = Math.min(repayAmount, player.debt, player.money)
  player.money -= actualRepay
  player.debt -= actualRepay
  
  // 利子加算
  player.debt += player.debt * player.interestRate
}
```

---

### 9-5. 借金システム

```javascript
// 借金データ構造
const loan = {
  principal: 0,           // 元金
  debt: 0,                // 現在の借金残高（元金＋利子）
  monthlyRepayment: 0,    // 月々の返済額（借金時に決定）
  interestRate: 0.04,     // 月利（役職・金額で変動）
}

// 借金上限（年収相当）
const DEBT_LIMIT = {
  徒士: 14.4,      // 1.2石×12ヶ月
  馬上衆: 42,      // 3.5石×12ヶ月
  小頭: 60,        // 5石×12ヶ月
}

// 金利テーブル（借入額で変動）
// 借入額が少ないときは金利が高い
// 借入額が大きい時は金利が下がる（信用が高い）
// ※将来は商人との親密度で上限・金利が変動予定
const INTEREST_RATE_BY_AMOUNT = {
  tier1: { maxAmount: 50, rate: 0.05 },   // 50貫まで：月5%
  tier2: { maxAmount: 100, rate: 0.04 },  // 100貫まで：月4%
}

function getInterestRate(totalDebt) {
  if (totalDebt <= INTEREST_RATE_BY_AMOUNT.tier1.maxAmount) {
    return INTEREST_RATE_BY_AMOUNT.tier1.rate  // 月5%
  }
  return INTEREST_RATE_BY_AMOUNT.tier2.rate  // 月4%
}

// 借金実行
function takeLoan(player, amount, monthlyRepayment) {
  const limit = DEBT_LIMIT[player.rank]
  if (player.debt + amount > limit) {
    return { success: false, message: "借金上限を超えています" }
  }
  
  const rate = getInterestRate(player.debt + amount)
  
  player.debt += amount
  player.money += amount
  player.monthlyRepayment = monthlyRepayment
  player.interestRate = rate
  
  return { success: true, rate }
}
```

**設計意図：**
- 馬上衆だからといって馬に乗る義務はない（馬購入は任意）
- 借金は「いつでもできるが、金利が痛い」というリスク
- 役職が上がると信用が上がり、金利が下がる
- 低役職での借金は高金利で苦しい → 計画的な資金運用を促す

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

### 10-3. 賊軍討伐イベント

```javascript
function showRankDEvent(player) {
  showMessage("上司から呼び出しがありました")
  showMessage("上司：「小頭への昇進を考えている」")
  showMessage("上司：「だが、その前に一つ仕事を任せたい」")
  showMessage("上司：「賊軍が出た。これを討伐せよ」")
  
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
扶持米：月1.2石
従僕：3名
米：0.5石
金：10貫
借金：0貫
```

**月次収支：**
```
収入：1.2石
支出：
  若党2名：0.6石
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
借金：0〜12貫（馬8+徒士4を借金で購入した場合）

※以下は「馬購入+徒士1名雇用」の典型例
```

**月次収支：**
```
収入：3.5石
支出：
  従僕2名：0.6石
  徒士1名：1.2石
  馬維持：0.6石
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
□ 徒士期に米が余る（月0.45石程度）
□ 馬上衆昇進で馬購入は任意（8貫）
□ 馬上衆期に余裕がある（馬なし月2.75石、馬あり月2.15石）
□ 小頭昇進でさらに余裕が出る
```

---

### 12-3. 盗賊討伐

```
□ ランクD：徒士で安全に討伐可能（犯罪者1〜2名）
□ ランクC：徒士でほぼ互角（小規模盗賊団3〜5名）
□ ランクB：徒士では厳しい、馬上衆で余裕（中規模6〜10名）
□ ランクA：馬上衆で挑戦可能（大規模11〜15名）
□ ランクS：計略と準備で成功率50%程度（賊軍20〜25名）
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
  - 徒士期：月1.05石余剰
  - 馬上衆期：月2.45石余剰、借金8貫（約3ヶ月で返済）
  - 小頭期：さらに余裕
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
  収入：1.2石
  支出：0.75石
  余剰：0.45石

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

#### 主命効率（功績/ターン）

```
訓練：5/1 = 5
巡察：3/1 = 3（遭遇時6）
情報収集：12/1 = 12（知略依存）
護衛任務：8/1 = 8（襲撃時16）
物資輸送：10/1 = 10（襲撃時25）

盗賊討伐（小規模）：15/2 = 7.5
盗賊討伐（中規模）：30/3 = 10
盗賊討伐（大規模）：40/4 = 10
盗賊討伐（討伐戦）：60/4 = 15
盗賊討伐（賊軍）：80/8 = 10
```

#### 盗賊の強さ

```
ランクD（1〜2名）：
  戦闘力：15〜50
  徒士（64）で楽勝

ランクC（3〜5名）：
  戦闘力：70〜110
  徒士（64）でほぼ互角

ランクB（6〜10名）：
  戦闘力：150〜250
  馬上衆（106）で余裕

ランクA（11〜15名）：
  戦闘力：300〜450
  馬上衆（106）で挑戦可能

ランクS（20〜25名）：
  戦闘力：800 → 計略後504
  計略と準備で成功率50%程度
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
