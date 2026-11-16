import { expect, test } from '@playwright/test'

// 假相機提供合成畫面（無人體），所以入位清單不會通過——
// 快樂路徑改走「跳過引導直接開始」，驗證整條 UI 狀態機到回顧頁無斷點。

test('選單頁列出初級 5 卡，點卡帶 exercise 參數進訓練頁', async ({ page }) => {
  await page.goto('/exercises.html')
  const cards = page.locator('.exercise-card:not(.is-locked)')
  await expect(cards).toHaveCount(5)
  await expect(page.locator('.exercise-card.is-locked')).toHaveCount(2)

  await page.getByText('椅子坐站').click()
  await expect(page).toHaveURL(/train\.html\?exercise=sit-to-stand/)
  await expect(page.locator('#preview-overlay')).toBeVisible()
  await expect(page.locator('#preview-name')).toHaveText('椅子坐站')
})

test('訓練頁完整流程：示範卡 -> 相機 -> 引導 -> 開始 -> 儲存 -> 回顧', async ({ page }) => {
  await page.goto('/train.html?exercise=march')

  // 1. 示範卡先擋在相機前
  await expect(page.locator('#preview-overlay')).toBeVisible()
  await expect(page.locator('#top-exercise-name')).toHaveText('原地踏步抬腿')
  await expect(page.locator('#preview-safety')).not.toBeEmpty()

  // 2. 按「我知道了」才開相機（假相機會成功）
  await page.locator('#btn-preview-start').click()
  await expect(page.locator('#preview-overlay')).toBeHidden()
  await expect(page.locator('#guide-overlay')).toBeVisible()
  // 正面動作的引導文案
  await expect(page.locator('#guide-title')).toHaveText('正面站位準備')
  await expect(page.locator('#chk-facing-label')).toHaveText('正面站位')

  // 3. 預設前鏡頭 -> 畫面鏡像
  await expect(page.locator('#cam-wrap')).toHaveClass(/mirrored/)

  // 4. 相機串流真的在跑
  await expect
    .poll(async () => page.locator('#cam').evaluate((v: HTMLVideoElement) => v.videoWidth), {
      timeout: 20_000
    })
    .toBeGreaterThan(0)

  // 5. 模型載入完成後「跳過引導」可按（這是入位偵測不過時的逃生口）
  const skip = page.locator('#btn-skip-guide')
  await expect(skip).toBeEnabled({ timeout: 60_000 })
  await skip.click()

  // 6. 進入組內：引導關閉、控制列可用、色帶在校準/入位提示狀態（紅或黃，不是斷點）
  await expect(page.locator('#guide-overlay')).toBeHidden()
  await expect(page.locator('#btn-end-set')).toBeEnabled()
  await expect(page.locator('#btn-end-session')).toBeEnabled()
  await expect(page.locator('#top-band')).toHaveClass(/tone-(red|yellow)/)
  await expect(page.locator('#rep-complete')).toHaveText('0')

  // 7. 結束一組 -> 回到入位引導（下一組）
  await page.locator('#btn-end-set').click()
  await expect(page.locator('#guide-overlay')).toBeVisible()
  await expect(page.locator('#set-progress')).toContainText('已完成 1 組')

  // 8. 結束訓練 -> 自動導向回顧頁並帶 session 參數
  await expect(page.locator('#btn-end-session')).toBeEnabled()
  await page.locator('#btn-end-session').click()
  await page.waitForURL(/review\.html\?session=/, { timeout: 20_000 })

  // 9. 回顧頁列出剛存的 Session，動作名稱正確，明細自動展開
  await expect(page.locator('.session-card-btn').first()).toContainText('原地踏步抬腿')
  await expect(page.locator('#detail-section')).toBeVisible()
  await expect(page.locator('#session-detail')).toContainText('march-v0.1')

  // 10. 兩段式刪除走完（清理並驗證刪除分支）
  await page.locator('#btn-delete-step1').click()
  await expect(page.locator('#delete-confirm-box')).toBeVisible()
  await page.locator('#btn-delete-confirm').click()
  await expect(page.locator('#review-status')).toContainText('已刪除')
})

test('無 exercise 參數安全回退深蹲', async ({ page }) => {
  await page.goto('/train.html')
  await expect(page.locator('#top-exercise-name')).toHaveText('深蹲')
  await expect(page.locator('#preview-name')).toHaveText('深蹲')
})
