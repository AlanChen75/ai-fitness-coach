# Iteration 3a：通用動作循環引擎 + 初級動作目錄（純邏輯層，無 UI）

## 背景與目標

產品要從「只有深蹲」擴成「動作選單」。初級班受眾為銀髮族與初學女性，首批 5 個徒手動作：

| id | 名稱 | 視角 | 計量 | 備註 |
|---|---|---|---|---|
| squat | 深蹲 | side | 膝角 | 沿用既有 squat FSM，不重寫 |
| sit-to-stand | 椅子坐站 | side | 膝角 | 坐到站循環，銀髮經典訓練 |
| calf-raise | 提踵 | side | 肩部上升量（相對基線） | 可扶牆做 |
| march | 原地踏步抬腿 | front | 膝蓋抬升量 | 正面視角 |
| wall-pushup | 牆壁伏地挺身 | side | 肘角 | 可對牆做 |

本任務只做邏輯層：通用循環引擎、動作目錄、計量函式、SVG 簡筆示意圖、完整測試。UI 整合是下一任務（3b），本任務不改任何 html/train.ts/review.ts。

## 硬性約束（違反即退件）

- `src/engine/` 既有檔案（types.ts、features.ts、squat-fsm.ts、rep-engine.ts）一行不改。只准新增檔案。
- `src/framing.ts`、`src/storage.ts`、`src/tts.ts`、`src/pose-benchmark.ts`、所有 html、train.ts、review.ts、sw.js 本任務一律不碰。
- 不加依賴。既有 20 測試全綠。禁 emoji。純函式、不可變、無 Date.now（時間由呼叫端注入）。
- 計數鐵律與深蹲相同：**寧漏不錯**。追蹤缺口 > 300ms 的 rep 標 uncertain；連續 invalid > 1000ms 重置回未就緒並把未完成 rep 以 uncertain 結算；最短 rep 時長防抖。

## R11 通用循環引擎 `src/engine/cycle-fsm.ts`

深蹲 FSM 的抽象化：任何「單一標量指標沿一個方向越過門檻再回來」的動作都用它計數。

### CycleRules（versioned，門檻全部集中）
```
interface CycleRules {
  rules_version: string            // 例 'cycle-v0.1'
  direction: 'down' | 'up'         // down=指標下降進入動作（深蹲膝角）；up=上升進入（提踵上升量）
  thresholdMode: 'absolute' | 'baseline-delta'
  enterThreshold: number           // 離開站姿、進入動作（遲滯外門檻）
  bottomThreshold: number          // 動作到位（遲滯內門檻）
  exitThreshold: number            // 回到準備位
  calibrationMs: number            // 1000：連續 valid 校準
  minRepMs: number                 // 最短 rep 防抖
  minBottomSamples: number         // 到位需 >= N 個樣本才可能 complete
  maxGapMs: number                 // 300：超過則該 rep uncertain
  invalidResetMs: number           // 1000：連續 invalid 重置
}
```
- `thresholdMode 'baseline-delta'`：校準期間收集指標樣本，取中位數為 baseline，門檻解讀為「相對 baseline 的位移量」（提踵用：肩部上升 delta）。'absolute' 則直接比對指標值（膝角、肘角）。
- `direction 'up'` 時，enter/bottom/exit 的比較方向反轉（指標越大越深入動作）。實作建議：內部把指標正規化成「進入深度」一個方向，避免到處寫兩套比較。

### 介面（鏡射既有 squat FSM 的事件/輸出形狀）
- `createCycleState(rules)`、`stepCycle(state, sample, rules)`，sample = `{ t_ms: number, value: number | null, valid: boolean }`。
- 輸出事件與 rep 結算語意對齊 squat FSM：phase（NOT_READY/READY/ENTERING/BOTTOM/RETURNING 命名可自定，但要能映射到「校準中/準備/進行中」三類 UI 狀態）、rep_complete / rep_uncertain 事件、state_change 事件含 reason。
- rep 紀錄欄位：`{ start_ms, end_ms, status, tempo_ms, peak_value, tracking_gap_ms, reason }`（peak_value = 本 rep 指標最深值）。
- 提供 `getCycleSetStats(state)` 回傳樣本數/有效數/總缺口，供 3b 組 SetSummary。

## R12 計量函式 `src/exercises/metrics.ts`（純函式）

每個回傳 `{ value: number | null, valid: boolean }`，visibility < 0.5 的必要點直接 valid:false、value:null（絕不回 NaN）：

- `kneeAngleMetric(landmarks)`：直接複用 `extractFeatures`（import 自 engine/features）取 kneeAngle。
- `elbowAngleMetric(landmarks)`：側面肘角。左右側各算（肩 11/12、肘 13/14、腕 15/16），取可見度較高側，角度 = 肩-肘-腕夾角。
- `shoulderRiseMetric(landmarks)`：肩中點 y 與軀幹長：`value = -(midShoulderY)/torsoLen`（y 向上為負，正規化成「越高值越大」，搭配 baseline-delta + direction 'up'）。torsoLen < 1e-6 → invalid。
- `kneeLiftMetric(landmarks)`：正面抬腿：兩膝各算 `(hipY - kneeY)/torsoLen`（膝高於髖為正），取兩側較大值。髖/膝任一側可見即可算該側；兩側皆不可見 → invalid。

## R13 動作目錄 `src/exercises/catalog.ts`

```
interface ExerciseDef {
  id: string
  nameZh: string
  tier: 'beginner' | 'intermediate' | 'advanced'
  view: 'side' | 'front'
  targetsZh: readonly string[]      // 例 ['大腿', '臀部']
  stepsZh: readonly string[]        // 2-4 條動作要領，銀髮友善口吻
  safetyZh: string                  // 例 '可扶椅背或牆面保持平衡'
  figureSvg: string                 // 來自 figures.ts
  engine: { kind: 'squat' } | { kind: 'cycle'; metric: MetricId; rules: CycleRules }
}
export const EXERCISES: readonly ExerciseDef[] = [...5 筆...]
export function getExercise(id: string): ExerciseDef | null
```

門檻初值（之後實測再調，全部集中在各動作的 rules 物件）：
- sit-to-stand：膝角 absolute down，enter 150 / bottom 110 / exit 160，minRep 1000ms（坐站較慢）。
- calf-raise：shoulderRise baseline-delta up，enter +0.03 / bottom +0.05 / exit +0.015，minRep 600ms。
- march：kneeLift absolute up，enter 0.25 / bottom 0.40 / exit 0.15，minRep 400ms（抬腿節奏快）。v0 不強制左右交替，規格註明此限制。
- wall-pushup：肘角 absolute down，enter 150 / bottom 110 / exit 160，minRep 600ms。

## R14 簡筆示意圖 `src/exercises/figures.ts`

- 每動作一個 inline SVG 字串（viewBox 120x180，線條風格、色彩沿用入位引導層既有 guide-silhouette：stroke var(--accent) 或 #0ea5e9、線寬 4-6、圓頭）。
- 畫「動作到位」的關鍵姿勢，用虛線疊影表達起始姿勢（例：深蹲圖 = 實線蹲姿 + 虛線站姿）。椅子坐站要畫出椅子、牆壁伏地挺身要畫出牆、提踵畫腳跟離地、踏步畫單膝高抬。
- 禁外部圖檔、禁 base64。

## R15 測試（先紅後綠）`tests/cycle-fsm.test.ts` + `tests/exercises.test.ts`

- T15.1 cycle down/absolute：合成膝角序列完整循環 → 1 complete；峰值記錄正確。
- T15.2 遲滯：指標在 enter 門檻附近抖動不產生 rep。
- T15.3 minRepMs：過快循環 → 不計或 uncertain（與深蹲同語意）。
- T15.4 缺口：循環中 gap 350ms → 該 rep uncertain。
- T15.5 連續 invalid 1100ms → 重置，進行中 rep 以 uncertain 結算。
- T15.6 baseline-delta + up（提踵參數）：校準段 value 穩定 → baseline 正確；上升 0.06 再回落 → 1 complete。
- T15.7 metrics：肘角 90 度 fixture 算值正確；kneeLift 單膝抬高算較大側；必要點 visibility 0.2 → invalid 且 value null。
- T15.8 catalog：恰 5 筆、id 唯一、每筆欄位齊全非空、squat 是 kind 'squat'、其餘 4 筆 rules_version 皆非空且門檻符合 direction 語意（enter/bottom/exit 大小關係正確）。
- 既有 20 測試全綠；`npm run build` 綠。

## 完成回報

執行 `npx vitest run` 與 `npm run build`，貼輸出摘要；逐條自評 R11-R15；列改動/新增檔案清單。不要 git commit。
