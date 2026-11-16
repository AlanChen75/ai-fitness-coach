# Iteration 2 任務二：/train 訓練頁 + /review 回顧頁（UI 接線）

接續任務一（src/engine/ 已完成並通過審查，不得修改引擎任何檔案）。本任務把引擎接上相機、TTS 與本地儲存。KB 規格第 7、8 節為準。

## 交付物

| 檔案 | 內容 |
|---|---|
| `train.html` + `src/train.ts` | 訓練頁 |
| `review.html` + `src/review.ts` | 回顧頁 |
| `src/storage.ts` | Session 存 IndexedDB + PoseSequence 存 OPFS（JSONL） |
| `src/tts.ts` | 繁中語音播報（cooldown 防重複） |
| `index.html` | 只准加兩個導航連結（訓練 / 回顧） |
| `vite.config.ts` | 加兩個 input entry |
| `public/sw.js` | PRECACHE 加兩頁，CACHE_NAME 升為 `fitness-coach-v0.2.0` |

## 需求

### R5 訓練頁 /train
- R5.1 復用 `src/pose-benchmark.ts` 的 `startCamera` / `loadPose`（已 export），前/後鏡頭切換與鏡像照 device-check 頁的做法（`.video-wrap.mirrored`）。
- R5.2 推論迴圈：限頻 10Hz（TARGET_INTERVAL_MS=100），每幀 `extractFeatures` → `processSample`；UI 顯示大字計數（complete 數）、目前 FSM phase 中文標籤、辨識品質（valid 比例）、uncertain 數。
- R5.3 流程按鈕：開始一組 → 結束一組 → 結束訓練。每組一個 `RepEngineState`（`createRepEngineState`，idFactory 用 crypto.randomUUID 或等效）。
- R5.4 TTS（src/tts.ts）：rep_complete 報數（「一」「二」…或數字），校準完成講「開始」，連續 invalid 講「辨識不清，請調整鏡頭」。同類提示 cooldown >= 3 秒，`speechSynthesis.cancel()` 不得打斷報數疊報。可開關。
- R5.5 中斷處理：`visibilitychange:hidden` 或 camera track `ended` → 立即停止取樣、session 標 `interrupted: true`、checkpoint 寫入儲存。回前景不自動續跑，顯示「已中斷」要求重新開始。
- R5.6 結束訓練 → 組裝 `Session`（`createSession`，consent 預設 pose:true 其餘 false，camera 用 track.getSettings 實值，device_profile_id 讀 IDB 最新 capability profile 的 profile_id，沒有就 'unknown'）→ 存檔 → 導向 review。

### R6 儲存（src/storage.ts）
- R6.1 IndexedDB：沿用 `src/db.ts` 的 DB（版本升 2，加 object store `sessions`，keyPath `session_id`）。存 Session（含 sets 與 reps，**不含** landmarks 原始流）。
- R6.2 OPFS：每組一個 JSONL 檔 `sessions/<session_id>/<set_id>.pose.jsonl`，每行一個 `PoseSample`（t_ms, landmarks, valid）。訓練中每 10 秒或每 100 樣本 checkpoint 追加寫入一次，不是整組結束才寫。OPFS 不可用時降級：只存 Session 摘要並在 UI 標示「無 Pose 證據」。
- R6.3 Rep 的 `pose_file_ref` 填 `opfs://sessions/<session_id>/<set_id>.pose.jsonl`。
- R6.4 提供 `listSessions()`、`getSession(id)`、`readPoseSequence(session_id,set_id)`、`deleteSession(id)`（連 OPFS 檔一起刪）。

### R7 回顧頁 /review
- R7.1 列出所有 Session（新到舊）：日期、組數、總次數（complete/uncertain 分開）、資料完整度。
- R7.2 點開一個 Session：每組的 rep 表（序號、status、tempo_ms、min_knee_angle、tracking_gap_ms、reason）。
- R7.3 匯出該 Session 完整 JSON（含讀回的 PoseSequence）為下載檔。
- R7.4 刪除 Session（兩段確認）。

## 硬性約束
- **不得改動** src/engine/*、src/pose-benchmark.ts、src/db.ts 既有函式簽名（db.ts 可加新函式與版本升級邏輯，不得破壞既有 capability profile 讀寫——IDB 版本升級要保留既有 store）。
- 視覺沿用 `src/style.css` 既有 tokens 與 class，可追加 class 不得改既有值。全站無 emoji。繁體中文 UI。
- 觸碰目標 >= 48px，訓練頁大字計數 >= 72px。
- TypeScript strict；`npm run build` 與 `npx vitest run` 必須綠（既有 10 測試不得壞）。
- 不引入任何新依賴。
- 完成後 stdout 輸出：變更檔案清單 + build 與 vitest 實際輸出摘要 + 每個 R 條目一行自評（達成/未達成+原因）。
