# ITERATION 6 — 坐姿划船改為可計數（器械第一個計數動作）

背景：使用者提供兩支健身房實拍坐姿划船影片（斜側面、背景有其他人）。審查者已用 app 同一顆
`public/models/pose_landmarker_lite.task` 離線跑過，並用與 `elbowAngleMetric` 相同的邏輯
（每點 visibility >= 0.5、左右取平均 visibility 較高的一側）每 3 幀取樣（約 10 fps）重算出指標序列：

- `tests/fixtures/seated-row-video-a-metric.json`：335 筆，0 筆 null，影片 A 實際 12 次
- `tests/fixtures/seated-row-video-b-metric.json`：360 筆，0 筆 null，影片 B 實際 8 次

格式與 `march-real-device-metric.json` 相同：`[{ "t": <ms>, "v": <elbow 度數 | null> }]`。
實際次數已由手肘角度與手腕水平位置兩個獨立訊號交叉確認，影片 B 另以每秒 2 幀人工核對。

觀察到的數值範圍（斜側面拍攝，2D 投影會壓縮角度，所以不是教科書的 70-90 度）：
- 手臂伸直（起點/回到起點）：155-173 度
- 拉到底：101-123 度
- 影片 B 有一段中途停在約 137 度後繼續拉到 109 度，這是同一下，不得算兩次

## 範圍限制

- 禁止修改 `src/engine/**`、`src/framing.ts`、`src/exercise-session.ts`、`tools/figure-gif/**`、`public/figures/**`
- 禁止修改兩個 fixture 檔
- 所有輸出（程式、註解、commit、UI 文字）不得含 emoji
- 其他 5 個器械動作維持 demoOnly，不動

## 需求

### R1 catalog：seated-row 改為計數動作（src/exercises/catalog.ts）
- 移除 `demoOnly: true`，engine 改為 `{ kind: 'cycle', metric: 'elbowAngle', rules: SEATED_ROW_RULES }`
- 新增 `SEATED_ROW_RULES`，`rules_version: 'seated-row-v0.1'`，`direction: 'down'`，`thresholdMode: 'absolute'`，
  用 `makeDefaultCycleRules`。門檻由你依 fixture 決定，起點建議 enter 150 / bottom 130 / exit 152、minRepMs 800；
  註解寫明「依 2026-11-17 兩支健身房實拍影片離線校準（斜側面），尚未經手機實機 session 校準」
- `framingRegions: ['upper', 'hips']`
- `figureSvg: ''`（沒有 rig 規格，選單與預覽用既有 GIF；GIF 載入失敗時 fallback 為空白可接受）
- `stepsZh` 保留；`steps` 欄位可保留
- 加入相機擺放提示：若 catalog 或 train 頁已有放置提示機制就沿用；沒有則在 `safetyZh` 之外不新增欄位，
  改在 `stepsZh` 第一條前加一條「手機放在身體側面約 2 公尺、略高於腰，讓肩、手肘、手腕都入鏡」

### R2 選單與路由
- seated-row 卡片連到 `train.html?exercise=seated-row`，標籤顯示視角（側面）而非「示範」——
  既有 `main.ts` 已依 `demoOnly` 分流，理論上不必改，請確認
- `train.html?exercise=seated-row` 不再被導向 demo.html（既有守衛依 demoOnly，理論上不必改，請確認）
- `demo.html?exercise=seated-row` 依既有邏輯會顯示錯誤並導回首頁，可接受

### R3 真實資料回歸測試（新檔 tests/seated-row-real-video.test.ts）
仿照 `tests/march-real-device.test.ts` 的 `runSequence` 寫法，用 `getExercise('seated-row')` 的 rules 跑 `stepCycle`：
- 影片 A：`complete + uncertain === 12` 且 `complete >= 11`
- 影片 B：`complete + uncertain === 8` 且 `complete >= 7`
- 抗誤計：把影片 B 序列中所有值 clamp 到 >= 135（模擬只拉一半）→ 計數必須為 0
- 抗雙計：合成序列「170 → 109 → 137（停 600ms）→ 109 → 170」只算 1 次
- 追蹤中斷：影片 A 中挑一下拉到底期間把 3 筆連續樣本改成 null（約 300ms）→ 總捕捉數仍為 12（允許標 uncertain）

### R4 既有測試同步
- `tests/exercises.test.ts`：demoOnly 從 6 筆改為 5 筆；machine tier 仍 6 筆；seated-row 不是 demoOnly 且 engine 為 cycle/elbowAngle
- `tests/figure-rig.test.ts` T4b.4：rig 動作的篩選條件改為 `figureSvg !== ''`（數量仍 18）
- e2e `e2e/train-flow.spec.ts`：新增一案——器械 tab 點「坐姿划船」進入 train.html（不是 demo.html）；
  既有「滑輪下拉 → demo.html」與「train.html?exercise=lat-pulldown 被導向 demo」維持

### R5 Service worker
- `public/sw.js` CACHE_NAME 升版為 `fitness-coach-v0.6.0`

## Test Matrix

| Req | 驗證 | 標準 |
|---|---|---|
| R1 | vitest catalog 測試 | seated-row 為 cycle/elbowAngle、rules_version seated-row-v0.1、framing upper+hips |
| R2 | e2e | 坐姿划船卡片進 train.html；滑輪下拉仍進 demo.html |
| R3 | vitest 真實影片回歸 | A=12、B=8、半程 0、停頓不雙計、短中斷不漏計 |
| R4 | vitest + playwright | 既有全綠 |
| R5 | more-page 測試 | 版本格式正確 |

## 完成定義
`npx vitest run`、`npx playwright test`、`npm run build` 全綠，`git diff --stat` 只動到允許的檔案，
最後輸出一行 `DONE 6`（寫出最終門檻數值與 A/B 兩支的 complete/uncertain 數）。部署由審查者執行。
