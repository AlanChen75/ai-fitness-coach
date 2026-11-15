import './style.css'
import { getLatestProfile } from './db'
import { registerSw } from './sw-register'

registerSw()

const $ = (sel: string) => document.querySelector(sel) as HTMLElement

$('#sec-ctx').textContent = window.isSecureContext ? 'HTTPS 正常' : '非安全來源，相機不可用'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready
    .then(() => { $('#sw-state').textContent = '已啟用（可離線）' })
    .catch(() => { $('#sw-state').textContent = '註冊失敗' })
  if (!navigator.serviceWorker.controller) $('#sw-state').textContent = '首次載入，快取建立中'
} else {
  $('#sw-state').textContent = '此瀏覽器不支援'
}

getLatestProfile()
  .then((p) => {
    $('#profile-state').textContent = p ? String(p.created_at).slice(0, 19).replace('T', ' ') : '尚未檢測'
  })
  .catch(() => { $('#profile-state').textContent = '讀取失敗' })
