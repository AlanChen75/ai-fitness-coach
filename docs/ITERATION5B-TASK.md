# ITERATION 5B — 器械分類上線 + 選單/預覽改用動畫 GIF

前置：5A 完成（public/figures/ 有 24 張 GIF 且通過審查）。

目標：
1. 首頁新增第四個分類「器械」，放 6 個器械動作（示範教學，不計數）
2. 選單卡片與訓練頁入位預覽的人物圖，由內嵌 SVG 改為動畫 GIF
3. 器械動作點進去是示範頁（動畫 + 目標肌群 + 操作要點），不是訓練頁

## 範圍限制

- 禁止修改 `src/engine/**`、`src/framing.ts`、`src/exercise-session.ts`
- `src/train.ts` 只允許兩處：預覽圖改 GIF、demoOnly 守衛（見 R4）
- 所有輸出不得含 emoji

## 需求

### R1 catalog 擴充（src/exercises/catalog.ts）
- `ExerciseDef` 加 `demoOnly?: boolean` 與 `steps?: string[]`（操作要點，每條一句）
- 新增 6 筆器械動作（id 與 5A 的 R7 表一致：lat-pulldown、chest-press-machine、seated-row、leg-press、shoulder-press-machine、leg-extension），`demoOnly: true`，含中文名稱、目標肌群文字、3-4 條操作要點；不需要 engine 門檻設定（型別上允許 demoOnly 項目省略計數設定，或給佔位值但永不使用）
- tier 體系：新增 `'machine'` tier，中文標籤「器械」

### R2 首頁第四分頁（index.html + src/main.ts）
- tab 列新增「器械」，`data-tier="machine"`，6 張卡片
- 所有卡片（含原 18 個）的人物圖改為 `<img src="./figures/<id>.gif" loading="lazy" alt="<名稱>示範">`
- 卡片保留名稱與目標肌群文字
- 器械卡片點擊導向 `demo.html?exercise=<id>`；徒手卡片維持 `train.html?exercise=<id>`

### R3 示範頁（demo.html + src/demo-page.ts）
- 大圖顯示該動作 GIF（寬度滿版、最大 420px 置中）
- 顯示：動作名稱、目標肌群、操作要點清單（steps）
- 「回選單」連結；無相機、無計數
- 未知或非 demoOnly 的 exercise 參數：顯示錯誤並導回首頁
- head 三件套與其他頁一致（manifest、icons、theme-color）

### R4 train.ts 守衛與預覽圖
- URL 帶 demoOnly 動作時直接 `location.replace('./demo.html?exercise=<id>')`
- 入位預覽區的人物示範圖改用 GIF（`./figures/<id>.gif`）；figure-rig SVG 程式保留不刪（單測仍在），只是不再掛到預覽 DOM
- GIF 載入失敗時 fallback 顯示原 SVG 圖（onerror 切換）

### R5 Service worker 與快取
- `public/sw.js` CACHE_NAME 升版；`demo.html` 加入 PRECACHE
- figures/ 不進 PRECACHE（走既有 runtime cache-first）

### R6 測試
- 單測：catalog 24 筆、6 筆 demoOnly 且含 steps、demo.html 結構（title、#demo-fig、#demo-steps、回首頁連結）、index.html 四個 tab
- 既有 figure-rig 單測維持全綠（程式保留）
- e2e（Playwright）：
  - 首頁四 tab，各 tier 卡片數 6/6/6/6，卡片 img src 指向 figures/
  - 點器械卡 → demo.html 顯示名稱與要點
  - 點徒手卡 → train.html 照常
  - train.html?exercise=lat-pulldown 被導向 demo.html

## Test Matrix

| Req | 驗證 | 標準 |
|---|---|---|
| R1 | vitest catalog 測試 | 24 筆、demoOnly/steps 齊 |
| R2 | e2e 首頁 | 4 tab、各 6 卡、img 路徑正確 |
| R3 | vitest 結構測試 + e2e 點擊 | demo 頁渲染名稱/要點/GIF |
| R4 | e2e redirect 測試 | demoOnly 進 train 被導走 |
| R5 | 讀 sw.js | 版本升、demo.html 在 PRECACHE、figures 不在 |
| R6 | `npx vitest run` + `npx playwright test` | 全綠 |

## 完成定義
全部測試綠 + `npm run build` 成功，輸出一行 `DONE 5B`。部署由審查者執行。
