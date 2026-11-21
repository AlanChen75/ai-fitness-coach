# AGENTS.md — AI 健身教練部署引導（SmallGreen Path A）

你是部署導遊，不是驗證裁判。每一關是否通過由測試、conformance 與 Evidence Pack 判定；部署命令成功不等於服務已完成上架。任何一步連續失敗三次即停止，保留錯誤訊息、時間與使用的 commit。

## 專案邊界

AI 健身教練是純靜態 PWA：用 MediaPipe Pose Landmarker 在瀏覽器內辨識姿勢並計數。部署只會在部署者自己的 Cloudflare 帳號建立一個只含靜態資產的 Worker（`ai-fitness-coach`），沒有 D1、KV、R2、secret 或任何 binding。

- 相機畫面與姿勢資料只在使用者瀏覽器內處理，伺服器端不收任何資料
- 姿勢模型檔 `public/models/pose_landmarker_lite.task` 與 WASM `public/wasm/` 隨 repo 提供，執行期不呼叫外部服務
- 相機需要 HTTPS；`*.workers.dev` 網址即符合

## 前置與確認（最多兩次）

1. **說明**：讀 `.smallgreen/profile.yaml`、`.smallgreen/acceptance.yaml`、`.smallgreen/maintenance.yaml`，向使用者說明只會建立一個靜態資產 Worker、沒有後端資料與外部連線。
2. **確認一**：使用者確認要在自己的 Cloudflare 帳號建立 Worker `ai-fitness-coach`。若帳號已有同名 Worker，停止並詢問，不得覆蓋。
3. **本機閘門**（依序，任一非 0 即停止）：

   ```bash
   npm ci
   npm test
   npm run build
   ```

4. **確認二**：使用者確認後才部署。

## 部署與驗收

```bash
npx wrangler@4.166.0 whoami
npx wrangler@4.166.0 deploy
```

部署輸出會給出 `https://ai-fitness-coach.<subdomain>.workers.dev`。剛部署的前幾秒可能回 1042 或 404，等待 10 秒重試，最多三次。

依 `.smallgreen/acceptance.yaml` 驗收：

- `/index.html`、`/train.html`、`/sw.js`、`/manifest.webmanifest`、`/models/pose_landmarker_lite.task` 皆回 200
- `/models/pose_landmarker_lite.task` 的大小與 `dist/models/pose_landmarker_lite.task` 相同
- 用瀏覽器開首頁與訓練頁，console 沒有未處理例外，網路請求全部指向部署網址本身
- 真實計數需要真人與手機相機，屬 `user_acceptance`；agent 無法代做時如實標示未驗，不得宣稱通過

## 維護與退出

更新：拉取新 commit 後重跑本機閘門，`npm run build && npx wrangler@4.166.0 deploy`。改版時必須升級 `public/sw.js` 的 `CACHE_NAME`，否則已安裝的使用者會繼續看到舊版。

移除：

```bash
npx wrangler@4.166.0 delete ai-fitness-coach
```

移除後以部署前資源清單比對，Worker 清單回到部署前狀態。使用者手機上的訓練紀錄存在瀏覽器本機，不受移除影響；需要時請使用者先在回顧頁匯出 JSON，再清除瀏覽器網站資料。
