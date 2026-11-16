import { defineConfig } from '@playwright/test'

// E2E 用假相機走訓練流程：MediaPipe 偵測不到人是預期的，
// 測的是 UI 狀態機（示範卡 -> 引導 -> 開始 -> 儲存 -> 回顧）無斷點。
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8788',
    headless: true,
    permissions: ['camera'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream'
      ]
    },
    viewport: { width: 390, height: 844 }
  },
  webServer: {
    command: 'python3 -m http.server 8788 --directory dist',
    url: 'http://127.0.0.1:8788/index.html',
    reuseExistingServer: true,
    timeout: 30_000
  }
})
