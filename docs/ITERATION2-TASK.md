# Iteration 2 任務一：深蹲 FSM 核心引擎（純邏輯 + 單測）

依據 KB 規格「OPPO Reno2 PWA AI 健身教練規格 v0.1」第 5、6 節。本任務只做**不碰 DOM、不碰相機**的純 TypeScript 引擎與單元測試；UI 接線是下一個任務，不要做。

## 交付物（新增檔案，不得改動既有 src/*.ts 除了指定處）

| 檔案 | 內容 |
|---|---|
| `src/engine/types.ts` | Session / Set / Rep / PoseSample / Quality / CoachEvent 型別（照下方 schema） |
| `src/engine/features.ts` | 33 landmarks（側面）→ 每幀特徵：膝角度、髖角度、髖相對高度、關鍵點可見性 |
| `src/engine/squat-fsm.ts` | 深蹲狀態機 + 計數規則 `squat-side-v0.1` |
| `src/engine/rep-engine.ts` | 串接層：樣本流入 → 品質門 → FSM → Rep 紀錄輸出 |
| `tests/squat-fsm.test.ts` 等 | vitest 單測，覆蓋下方測試矩陣每一列 |
| `package.json` | 僅允許加 devDependency `vitest` 與 script `"test": "vitest run"` |

## 需求（每條有 ID，驗收逐條對）

### R1 特徵計算（features.ts）
- R1.1 輸入為 MediaPipe 33 normalized landmarks（{x,y,z,visibility}[]），輸出 `FrameFeatures`：左右膝角度（hip-knee-ankle 三點夾角，度）、髖角度（shoulder-hip-knee）、髖 y 相對站立基線的位移比、本幀關鍵點（11,12,23,24,25,26,27,28）最低 visibility。
- R1.2 任一關鍵點 visibility < 0.5 → `valid:false`，角度輸出 null，不得丟 NaN。
- R1.3 側面視角：以可見性較高的一側（左/右）為主側，輸出 `side: 'left'|'right'`。

### R2 狀態機（squat-fsm.ts）
- R2.1 狀態：`NOT_READY → STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING`。
- R2.2 進入 STANDING（校準）：連續 >= 1.0 秒 valid 且膝角度 > standUpAngle（預設 160 度）。
- R2.3 轉換用遲滯雙門檻：下降判定 kneeAngle < descendEnter（130），BOTTOM 判定 kneeAngle < bottomEnter（100），上升回 STANDING 判定 kneeAngle > standUpAngle（160）。全部參數集中於一個 `SquatRules` 物件，`rules_version: 'squat-side-v0.1'`，不得散落 magic number。
- R2.4 最短合理時間：單次 rep（離開 STANDING 到回 STANDING）>= 600ms，否則視為抖動不計數。
- R2.5 完整下降-上升且 BOTTOM 有效樣本 >= 3 → 發出 `rep_complete` 事件；過程中出現 invalid 樣本缺口 > 300ms → 該下改發 `rep_uncertain`，絕不猜測補數。
- R2.6 invalid 樣本連續 > 1000ms → 退回 NOT_READY，當前未完成的 rep 標 uncertain 丟出。
- R2.7 FSM 為純函式風格：`step(state, features, timestampMs) → { state, events }`，不可變更新，無副作用、無 Date.now、無全域狀態。

### R3 Rep 紀錄（rep-engine.ts）
- R3.1 每個 rep 輸出：rep_id（呼叫端注入的 idFactory 產生）、start_ms、end_ms、status（complete|uncertain）、metrics.tempo_ms、quality.valid_sample_count、quality.tracking_gap_ms、觸發理由字串。
- R3.2 引擎吐出 Set 層彙總：reps 陣列、總樣本數、總缺口 ms、使用的 rules_version。
- R3.3 時間一律用呼叫端傳入的單調 timestampMs，引擎內不得自取時間。

### R4 Schema（types.ts）
照規格 v0.1 JSON（schema_version 0.1.0）：Session{session_id, device_profile_id, started_at, pose_model, rules_version, camera, consent, sets[]}、Set{set_id, exercise, view, reps[]}、Rep 如 R3.1。PoseSample{t_ms, landmarks, valid}。

## 測試矩陣（vitest，每列至少一測；合成 landmark 序列放 tests/fixtures.ts 用產生器函式做，不要手打幾百行）

| ID | 情境 | 斷言 |
|---|---|---|
| T1 | 標準 3 下深蹲序列（站立→130 以下→100 以下→回 160） | count=3，全部 complete，tempo 合理 |
| T2 | 半蹲（最低只到 110，未達 bottomEnter） | count=0，無事件或僅狀態轉換 |
| T3 | 抖動（膝角在 158-163 快速震盪） | count=0（R2.4 最短時間擋掉） |
| T4 | 下蹲途中遮擋 500ms（invalid 缺口 > 300ms）後完成 | 該下 status=uncertain（R2.5） |
| T5 | 連續 invalid 1.2s | 回 NOT_READY，未完成 rep 以 uncertain 丟出（R2.6） |
| T6 | visibility 0.4 的幀 | features valid:false、無 NaN（R1.2） |
| T7 | 同一序列跑兩次 step 鏈 | 結果完全相同（純函式，R2.7） |
| T8 | 左側清楚右側遮擋 | side='left' 且角度取左側（R1.3） |
| T9 | rep 完成事件帶的 quality 欄位 | valid_sample_count 與 tracking_gap_ms 數值正確（R3.1） |

## 硬性約束
- TypeScript strict（沿用現有 tsconfig，不得改 compilerOptions）。
- 引擎碼零 DOM / 零瀏覽器 API；`npm run build` 與 `npx vitest run` 都必須綠。
- 不可變資料（spread 回新物件），函式 < 50 行，檔案 < 400 行。
- 全程不用 emoji；註解繁體中文或英文皆可。
- 不得引入 vitest 以外任何新依賴。
- 完成後在 stdout 輸出：變更檔案清單 + `npx vitest run` 實際輸出摘要。
