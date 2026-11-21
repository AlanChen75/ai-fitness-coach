import { expect, test } from '@playwright/test'

// 假相機提供合成畫面（無人體），所以入位清單不會通過——
// 快樂路徑改走「跳過引導直接開始」，驗證整條 UI 狀態機到回顧頁無斷點。

test('T4b.5 & 5B.R2 首頁四個 tier 各 6 張可點卡且圖片為 figures/*.gif，點弓步蹲進訓練頁且預覽為 GIF', async ({ page }) => {
  await page.goto('/index.html')

  const tabs = page.locator('.tier-tab[role="tab"]')
  await expect(tabs).toHaveCount(4)
  await expect(page.locator('#tab-beginner')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.exercise-card.is-locked')).toHaveCount(0)

  const beginnerPanel = page.locator('#panel-beginner')
  await expect(beginnerPanel).toBeVisible()
  await expect(beginnerPanel.locator('a.exercise-card')).toHaveCount(6)
  await expect(beginnerPanel.locator('.exercise-figure img').first()).toHaveAttribute('src', /figures\/.*\.gif/)

  // 切換中級 / 高階 / 器械 tab，各有 6 張可點卡，且卡片圖皆指向 figures/
  await page.locator('#tab-intermediate').click()
  await expect(page.locator('#tab-intermediate')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#panel-intermediate')).toBeVisible()
  await expect(page.locator('#panel-beginner')).toBeHidden()
  await expect(page.locator('#panel-intermediate a.exercise-card')).toHaveCount(6)
  await expect(page.locator('#panel-intermediate .exercise-figure img').first()).toHaveAttribute('src', /figures\/.*\.gif/)

  await page.locator('#tab-advanced').click()
  await expect(page.locator('#tab-advanced')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#panel-advanced')).toBeVisible()
  await expect(page.locator('#panel-advanced a.exercise-card')).toHaveCount(6)
  await expect(page.locator('#panel-advanced .exercise-figure img').first()).toHaveAttribute('src', /figures\/.*\.gif/)

  await page.locator('#tab-machine').click()
  await expect(page.locator('#tab-machine')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#panel-machine')).toBeVisible()
  await expect(page.locator('#panel-machine a.exercise-card')).toHaveCount(6)
  await expect(page.locator('#panel-machine .exercise-figure img').first()).toHaveAttribute('src', /figures\/.*\.gif/)

  // 切回中級點「弓步蹲」進訓練頁並驗證示範卡標題與 GIF
  await page.locator('#tab-intermediate').click()
  await page.locator('#panel-intermediate a.exercise-card', { hasText: '弓步蹲' }).click()
  await expect(page).toHaveURL(/train\.html\?exercise=lunge/)
  await expect(page.locator('#preview-overlay')).toBeVisible()
  await expect(page.locator('#preview-name')).toHaveText('弓步蹲')
  await expect(page.locator('#top-exercise-name')).toHaveText('弓步蹲')
  await expect(page.locator('#preview-figure img')).toHaveAttribute('src', /figures\/lunge\.gif/)
})

test('5B.R3 點器械 demoOnly 卡進 demo.html 顯示名稱、目標肌群、要點與 GIF', async ({ page }) => {
  await page.goto('/index.html')

  await page.locator('#tab-machine').click()
  await expect(page.locator('#panel-machine')).toBeVisible()
  await page.locator('#panel-machine a.exercise-card', { hasText: '坐姿胸推' }).click()

  await expect(page).toHaveURL(/demo\.html\?exercise=chest-press-machine/)
  await expect(page.locator('#demo-name')).toHaveText('坐姿胸推')
  await expect(page.locator('#demo-targets')).toContainText('胸大肌')
  await expect(page.locator('#demo-fig img')).toHaveAttribute('src', /figures\/chest-press-machine\.gif/)
  const stepCount = await page.locator('#demo-steps li').count()
  expect(stepCount).toBeGreaterThanOrEqual(3)
})

test('5B.R4 demoOnly 動作進 train.html 直接被導向 demo.html', async ({ page }) => {
  await page.goto('/train.html?exercise=chest-press-machine')
  await expect(page).toHaveURL(/demo\.html\?exercise=chest-press-machine/)
  await expect(page.locator('#demo-name')).toHaveText('坐姿胸推')
})

test('6.R2 器械 tab 點坐姿划船進 train.html（標籤為側面、含相機擺放提示）', async ({ page }) => {
  await page.goto('/index.html')

  await page.locator('#tab-machine').click()
  await expect(page.locator('#panel-machine')).toBeVisible()
  const seatedRowCard = page.locator('#panel-machine a.exercise-card', { hasText: '坐姿划船' })
  await expect(seatedRowCard.locator('.exercise-view-tag')).toHaveText('側面')
  await seatedRowCard.click()

  await expect(page).toHaveURL(/train\.html\?exercise=seated-row/)
  await expect(page.locator('#preview-overlay')).toBeVisible()
  await expect(page.locator('#preview-name')).toHaveText('坐姿划船')
  await expect(page.locator('#top-exercise-name')).toHaveText('坐姿划船')
  await expect(page.locator('#preview-figure img')).toHaveAttribute('src', /figures\/seated-row\.gif/)
  await expect(page.locator('#preview-steps li').first()).toContainText('手機放在身體側面')
})

test('7.R8 器械 tab 卡片順序與 R1 一致，且點滑輪下拉與器械划船皆進 train.html 顯示各自 GIF', async ({ page }) => {
  await page.goto('/index.html')

  await page.locator('#tab-machine').click()
  await expect(page.locator('#panel-machine')).toBeVisible()

  const names = await page.locator('#panel-machine a.exercise-card .exercise-name').allTextContents()
  expect(names).toEqual(['滑輪下拉', '坐姿划船', '器械划船', '坐姿胸推', '肩推機', '腿部推蹬'])

  await page.locator('#panel-machine a.exercise-card', { hasText: '滑輪下拉' }).click()
  await expect(page).toHaveURL(/train\.html\?exercise=lat-pulldown/)
  await expect(page.locator('#preview-overlay')).toBeVisible()
  await expect(page.locator('#preview-name')).toHaveText('滑輪下拉')
  await expect(page.locator('#preview-figure img')).toHaveAttribute('src', /figures\/lat-pulldown\.gif/)

  await page.goto('/index.html')
  await page.locator('#tab-machine').click()
  await page.locator('#panel-machine a.exercise-card', { hasText: '器械划船' }).click()
  await expect(page).toHaveURL(/train\.html\?exercise=machine-row/)
  await expect(page.locator('#preview-overlay')).toBeVisible()
  await expect(page.locator('#preview-name')).toHaveText('器械划船')
  await expect(page.locator('#preview-figure img')).toHaveAttribute('src', /figures\/machine-row\.gif/)
})

test('T4a.5 exercises.html 自動轉址到 index.html', async ({ page }) => {
  await page.goto('/exercises.html')
  await expect(page).toHaveURL(/\/(index\.html)?$/)
  await expect(page.locator('#panel-beginner a.exercise-card')).toHaveCount(6)
})

test('T4a.6 more.html 含裝置檢測連結與系統狀態區塊', async ({ page }) => {
  await page.goto('/more.html')
  await expect(page.locator('a[href="./device-check.html"]')).toBeVisible()
  await expect(page.locator('#sec-ctx')).toBeVisible()
  await expect(page.locator('#sw-state')).toBeVisible()
  await expect(page.locator('#sw-version')).toBeVisible()
  await expect(page.locator('#profile-state')).toBeVisible()
})

test('訓練頁完整流程：示範卡 -> 相機 -> 引導 -> 開始 -> 儲存 -> 回顧', async ({ page }) => {
  await page.goto('/train.html?exercise=march')

  // 1. 示範卡先擋在相機前
  await expect(page.locator('#preview-overlay')).toBeVisible()
  await expect(page.locator('#top-exercise-name')).toHaveText('原地踏步抬腿')
  await expect(page.locator('#preview-safety')).not.toBeEmpty()

  // 2. 按「我知道了」才開相機（假相機會成功）
  await page.locator('#btn-preview-start').click()
  // toBeHidden 在 visibility transition 進行中會誤判（isVisible 與 computed style
  // 於 500ms 內皆為 hidden，實測三種探針一致），改用 poll 避免競態
  await expect.poll(() => page.locator('#preview-overlay').isVisible()).toBe(false)
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
  await expect(page.locator('#session-detail')).toContainText('march-v0')

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

test('8.R2 橫放電視模式版面：左側 42% 大字資訊欄、右側 58% 相機與骨架對齊、示範卡可點', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 })
  await page.goto('/index.html')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/train.html?exercise=squat&tv=1')

  await expect(page.locator('body')).toHaveClass(/tv-mode/)
  await expect(page.locator('#tv-toggle')).toBeChecked()

  const camBox = await page.locator('#cam-wrap').boundingBox()
  expect(camBox).not.toBeNull()
  expect(camBox!.x).toBeGreaterThanOrEqual(0.4 * 915)

  const overlayClientWidth = await page.locator('#overlay').evaluate((el) => el.clientWidth)
  expect(overlayClientWidth).toBeCloseTo(camBox!.width, 0)

  const repFontSize = await page.locator('#rep-complete').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(repFontSize).toBeGreaterThanOrEqual(150)

  const topBandBox = await page.locator('#top-band').boundingBox()
  const repBox = await page.locator('.hud-rep-box').boundingBox()
  expect(topBandBox).not.toBeNull()
  expect(repBox).not.toBeNull()
  expect(topBandBox!.x + topBandBox!.width).toBeLessThanOrEqual(0.42 * 915 + 1)
  expect(repBox!.x + repBox!.width).toBeLessThanOrEqual(0.42 * 915 + 1)

  const startBtn = page.locator('#btn-preview-start')
  await expect(startBtn).toBeVisible()
  const btnBox = await startBtn.boundingBox()
  expect(btnBox).not.toBeNull()
  expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(412)
  await startBtn.click()
  await expect.poll(() => page.locator('#preview-overlay').isVisible()).toBe(false)
})

test('8.R1/R3/R4 直立電視模式提示、保存生效與關閉後恢復 68px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/index.html')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/train.html?exercise=squat&tv=1')

  await expect(page.locator('body')).toHaveClass(/tv-mode/)
  await expect(page.locator('#tv-rotate-hint')).toBeVisible()

  await page.goto('/train.html?exercise=squat')
  await expect(page.locator('body')).toHaveClass(/tv-mode/)
  await expect(page.locator('#tv-toggle')).toBeChecked()
  await expect(page.locator('#tv-rotate-hint')).toBeVisible()

  await page.locator('#tv-toggle').uncheck()
  await expect(page.locator('body')).not.toHaveClass(/tv-mode/)
  await expect(page.locator('#tv-rotate-hint')).toBeHidden()

  const repFontSize = await page.locator('#rep-complete').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(repFontSize).toBe(68)
})

test('8.R1 tv=0 強制關閉電視模式', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 })
  await page.goto('/index.html')
  await page.evaluate(() => localStorage.setItem('fc.tvMode', '1'))
  await page.goto('/train.html?exercise=squat&tv=0')

  await expect(page.locator('body')).not.toHaveClass(/tv-mode/)
  await expect(page.locator('#tv-toggle')).not.toBeChecked()
})

test('8.1 第一次打開電視開關顯示投放說明，關閉後不再自動出現，可從直立提示再開', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/index.html')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/train.html?exercise=squat')
  await page.locator('#btn-preview-start').click()

  const guide = page.locator('#tv-cast-guide')
  await expect(guide).toBeHidden()
  await page.locator('#tv-toggle').check()
  await expect(guide).toBeVisible()
  await expect(guide).toContainText('投放螢幕')
  await expect(guide).toContainText('螢幕鏡像輸出')
  await page.locator('#btn-tv-cast-close').click()
  await expect(guide).toBeHidden()

  await page.locator('#tv-toggle').uncheck()
  await page.locator('#tv-toggle').check()
  await expect(guide).toBeHidden()

  await page.locator('#tv-rotate-hint').click()
  await expect(guide).toBeVisible()
  await page.locator('#btn-tv-cast-close').click()
  await expect(guide).toBeHidden()
})

test('8.1 網址 tv=1 不自動跳出投放說明；橫放時說明卡按鈕在畫面內', async ({ page }) => {
  await page.setViewportSize({ width: 915, height: 412 })
  await page.goto('/index.html')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/train.html?exercise=squat&tv=1')
  await expect(page.locator('#tv-cast-guide')).toBeHidden()

  await page.locator('#btn-preview-start').click()
  await page.locator('#tv-toggle').uncheck()
  await page.locator('#tv-toggle').check()
  const btn = page.locator('#btn-tv-cast-close')
  await expect(btn).toBeVisible()
  await btn.scrollIntoViewIfNeeded()
  const box = await btn.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.y + box!.height).toBeLessThanOrEqual(412)
  await btn.click()
  await expect(page.locator('#tv-cast-guide')).toBeHidden()
})
