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

  it('more.html 含安裝到桌面說明（Android 與 iPhone）與分享按鈕', () => {
    const html = readPage('more.html')

    expect(html).toContain('安裝到手機桌面')
    expect(html).toContain('加入主畫面')
    expect(html).toContain('Android')
    expect(html).toContain('iPhone')
    expect(html).toContain('id="btn-install"')
    expect(html).toContain('id="btn-share"')
    expect(html).toContain('id="share-status"')
  })

  it('index.html 為動作選單首頁，含紀錄與更多連結及四個等級 tab（含器械）', () => {
    const html = readPage('index.html')

    expect(html).toContain('AI 健身教練')
    expect(html).toContain('href="./review.html"')
    expect(html).toContain('href="./more.html"')
    expect(html).toContain('data-tier="beginner"')
    expect(html).toContain('data-tier="intermediate"')
    expect(html).toContain('data-tier="advanced"')
    expect(html).toContain('data-tier="machine"')
    expect(html).toContain('>器械</button>')
    expect(html).toContain('id="exercise-catalog"')
    expect(html).not.toContain('id="sec-ctx"')
    expect(html).not.toContain('開始裝置檢測')
  })

  it('demo.html 結構完整，含 title、#demo-fig、#demo-steps、回首頁連結與 head 三件套', () => {
    const html = readPage('demo.html')

    expect(html).toContain('<title>')
    expect(html).toContain('id="demo-fig"')
    expect(html).toContain('id="demo-steps"')
    expect(html).toContain('id="demo-name"')
    expect(html).toContain('id="demo-targets"')
    expect(html).toContain('href="./index.html"')
    expect(html).toContain('rel="manifest" href="./manifest.webmanifest"')
    expect(html).toContain('href="./icons/favicon-32.png"')
    expect(html).toContain('href="./icons/apple-touch-icon.png"')
    expect(html).toContain('name="theme-color"')
    expect(html).toContain('src="./src/demo-page.ts"')
    expect(html).not.toContain('id="cam"')
  })

  it('sw.js 升版且 PRECACHE 含 demo.html、不含 figures/', () => {
    const sw = readPage('public/sw.js')
    expect(sw).toMatch(/CACHE_NAME\s*=\s*['"]fitness-coach-v0\.5\.2['"]/)
    const precacheMatch = sw.match(/const PRECACHE = \[([\s\S]*?)\]/)
    expect(precacheMatch).not.toBeNull()
    const precacheBlock = precacheMatch![1]
    expect(precacheBlock).toContain("'./demo.html'")
    expect(precacheBlock).not.toContain('figures/')
  })

  it('exercises.html 保留 meta refresh 轉址到 index.html', () => {
    const html = readPage('exercises.html')

    expect(html).toContain('http-equiv="refresh"')
    expect(html).toContain('url=./index.html')
    expect(html).toContain('href="./index.html"')
  })
})
