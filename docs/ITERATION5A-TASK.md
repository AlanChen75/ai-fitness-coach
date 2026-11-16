# ITERATION 5A — 解剖風格動畫 GIF 資產管線（24 個動作）

目標：把已驗證的試產管線（深蹲解剖風格 GIF）搬進本 repo，批量產出 18 個徒手動作 + 6 個器械動作的示範動畫 GIF，供選單卡片與入位預覽使用。

試產管線來源（已完成、可直接搬）：
`/private/tmp/claude-501/-Users-user-Desktop-AI100-/696172f2-f4d4-4228-9955-d10775b59769/scratchpad/gif-pilot/agy/`
（src/anatomy/ 渲染核心 + scripts/ 建置驗收 + src/exercises/squat.json 姿勢定義）

## 範圍限制

- 本階段只動 `tools/figure-gif/`（新目錄）、`public/figures/`（輸出）、`package.json`（加 scripts）
- 禁止修改 `src/**`（整合在 5B 做）
- 所有輸出與程式碼不得含 emoji

## Phase 1 需求（R1-R6，先做這段）

### R1 管線入 repo
- 試產程式碼搬到 `tools/figure-gif/`，路徑改相對於 repo（playwright 用本 repo node_modules）
- `npm run figures` 建全部；`npm run figures -- --exercise <id>` 建單一動作
- 同時輸出每動作 contact sheet（站立/中間/終點 3 階段並排 PNG）到 `tools/figure-gif/review/<id>.png`

### R2 18 個徒手動作姿勢定義（tools/figure-gif/exercises/<id>.json）
動作關鍵影格參考 `src/exercises/figure-specs.ts`（含每動作 view: side/front）與 `src/exercises/catalog.ts` 的動作說明。視角沿用 figure-specs 的設定；**front view 需要新增正面人體輪廓渲染**（試產只有側面）。

### R3 錨定規則
- 站姿動作：接觸地面的腳掌像素固定（試產已驗證的 anchor: feet）
- 跳躍動作（jump-squat、jump-lunge、jumping-jack、high-knees）：接觸期腳掌固定，騰空期允許離地，落地回到同一位置
- 臥姿/撐地動作（glute-bridge、pushup、knee-pushup）：接觸點（肩胛著地點/手掌/膝）固定
- wall-pushup：手掌貼牆固定，牆面畫淺灰直線

### R4 目標肌群高亮（橘紅色，其餘身體淺灰白）
| id | 高亮肌群 |
|---|---|
| squat | 股四頭肌、臀大肌 |
| sit-to-stand | 股四頭肌、臀大肌 |
| calf-raise | 腓腸肌（小腿後側） |
| march | 髖屈肌（大腿前上緣）、核心 |
| wall-pushup | 胸大肌、肱三頭肌 |
| side-leg-raise | 臀中肌（髖外側） |
| lunge | 股四頭肌、臀大肌 |
| knee-pushup | 胸大肌、肱三頭肌 |
| sumo-squat | 內收肌（大腿內側）、臀大肌 |
| glute-bridge | 臀大肌、腿後腱 |
| jumping-jack | 三角肌、腓腸肌 |
| high-knees | 髖屈肌、股四頭肌 |
| pushup | 胸大肌、肱三頭肌 |
| jump-squat | 股四頭肌、臀大肌、腓腸肌 |
| jump-lunge | 股四頭肌、臀大肌 |
| bulgarian-split-squat | 股四頭肌、臀大肌 |
| single-leg-rdl | 腿後腱、臀大肌 |
| pistol-squat | 股四頭肌、臀大肌 |

肌肉形狀必須貼著對應骨段移動（試產的股四/臀大肌作法），不可浮動或變成圓球。

### R5 輸出規格（行動裝置流量考量）
- `public/figures/<id>.gif`，384x384，24-32 幀，2 秒無限循環
- 全局調色盤 <= 64 色 + 抖動，目標每張 < 500KB，硬上限 800KB
- 總量控制：24 張總和 < 15MB（不會進 service worker 預快取，runtime cache 載入）

### R6 自動驗收腳本（tools/figure-gif/verify.py 或 .js）
逐張檢查並輸出報告：
- GIF 格式、尺寸 384x384、幀數 >= 24、loop 無限
- 檔案大小 < 800KB
- 錨定抽檢：站姿動作抽 3 幀腳掌區域像素 diff = 0（跳躍/臥姿動作標註略過原因）
- 報告寫到 `tools/figure-gif/review/report.json`

## Phase 2 需求（R7，Phase 1 完成並通過審查後才做）

### R7 6 個器械動作（新增 props 器材剪影層，深灰色簡化造型）
| id | 動作 | 視角 | 姿勢與器材 | 高亮肌群 |
|---|---|---|---|---|
| lat-pulldown | 滑輪下拉 | side | 坐姿，上方橫桿下拉到鎖骨，畫座椅+上方滑輪架 | 背闊肌 |
| chest-press-machine | 坐姿胸推 | side | 坐姿，雙手前推把手，畫靠背座椅+把手 | 胸大肌 |
| seated-row | 坐姿划船 | side | 坐姿，雙手後拉握把，畫座椅+前方踏板 | 背闊肌、菱形肌 |
| leg-press | 腿部推蹬 | side | 斜躺，雙腿推斜上踏板，畫斜躺椅+踏板 | 股四頭肌、臀大肌 |
| shoulder-press-machine | 肩推機 | front | 坐姿，雙手上推把手，畫座椅 | 三角肌 |
| leg-extension | 腿部伸展 | side | 坐姿，小腿從垂直踢到水平，畫座椅+腳墊滾筒 | 股四頭肌 |

- 器材剪影不可與人體重疊混色（器材在人體後層或前層要分清楚，例如 leg-press 踏板在腳前）
- 錨定：坐姿動作臀部與座椅接觸點固定

## Test Matrix

| Req | 驗證方式 | 通過標準 |
|---|---|---|
| R1 | `npm run figures -- --exercise squat` | 產出 gif + contact sheet，exit 0 |
| R2 | review/ 下 18 張 contact sheet | 人工逐張審（審查者執行） |
| R3 | verify 腳本錨定抽檢 | 站姿 diff=0，特例有標註 |
| R4 | contact sheet 目視 | 肌肉位置貼骨段、顏色正確 |
| R5 | verify 腳本 | 尺寸/幀數/大小全過，總量 < 15MB |
| R6 | `tools/figure-gif/review/report.json` | 全部 pass |
| R7 | 6 張 contact sheet + verify | 同上，含器材不重疊 |

## 完成定義
Phase 1：18 張 GIF + contact sheets + report.json 全綠，輸出一行 `DONE PHASE1`。
Phase 2：24 張全數就位，輸出一行 `DONE PHASE2`。
