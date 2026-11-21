# ITERATION 8 — 電視模式（手機橫放鏡像到電視的大字版面）

背景：使用者 2026-11-21 在家用 Android 手機把訓練頁「投放螢幕」鏡像到 Android TV，實拍 20 秒驗證：
- 鏡像可用，計數 6 -> 10 正常跳，骨架與動作同步，看不出明顯延遲
- 問題：手機直立時電視上只有約 1/4 寬的直條畫面，右上角次數框太小，站在運動位置看不清

本輪做法：不改計數邏輯，只新增一個「電視模式」版面。手機橫放時，畫面左側是大字資訊欄，
右側是相機與骨架。鏡像到電視後整個電視都是有用的畫面。Presentation API 不在本輪範圍。

## 範圍限制

- 禁止修改 `src/engine/**`、`src/framing.ts`、`src/exercise-session.ts`、`src/exercises/**`、`tests/fixtures/**`
- `train.html`：只允許新增 R1 的切換開關與 R4 的提示元素，不得改動或刪除既有元素的 id
- `src/train.ts`：只允許新增電視模式切換與 R5 螢幕常亮的程式碼（合計約 80 行內），不得改動計數、引導、儲存流程
- 版面一律用 CSS 重新排既有元素（`body.tv-mode` 底下的規則），不要複製一份 DOM
- 所有輸出（程式、註解、UI 文字）不得含 emoji
- 不要 git commit

## 需求

### R1 開關與保存
- 底部控制列「語音」旁新增 `<label class="bar-toggle"><input type="checkbox" id="tv-toggle"><span>電視</span></label>`
- 勾選時 `document.body` 加上 class `tv-mode`，取消時移除
- 狀態存在 `localStorage` 的 `fc.tvMode`（值 `'1'` / `'0'`），讀寫都要包 try/catch，讀不到時預設關閉
- 網址帶 `?tv=1` 時強制開啟並寫入保存；`?tv=0` 強制關閉並寫入保存
- 頁面載入時依保存值或網址參數套用，checkbox 狀態要同步

### R2 橫放版面（`body.train-page.tv-mode` 且 `@media (orientation: landscape)`）
- 相機區 `#cam-wrap`：`left: 42%`，寬 58%，高 100%；video 維持 `object-fit: cover`
  （`renderSkeletonOverlay` 用 `elOverlay.clientWidth/Height` 計算，相機區縮小後骨架會自動對齊，不要改這段）
- 左側 42% 是資訊欄，深色底 `#0b1220`，由上而下：
  1. `#top-band`：改成資訊欄頂端（`left:0; width:42%; right:auto`），動作名稱 `font-size: 4vh`，
     狀態文字 `#top-status-text` `font-size: 7vh`，組數進度 `font-size: 4vh`；tone 顏色規則保持有效
  2. `.hud-rep-box`：移到資訊欄中央，去掉背景框，`#rep-complete` 字級 `min(46vh, 30vw)`，
     「待確認」那行 `font-size: 4vh`
  3. `.bottom-bar`：移到資訊欄底部（`width:42%`），按鈕可以縮小但觸控高度不低於 40px
- `.hud-knee` 在電視模式隱藏
- `.stage-alerts`、`#preview-overlay`、`#guide-overlay` 在橫放時要完整可見、可操作：
  卡片 `max-height: 92vh` 並可捲動，不得被裁切
- 所有文字不得溢出資訊欄（e2e 檢查元素右緣不超過資訊欄右緣）

### R3 未開電視模式時完全不變
- 沒有 `tv-mode` class 時，任何既有元素的位置、字級都不能變（e2e 檢查 `#rep-complete` 仍為 68px）

### R4 直立時的提示
- `train.html` 新增 `<div id="tv-rotate-hint" class="tv-rotate-hint">電視模式請把手機橫放</div>`
- 只有 `body.tv-mode` 且直立時顯示（CSS 控制），置中、字級 20px 以上、不擋底部按鈕；其他情況 `display:none`

### R5 訓練中螢幕常亮
- 鏡像投影時手機螢幕若自動變暗或鎖定，電視就斷了。開始取樣後呼叫 `navigator.wakeLock.request('screen')`；
  不支援或失敗時靜默略過（`console.warn` 一行即可），不得影響訓練
- 頁面回到前景（`visibilitychange` 變 visible）且訓練仍在進行時重新取得
- 結束訓練並儲存、或頁面中斷時釋放
- 兩種模式都套用（不限電視模式）

### R6 測試
- e2e `e2e/train-flow.spec.ts` 新增：
  1. 橫放 viewport 915x412，開 `train.html?exercise=squat&tv=1`：body 有 `tv-mode`；`#tv-toggle` 已勾選；
     `#cam-wrap` 左緣 >= 0.4 * 915；`#overlay` 的 clientWidth 等於 `#cam-wrap` 寬度；
     `#rep-complete` 計算字級 >= 150px；`#top-band` 與 `.hud-rep-box` 右緣 <= 0.42 * 915 + 1；
     示範卡「我知道了，開始」按鈕在 viewport 內可點
  2. 直立 viewport 390x844 開 `?tv=1`：`#tv-rotate-hint` 可見；不帶 tv 參數重新載入後仍為 tv-mode（保存生效）；
     點 `#tv-toggle` 取消後 `#tv-rotate-hint` 不可見、`#rep-complete` 字級回到 68px
  3. `?tv=0` 開啟後 body 沒有 `tv-mode`
- 既有 e2e 全部維持通過（預設 viewport 390x844，未開電視模式）
- 先清掉 localStorage 再跑各案，避免案例互相影響
- `public/sw.js` CACHE_NAME 升為 `fitness-coach-v0.8.0`

## Test Matrix

| Req | 驗證 | 標準 |
|---|---|---|
| R1 | e2e 案 2、3 | 開關、網址參數、保存都生效 |
| R2 | e2e 案 1 | 相機區 58%、骨架畫布對齊相機區、大字 >= 150px、資訊欄不溢出、示範卡可點 |
| R3 | e2e 案 2 + 既有全部 | 未開時 68px，既有案全綠 |
| R4 | e2e 案 2 | 直立提示顯示與隱藏 |
| R5 | 審查者實機（Playwright 無法驗螢幕常亮） | 程式有 feature detect、失敗不拋錯 |
| 全部 | vitest + build | 全綠 |

## 完成定義
`npx vitest run`、`npm run build`、`npx playwright test` 全綠，`git status` 只出現允許範圍內的變更，
另存兩張截圖到 `docs/review/tv-mode-landscape.png`（915x412，示範卡關閉後）與 `docs/review/tv-mode-portrait.png`，
最後輸出一行 `DONE 8`（附 train.ts 新增行數）。
