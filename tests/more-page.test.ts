import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')

function readPage(name: string): string {
  return readFileSync(resolve(ROOT, name), 'utf8')
}

describe('Iteration 4a HTML 頁面結構 (T4a.6)', () => {
  it('T4a.6: more.html 含裝置檢測連結、SW 版本與狀態區塊', () => {
    const html = readPage('more.html')

    expect(html).toContain('href="./device-check.html"')
    expect(html).toContain('href="./index.html"')
    expect(html).toContain('id="sec-ctx"')
    expect(html).toContain('id="sw-state"')
    expect(html).toContain('id="sw-version"')
    expect(html).toContain('id="profile-state"')
    expect(html).toContain('src="./src/more-page.ts"')
  })

  it('index.html 為動作選單首頁，含紀錄與更多連結及三個等級 tab', () => {
    const html = readPage('index.html')

    expect(html).toContain('AI 健身教練')
    expect(html).toContain('href="./review.html"')
    expect(html).toContain('href="./more.html"')
    expect(html).toContain('data-tier="beginner"')
    expect(html).toContain('data-tier="intermediate"')
    expect(html).toContain('data-tier="advanced"')
    expect(html).toContain('id="exercise-catalog"')
    expect(html).not.toContain('id="sec-ctx"')
    expect(html).not.toContain('開始裝置檢測')
  })

  it('exercises.html 保留 meta refresh 轉址到 index.html', () => {
    const html = readPage('exercises.html')

    expect(html).toContain('http-equiv="refresh"')
    expect(html).toContain('url=./index.html')
    expect(html).toContain('href="./index.html"')
  })
})
