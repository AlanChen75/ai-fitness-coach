# ITERATION 7 — 器械六項重整：滑輪下拉與器械划船改為可計數

背景：使用者再提供兩支健身房實拍影片：
- 影片 C：滑輪下拉（坐姿高位下拉，側面略斜，鏡頭固定）
- 影片 D：器械划船（有胸墊、固定軌道握把的坐姿划船機，手持拍攝鏡頭有移動）

審查者已用 app 同一顆 `pose_landmarker_lite.task` 離線跑過（每 3 幀取樣，約 10 fps），
並用 app 真正的 `stepCycle` 做過門檻掃描，結論如下：

| 動作 | 指標 | 門檻起點（enter/bottom/exit） | 結果 |
|---|---|---|---|
| 滑輪下拉 | 新指標 `wristHeight`（見 R2） | 0.70 / 0.35 / 0.78 | 4 組門檻都算 8 次，時間點一致 |
| 器械划船 | 既有 `elbowAngle` | 158 / 150 / 160 | 4 組門檻都算 11 次 |

不選的方案與理由：
- 滑輪下拉用 `elbowAngle`：影片中有兩下沒有完全伸直（手肘只回到 132-137 度），用手肘角度會漏算（7-8 次不穩）
- 既有 `wristRaise`：要求雙側肩、髖、手腕都可見，側拍時遠側手被擋，影片 C 有 20% 缺值、影片 D 100% 缺值，不能用
- 器械划船用手腕前伸距離：不同門檻算出 9-11 次，不穩

實際次數（人工對照畫面）：
- 影片 C 共 9 次下拉，但第一下在錄影開始前已經拉下，狀態機尚未完成起始校準，正確可計數為 **8**
- 影片 D 共 12 次划船，最後一下影片結束時尚未回放，正確可計數為 **11**；後段幾下握把沒有拉到胸口（真的拉得較淺，已看畫面確認），手肘最深只到 135-144 度

指標序列已放在：
- `tests/fixtures/lat-pulldown-video-c-metric.json`（wristHeight，578 筆，1 筆 null）
- `tests/fixtures/machine-row-video-d-metric.json`（elbowAngle，467 筆，0 筆 null）

格式同 `seated-row-video-a-metric.json`：`[{ "t": <ms>, "v": <number | null> }]`。

## 範圍限制

- 禁止修改 `src/engine/**`、`src/framing.ts`、`src/exercise-session.ts`
- `src/train.ts` 只允許在 `METRIC_LABELS` 新增 `wristHeight` 一個 key
- 禁止修改 `tests/fixtures/**` 既有與新增的 fixture
- 所有輸出（程式、註解、commit、UI 文字）不得含 emoji
- 不要 git commit

## 需求

### R1 器械六項重整（src/exercises/catalog.ts）
器械 tier 最終 6 筆，卡片順序（即陣列中 machine 項目的相對順序）如下：

| 順序 | id | nameZh | 狀態 |
|---|---|---|---|
| 1 | lat-pulldown | 滑輪下拉 | 改為計數（R3） |
| 2 | seated-row | 坐姿划船 | 已可計數，不動門檻 |
| 3 | machine-row | 器械划船 | 新增，計數（R4） |
| 4 | chest-press-machine | 坐姿胸推 | 維持 demoOnly |
| 5 | shoulder-press-machine | 肩推機 | 維持 demoOnly |
| 6 | leg-press | 腿部推蹬 | 維持 demoOnly |

- 刪除 `leg-extension` 這筆
- 刪除 `tools/figure-gif/exercises/leg-extension.json` 與 `public/figures/leg-extension.gif`；
  若 `machineProps.js` 有 leg-extension 專用 prop 函式，一併刪除

### R2 新指標 wristHeight（src/exercises/metrics.ts）
- `MetricId` 與 `SUPPORTED_METRIC_IDS` 加入 `'wristHeight'`，`computeMetric` 加分支
- 定義（必須與 fixture 產生方式完全一致）：
  - 左側用 (11 肩, 15 腕, 23 髖)，右側用 (12, 16, 24)；三點各自 `isPointUsable`（visibility >= minVisibility）才算該側可用
  - 該側軀幹長 = hypot(肩 - 髖)，小於 EPSILON 視為不可用
  - 兩側都可用時，取三點平均 visibility 較高的一側
  - value = (肩.y - 腕.y) / 該側軀幹長（手腕高於肩為正）
  - 兩側都不可用回傳 `INVALID_METRIC`
- 檔頭註解寫明：單側指標，供側拍使用；雙側版本 `wristRaise` 側拍時遠側手常不可見
- `src/train.ts` 的 `METRIC_LABELS` 加 `wristHeight: '手腕高度'`

### R3 滑輪下拉改為計數
- 移除 `demoOnly`；engine `{ kind: 'cycle', metric: 'wristHeight', rules: LAT_PULLDOWN_RULES }`
- `LAT_PULLDOWN_RULES`：`rules_version: 'lat-pulldown-v0.1'`，`direction: 'down'`，`thresholdMode: 'absolute'`，
  起點 enter 0.70 / bottom 0.35 / exit 0.78，minRepMs 800，用 `makeDefaultCycleRules`；
  可依 fixture 微調，但結果必須通過 R5
- 註解：「依 2026-11-17 健身房實拍影片離線校準（側面略斜），尚未經手機實機 session 校準」
- `framingRegions: ['upper', 'hips']`，`figureSvg: ''`
- `stepsZh` 第一條插入：「手機放在身體側面約 2 公尺、高度約胸口，手舉到最高時手腕仍要在畫面內」

### R4 新增器械划船 machine-row
- `nameZh: '器械划船'`，`tier: 'machine'`，`view: 'side'`，不設 demoOnly
- `targetsZh: ['背闊肌', '菱形肌', '中斜方肌']`
- `stepsZh`（第一條為相機提示）：
  1. 手機放在身體側面約 2 公尺、略高於腰，讓肩、手肘、手腕都入鏡
  2. 調整座椅高度讓握把與胸口同高，胸口貼緊前方胸墊
  3. 夾緊肩胛骨帶動手肘向後拉，把握把拉到身體兩側
  4. 控制速度回放到手臂伸直，胸口全程不離開胸墊
- `steps` 與 `stepsZh` 後三條相同（不含相機提示）
- `safetyZh: '胸口不要離開胸墊借力，回放時不要讓重量直接砸回'`
- engine `{ kind: 'cycle', metric: 'elbowAngle', rules: MACHINE_ROW_RULES }`
- `MACHINE_ROW_RULES`：`rules_version: 'machine-row-v0.1'`，`direction: 'down'`，`thresholdMode: 'absolute'`，
  起點 enter 158 / bottom 150 / exit 160，minRepMs 800；註解同 R3（另註明「影片 D 後段拉得較淺，bottom 150 是為了涵蓋實際較淺的划船」）
- `framingRegions: ['upper', 'hips']`，`figureSvg: ''`

### R5 真實影片回歸測試（新檔 tests/machine-real-video.test.ts）
仿照 `tests/seated-row-real-video.test.ts`：
- 影片 C 用 `getExercise('lat-pulldown')` 的 rules：`complete + uncertain === 8` 且 `complete >= 7`
- 影片 D 用 `getExercise('machine-row')` 的 rules：`complete + uncertain === 11` 且 `complete >= 10`
- 抗誤計 C：把所有值 clamp 到 >= 0.5（只拉一半）→ 0 次
- 抗誤計 D：把所有值 clamp 到 >= 155 → 0 次
- 追蹤中斷：影片 D 中任挑一下拉到底區間的連續 3 筆改 null → 總數仍為 11
- 註解寫明實際次數與「第一下在錄影前開始 / 最後一下未回放」的原因

### R6 wristHeight 單元測試（加在 tests/exercises.test.ts 或新檔）
- 合成 landmarks：左側可見、右側不可見 → 用左側算，值等於手算結果
- 兩側都可見時取平均 visibility 高的一側
- 兩側都不可見 → `valid: false`、`value: null`
- 手腕在肩上方為正、下方為負

### R7 動畫：器械划船 GIF
- 新增 `tools/figure-gif/exercises/machine-row.json`，仿 `seated-row.json` 結構（側面、坐姿 anchor）
- 新增 prop `machine-row`（在 `machineProps.js`）：座椅、正前方直立的胸墊（貼住胸口）、
  固定軌道握把（握把在胸口高度，從身體前方手臂伸直處沿水平方向往身體拉），深灰機身，風格與其他器械 prop 一致
- 動作：軀幹全程直立貼胸墊、不前後擺；上臂從前伸往後拉到手肘超過軀幹後方，前臂保持水平；
  2 秒循環，起點與終點都是手臂伸直
- 肌群高亮：lats、rhomboids（沿用既有 shape key，若無 rhomboids 則用既有背部 key）
- `npm run figures` 重產全部 GIF，`npm run figures:verify` 全過（數量變成 24：刪 leg-extension、加 machine-row）
- 除 `machine-row.gif` 新增、`leg-extension.gif` 刪除外，其他 GIF 必須位元組不變（用 md5 比對前後）
- 產出 `tools/figure-gif/review/machine-row` 的 contact sheet 供審查者目視

### R8 既有測試與 e2e 同步
- `tests/exercises.test.ts`：machine tier 6 筆且順序如 R1；demoOnly 剩 3 筆（chest-press-machine、shoulder-press-machine、leg-press）；
  lat-pulldown / seated-row / machine-row 為 cycle
- e2e `e2e/train-flow.spec.ts`：
  - 原本「滑輪下拉 → demo.html」改成「坐姿胸推 → demo.html」
  - 原本「train.html?exercise=lat-pulldown 被導向 demo」改成 `chest-press-machine`
  - 新增：器械 tab 點「滑輪下拉」與「器械划船」都進 train.html，預覽圖 src 指向各自 GIF
  - 器械 tab 卡片順序與 R1 一致
- `public/sw.js` CACHE_NAME 升為 `fitness-coach-v0.7.0`

## Test Matrix

| Req | 驗證 | 標準 |
|---|---|---|
| R1 | vitest catalog | machine 6 筆、順序正確、無 leg-extension |
| R2/R6 | vitest 單元 | wristHeight 四案通過 |
| R3/R4/R5 | vitest 真實影片 | C=8、D=11、clamp 0、短中斷不漏 |
| R7 | figures:verify + md5 比對 + contact sheet | 24 張通過、其他 GIF 不變 |
| R8 | playwright | 全綠含新案 |

## 完成定義
`npx vitest run`、`npx playwright test`、`npm run build`、`npm run figures:verify` 全綠，
`git status` 只出現允許範圍內的變更，最後輸出一行
`DONE 7`（附 C、D 最終門檻與 complete/uncertain 數、md5 比對結果）。
