# ウインドサーフへの指示: 負傷システムUI追加

## 概要

戦闘結果画面と家臣一覧画面に、負傷システムのUIを追加してください。

---

## 1. 戦闘結果画面（SC-10）の修正

### 追加要素

戦闘結果に以下の情報を追加：

```
【戦闘結果】
勝利！

損失:
  死亡: 0名
  重傷: 1名（山田太郎）
  軽傷: 2名（佐藤次郎、鈴木三郎）
  無傷: 0名

獲得:
  功績: +15
  米: +0.075石
  金: +0.05貫
```

### スタイル

- **死亡**: 赤色（#EF4444）、太字
- **重傷**: オレンジ色（#F97316）
- **軽傷**: 黄色（#EAB308）
- **無傷**: 緑色（#22C55E）

### レイアウト

```html
<div class="battle-result">
  <h2 class="result-title success">勝利！</h2>
  
  <div class="casualties-section">
    <h3>損失</h3>
    <div class="casualty-item death">
      <span class="label">死亡:</span>
      <span class="count">0名</span>
    </div>
    <div class="casualty-item severe">
      <span class="label">重傷:</span>
      <span class="count">1名</span>
      <span class="names">（山田太郎）</span>
      <span class="recovery-time">※8週間で回復</span>
    </div>
    <div class="casualty-item light">
      <span class="label">軽傷:</span>
      <span class="count">2名</span>
      <span class="names">（佐藤次郎、鈴木三郎）</span>
      <span class="recovery-time">※4週間で回復</span>
    </div>
    <div class="casualty-item safe">
      <span class="label">無傷:</span>
      <span class="count">0名</span>
    </div>
  </div>
  
  <div class="rewards-section">
    <h3>獲得</h3>
    <div class="reward-item">功績: +15</div>
    <div class="reward-item">米: +0.075石</div>
    <div class="reward-item">金: +0.05貫</div>
  </div>
</div>
```

---

## 2. メイン画面（SC-03）の家臣セクション修正

### 現在の表示

```
家臣
従僕    3名
徒士    0名
```

### 修正後の表示

```
家臣
従僕    3名（正常2、軽傷1）
徒士    0名
```

### 詳細表示（クリックで展開）

```
従僕 [3名]
  ├ 山田太郎  武芸48  [正常]
  ├ 佐藤次郎  武芸53  [軽傷] あと3週で回復
  └ 鈴木三郎  武芸45  [正常]
```

### 状態表示の色

- **[正常]**: 白色（#FFFFFF）
- **[軽傷]**: 黄色（#EAB308）
- **[重傷]**: オレンジ色（#F97316）

---

## 3. 新規画面: 家臣詳細画面（SC-11）

### 概要

家臣の詳細情報を表示する画面を新規作成。

### レイアウト

```
┌─────────────────────────────────┐
│ 家臣詳細                         │
├─────────────────────────────────┤
│                                 │
│ 【従僕】                        │
│                                 │
│ ┌─────────────────────────┐   │
│ │ 山田太郎                  │   │
│ │ 武芸: 48                  │   │
│ │ 状態: [正常]              │   │
│ │ 戦闘力: 48 (100%)         │   │
│ └─────────────────────────┘   │
│                                 │
│ ┌─────────────────────────┐   │
│ │ 佐藤次郎                  │   │
│ │ 武芸: 53                  │   │
│ │ 状態: [軽傷] ⚠️          │   │
│ │ 戦闘力: 42 (80%)          │   │
│ │ 回復: あと3週間           │   │
│ └─────────────────────────┘   │
│                                 │
│ ┌─────────────────────────┐   │
│ │ 鈴木三郎                  │   │
│ │ 武芸: 45                  │   │
│ │ 状態: [重傷] ⚠️⚠️       │   │
│ │ 戦闘力: 0 (戦闘不可)      │   │
│ │ 回復: あと7週間           │   │
│ └─────────────────────────┘   │
│                                 │
│ 【徒士】                        │
│ （なし）                        │
│                                 │
│          [閉じる]               │
└─────────────────────────────────┘
```

### カード要素のCSS

```css
.retainer-card {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.retainer-card.normal {
  border-left: 4px solid #22C55E;
}

.retainer-card.light-injury {
  border-left: 4px solid #EAB308;
  background: rgba(234, 179, 8, 0.05);
}

.retainer-card.severe-injury {
  border-left: 4px solid #F97316;
  background: rgba(249, 115, 22, 0.05);
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.normal {
  background: #22C55E;
  color: #000;
}

.status-badge.light {
  background: #EAB308;
  color: #000;
}

.status-badge.severe {
  background: #F97316;
  color: #fff;
}
```

---

## 4. 盗賊討伐画面（SC-08）の修正

### 自軍情報セクションに負傷状態を追加

```
自軍情報
戦力: 206 (実効戦力: 188)
従僕: 3名（正常2、軽傷1）
徒士: 0名
勝率: 95%
```

### 注記

- **実効戦力**: 負傷者の戦闘力減少を反映した実際の戦力
- 軽傷者がいる場合は括弧内に内訳を表示

---

## 参照ファイル

- `詳細設計書/Version0.1_詳細設計書.md` - セクション5-4「負傷システム」
- `UIモック/SC-03_メイン画面.html` - 既存のメイン画面
- `UIモック/SC-08_盗賊討伐画面.html` - 既存の盗賊討伐画面
- `UIモック/SC-10_戦闘結果画面.html` - 既存の戦闘結果画面

---

## チェックリスト

- [ ] SC-10に損失の詳細表示を追加（死亡、重傷、軽傷、無傷）
- [ ] SC-03の家臣セクションに負傷状態の内訳を追加
- [ ] SC-11（家臣詳細画面）を新規作成
- [ ] SC-08の自軍情報に実効戦力と負傷状態を追加
- [ ] 各状態に適切な色分けを適用
- [ ] 回復期間の表示を追加
