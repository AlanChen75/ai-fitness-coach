import './style.css'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { getLatestProfile } from './db'
import { extractFeatures } from './engine/features'
import {
  createRepEngineState,
  createSession,
  getSetSummary,
  processSample
} from './engine/rep-engine'
import type { RepEngineState } from './engine/rep-engine'
import { DEFAULT_SQUAT_RULES } from './engine/squat-fsm'
import { SCHEMA_VERSION } from './engine/types'
import type {
  CameraMetadata,
  NormalizedLandmark,
  PoseSample,
  SquatPhase
} from './engine/types'
import { loadPose, startCamera } from './pose-benchmark'
import type { CameraInfo } from './pose-benchmark'
import {
  appendPoseSamples,
  buildPoseFileRef,
  isOpfsAvailable,
  saveSession,
  toStoredSet
} from './storage'
import type { StoredConsentMetadata, StoredSession, StoredSet } from './storage'
import { registerSw } from './sw-register'
import { createCoachTts } from './tts'

registerSw()

const TARGET_INTERVAL_MS = 100
const CHECKPOINT_INTERVAL_MS = 10_000
const CHECKPOINT_SAMPLE_THRESHOLD = 100
const INVALID_WARN_MS = 3000
const POSE_MODEL_NAME = 'pose_landmarker_lite.task'

const SKELETON: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28]
]

const PHASE_LABELS: Record<SquatPhase, string> = {
  NOT_READY: '校準中（請站直）',
  STANDING: '站立準備',
  DESCENDING: '下蹲中',
  BOTTOM: '蹲底',
  ASCENDING: '起身中'
}

function $(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el as HTMLElement
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const elRepComplete = $('#rep-complete')
const elRepUncertain = $('#rep-uncertain')
const elFsmPhase = $('#fsm-phase')
const elValidRatio = $('#valid-ratio')
const elSetProgress = $('#set-progress')
const elLiveInfo = $('#live-info')
const elInterruptBanner = $('#interrupt-banner')
const elOpfsBanner = $('#opfs-banner')
const elStatusBanner = $('#status-banner')
const elCamWrap = $('#cam-wrap')
const elVideo = $('#cam') as HTMLVideoElement
const elOverlay = $('#overlay') as HTMLCanvasElement
const elTtsToggle = $('#tts-toggle') as HTMLInputElement

const btnInitCam = $('#btn-init-cam') as HTMLButtonElement
const btnSwitchCam = $('#btn-switch-cam') as HTMLButtonElement
const btnStartSet = $('#btn-start-set') as HTMLButtonElement
const btnEndSet = $('#btn-end-set') as HTMLButtonElement
const btnEndSession = $('#btn-end-session') as HTMLButtonElement
const btnRestart = $('#btn-restart') as HTMLButtonElement

const tts = createCoachTts({ enabled: elTtsToggle.checked })

// ---------- 執行期狀態 ----------
let landmarker: PoseLandmarker | null = null
let delegateName = ''
let facing: 'environment' | 'user' = 'environment'
let cameraInfo: CameraInfo | null = null
let trackedVideoTrack: MediaStreamTrack | null = null

let loopRafId: number | null = null
let lastInferenceAt = 0
let inferenceInFlight = false

let sessionId: string | null = null
let sessionStartedAt: string | null = null
let completedSets: StoredSet[] = []
let engineState: RepEngineState | null = null
let setStartPerfMs = 0
let lastSampleTms = -1
let pendingSamples: PoseSample[] = []
let lastCheckpointAt = 0
let invalidSinceMs: number | null = null
let inSet = false
let interrupted = false
let opfsSupported = true
let currentSetOpfsOk = true
let sessionPoseEvidenceOk = true
let cachedDeviceProfileId: string | null = null

function showStatus(msg: string, tone: 'ok' | 'warn' | 'fail' | '' = ''): void {
  elStatusBanner.textContent = msg
  elStatusBanner.className = `alert-banner${tone ? ' ' + tone : ''}`
}

function hideStatus(): void {
  elStatusBanner.className = 'alert-banner hidden'
  elStatusBanner.textContent = ''
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: readonly NormalizedLandmark[],
  w: number,
  h: number
): void {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#0ea5e9'
  ctx.lineWidth = 3
  for (const [a, b] of SKELETON) {
    const pa = lm[a]
    const pb = lm[b]
    if (!pa || !pb) continue
    ctx.beginPath()
    ctx.moveTo(pa.x * w, pa.y * h)
    ctx.lineTo(pb.x * w, pb.y * h)
    ctx.stroke()
  }
  ctx.fillStyle = '#10b981'
  for (const p of lm) {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function updateHud(): void {
  if (!engineState) {
    elRepComplete.textContent = '0'
    elRepUncertain.textContent = '0'
    elValidRatio.textContent = '--'
    elFsmPhase.textContent = interrupted ? '已中斷' : (landmarker && cameraInfo ? '待機就緒' : '待機')
    elFsmPhase.className = `phase-badge ${interrupted ? 'not-ready' : 'standing'}`
    elSetProgress.textContent = sessionId
      ? `組間休息 / 已完成 ${completedSets.length} 組`
      : '尚未開始 / 0 組'
    return
  }

  const completeCount = engineState.reps.filter((r) => r.status === 'complete').length
  const uncertainCount = engineState.reps.filter((r) => r.status === 'uncertain').length
  const ratio = engineState.totalSampleCount > 0
    ? `${Math.round((engineState.validSampleCount / engineState.totalSampleCount) * 100)}%`
    : '--'
  const phase = engineState.fsm.phase

  elRepComplete.textContent = String(completeCount)
  elRepUncertain.textContent = String(uncertainCount)
  elValidRatio.textContent = ratio
  elFsmPhase.textContent = PHASE_LABELS[phase]
  elFsmPhase.className =
    phase === 'NOT_READY'
      ? 'phase-badge not-ready'
      : phase === 'STANDING'
        ? 'phase-badge standing'
        : 'phase-badge active'
  elSetProgress.textContent = `第 ${completedSets.length + 1} 組進行中 / 已完成 ${completedSets.length} 組`
}

function syncButtons(): void {
  const ready = Boolean(landmarker && cameraInfo && !interrupted)
  btnInitCam.disabled = inSet
  btnSwitchCam.disabled = !cameraInfo || inSet || interrupted
  btnStartSet.disabled = !ready || inSet
  btnEndSet.disabled = !inSet || interrupted
  btnEndSession.disabled = !sessionId || interrupted
  btnRestart.classList.toggle('hidden', !interrupted)
}

function detachTrackListener(): void {
  if (trackedVideoTrack) {
    trackedVideoTrack.removeEventListener('ended', handleTrackEnded)
    trackedVideoTrack = null
  }
}

function attachTrackListener(): void {
  detachTrackListener()
  const stream = elVideo.srcObject as MediaStream | null
  const track = stream?.getVideoTracks()[0] ?? null
  if (track) {
    trackedVideoTrack = track
    track.addEventListener('ended', handleTrackEnded)
  }
}

function stopCameraTracks(): void {
  detachTrackListener()
  const stream = elVideo.srcObject as MediaStream | null
  if (stream) {
    stream.getTracks().forEach((t) => t.stop())
    elVideo.srcObject = null
  }
  cameraInfo = null
}

function readCameraMetadata(): CameraMetadata {
  const stream = elVideo.srcObject as MediaStream | null
  const track = stream?.getVideoTracks()[0]
  if (track && track.readyState === 'live') {
    const s = track.getSettings()
    return {
      facing: s.facingMode ?? facing,
      width: s.width ?? elVideo.videoWidth ?? 0,
      height: s.height ?? elVideo.videoHeight ?? 0,
      frameRate: s.frameRate,
      label: track.label || undefined
    }
  }
  if (cameraInfo) {
    return {
      facing: cameraInfo.facing,
      width: cameraInfo.width,
      height: cameraInfo.height,
      frameRate: cameraInfo.frameRate,
      label: cameraInfo.label || undefined
    }
  }
  return { facing, width: elVideo.videoWidth || 0, height: elVideo.videoHeight || 0 }
}

async function resolveDeviceProfileId(): Promise<string> {
  if (cachedDeviceProfileId) return cachedDeviceProfileId
  try {
    const latest = await getLatestProfile()
    if (latest && typeof latest.profile_id === 'string' && latest.profile_id.length > 0) {
      cachedDeviceProfileId = latest.profile_id
      return cachedDeviceProfileId
    }
  } catch {
    // 讀不到 profile 時依規格回退 unknown
  }
  return 'unknown'
}

function buildConsent(): StoredConsentMetadata {
  return {
    accepted: true,
    version: SCHEMA_VERSION,
    timestamp: sessionStartedAt ?? new Date().toISOString(),
    pose: true,
    video: false,
    upload: false
  }
}

async function flushPendingSamples(activeSessionId: string, activeSetId: string): Promise<boolean> {
  if (pendingSamples.length === 0) return currentSetOpfsOk
  const batch = pendingSamples
  pendingSamples = []
  lastCheckpointAt = performance.now()
  if (!opfsSupported) {
    currentSetOpfsOk = false
    sessionPoseEvidenceOk = false
    return false
  }
  const ok = await appendPoseSamples(activeSessionId, activeSetId, batch)
  if (!ok) {
    currentSetOpfsOk = false
    sessionPoseEvidenceOk = false
    elOpfsBanner.classList.remove('hidden')
  }
  return ok
}

async function buildStoredSession(
  sets: readonly StoredSet[],
  isInterrupted: boolean,
  endedAt: string | null
): Promise<StoredSession> {
  const sid = sessionId ?? makeId()
  const startedAt = sessionStartedAt ?? new Date().toISOString()
  const deviceProfileId = await resolveDeviceProfileId()
  const base = createSession({
    sessionId: sid,
    deviceProfileId,
    startedAt,
    poseModel: POSE_MODEL_NAME,
    rulesVersion: DEFAULT_SQUAT_RULES.rules_version,
    camera: readCameraMetadata(),
    consent: buildConsent(),
    sets
  })
  return {
    ...base,
    consent: buildConsent(),
    sets,
    interrupted: isInterrupted,
    ended_at: endedAt,
    pose_evidence_available: sessionPoseEvidenceOk
  }
}

async function saveCheckpointSession(isInterrupted: boolean, endedAt: string | null): Promise<void> {
  if (!sessionId) return
  const activeSetSnapshot: StoredSet[] = engineState
    ? [
        toStoredSet(
          getSetSummary(engineState),
          currentSetOpfsOk ? buildPoseFileRef(sessionId, engineState.setId) : null
        )
      ]
    : []
  const allSets = [...completedSets, ...activeSetSnapshot]
  const stored = await buildStoredSession(allSets, isInterrupted, endedAt)
  await saveSession(stored)
}

function handleEventsForTts(
  prevState: RepEngineState,
  nextState: RepEngineState,
  events: ReturnType<typeof processSample>['events'],
  now: number,
  frameValid: boolean
): void {
  if (frameValid) {
    invalidSinceMs = null
  } else if (invalidSinceMs === null) {
    invalidSinceMs = now
  }

  for (const ev of events) {
    if (ev.type === 'state_change') {
      if (ev.from === 'NOT_READY' && ev.to === 'STANDING') {
        tts.announceCalibration()
      } else if (ev.reason === 'invalid_streak_exceeded') {
        tts.announceInvalid()
      }
      continue
    }
    if (ev.type === 'rep_complete') {
      const completeCount = nextState.reps.filter((r) => r.status === 'complete').length
      tts.announceRep(completeCount)
    }
  }

  // 若持續在 NOT_READY 且連續 invalid 超過 3 秒，也語音提醒調整鏡頭
  const prevComplete = prevState.reps.filter((r) => r.status === 'complete').length
  const nextComplete = nextState.reps.filter((r) => r.status === 'complete').length
  if (
    prevComplete === nextComplete &&
    nextState.fsm.phase === 'NOT_READY' &&
    invalidSinceMs !== null &&
    now - invalidSinceMs >= INVALID_WARN_MS
  ) {
    tts.announceInvalid()
  }
}

function stepFrame(now: number): void {
  if (!landmarker || !cameraInfo || interrupted) return
  if (inferenceInFlight || elVideo.readyState < 2) return
  if (now - lastInferenceAt < TARGET_INTERVAL_MS) return

  inferenceInFlight = true
  lastInferenceAt = now
  try {
    if (elOverlay.width !== elVideo.videoWidth || elOverlay.height !== elVideo.videoHeight) {
      elOverlay.width = elVideo.videoWidth
      elOverlay.height = elVideo.videoHeight
    }

    const result = landmarker.detectForVideo(elVideo, now)
    const rawLm = result.landmarks?.[0] ?? []
    const landmarks: NormalizedLandmark[] = rawLm.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      visibility: p.visibility
    }))

    const ctx = elOverlay.getContext('2d')
    if (ctx) {
      if (landmarks.length > 0) {
        drawSkeleton(ctx, landmarks, elOverlay.width, elOverlay.height)
      } else {
        ctx.clearRect(0, 0, elOverlay.width, elOverlay.height)
      }
    }

    if (!inSet || !engineState || !sessionId) {
      const preview = extractFeatures(landmarks)
      if (preview.valid && preview.kneeAngle !== null) {
        elLiveInfo.textContent = `預覽就緒 · ${preview.side === 'left' ? '左側' : '右側'} · 膝角 ${Math.round(preview.kneeAngle)}°`
      } else {
        elLiveInfo.textContent = '預覽中 · 請讓全身側面入鏡'
      }
      return
    }

    const rawTms = Math.max(0, Math.round(now - setStartPerfMs))
    const t_ms = lastSampleTms >= 0 ? Math.max(lastSampleTms + 1, rawTms) : rawTms
    lastSampleTms = t_ms

    const prevState = engineState
    const res = processSample(prevState, {
      t_ms,
      landmarks,
      valid: landmarks.length > 0
    })
    engineState = res.state

    pendingSamples.push({
      t_ms,
      landmarks,
      valid: res.features.valid
    })

    handleEventsForTts(prevState, engineState, res.events, now, res.features.valid)

    const angleText = res.features.kneeAngle !== null ? `${Math.round(res.features.kneeAngle)}°` : '--'
    elLiveInfo.textContent = `推論中 · 膝角 ${angleText} · 樣本 ${engineState.totalSampleCount}`
    updateHud()

    if (
      pendingSamples.length >= CHECKPOINT_SAMPLE_THRESHOLD ||
      (now - lastCheckpointAt >= CHECKPOINT_INTERVAL_MS && pendingSamples.length > 0)
    ) {
      const activeSetId = engineState.setId
      void flushPendingSamples(sessionId, activeSetId).then(() => saveCheckpointSession(false, null))
    }
  } catch (err) {
    console.error('inference loop error', err)
  } finally {
    inferenceInFlight = false
  }
}

function startLoop(): void {
  if (loopRafId !== null) return
  const tick = (now: number) => {
    if (loopRafId === null) return
    stepFrame(now)
    loopRafId = requestAnimationFrame(tick)
  }
  loopRafId = requestAnimationFrame(tick)
}

function stopLoop(): void {
  if (loopRafId !== null) {
    cancelAnimationFrame(loopRafId)
    loopRafId = null
  }
}

async function initCameraAndModel(): Promise<void> {
  hideStatus()
  btnInitCam.disabled = true
  elLiveInfo.textContent = '開啟相機與載入模型中…'
  elCamWrap.classList.toggle('mirrored', facing === 'user')

  try {
    detachTrackListener()
    cameraInfo = await startCamera(elVideo, facing)
    attachTrackListener()
    elOverlay.width = elVideo.videoWidth
    elOverlay.height = elVideo.videoHeight
  } catch (err) {
    showStatus(`相機開啟失敗：${String(err)}`, 'fail')
    elLiveInfo.textContent = '相機無法開啟'
    syncButtons()
    return
  }

  try {
    if (!landmarker) {
      const loaded = await loadPose()
      landmarker = loaded.landmarker
      delegateName = loaded.delegate
    }
    opfsSupported = await isOpfsAvailable()
    if (!opfsSupported) {
      sessionPoseEvidenceOk = false
      elOpfsBanner.classList.remove('hidden')
    }
    elLiveInfo.textContent = `相機與模型就緒（delegate: ${delegateName}）`
    startLoop()
  } catch (err) {
    showStatus(`模型載入失敗：${String(err)}`, 'fail')
    elLiveInfo.textContent = '模型載入失敗'
  }
  updateHud()
  syncButtons()
}

async function switchCamera(): Promise<void> {
  if (inSet || interrupted) return
  facing = facing === 'environment' ? 'user' : 'environment'
  elCamWrap.classList.toggle('mirrored', facing === 'user')
  try {
    detachTrackListener()
    cameraInfo = await startCamera(elVideo, facing)
    attachTrackListener()
    elOverlay.width = elVideo.videoWidth
    elOverlay.height = elVideo.videoHeight
    elLiveInfo.textContent = `已切換為${facing === 'user' ? '前鏡頭（鏡像）' : '後鏡頭'}`
  } catch (err) {
    showStatus(`切換鏡頭失敗：${String(err)}`, 'fail')
  }
  syncButtons()
}

async function startSet(): Promise<void> {
  if (!landmarker || !cameraInfo || inSet || interrupted) return
  hideStatus()

  if (!sessionId) {
    sessionId = makeId()
    sessionStartedAt = new Date().toISOString()
    completedSets = []
    opfsSupported = await isOpfsAvailable()
    sessionPoseEvidenceOk = opfsSupported
    if (!opfsSupported) {
      elOpfsBanner.classList.remove('hidden')
    }
    void resolveDeviceProfileId()
  }

  const setId = makeId()
  engineState = createRepEngineState({ setId, idFactory: makeId })
  setStartPerfMs = performance.now()
  lastSampleTms = -1
  pendingSamples = []
  lastCheckpointAt = performance.now()
  invalidSinceMs = null
  currentSetOpfsOk = opfsSupported
  inSet = true

  updateHud()
  syncButtons()
  startLoop()
}

async function finalizeCurrentSet(): Promise<void> {
  if (!engineState || !sessionId) return
  inSet = false
  const currentEngine = engineState
  const currentSetId = currentEngine.setId
  const opfsOk = await flushPendingSamples(sessionId, currentSetId)
  const summary = getSetSummary(currentEngine)
  const poseRef = opfsOk ? buildPoseFileRef(sessionId, currentSetId) : null
  completedSets = [...completedSets, toStoredSet(summary, poseRef)]
  engineState = null
  await saveCheckpointSession(false, null)
}

async function endSet(): Promise<void> {
  if (!inSet) return
  btnEndSet.disabled = true
  await finalizeCurrentSet()
  showStatus(`第 ${completedSets.length} 組已結束並保存。可開始下一組或結束訓練。`, 'ok')
  updateHud()
  syncButtons()
}

async function endSession(): Promise<void> {
  if (!sessionId || interrupted) return
  btnEndSession.disabled = true
  btnEndSet.disabled = true
  btnStartSet.disabled = true

  if (inSet) {
    await finalizeCurrentSet()
  }
  const stored = await buildStoredSession(completedSets, false, new Date().toISOString())
  await saveSession(stored)

  stopLoop()
  stopCameraTracks()
  window.location.href = `./review.html?session=${encodeURIComponent(stored.session_id)}`
}

async function triggerInterrupt(reasonLabel: string): Promise<void> {
  if (interrupted) return
  const hasActiveProgress = inSet || Boolean(sessionId && completedSets.length > 0)
  if (!hasActiveProgress) return

  interrupted = true
  inSet = false
  stopLoop()
  tts.stop()

  elInterruptBanner.textContent = `已中斷（${reasonLabel}）：已立即停止取樣並寫入本地儲存。請按「重新開始」重新訓練，或前往回顧頁查看紀錄。`
  elInterruptBanner.classList.remove('hidden')
  elLiveInfo.textContent = '訓練已中斷'
  updateHud()
  syncButtons()

  if (sessionId) {
    const activeSetId = engineState?.setId
    if (activeSetId) {
      await flushPendingSamples(sessionId, activeSetId)
    }
    await saveCheckpointSession(true, new Date().toISOString())
  }
  stopCameraTracks()
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    void triggerInterrupt('頁面進入背景')
  }
}

function handleTrackEnded(): void {
  void triggerInterrupt('相機串流結束')
}

function restartTraining(): void {
  stopLoop()
  stopCameraTracks()
  tts.stop()

  sessionId = null
  sessionStartedAt = null
  completedSets = []
  engineState = null
  pendingSamples = []
  lastSampleTms = -1
  invalidSinceMs = null
  inSet = false
  interrupted = false
  sessionPoseEvidenceOk = true
  currentSetOpfsOk = true

  elInterruptBanner.classList.add('hidden')
  hideStatus()
  elLiveInfo.textContent = '請重新開啟相機與模型'
  updateHud()
  syncButtons()
}

elTtsToggle.addEventListener('change', () => {
  tts.setEnabled(elTtsToggle.checked)
})
btnInitCam.addEventListener('click', () => { void initCameraAndModel() })
btnSwitchCam.addEventListener('click', () => { void switchCamera() })
btnStartSet.addEventListener('click', () => { void startSet() })
btnEndSet.addEventListener('click', () => { void endSet() })
btnEndSession.addEventListener('click', () => { void endSession() })
btnRestart.addEventListener('click', restartTraining)
document.addEventListener('visibilitychange', handleVisibilityChange)

updateHud()
syncButtons()
