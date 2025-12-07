# ウインドサーフへの指示: 従僕補充システムUI追加

## 概要

月次報告画面に従僕補充の選択肢を追加してください。

---

## 1. 月次報告画面（SC-06）の修正

### 現在の表示

```
【月次報告】

扶持米: +0.5石
給与支払い: -0.3石
借金利息: -0.05貫

[次へ]
```

### 修正後の表示（従僕死亡時）

```
【月次報告】

扶持米: +0.5石
給与支払い: -0.3石
借金利息: -0.05貫

━━━━━━━━━━━━━━━━━━━━━━

⚠️ 従僕の補充

死亡者: 山田太郎（武芸48）

補充候補: 田中四郎（武芸42）
費用: 金100両、米0.2石

現在の資金: 金250両、米1.5石

[補充する] [見送る]
```

---

## 2. レイアウト

### HTML構造

```html
<div class="monthly-report">
  <!-- 既存の月次報告内容 -->
  
  <!-- 従僕補充セクション（死亡者がいる場合のみ表示） -->
  <div class="retainer-replacement-section">
    <div class="section-divider"></div>
    
    <div class="warning-header">
      <span class="warning-icon">⚠️</span>
      <h3>従僕の補充</h3>
    </div>
    
    <div class="deceased-info">
      <span class="label">死亡者:</span>
      <span class="name">山田太郎</span>
      <span class="stats">（武芸48）</span>
    </div>
    
    <div class="candidate-info">
      <div class="candidate-header">補充候補</div>
      <div class="candidate-details">
        <span class="name">田中四郎</span>
        <span class="stats">（武芸42）</span>
      </div>
    </div>
    
    <div class="cost-info">
      <span class="label">費用:</span>
      <span class="cost">金100両、米0.2石</span>
    </div>
    
    <div class="current-resources">
      <span class="label">現在の資金:</span>
      <span class="resources">金250両、米1.5石</span>
    </div>
    
    <div class="action-buttons">
      <button class="btn-replace">補充する</button>
      <button class="btn-skip">見送る</button>
    </div>
  </div>
</div>
```

### CSS

```css
.retainer-replacement-section {
  margin-top: 24px;
  padding: 20px;
  background: rgba(239, 68, 68, 0.05);
  border: 2px solid #EF4444;
  border-radius: 8px;
}

.section-divider {
  height: 2px;
  background: linear-gradient(
    to right,
    transparent,
    #3a3a3a,
    transparent
  );
  margin: 24px 0;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.warning-icon {
  font-size: 24px;
}

.warning-header h3 {
  color: #EF4444;
  font-size: 18px;
  font-weight: bold;
  margin: 0;
}

.deceased-info {
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-left: 4px solid #EF4444;
  margin-bottom: 16px;
}

.deceased-info .label {
  color: #9CA3AF;
  margin-right: 8px;
}

.deceased-info .name {
  color: #EF4444;
  font-weight: bold;
}

.deceased-info .stats {
  color: #9CA3AF;
  margin-left: 4px;
}

.candidate-info {
  padding: 12px;
  background: rgba(34, 197, 94, 0.05);
  border-left: 4px solid #22C55E;
  margin-bottom: 16px;
}

.candidate-header {
  color: #9CA3AF;
  font-size: 14px;
  margin-bottom: 8px;
}

.candidate-details .name {
  color: #22C55E;
  font-weight: bold;
}

.candidate-details .stats {
  color: #9CA3AF;
  margin-left: 4px;
}

.cost-info,
.current-resources {
  padding: 8px 12px;
  margin-bottom: 8px;
}

.cost-info .label,
.current-resources .label {
  color: #9CA3AF;
  margin-right: 8px;
}

.cost-info .cost {
  color: #F59E0B;
  font-weight: bold;
}

.current-resources .resources {
  color: #FFFFFF;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: center;
}

.btn-replace {
  background: #22C55E;
  color: #000;
  padding: 12px 32px;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-replace:hover {
  background: #16A34A;
}

.btn-replace:disabled {
  background: #6B7280;
  cursor: not-allowed;
}

.btn-skip {
  background: transparent;
  color: #9CA3AF;
  padding: 12px 32px;
  border: 2px solid #3a3a3a;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-skip:hover {
  border-color: #9CA3AF;
  color: #FFFFFF;
}
```

---

## 3. 資金不足時の表示

```html
<div class="retainer-replacement-section insufficient-funds">
  <!-- 同じ内容 -->
  
  <div class="error-message">
    ⚠️ 資金が不足しています
  </div>
  
  <div class="action-buttons">
    <button class="btn-replace" disabled>補充する</button>
    <button class="btn-skip">見送る</button>
  </div>
</div>
```

```css
.error-message {
  color: #EF4444;
  background: rgba(239, 68, 68, 0.1);
  padding: 12px;
  border-radius: 4px;
  text-align: center;
  margin-bottom: 16px;
  font-weight: bold;
}
```

---

## 4. 複数死亡者がいる場合

```
⚠️ 従僕の補充（1/2）

死亡者: 山田太郎（武芸48）

補充候補: 田中四郎（武芸42）
費用: 金100両、米0.2石

[補充する] [見送る]

※残り1名の補充候補は次の画面で表示されます
```

---

## 5. 補充完了時のメッセージ

```
✓ 従僕を補充しました

田中四郎（武芸42）が加わりました。

費用: 金100両、米0.2石を支払いました。

[次へ]
```

---

## 参照ファイル

- `詳細設計書/Version0.1_詳細設計書.md` - セクション5-5「従僕補充システム」
- `UIモック/SC-06_月次報告画面.html` - 既存の月次報告画面

---

## チェックリスト

- [ ] SC-06に従僕補充セクションを追加
- [ ] 死亡者情報の表示
- [ ] 補充候補の表示
- [ ] 費用と現在の資金の表示
- [ ] 補充/見送りボタンの実装
- [ ] 資金不足時の表示とボタン無効化
- [ ] 補充完了メッセージの表示
