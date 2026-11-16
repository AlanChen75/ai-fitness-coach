# Iteration 3b：動作選單頁 + 跟練整合（UI 層）

## 背景

3a 已完成邏輯層（commit 75a8bfe）：`src/engine/cycle-fsm.ts`（通用循環引擎）、`src/exercises/`（catalog 5 動作、metrics、figures SVG）。本任務把它接上 UI：動作選單頁 → 動作示範預覽 → 進入跟練（訓練頁按動作 id 切換引擎與引導）。

## 硬性約束（違反即退件）

- `src/engine/**`（含 cycle-fsm.ts）、`src/exercises/**`、`src/framing.ts`、`src/storage.ts`、`src/pose-benchmark.ts`、`src/db.ts`、device-check 頁一律不改。`src/tts.ts` 僅可新增（不改既有簽名）。
- 不加依賴。既有 31 測試全綠。禁 emoji。
- `public/sw.js` CACHE_NAME 升 `fitness-coach-v0.4.0`，PRECACHE 加入新頁。
- 計數語意不准動：uncertain 永不顯示成 complete。

## R16 動作選單頁 `exercises.html` + `src/exercises-page.ts`

- 卡片格（直式兩欄、卡片含 figureSvg、nameZh、targetsZh chips、view 標記「側面」/「正面」），tier 分段：
  - 「初級」區：5 張卡全部可點。
  - 「中級」「高級」區：各放一張鎖定佔位卡（文案「即將推出：線條雕塑 / 體態維持」），不可點，視覺降透明度。
- 點卡片 → `train.html?exercise=<id>`。
- index.html 首頁的「訓練」按鈕改連到 `exercises.html`（文案「選擇動作」）；保留直接「回顧」。
- vite.config.ts 加 entry。樣式沿用現有 design tokens（--surface 卡片、--accent 強調），卡片觸碰區 >= 48px。

## R17 訓練頁按動作驅動 `src/train.ts` + `train.html`

### R17.1 動作解析
- 讀 `?exercise=<id>`，用 `getExercise(id)`；無參數或查無 → 預設 'squat' 並照常運作（不報錯）。
- 頂部色帶左側顯示動作名稱（小字，狀態文字之上或之前）。

### R17.2 示範預覽層（入位引導層的前一步）
- 進頁先顯示「動作預覽卡」覆蓋層：figureSvg（放大）、nameZh、stepsZh 逐條、safetyZh（警示色小框）、按鈕「我知道了，開始」（>= 48px）。
- 按下後才開相機（把現有的 initCameraAndModel 呼叫移到這裡，不再頁面載入即開）→ 進入既有入位引導層。
- 「跳過引導直接開始」保留既有行為。

### R17.3 入位引導按視角切換
- `exercise.view === 'side'` → 要求 facing 'side'（現行為）。
- `view === 'front'` → 要求 facing 'front'（framing.detectFacing 已會回 'front'），清單第二項文字改「正面站位」，提示文字與 TTS 相應改為「請正面對鏡頭」（tts 新增 cue，沿用 cooldown；不可改既有簽名，新增 announce 方法或直接用 announceCue）。
- 引導層的人形示意直接用該動作的 figureSvg。

### R17.4 引擎分流
- `engine.kind === 'squat'` → 現行 processSample 流程完全不變。
- `engine.kind === 'cycle'` → 每幀：`computeMetric(metric, landmarks)` → `stepCycle(state, { t_ms, value, valid }, rules)`。
  - HUD 計數 = cycle reps complete 數；待確認 = uncertain 數；左下 debug 值顯示當前 metric 值（膝角顯示度數、其餘顯示小數兩位）。
  - 色帶：`toCycleUiStatus` 'calibrating' → 黃「校準中：請保持起始姿勢」；'ready' → 綠「準備好了，開始動作」；'active' → 綠「計數中」。
  - TTS：rep_complete → announceRep(完成數)；校準完成（READY state_change）→「開始」（沿用 calibration cue）；invalid_streak_exceeded → announceInvalid。
- Session 儲存：SetSummary 由 cycle 路徑手組（`getCycleSetStats` + rep 映射：peak_value 填入 metrics.min_knee_angle 欄位僅當 metric 是 kneeAngle，否則 min_knee_angle 為 null；rules_version 取該動作 rules_version；`exercise` 欄位填動作 id；`view` 填動作 view）。型別以既有 SetSummary/Rep 為準（不改 engine types；quality.valid_sample_count 填 rep 的 valid_sample_count，quality.tracking_gap_ms 填 rep tracking_gap_ms）。
- PoseSequence/OPFS/checkpoint/中斷邏輯完全沿用，不分動作。

### R17.5 回顧頁 `src/review.ts`
- Session 列表與明細顯示動作中文名（由 set.exercise id 查 catalog，查無則原樣顯示 id）。
- rep 表 min_knee_angle 欄位標題改「峰值」，null 顯示 '--'（不破壞舊資料）。

## R18 測試

- tests/ui-support 既有不動。新增 `tests/cycle-session.test.ts`：cycle rep 紀錄 → SetSummary/Rep 映射函式（抽成純函式放 `src/exercise-session.ts` 以便測試）：peak_value→min_knee_angle 規則、exercise/view/rules_version 正確、uncertain 保留。至少 3 案例。
- 既有 31 全綠；`npm run build`（tsc strict）綠。

## 完成回報

`npx vitest run` 與 `npm run build` 輸出摘要、R16-R18 自評、檔案清單。不要 git commit。
