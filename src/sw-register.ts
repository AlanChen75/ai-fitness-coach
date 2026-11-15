export function registerSw(): void {
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => {
      console.error('Service Worker 註冊失敗', e)
    })
  })
}
