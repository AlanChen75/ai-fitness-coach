# Iteration 4b：三級各六個動作（共 18 個）+ 新指標

前置：Iteration 4a 已完成（首頁選單 + figure-rig 動態示範圖）。
目標：動作目錄擴充到初級 / 中級 / 高階各 6 個，全部可選可練；新增 5 個指標。

限制（沿用）：
- 不碰 src/engine/**、src/framing.ts、src/exercise-session.ts、src/train.ts
- 不用 emoji；繁體中文；無 console.log；不可變資料風格
- 新門檻全部是未校準初始值，rules_version 一律 `<id>-v0.1`，catalog 註解標明
  「未校準初始值，待真機實測校準」

## R1 動作清單（18 個）

### 初級（受眾：長者與入門女性，現有 5 個 + 1 新）
| id | 名稱 | view | 指標 | 說明 |
|---|---|---|---|---|
| squat | 深蹲 | side | squat FSM | 既有，不動 |
| sit-to-stand | 椅子坐站 | side | kneeAngle | 既有，不動 |
| calf-raise | 提踵 | side | shoulderRise | 既有，不動 |
| march | 原地踏步抬腿 | front | kneeLift | 既有，不動 |
| wall-pushup | 牆壁伏地挺身 | side | elbowAngle | 既有，不動 |
| side-leg-raise | 站姿側抬腿 | front | legAbduction（新） | 單腿向側抬起放下 |

### 中級（線條雕塑入門）
| id | 名稱 | view | 指標 | 門檻初始值 |
|---|---|---|---|---|
| lunge | 弓步蹲 | side | kneeAngle | 150/110/160 down, minRep 800 |
| knee-pushup | 跪姿伏地挺身 | side | elbowAngle | 150/100/160 down, minRep 600 |
| sumo-squat | 相撲深蹲 | front | hipDrop（新） | baseline-delta up 0.15/0.25/0.10, minRep 800 |
| glute-bridge | 橋式抬臀 | side | hipLift（新） | baseline-delta up 0.08/0.15/0.05, minRep 800 |
| jumping-jack | 開合跳 | front | wristRaise（新） | absolute up 0.2/0.5/0.0, minRep 300, minBottomSamples 1 |
| high-knees | 高抬腿 | front | kneeLift | 同 march-v0.2 門檻, minRep 250, minBottomSamples 1 |

### 高階（體態維持與強度）
| id | 名稱 | view | 指標 | 門檻初始值 |
|---|---|---|---|---|
| pushup | 標準伏地挺身 | side | elbowAngle | 150/95/160 down, minRep 500 |
| jump-squat | 深蹲跳 | side | kneeAngle | 150/115/160 down, minRep 350, minBottomSamples 1 |
| jump-lunge | 弓步跳 | side | kneeAngle | 150/120/160 down, minRep 350, minBottomSamples 1 |
| bulgarian-split-squat | 保加利亞分腿蹲 | side | kneeAngle | 150/105/160 down, minRep 800 |
| single-leg-rdl | 單腳硬舉 | side | torsoLean（新） | absolute up 30/55/20（度）, minRep 800 |
| pistol-squat | 單腳深蹲 | side | kneeAngle | 150/90/160 down, minRep 1000 |

共同：calibrationMs 1000、maxGapMs 300、invalidResetMs 1000、
minBottomSamples 預設 2（表格另註明 1 的除外）。

## R2 新指標（src/exercises/metrics.ts 擴充）

全部純函式、永不 NaN、資料不足回 { value: null, valid: false }，
可見度門檻沿用 DEFAULT_MIN_VISIBILITY，左右側策略與既有指標一致（取可見度較高側或雙側並用，逐一註明）：

1. `legAbduction`（side-leg-raise, front view）：
   value = max(|ankleX_L - hipX_L|, |ankleX_R - hipX_R|) / torsoLen。
   需要 23/24/27/28 與肩（torsoLen 用 11/12/23/24 中點）。
2. `hipDrop`（sumo-squat, front view）：
   value = midHipY / torsoLen（baseline-delta 模式會自動扣校準基線；蹲下 hipY 變大 → 值上升）。
3. `hipLift`（glute-bridge, side view 躺姿）：
   value = -(midHipY) / torsoLen（抬臀 hipY 變小 → 值上升；baseline-delta）。
4. `wristRaise`（jumping-jack, front view）：
   value = ((shoulderY_L - wristY_L) + (shoulderY_R - wristY_R)) / 2 / torsoLen，
   兩手皆上舉才到高值。需要 11/12/15/16。
5. `torsoLean`（single-leg-rdl, side view）：
   肩中點到髖中點向量與鉛直線的夾角（度），直立約 0，髖鉸鏈前傾變大。

METRIC_LABELS 補五個新指標的中文標籤（HUD 即時讀數用）。

## R3 framingRegions（入鏡需求 = 指標真正用到的關節）

- side-leg-raise：['upper','hips','knees','ankles']（metric 用腳踝）
- sumo-squat / glute-bridge / jumping-jack / single-leg-rdl：['upper','hips']
- lunge / knee-pushup / pushup / jump-squat / jump-lunge / bulgarian-split-squat /
  pistol-squat / high-knees：kneeAngle 類全身 ['upper','hips','knees','ankles']；
  high-knees 用 kneeLift → ['upper','hips','knees']

## R4 示範圖與文案

- 每個新動作定義 FigureSpec（4a 的 rig），起始/動作兩姿勢要能看出動作本質
  （弓步=前後分腿屈膝、開合跳=手腳開合、橋式=躺姿抬臀、硬舉=單腳後伸體前傾…）。
  躺姿動作（glute-bridge）rig 若表達不了，允許在 figure-rig 加「rotate 整體 90 度」
  之類的最小擴充，不可退回靜態圖。
- 每個動作：targetsZh（2-3 個）、stepsZh（3 步）、safetyZh（1 句），
  受眾語氣：初級對長者友善、中級高階講明強度與落地緩衝。
- 首頁選單：三個 tier 全部變可點卡（移除 4a 的鎖定佔位與「即將推出」）。

## R5 測試矩陣

| ID | 測試 | 類型 |
|---|---|---|
| T4b.1 | 5 個新指標：合成 landmarks 正向案例回傳正確符號與量級；可見度不足回 invalid；永不 NaN | unit |
| T4b.2 | 目錄完整性：18 個、各 tier 6 個、id 唯一、每個 cycle 動作的 metric 都是 computeMetric 支援的 id、rules_version 與 id 前綴一致 | unit |
| T4b.3 | 每個新動作合成一段「校準 + 2 次標準循環」樣本流，複述其 rules 能數到 2 次 complete | unit |
| T4b.4 | 每個動作 figureSvg 非空且含 animation | unit（擴充 4a 的測試） |
| T4b.5 | e2e：三個 tier 各 6 張可點卡、無鎖定卡；點「弓步蹲」進 train 且示範卡標題正確 | e2e（改既有） |

## 驗收

`npx vitest run` 全綠、`npm run build` 成功、e2e 語法正確（由審查者實跑）。
不碰受保護路徑。
