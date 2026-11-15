import './style.css'
import { idbRoundtrip, opfsRoundtrip, putProfile } from './db'
import { startCamera, loadPose, runBenchmark } from './pose-benchmark'
import type { CameraInfo, BenchmarkResult } from './pose-benchmark'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { registerSw } from './sw-register'

registerSw()

type Status = 'ok' | 'warn' | 'fail'
interface CheckItem { key: string; value: string; status: Status }

const profile: Record<string, unknown> = {
  profile_id: 'profile-' + Date.now().toString(36),
  schema_version: '0.1.0',
  created_at: new Date().toISOString()
}

const $ = (sel: string) => document.querySelector(sel) as HTMLElement

function renderRows(target: string, items: CheckItem[]): void {
  $(target).innerHTML = items.map((it) =>
    `<div class="result-row"><span class="k">${it.key}</span><span class="v ${it.status}">${it.value}</span></div>`
  ).join('')
}

// ---------- 靜態檢測 ----------
async function staticChecks(): Promise<void> {
  const items: CheckItem[] = []

  const secure = window.isSecureContext
  items.push({ key: '安全來源 HTTPS', value: secure ? 'true' : 'false（相機不可用）', status: secure ? 'ok' : 'fail' })

  items.push({ key: 'User Agent', value: navigator.userAgent.slice(0, 80), status: 'ok' })

  const hasWasm = typeof WebAssembly === 'object'
  items.push({ key: 'WebAssembly', value: hasWasm ? '支援' : '不支援', status: hasWasm ? 'ok' : 'fail' })

  let webgl = '不支援'
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')
    if (gl) webgl = (gl.getParameter(gl.VERSION) as string).slice(0, 40)
  } catch { /* 留在不支援 */ }
  items.push({ key: 'WebGL', value: webgl, status: webgl === '不支援' ? 'warn' : 'ok' })

  items.push({ key: 'Dedicated Worker', value: typeof Worker === 'function' ? '支援' : '不支援', status: typeof Worker === 'function' ? 'ok' : 'warn' })
  items.push({ key: 'OffscreenCanvas', value: typeof OffscreenCanvas === 'function' ? '支援' : '不支援', status: typeof OffscreenCanvas === 'function' ? 'ok' : 'warn' })

  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate()
      const usedMb = Math.round((est.usage ?? 0) / 1048576)
      const quotaMb = Math.round((est.quota ?? 0) / 1048576)
      items.push({ key: '儲存配額', value: `${usedMb} / ${quotaMb} MB`, status: 'ok' })
      profile.storage_estimate = { usage_mb: usedMb, quota_mb: quotaMb }
    } catch (e) {
      items.push({ key: '儲存配額', value: String(e), status: 'warn' })
    }
  } else {
    items.push({ key: '儲存配額', value: 'estimate 不支援', status: 'warn' })
  }

  if (navigator.storage?.persist) {
    try {
      const persisted = await navigator.storage.persist()
      items.push({ key: '持久化儲存', value: persisted ? '已允許' : '被拒（不阻擋訓練）', status: persisted ? 'ok' : 'warn' })
      profile.storage_persisted = persisted
    } catch {
      items.push({ key: '持久化儲存', value: '呼叫失敗', status: 'warn' })
    }
  }

  const mimes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  const supported = typeof MediaRecorder === 'function'
    ? mimes.filter((m) => MediaRecorder.isTypeSupported(m))
    : []
  items.push({
    key: 'MediaRecorder MIME',
    value: supported.length ? supported.join(', ') : '無可用格式（錄影選配不可用）',
    status: supported.length ? 'ok' : 'warn'
  })
  profile.media_recorder_mimes = supported

  items.push({ key: 'Page Visibility', value: typeof document.visibilityState === 'string' ? '支援' : '不支援', status: 'ok' })
  const wakeLock = 'wakeLock' in navigator
  items.push({ key: 'Screen Wake Lock', value: wakeLock ? '支援' : '不支援', status: wakeLock ? 'ok' : 'warn' })
  items.push({ key: '目前網路', value: navigator.onLine ? 'online（不代表伺服器健康）' : 'offline', status: 'ok' })

  profile.secure_context = secure
  profile.user_agent = navigator.userAgent
  profile.wasm = hasWasm
  profile.webgl = webgl
  profile.worker = typeof Worker === 'function'
  profile.offscreen_canvas = typeof OffscreenCanvas === 'function'
  profile.wake_lock = wakeLock

  renderRows('#static-results', items)
}

// ---------- 儲存實測 ----------
async function storageChecks(): Promise<void> {
  const items: CheckItem[] = []
  const idb = await idbRoundtrip()
  items.push({ key: 'IndexedDB 往返', value: idb.detail, status: idb.ok ? 'ok' : 'fail' })
  const opfs = await opfsRoundtrip()
  items.push({
    key: 'OPFS 往返',
    value: opfs.detail,
    status: opfs.ok ? 'ok' : (opfs.supported ? 'fail' : 'warn')
  })
  profile.idb_roundtrip = idb
  profile.opfs_roundtrip = opfs
  renderRows('#storage-results', items)
}

// ---------- TTS ----------
function ttsCheck(): void {
  const items: CheckItem[] = []
  if (!('speechSynthesis' in window)) {
    renderRows('#tts-results', [{ key: 'speechSynthesis', value: '不支援', status: 'fail' }])
    profile.tts = { supported: false }
    return
  }
  const speakNow = () => {
    const voices = speechSynthesis.getVoices()
    const zhVoices = voices.filter((v) => v.lang.startsWith('zh'))
    const pick = zhVoices.find((v) => v.lang === 'zh-TW') ?? zhVoices[0]
    const u = new SpeechSynthesisUtterance('語音測試，第五下，動作很穩')
    u.lang = 'zh-TW'
    if (pick) u.voice = pick
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
    items.length = 0
    items.push({ key: '中文語音數', value: String(zhVoices.length), status: zhVoices.length ? 'ok' : 'warn' })
    items.push({ key: '使用語音', value: pick ? `${pick.name}（${pick.lang}）` : '系統預設', status: 'ok' })
    items.push({ key: '播放', value: '已送出，請耳聽確認', status: 'warn' })
    profile.tts = { supported: true, zh_voice_count: zhVoices.length, picked: pick?.name ?? null }
    renderRows('#tts-results', items)
  }
  // Android Chrome voices 可能非同步載入
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.addEventListener('voiceschanged', speakNow, { once: true })
    setTimeout(speakNow, 500)
  } else {
    speakNow()
  }
}

// ---------- 相機 + Pose ----------
let landmarker: PoseLandmarker | null = null
let delegate = ''
let camInfo: CameraInfo | null = null

async function cameraAndModel(): Promise<void> {
  const video = $('#cam') as HTMLVideoElement
  const items: CheckItem[] = []
  const btnBench = $('#btn-bench') as HTMLButtonElement
  const useFront = ($('#front-cam') as HTMLInputElement).checked
  // 前鏡頭時預覽與骨架一起鏡像（同一 transform 保持對齊）
  const wrap = document.querySelector('.video-wrap') as HTMLElement
  wrap.classList.toggle('mirrored', useFront)
  try {
    camInfo = await startCamera(video, useFront ? 'user' : 'environment')
    items.push({ key: '鏡頭', value: `${camInfo.label.slice(0, 40)}（${camInfo.facing}）`, status: 'ok' })
    items.push({ key: '實際解析度', value: `${camInfo.width}x${camInfo.height} @ ${Math.round(camInfo.frameRate)}fps`, status: 'ok' })
  } catch (e) {
    // 相機失敗仍嘗試載模型，讓桌機除錯能驗證模型路徑；Benchmark 仍需相機
    items.push({ key: '相機', value: '開啟失敗：' + String(e), status: 'fail' })
  }
  try {
    $('#bench-live').textContent = '模型載入中…'
    const loaded = await loadPose()
    landmarker = loaded.landmarker
    delegate = loaded.delegate
    items.push({ key: 'Pose Lite 模型', value: `載入成功（delegate: ${delegate}）`, status: 'ok' })
    if (camInfo) {
      btnBench.disabled = false
      $('#bench-live').textContent = '模型就緒，可開始 Benchmark'
    } else {
      $('#bench-live').textContent = '模型就緒，但相機不可用，無法 Benchmark'
    }
  } catch (e) {
    items.push({ key: 'Pose Lite 模型', value: '載入失敗：' + String(e), status: 'fail' })
  }
  profile.camera = camInfo
  renderRows('#cam-results', items)
}

async function benchmark(): Promise<void> {
  if (!landmarker || !camInfo) return
  const video = $('#cam') as HTMLVideoElement
  const overlay = $('#overlay') as HTMLCanvasElement
  const quick = ($('#quick-mode') as HTMLInputElement).checked
  const duration = quick ? 15 : 60
  const btn = $('#btn-bench') as HTMLButtonElement
  btn.disabled = true
  const result: BenchmarkResult = await runBenchmark(
    landmarker, delegate, video, overlay, duration,
    (msg) => { $('#bench-live').textContent = msg }
  )
  btn.disabled = false
  profile.pose_benchmark = result
  // 跑完直接自動保存，避免漏按：匯出即含 benchmark
  try {
    await putProfile({ ...profile })
    $('#bench-live').textContent = 'Benchmark 完成，已自動保存，可直接匯出 JSON'
  } catch (e) {
    $('#bench-live').textContent = 'Benchmark 完成，但自動保存失敗：' + String(e)
  }
  const hzOk: Status = result.effective_pose_hz >= 8 ? 'ok' : (result.effective_pose_hz >= 5 ? 'warn' : 'fail')
  renderRows('#cam-results', [
    { key: '時長 / 推論次數', value: `${result.duration_s}s / ${result.inference_count} 次`, status: 'ok' },
    { key: 'p50 / p95 / max', value: `${result.p50_ms} / ${result.p95_ms} / ${result.max_ms} ms`, status: result.p95_ms <= 150 ? 'ok' : 'warn' },
    { key: '有效 Pose Hz', value: String(result.effective_pose_hz), status: hzOk },
    { key: '掉幀（送達-取樣）', value: String(result.dropped_frames), status: 'ok' },
    { key: '偵測到人比例', value: (result.pose_detected_ratio * 100).toFixed(1) + '%', status: 'ok' },
    { key: 'Delegate', value: result.delegate, status: 'ok' }
  ])
}

// ---------- Profile 保存與匯出 ----------
async function saveProfile(): Promise<void> {
  try {
    await putProfile({ ...profile })
    renderRows('#profile-results', [{ key: '保存', value: '已存入 IndexedDB：' + String(profile.profile_id), status: 'ok' }])
  } catch (e) {
    renderRows('#profile-results', [{ key: '保存', value: '失敗：' + String(e), status: 'fail' }])
  }
}

function exportProfile(): void {
  if (!profile.pose_benchmark) {
    alert('注意：這份 Profile 還沒有 Benchmark 結果。請先跑完 60 秒 Benchmark 再匯出，才有 p50/p95 與 Pose Hz 數據。')
  }
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'device-capability-profile.json'
  a.click()
  URL.revokeObjectURL(a.href)
}

$('#btn-static').addEventListener('click', () => { void staticChecks() })
$('#btn-storage').addEventListener('click', () => { void storageChecks() })
$('#btn-tts').addEventListener('click', ttsCheck)
$('#btn-cam').addEventListener('click', () => { void cameraAndModel() })
$('#btn-bench').addEventListener('click', () => { void benchmark() })
$('#btn-save').addEventListener('click', () => { void saveProfile() })
$('#btn-export').addEventListener('click', exportProfile)
