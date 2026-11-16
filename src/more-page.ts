import './style.css'
import { getLatestProfile } from './db'
import { registerSw } from './sw-register'

registerSw()

function getEl(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el as HTMLElement
}

async function resolveSwVersion(): Promise<string> {
  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      const match = keys.find((k) => k.startsWith('fitness-coach-'))
      if (match) return match
    } catch {
      // ignore cache API errors and fall back to fetching sw.js
    }
  }

  try {
    const res = await fetch('./sw.js', { cache: 'no-store' })
    if (res.ok) {
      const text = await res.text()
      const m = text.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)
      if (m?.[1]) return m[1]
    }
  } catch {
    // offline without cache key
  }

  return '未知'
}

getEl('#sec-ctx').textContent = window.isSecureContext ? 'HTTPS 正常' : '非安全來源，相機不可用'

const swStateEl = getEl('#sw-state')
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then(() => {
      swStateEl.textContent = '已啟用（可離線）'
    })
    .catch(() => {
      swStateEl.textContent = '註冊失敗'
    })
  if (!navigator.serviceWorker.controller) {
    swStateEl.textContent = '首次載入，快取建立中'
  }
} else {
  swStateEl.textContent = '此瀏覽器不支援'
}

resolveSwVersion()
  .then((ver) => {
    getEl('#sw-version').textContent = ver
  })
  .catch(() => {
    getEl('#sw-version').textContent = '讀取失敗'
  })

getLatestProfile()
  .then((p) => {
    getEl('#profile-state').textContent = p
      ? String(p.created_at).slice(0, 19).replace('T', ' ')
      : '尚未檢測'
  })
  .catch(() => {
    getEl('#profile-state').textContent = '讀取失敗'
  })
