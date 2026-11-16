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
import {
  checkBodyInFrame,
  coverTransform,
  createInitialPositioningState,
  DEFAULT_FRAMING_RULES,
  detectFacing,
  updatePositioning
} from './framing'
import type {
  BodyInFrameResult,
  CoverTransform,
  FacingOrientation,
  PositioningState
} from './framing'
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
const FRONT_FACING_WARN_MS = 3000
const POSE_MODEL_NAME = 'pose_landmarker_lite.task'

const SKELETON: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28]
]

const ACTIVE_PHASE_LABELS: Record<Exclude<SquatPhase, 'NOT_READY'>, string> = {
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

const elTopBand = $('#top-band')
const elTopStatusText = $('#top-status-text')
const elSetProgress = $('#set-progress')
const elRepComplete = $('#rep-complete')
const elRepUncertain = $('#rep-uncertain')
const elKneeAngleLive = $('#knee-angle-live')
const elInterruptBanner = $('#interrupt-banner')
const elInterruptMsg = $('#interrupt-msg')
const elOpfsBanner = $('#opfs-banner')
const elStatusBanner = $('#status-banner')
const elCamWrap = $('#cam-wrap')
const elVideo = $('#cam') as HTMLVideoElement
const elOverlay = $('#overlay') as HTMLCanvasElement
const elTtsToggle = $('#tts-toggle') as HTMLInputElement

const elGuideOverlay = $('#guide-overlay')
const elGuideHint = $('#guide-hint')
const elChkInFrame = $('#chk-in-frame')
const elChkFacingSide = $('#chk-facing-side')
const elChkHoldStable = $('#chk-hold-stable')
const elChkHoldLabel = $('#chk-hold-label')

const btnInitCam = $('#btn-init-cam') as HTMLButtonElement
const btnSkipGuide = $('#btn-skip-guide') as HTMLButtonElement
const btnSwitchCam = $('#btn-switch-cam') as HTMLButtonElement
const btnEndSet = $('#btn-end-set') as HTMLButtonElement
const btnEndSession = $('#btn-end-session') as HTMLButtonElement
const btnRestart = $('#btn-restart') as HTMLButtonElement

const tts = createCoachTts({ enabled: elTtsToggle.checked })

// ---------- 執行期狀態 ----------
let landmarker: PoseLandmarker | null = null
let facing: 'environment' | 'user' = 'environment'
let cameraInfo: CameraInfo | null = null
let trackedVideoTrack: MediaStreamTrack | null = null
let initInFlight = false
let initFailed = false

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
let startingSet = false
let interrupted = false
let opfsSupported = true
let currentSetOpfsOk = true
let sessionPoseEvidenceOk = true
let cachedDeviceProfileId: string | null = null

let positioningState: PositioningState = createInitialPositioningState()
let frontFacingSinceMs: number | null = null
let lastInFrame: BodyInFrameResult = { inFrame: false, missing: 'all' }
let lastFacing: FacingOrientation = 'unknown'
let lastFrameValid = false
let lastKneeAngle: number | null = null
let lastLandmarkCount = 0

function showStatus(msg: string, tone: 'ok' | 'warn' | 'fail' | '' = ''): void {
  elStatusBanner.textContent = msg
  elStatusBanner.className = `alert-banner${tone ? ' ' + tone : ''}`
}

function hideStatus(): void {
  elStatusBanner.className = 'alert-banner hidden'
  elStatusBanner.textContent = ''
}

function averageVisibility(landmarks: readonly NormalizedLandmark[]): number {
  if (landmarks.length === 0) return 0
  let sum = 0
  for (const p of landmarks) {
    const v = typeof p.visibility === 'number' && Number.isFinite(p.visibility) ? p.visibility : 0
    sum += Math.max(0, Math.min(1, v))
  }
  return sum / landmarks.length
}

function renderSkeletonOverlay(
  landmarks: readonly NormalizedLandmark[],
  frameValid: boolean
): void {
  const viewW = elOverlay.clientWidth || window.innerWidth
  const viewH = elOverlay.clientHeight || window.innerHeight
  if (viewW <= 0 || viewH <= 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const targetW = Math.round(viewW * dpr)
  const targetH = Math.round(viewH * dpr)
  if (elOverlay.width !== targetW || elOverlay.height !== targetH) {
    elOverlay.width = targetW
    elOverlay.height = targetH
  }

  const ctx = elOverlay.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, viewW, viewH)

  if (landmarks.length > 0 && elVideo.videoWidth > 0 && elVideo.videoHeight > 0) {
    const tf = coverTransform(elVideo.videoWidth, elVideo.videoHeight, viewW, viewH)
    const qualityOk = frameValid && averageVisibility(landmarks) >= DEFAULT_FRAMING_RULES.minVisibility
    const color = qualityOk ? '#10b981' : '#f59e0b'
    drawSkeleton(ctx, landmarks, elVideo.videoWidth, elVideo.videoHeight, tf, color)
  }

  ctx.restore()
}

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: readonly NormalizedLandmark[],
  videoW: number,
  videoH: number,
  tf: CoverTransform,
  color: string
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (const [a, b] of SKELETON) {
    const pa = lm[a]
    const pb = lm[b]
    if (!pa || !pb) continue
    if (!Number.isFinite(pa.x) || !Number.isFinite(pa.y) || !Number.isFinite(pb.x) || !Number.isFinite(pb.y)) {
      continue
    }
    ctx.beginPath()
    ctx.moveTo(pa.x * videoW * tf.scale + tf.offsetX, pa.y * videoH * tf.scale + tf.offsetY)
    ctx.lineTo(pb.x * videoW * tf.scale + tf.offsetX, pb.y * videoH * tf.scale + tf.offsetY)
    ctx.stroke()
  }

  ctx.fillStyle = color
  for (const p of lm) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    ctx.beginPath()
    ctx.arc(p.x * videoW * tf.scale + tf.offsetX, p.y * videoH * tf.scale + tf.offsetY, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function getFramingPrompt(
  inFrame: BodyInFrameResult,
  bodyFacing: FacingOrientation,
  landmarkCount: number
): string {
  if (landmarkCount === 0 || inFrame.missing === 'all') {
    return '偵測不到人'
  }
  if (!inFrame.inFrame) {
    if (inFrame.missing === 'lower') {
      return '請讓全身入鏡（後退一點）'
    }
    if (inFrame.missing === 'upper') {
      return '請讓全身入鏡（調整鏡頭高度）'
    }
    return '請讓全身入鏡（後退一點）'
  }
  if (bodyFacing === 'front' || bodyFacing === 'oblique') {
    return '請側面對鏡頭（轉身 90 度）'
  }
  if (bodyFacing === 'unknown') {
    return '偵測不到人'
  }
  return '請側面對鏡頭（轉身 90 度）'
}

function resolveTopBandState(): { readonly tone: 'neutral' | 'red' | 'yellow' | 'green'; readonly text: string } {
  if (interrupted) {
    return { tone: 'red', text: '訓練已中斷（已保存本地紀錄）' }
  }
  if (!cameraInfo || !landmarker) {
    return {
      tone: initFailed ? 'red' : 'neutral',
      text: initFailed ? '相機或模型尚未就緒' : '正在開啟相機與載入模型…'
    }
  }

  if (inSet && engineState) {
    const phase = engineState.fsm.phase
    if (phase === 'NOT_READY') {
      if (!lastInFrame.inFrame || lastFacing !== 'side') {
        return { tone: 'red', text: getFramingPrompt(lastInFrame, lastFacing, lastLandmarkCount) }
      }
      return { tone: 'yellow', text: '校準中：請站直不動' }
    }
    if (!lastFrameValid && lastLandmarkCount === 0) {
      return { tone: 'red', text: '偵測不到人' }
    }
    return { tone: 'green', text: `計數中 · ${ACTIVE_PHASE_LABELS[phase]}` }
  }

  if (!lastInFrame.inFrame || lastFacing !== 'side') {
    return { tone: 'red', text: getFramingPrompt(lastInFrame, lastFacing, lastLandmarkCount) }
  }
  return { tone: 'yellow', text: '入位確認中：請保持側面站穩' }
}

function updateGuideOverlay(): void {
  const showGuide = !inSet && !interrupted
  elGuideOverlay.classList.toggle('is-hidden', !showGuide)

  elChkInFrame.classList.toggle('passed', lastInFrame.inFrame)
  elChkFacingSide.classList.toggle('passed', lastFacing === 'side')
  elChkHoldStable.classList.toggle('passed', positioningState.ready)

  if (positioningState.holdStartMs !== null && !positioningState.ready) {
    elChkHoldLabel.textContent = `保持穩定（${(positioningState.heldMs / 1000).toFixed(1)} / 1.2 秒）`
  } else {
    elChkHoldLabel.textContent = '保持穩定'
  }

  if (!cameraInfo || !landmarker) {
    elGuideHint.textContent = initFailed
      ? '無法開啟相機或載入模型，請確認權限後重試'
      : '正在開啟相機與載入姿態模型…'
  } else if (!lastInFrame.inFrame && lastInFrame.missing === 'lower') {
    elGuideHint.textContent = '請後退，讓腳也入鏡'
  } else if (!lastInFrame.inFrame || lastFacing !== 'side') {
    elGuideHint.textContent = getFramingPrompt(lastInFrame, lastFacing, lastLandmarkCount)
  } else if (!positioningState.ready) {
    elGuideHint.textContent = '請保持全身側面站穩，即將自動開始'
  } else {
    elGuideHint.textContent = '入位完成，開始校準'
  }

  btnInitCam.classList.toggle('hidden', !initFailed || initInFlight)
}

function updateHud(): void {
  const band = resolveTopBandState()
  elTopBand.className = `top-band tone-${band.tone}`
  elTopStatusText.textContent = band.text

  if (!engineState) {
    elRepComplete.textContent = '0'
    elRepUncertain.textContent = '0'
    elSetProgress.textContent = sessionId
      ? `準備下一組 · 已完成 ${completedSets.length} 組`
      : '尚未開始 · 已完成 0 組'
  } else {
    const completeCount = engineState.reps.filter((r) => r.status === 'complete').length
    const uncertainCount = engineState.reps.filter((r) => r.status === 'uncertain').length
    elRepComplete.textContent = String(completeCount)
    elRepUncertain.textContent = String(uncertainCount)
    elSetProgress.textContent = `第 ${completedSets.length + 1} 組 · 已完成 ${completedSets.length} 組`
  }

  elKneeAngleLive.textContent =
    lastKneeAngle !== null ? `膝角 ${Math.round(lastKneeAngle)}°` : '膝角 --'

  updateGuideOverlay()
}

function syncButtons(): void {
  const ready = Boolean(landmarker && cameraInfo && !interrupted)
  btnInitCam.disabled = initInFlight || inSet
  btnSkipGuide.disabled = !ready || inSet || startingSet
  btnSwitchCam.disabled = !cameraInfo || inSet || interrupted || initInFlight
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

function handleGuidanceFrame(
  landmarks: readonly NormalizedLandmark[],
  now: number
): void {
  const preview = extractFeatures(landmarks)
  lastFrameValid = preview.valid
  lastKneeAngle = preview.kneeAngle
  renderSkeletonOverlay(landmarks, preview.valid)

  positioningState = updatePositioning(
    positioningState,
    { inFrame: lastInFrame.inFrame, facing: lastFacing },
    now
  )

  if (lastFacing === 'front') {
    if (frontFacingSinceMs === null) {
      frontFacingSinceMs = now
    } else if (now - frontFacingSinceMs >= FRONT_FACING_WARN_MS) {
      tts.announceCue('facing', '請側面對鏡頭')
    }
  } else {
    frontFacingSinceMs = null
  }

  updateHud()
  if (positioningState.ready && !startingSet) {
    void startSet()
  }
}

function stepFrame(now: number): void {
  if (!landmarker || !cameraInfo || interrupted) return
  if (inferenceInFlight || elVideo.readyState < 2) return
  if (now - lastInferenceAt < TARGET_INTERVAL_MS) return

  inferenceInFlight = true
  lastInferenceAt = now
  try {
    const result = landmarker.detectForVideo(elVideo, now)
    const rawLm = result.landmarks?.[0] ?? []
    const landmarks: NormalizedLandmark[] = rawLm.map((p) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      visibility: p.visibility
    }))

    lastLandmarkCount = landmarks.length
    lastInFrame = checkBodyInFrame(landmarks)
    lastFacing = detectFacing(landmarks)

    if (!inSet || !engineState || !sessionId) {
      handleGuidanceFrame(landmarks, now)
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
    lastFrameValid = res.features.valid
    lastKneeAngle = res.features.kneeAngle

    renderSkeletonOverlay(landmarks, res.features.valid)

    pendingSamples.push({
      t_ms,
      landmarks,
      valid: res.features.valid
    })

    handleEventsForTts(prevState, engineState, res.events, now, res.features.valid)
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
  if (initInFlight) return
  initInFlight = true
  initFailed = false
  hideStatus()
  syncButtons()
  updateHud()
  elCamWrap.classList.toggle('mirrored', facing === 'user')

  try {
    detachTrackListener()
    cameraInfo = await startCamera(elVideo, facing)
    attachTrackListener()
  } catch (err) {
    initFailed = true
    initInFlight = false
    showStatus(`相機開啟失敗：${String(err)}`, 'fail')
    updateHud()
    syncButtons()
    return
  }

  try {
    if (!landmarker) {
      const loaded = await loadPose()
      landmarker = loaded.landmarker
    }
    opfsSupported = await isOpfsAvailable()
    if (!opfsSupported) {
      sessionPoseEvidenceOk = false
      elOpfsBanner.classList.remove('hidden')
    }
    startLoop()
  } catch (err) {
    initFailed = true
    showStatus(`模型載入失敗：${String(err)}`, 'fail')
  } finally {
    initInFlight = false
  }
  updateHud()
  syncButtons()
}

async function switchCamera(): Promise<void> {
  if (inSet || interrupted || initInFlight) return
  facing = facing === 'environment' ? 'user' : 'environment'
  elCamWrap.classList.toggle('mirrored', facing === 'user')
  positioningState = createInitialPositioningState()
  frontFacingSinceMs = null
  try {
    detachTrackListener()
    cameraInfo = await startCamera(elVideo, facing)
    attachTrackListener()
    hideStatus()
  } catch (err) {
    showStatus(`切換鏡頭失敗：${String(err)}`, 'fail')
  }
  updateHud()
  syncButtons()
}

async function startSet(): Promise<void> {
  if (!landmarker || !cameraInfo || inSet || interrupted || startingSet) return
  startingSet = true
  hideStatus()
  syncButtons()

  try {
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
    startLoop()
  } finally {
    startingSet = false
    syncButtons()
  }
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
  positioningState = createInitialPositioningState()
  frontFacingSinceMs = null
  showStatus(`第 ${completedSets.length} 組已結束並保存，回到入位準備。`, 'ok')
  updateHud()
  syncButtons()
}

async function endSession(): Promise<void> {
  if (!sessionId || interrupted) return
  btnEndSession.disabled = true
  btnEndSet.disabled = true
  btnSkipGuide.disabled = true

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

  elInterruptMsg.textContent = `已中斷（${reasonLabel}）：已立即停止取樣並寫入本地儲存。請按「重新開始」重新訓練，或前往回顧頁查看紀錄。`
  elInterruptBanner.classList.remove('hidden')
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
  startingSet = false
  interrupted = false
  sessionPoseEvidenceOk = true
  currentSetOpfsOk = true
  positioningState = createInitialPositioningState()
  frontFacingSinceMs = null
  lastInFrame = { inFrame: false, missing: 'all' }
  lastFacing = 'unknown'
  lastFrameValid = false
  lastKneeAngle = null
  lastLandmarkCount = 0

  elInterruptBanner.classList.add('hidden')
  hideStatus()
  updateHud()
  syncButtons()
  void initCameraAndModel()
}

elTtsToggle.addEventListener('change', () => {
  tts.setEnabled(elTtsToggle.checked)
})
btnInitCam.addEventListener('click', () => { void initCameraAndModel() })
btnSkipGuide.addEventListener('click', () => { void startSet() })
btnSwitchCam.addEventListener('click', () => { void switchCamera() })
btnEndSet.addEventListener('click', () => { void endSet() })
btnEndSession.addEventListener('click', () => { void endSession() })
btnRestart.addEventListener('click', restartTraining)
document.addEventListener('visibilitychange', handleVisibilityChange)

updateHud()
syncButtons()
void initCameraAndModel()
