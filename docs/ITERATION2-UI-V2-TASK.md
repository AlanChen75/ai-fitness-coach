# Iteration 2 UI v2：訓練頁全螢幕疊加重做

## 背景（為什麼重做）

真機實測（Xiaomi 13 Pro，session 8d8e198c）78 秒 677 樣本 0 次計數。根因：

1. 使用者面對鏡頭做深蹲（正面視角），但 FSM 是側面規則。正面投影下膝角中位數 175 度，永遠過不了 130 度下蹲門檻。
2. 41% 幀追蹤品質不足（半身入鏡／太近），前 10 秒 visibility 約 0.01。
3. 舊 UI「上方數據＋下方畫面」分割，沒有任何「系統看不看得到你／站位對不對」的即時引導。

本次重做訓練頁為「全螢幕相機 + 疊加 HUD + 入位引導」。參考業界模式：骨架依追蹤品質變色、入位檢查通過才開始計數、狀態色帶（紅＝入位問題／黃＝校準中／綠＝計數中）。

## 硬性約束（違反即退件）

- `src/engine/**` 一行都不准改。`src/storage.ts`、`src/tts.ts` 的既有 export 簽名不准改（可新增）。
- `src/pose-benchmark.ts` 簽名不變。`src/db.ts` 不變。
- device-check 頁、review 頁、index 頁不改版面（index 文案可微調）。
- 不加任何新依賴。既有 14 個測試必須全綠。
- `public/sw.js` CACHE_NAME 升為 `fitness-coach-v0.3.0`。
- 禁 emoji。純函式、不可變資料、無 Date.now（UI 層計時可用 performance.now，由呼叫端注入給純函式）。

## R8 新模組 `src/framing.ts`（純函式，必須可測）

所有門檻集中在一個 exported const `DEFAULT_FRAMING_RULES`（versioned：`framing-v0.1`）。

### R8.1 全身入鏡檢查 `checkBodyInFrame(landmarks, rules)`
- 必要 landmark：11,12,23,24,25,26,27,28（肩、髖、膝、踝）。
- 全部 visibility >= 0.5 且 x,y 都在 [0.03, 0.97] 內 → `inFrame: true`。
- 回傳 `{ inFrame, missing: 'upper'|'lower'|'all'|null }`：踝/膝缺 → 'lower'（提示「請後退，讓腳也入鏡」）；肩缺 → 'upper'；全缺 → 'all'。

### R8.2 側面偵測 `detectFacing(landmarks, rules)`
- 原理：正面時兩肩 x 距離大，側面時近乎重合。
- `shoulderSpanX = |x11 - x12|`、`torsoLen = dist(mid(11,12), mid(23,24))`。
- `ratio = shoulderSpanX / torsoLen`（torsoLen < 1e-6 回 'unknown'）。
- ratio > 0.55 → 'front'；ratio < 0.35 → 'side'；之間 → 'oblique'。
- 任一必要 landmark（11,12,23,24）visibility < 0.5 → 'unknown'。

### R8.3 入位狀態機 `updatePositioning(state, input, nowMs)`（純函式）
- input = `{ inFrame, facing }`。
- 條件「inFrame 且 facing === 'side'」連續保持 >= 1200ms → `ready: true`（之後交給既有引擎校準）。
- 條件中斷即重算。state 不可變更新。

## R9 訓練頁改版 `train.html` + `src/train.ts`

### R9.1 全螢幕舞台
- video 滿版（fixed inset 0、object-fit: cover、直式優先），骨架 canvas 同尺寸疊加。前鏡頭時兩者鏡像（沿用 .mirrored）。
- 注意：object-fit cover 會裁切，骨架座標必須做相同的 cover 映射（依 video 原始寬高比與視窗比例計算 offset/scale），否則骨架會偏移。這是本次實作的最大技術風險點，必須在真機以外先用桌機攝影機驗證過。

### R9.2 頂部狀態色帶（唯一要看的地方）
- 固定頂部，大字（>= 20px）+ 底色全寬：
  - 紅：入位問題，文案依 framing 結果：「請讓全身入鏡（後退一點）」／「請側面對鏡頭（轉身 90 度）」／「偵測不到人」
  - 黃：「校準中：請站直不動」（引擎 NOT_READY 且入位 OK）
  - 綠：「計數中」+ 目前 FSM 中文狀態（下蹲中／蹲底／起身中）
- 色帶下方小字顯示本組/已完成組數。

### R9.3 疊加 HUD
- 右上：完成次數大字（>= 64px，半透明深色圓角底、backdrop-filter 可用則用）；下方小字「待確認 N」。
- 骨架顏色 = 追蹤品質：綠（valid 幀）、黃（landmark 有但平均 visibility < 0.5）、無 landmark 時不畫。
- 左下小字：膝角即時值（debug 用，字小不搶）。

### R9.4 入位引導層（開始訓練前的覆蓋層）
- 半透明深色覆蓋，中央：側面站位示意（用 inline SVG 畫簡易人形側面輪廓即可，禁外部圖）、三條檢查清單即時打勾：全身入鏡／側面站位／保持穩定。
- 三項全過（R8.3 ready）→ 覆蓋層自動淡出並自動呼叫既有 startSet 開始本組，TTS 說「開始」（沿用引擎校準→STANDING 的既有播報即可，不重複）。
- facing === 'front' 持續 >= 3 秒 → TTS 提示「請側面對鏡頭」（新增 cue kind 'facing'，沿用 cooldown 機制）。
- 「結束一組」後回到引導層（下一組重新入位）但清單通常立即全過，體感順暢。

### R9.5 底部控制列
- 半透明橫列固定底部：結束一組／結束訓練並儲存／切換鏡頭／語音開關（皆 >= 48px 高）。「開始一組」由入位自動觸發，不設按鈕；但保留「跳過引導直接開始」小字連結（防誤判卡死）。
- 中斷（背景／track ended）邏輯、checkpoint、儲存流程全部沿用現有實作不變。
- 返回連結（回首頁／回顧）放色帶右側小圖示或控制列。

## R10 測試（新增，必須先紅後綠）

tests/framing.test.ts：
- T10.1 正面站立 fixture（肩距大）→ facing 'front'。
- T10.2 側面站立 fixture（肩幾乎重合）→ 'side'。
- T10.3 膝/踝 visibility 0.2 → inFrame false 且 missing 'lower'。
- T10.4 updatePositioning：side+inFrame 持續 1200ms → ready；中途 300ms 變 front → 重新計時不 ready。
- T10.5 landmark 不足 → facing 'unknown'、inFrame false。
- T10.6 cover 映射函式（將其抽成純函式 `coverTransform(videoW, videoH, viewW, viewH)` 回傳 scale/offsetX/offsetY）：直式視窗配 480x640 與橫式來源各驗一組數值。

既有 14 測試全綠。`npm run build`（tsc strict）綠。

## 驗收摘要

- 打開訓練頁 → 全螢幕相機 + 入位引導層；站正面會被指出「請側面對鏡頭」；側面全身入鏡穩定 1.2 秒自動開始；頂部色帶紅黃綠對應狀態；計數大字疊右上。
- 完成後報告：改了哪些檔、測試輸出、以及 cover 映射的驗證方式。
