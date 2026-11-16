# Iteration 4a：首頁改版 + 動態示範圖 rig

目標：首頁變成「選等級、選動作、直接開始」的入口；測試與驗證功能收進內頁；
示範圖從靜態 SVG 升級成會動的 SVG 骨架動畫（CSS keyframes 旋轉肢段，不用 GIF）。

限制（全部沿用，不可違反）：
- 不碰 src/engine/**、src/framing.ts、src/exercise-session.ts、src/train.ts 的計數邏輯
- 不用任何 emoji；繁體中文文案
- 不可變資料風格、小檔案、無 console.log
- 既有測試必須保持綠；新功能要有對應測試

## R1 首頁 = 動作選單

- index.html 改為動作選單頁（取代現在的裝置檢測入口頁）：
  - 頂部：app 名稱「AI 健身教練」+ 右上兩個小連結「紀錄」(review.html)、「更多」(more.html)
  - 等級切換：三個 tab「初級」「中級」「高階」（預設初級）。tab 用按鈕 + aria-selected，
    切換不換頁（同頁顯示/隱藏各 tier 區塊）
  - 每個 tier 一個 grid，卡片樣式沿用 exercises-page 的 .exercise-card；
    卡片 = 動態示範圖 + 動作名 + 目標肌群一行；點卡 -> train.html?exercise=<id>
  - 中級與高階動作本任務先全部顯示為鎖定卡（.is-locked、aria-disabled，
    文案「即將推出」）；初級 6 格：現有 5 個 + 1 格鎖定佔位「站姿側抬腿（即將推出）」
    （4b 會解鎖，id 先不連結）
- exercises.html 保留為轉址殼：`<meta http-equiv="refresh" content="0; url=./index.html">`
  + 一行連結，舊書籤不死
- 新增 more.html（內頁）：收納「裝置能力檢測」(device-check.html)、
  「姿態效能測試」(pose-benchmark 既有入口若在 device-check 內就不用另列)、
  SW 版本顯示、既有 index 的狀態區塊（安全來源 / 離線快取 / 能力檢測結果）整段搬過來。
  首頁不再出現這些。
- src/main.ts 的狀態檢查邏輯搬到新的 src/more-page.ts；src/main.ts 改為選單頁邏輯
  （可把 src/exercises-page.ts 的 render 邏輯移植進來；exercises-page.ts 若保留須仍可 build）
- vite.config 的 rollup input 要加 more.html；public/sw.js PRECACHE 加 more.html
  （CACHE_NAME 版本號由審查者統一 bump，任務內不用改）

## R2 動態示範圖 rig（src/exercises/figure-rig.ts）

- 以「肢段旋轉」做動畫，不做 path morph：火柴人由群組組成，每群組有 transform-origin
  （關節點），CSS @keyframes 在 0%/100%（起始姿勢）與 50%（動作姿勢）之間旋轉/位移
- API 設計（純函式、零 DOM）：
  ```ts
  export interface RigPose {
    // 各關節角度（度）與軀幹位移，見下
    readonly torsoTilt: number      // 軀幹前傾角，0 = 直立
    readonly hipY: number           // 髖部垂直位移（viewBox 單位，蹲下為正）
    readonly thighL: number; readonly thighR: number   // 大腿相對軀幹角
    readonly shinL: number;  readonly shinR: number    // 小腿相對大腿角
    readonly upperArmL: number; readonly upperArmR: number
    readonly forearmL: number;  readonly forearmR: number
    readonly heelRaise: number      // 腳跟抬起位移（提踵用，預設 0）
  }
  export interface FigureSpec {
    readonly id: string
    readonly view: 'side' | 'front'
    readonly start: RigPose
    readonly action: RigPose
    readonly durationMs: number     // 一個循環
  }
  export function buildAnimatedFigure(spec: FigureSpec): string  // 回傳完整 <svg> 字串
  ```
- buildAnimatedFigure 產出的 SVG：
  - viewBox 0 0 120 180，線條風格沿用現有 figures.ts（stroke 用 currentColor 或
    var(--accent)，與現有卡片一致）
  - `<style>` 內嵌 keyframes，animation 名稱含 spec.id 避免跨 SVG 衝突
  - animation: alternate 無限循環，timing ease-in-out
  - `@media (prefers-reduced-motion: reduce)` 時停在 action 姿勢（animation: none +
    直接套 50% 的 transform）
  - front view 畫正面火柴人（兩肩等寬），side view 畫側面（單線手臂腿）
- 現有 5 個動作在 catalog.ts 改用 rig 產生（定義各自 FigureSpec）：
  深蹲（蹲起）、椅子坐站（坐起，髖位移大、軀幹前傾）、提踵（heelRaise）、
  原地踏步抬腿（front，單側 thigh 抬高交替感）、牆壁伏地挺身（side，手臂彎伸、軀幹斜）
- figures.ts 的靜態字串退場（檔案可刪或留 re-export，擇一，不留死碼）
- 示範卡（preview overlay）與引導頁（guide-figure）自動吃到動態版，不需改 train.ts
  （仍是 innerHTML = figureSvg）

## R3 測試矩陣

| ID | 測試 | 類型 |
|---|---|---|
| T4a.1 | buildAnimatedFigure 輸出含 svg 根節點、keyframes、alternate、reduced-motion 區塊 | unit |
| T4a.2 | 同一 spec 輸出為決定性字串（呼叫兩次相等）；不同 id 的 animation 名稱不同 | unit |
| T4a.3 | 5 個現有動作的 figureSvg 皆由 rig 產生且非空、含 animation | unit |
| T4a.4 | e2e：index.html 顯示三個 tier tab，初級 5 張可點卡 + 1 張鎖定；點椅子坐站進 train | e2e（改既有 train-flow 選單測試） |
| T4a.5 | e2e：exercises.html 轉址到 index.html | e2e |
| T4a.6 | more.html 含裝置檢測連結與狀態區塊 | e2e 或 unit（擇一） |

e2e 既有「選單頁列出初級 5 卡」測試改成對 index.html 斷言。

## 驗收

- `npx vitest run` 全綠、`npm run build` 成功、`npx playwright test` 全綠
- 不碰受保護路徑（git diff 應顯示 engine/framing/exercise-session/train 無異動，
  train.ts 僅允許因 import 路徑不得不動時的最小變更，預期零變更）
