// R11 通用動作循環狀態機（純函式、不可變、無 Date.now）
// 鏡射 squat-fsm.ts 的事件形狀與保守計數語意（寧漏不錯）

export type CycleDirection = 'down' | 'up'
export type CycleThresholdMode = 'absolute' | 'baseline-delta'

export interface CycleRules {
  readonly rules_version: string
  readonly direction: CycleDirection
  readonly thresholdMode: CycleThresholdMode
  readonly enterThreshold: number
  readonly bottomThreshold: number
  readonly exitThreshold: number
  readonly calibrationMs: number
  readonly minRepMs: number
  readonly minBottomSamples: number
  readonly maxGapMs: number
  readonly invalidResetMs: number
}

export type CyclePhase =
  | 'NOT_READY'
  | 'READY'
  | 'ENTERING'
  | 'BOTTOM'
  | 'RETURNING'

export type CycleUiStatus = 'calibrating' | 'ready' | 'active'

export interface CycleSample {
  readonly t_ms: number
  readonly value: number | null
  readonly valid: boolean
}

export interface CycleRepDraft {
  readonly startMs: number
  readonly peakValue: number
  readonly bottomSampleCount: number
  readonly validSampleCount: number
  readonly trackingGapMs: number
  readonly maxGapMs: number
}

export interface CycleRepRecord {
  readonly start_ms: number
  readonly end_ms: number
  readonly status: 'complete' | 'uncertain'
  readonly tempo_ms: number
  /** 本 rep 指標最深值（baseline-delta 模式為相對基線之位移量） */
  readonly peak_value: number
  readonly tracking_gap_ms: number
  readonly reason: string
}

export interface CycleStateChangeEvent {
  readonly type: 'state_change'
  readonly t_ms: number
  readonly from: CyclePhase
  readonly to: CyclePhase
  readonly reason: string
}

export interface CycleRepEvent {
  readonly type: 'rep_complete' | 'rep_uncertain'
  readonly t_ms: number
  readonly start_ms: number
  readonly end_ms: number
  readonly status: 'complete' | 'uncertain'
  readonly tempo_ms: number
  readonly peak_value: number
  readonly tracking_gap_ms: number
  readonly valid_sample_count: number
  readonly rep: CycleRepRecord
  readonly reason: string
}

export type CycleEvent = CycleStateChangeEvent | CycleRepEvent

export interface CycleFsmState {
  readonly phase: CyclePhase
  readonly rules: CycleRules
  readonly calibrationStartMs: number | null
  readonly calibrationValues: readonly number[]
  readonly baseline: number | null
  readonly invalidStreakStartMs: number | null
  readonly totalTrackingGapMs: number
  readonly totalSampleCount: number
  readonly validSampleCount: number
  readonly activeRep: CycleRepDraft | null
  readonly reps: readonly CycleRepRecord[]
  readonly lastTimestampMs: number | null
}

export interface CycleStepResult {
  readonly state: CycleFsmState
  readonly events: readonly CycleEvent[]
}

export interface CycleSetStats {
  readonly total_sample_count: number
  readonly valid_sample_count: number
  readonly total_tracking_gap_ms: number
}

interface NormalizedThresholds {
  readonly exitDepth: number
  readonly enterDepth: number
  readonly bottomDepth: number
}

export function createCycleState(rules: CycleRules): CycleFsmState {
  return {
    phase: 'NOT_READY',
    rules,
    calibrationStartMs: null,
    calibrationValues: [],
    baseline: null,
    invalidStreakStartMs: null,
    totalTrackingGapMs: 0,
    totalSampleCount: 0,
    validSampleCount: 0,
    activeRep: null,
    reps: [],
    lastTimestampMs: null
  }
}

export function toCycleUiStatus(phase: CyclePhase): CycleUiStatus {
  if (phase === 'NOT_READY') return 'calibrating'
  if (phase === 'READY') return 'ready'
  return 'active'
}

export function getCycleSetStats(state: CycleFsmState): CycleSetStats {
  const openGapMs =
    state.invalidStreakStartMs !== null && state.lastTimestampMs !== null
      ? Math.max(0, state.lastTimestampMs - state.invalidStreakStartMs)
      : 0

  return {
    total_sample_count: state.totalSampleCount,
    valid_sample_count: state.validSampleCount,
    total_tracking_gap_ms: state.totalTrackingGapMs + openGapMs
  }
}

function toDepth(value: number, direction: CycleDirection): number {
  return direction === 'up' ? value : -value
}

function normalizeThresholds(rules: CycleRules): NormalizedThresholds {
  return {
    exitDepth: toDepth(rules.exitThreshold, rules.direction),
    enterDepth: toDepth(rules.enterThreshold, rules.direction),
    bottomDepth: toDepth(rules.bottomThreshold, rules.direction)
  }
}

function computeMedian(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[mid]
  }
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function updatePeak(
  currentPeak: number,
  effectiveValue: number,
  direction: CycleDirection
): number {
  return direction === 'up'
    ? Math.max(currentPeak, effectiveValue)
    : Math.min(currentPeak, effectiveValue)
}

function makeStateChange(
  t_ms: number,
  from: CyclePhase,
  to: CyclePhase,
  reason: string
): CycleStateChangeEvent {
  return { type: 'state_change', t_ms, from, to, reason }
}

function makeRepEvent(
  type: 'rep_complete' | 'rep_uncertain',
  t_ms: number,
  draft: CycleRepDraft,
  tempoMs: number,
  reason: string,
  extraGapMs = 0
): CycleRepEvent {
  const trackingGapMs = draft.trackingGapMs + extraGapMs
  const status = type === 'rep_complete' ? 'complete' : 'uncertain'
  const rep: CycleRepRecord = {
    start_ms: draft.startMs,
    end_ms: t_ms,
    status,
    tempo_ms: tempoMs,
    peak_value: draft.peakValue,
    tracking_gap_ms: trackingGapMs,
    reason
  }
  return {
    type,
    t_ms,
    start_ms: rep.start_ms,
    end_ms: rep.end_ms,
    status,
    tempo_ms: tempoMs,
    peak_value: draft.peakValue,
    tracking_gap_ms: trackingGapMs,
    valid_sample_count: draft.validSampleCount,
    rep,
    reason
  }
}

function handleInvalidFrame(
  state: CycleFsmState,
  t: number,
  rules: CycleRules
): CycleStepResult {
  const totalSampleCount = state.totalSampleCount + 1

  if (state.phase === 'NOT_READY') {
    return {
      state: {
        ...state,
        calibrationStartMs: null,
        calibrationValues: [],
        totalSampleCount,
        lastTimestampMs: t
      },
      events: []
    }
  }

  const streakStart = state.invalidStreakStartMs ?? t
  const streakMs = t - streakStart
  if (streakMs <= rules.invalidResetMs) {
    return {
      state: {
        ...state,
        invalidStreakStartMs: streakStart,
        totalSampleCount,
        lastTimestampMs: t
      },
      events: []
    }
  }

  const events: CycleEvent[] = [
    makeStateChange(t, state.phase, 'NOT_READY', 'invalid_streak_exceeded')
  ]
  let reps = state.reps
  if (state.activeRep !== null) {
    const tempoMs = t - state.activeRep.startMs
    const repEv = makeRepEvent(
      'rep_uncertain',
      t,
      state.activeRep,
      tempoMs,
      'invalid_streak_exceeded',
      streakMs
    )
    events.push(repEv)
    reps = [...reps, repEv.rep]
  }

  return {
    state: {
      ...state,
      phase: 'NOT_READY',
      calibrationStartMs: null,
      calibrationValues: [],
      baseline: null,
      invalidStreakStartMs: null,
      totalTrackingGapMs: state.totalTrackingGapMs + streakMs,
      totalSampleCount,
      activeRep: null,
      reps,
      lastTimestampMs: t
    },
    events
  }
}

function handleCalibration(
  state: CycleFsmState,
  rawValue: number,
  t: number,
  rules: CycleRules,
  thresholds: NormalizedThresholds
): CycleStepResult {
  const baseCount = {
    totalSampleCount: state.totalSampleCount + 1,
    validSampleCount: state.validSampleCount + 1
  }

  if (rules.thresholdMode === 'absolute') {
    const depth = toDepth(rawValue, rules.direction)
    if (depth >= thresholds.exitDepth) {
      return {
        state: {
          ...state,
          ...baseCount,
          calibrationStartMs: null,
          calibrationValues: [],
          lastTimestampMs: t
        },
        events: []
      }
    }
  }

  const startMs = state.calibrationStartMs ?? t
  const calibrationValues = [...state.calibrationValues, rawValue]

  if (t - startMs >= rules.calibrationMs) {
    const baseline =
      rules.thresholdMode === 'baseline-delta' ? computeMedian(calibrationValues) : null
    return {
      state: {
        ...state,
        ...baseCount,
        phase: 'READY',
        calibrationStartMs: null,
        calibrationValues: [],
        baseline,
        invalidStreakStartMs: null,
        lastTimestampMs: t
      },
      events: [makeStateChange(t, 'NOT_READY', 'READY', 'calibration_complete')]
    }
  }

  return {
    state: {
      ...state,
      ...baseCount,
      calibrationStartMs: startMs,
      calibrationValues,
      lastTimestampMs: t
    },
    events: []
  }
}

function closeInvalidGapIfNeeded(state: CycleFsmState, t: number): CycleFsmState {
  if (state.invalidStreakStartMs === null) return state
  const gapMs = Math.max(0, t - state.invalidStreakStartMs)
  const activeRep =
    state.activeRep === null
      ? null
      : {
          ...state.activeRep,
          trackingGapMs: state.activeRep.trackingGapMs + gapMs,
          maxGapMs: Math.max(state.activeRep.maxGapMs, gapMs)
        }
  return {
    ...state,
    invalidStreakStartMs: null,
    totalTrackingGapMs: state.totalTrackingGapMs + gapMs,
    activeRep
  }
}

function updateDraftSample(
  draft: CycleRepDraft,
  effectiveValue: number,
  isBottom: boolean,
  direction: CycleDirection
): CycleRepDraft {
  return {
    ...draft,
    peakValue: updatePeak(draft.peakValue, effectiveValue, direction),
    bottomSampleCount: draft.bottomSampleCount + (isBottom ? 1 : 0),
    validSampleCount: draft.validSampleCount + 1
  }
}

function finalizeRep(
  state: CycleFsmState,
  draft: CycleRepDraft,
  t: number,
  rules: CycleRules
): CycleStepResult {
  const tempoMs = t - draft.startMs
  const events: CycleEvent[] = [
    makeStateChange(t, state.phase, 'READY', 'returned_to_ready')
  ]
  let reps = state.reps

  if (tempoMs >= rules.minRepMs) {
    if (draft.maxGapMs > rules.maxGapMs) {
      const repEv = makeRepEvent('rep_uncertain', t, draft, tempoMs, 'tracking_gap_exceeded')
      events.push(repEv)
      reps = [...reps, repEv.rep]
    } else if (draft.bottomSampleCount >= rules.minBottomSamples) {
      const repEv = makeRepEvent('rep_complete', t, draft, tempoMs, 'valid_cycle')
      events.push(repEv)
      reps = [...reps, repEv.rep]
    }
  }

  return {
    state: {
      ...state,
      phase: 'READY',
      activeRep: null,
      reps,
      lastTimestampMs: t
    },
    events
  }
}

function handleReady(
  state: CycleFsmState,
  effectiveValue: number,
  depth: number,
  t: number,
  thresholds: NormalizedThresholds
): CycleStepResult {
  if (depth > thresholds.enterDepth) {
    const activeRep: CycleRepDraft = {
      startMs: t,
      peakValue: effectiveValue,
      bottomSampleCount: 0,
      validSampleCount: 1,
      trackingGapMs: 0,
      maxGapMs: 0
    }
    return {
      state: {
        ...state,
        phase: 'ENTERING',
        activeRep,
        lastTimestampMs: t
      },
      events: [makeStateChange(t, 'READY', 'ENTERING', 'crossed_enter_threshold')]
    }
  }
  return { state: { ...state, lastTimestampMs: t }, events: [] }
}

function handleEntering(
  state: CycleFsmState,
  effectiveValue: number,
  depth: number,
  t: number,
  rules: CycleRules,
  thresholds: NormalizedThresholds
): CycleStepResult {
  const baseDraft = state.activeRep
  if (baseDraft === null) {
    return { state: { ...state, phase: 'READY', lastTimestampMs: t }, events: [] }
  }
  const enteredBottom = depth > thresholds.bottomDepth
  const draft = updateDraftSample(baseDraft, effectiveValue, enteredBottom, rules.direction)

  if (enteredBottom) {
    return {
      state: { ...state, phase: 'BOTTOM', activeRep: draft, lastTimestampMs: t },
      events: [makeStateChange(t, 'ENTERING', 'BOTTOM', 'reached_bottom_threshold')]
    }
  }
  if (depth < thresholds.exitDepth) {
    return {
      state: { ...state, phase: 'READY', activeRep: null, lastTimestampMs: t },
      events: [makeStateChange(t, 'ENTERING', 'READY', 'aborted_before_bottom')]
    }
  }
  return { state: { ...state, activeRep: draft, lastTimestampMs: t }, events: [] }
}

function handleBottom(
  state: CycleFsmState,
  effectiveValue: number,
  depth: number,
  t: number,
  rules: CycleRules,
  thresholds: NormalizedThresholds
): CycleStepResult {
  const baseDraft = state.activeRep
  if (baseDraft === null) {
    return { state: { ...state, phase: 'READY', lastTimestampMs: t }, events: [] }
  }
  const isBottom = depth > thresholds.bottomDepth
  const draft = updateDraftSample(baseDraft, effectiveValue, isBottom, rules.direction)

  if (depth < thresholds.exitDepth) {
    return finalizeRep(state, draft, t, rules)
  }
  if (!isBottom) {
    return {
      state: { ...state, phase: 'RETURNING', activeRep: draft, lastTimestampMs: t },
      events: [makeStateChange(t, 'BOTTOM', 'RETURNING', 'exited_bottom')]
    }
  }
  return { state: { ...state, activeRep: draft, lastTimestampMs: t }, events: [] }
}

function handleReturning(
  state: CycleFsmState,
  effectiveValue: number,
  depth: number,
  t: number,
  rules: CycleRules,
  thresholds: NormalizedThresholds
): CycleStepResult {
  const baseDraft = state.activeRep
  if (baseDraft === null) {
    return { state: { ...state, phase: 'READY', lastTimestampMs: t }, events: [] }
  }
  const isBottom = depth > thresholds.bottomDepth
  const draft = updateDraftSample(baseDraft, effectiveValue, isBottom, rules.direction)

  if (depth < thresholds.exitDepth) {
    return finalizeRep(state, draft, t, rules)
  }
  if (isBottom) {
    return {
      state: { ...state, phase: 'BOTTOM', activeRep: draft, lastTimestampMs: t },
      events: [makeStateChange(t, 'RETURNING', 'BOTTOM', 'reentered_bottom')]
    }
  }
  return { state: { ...state, activeRep: draft, lastTimestampMs: t }, events: [] }
}

export function stepCycle(
  state: CycleFsmState,
  sample: CycleSample,
  rules: CycleRules = state.rules
): CycleStepResult {
  const rawT = Number.isFinite(sample.t_ms)
    ? sample.t_ms
    : (state.lastTimestampMs ?? 0)
  const t =
    state.lastTimestampMs !== null ? Math.max(state.lastTimestampMs, rawT) : rawT

  if (!sample.valid || sample.value === null || !Number.isFinite(sample.value)) {
    return handleInvalidFrame(state, t, rules)
  }

  const thresholds = normalizeThresholds(rules)

  if (state.phase === 'NOT_READY') {
    return handleCalibration(state, sample.value, t, rules, thresholds)
  }

  const syncedBase = closeInvalidGapIfNeeded(state, t)
  const synced: CycleFsmState = {
    ...syncedBase,
    totalSampleCount: syncedBase.totalSampleCount + 1,
    validSampleCount: syncedBase.validSampleCount + 1
  }

  const effectiveValue =
    rules.thresholdMode === 'baseline-delta'
      ? sample.value - (synced.baseline ?? 0)
      : sample.value
  const depth = toDepth(effectiveValue, rules.direction)

  switch (synced.phase) {
    case 'READY':
      return handleReady(synced, effectiveValue, depth, t, thresholds)
    case 'ENTERING':
      return handleEntering(synced, effectiveValue, depth, t, rules, thresholds)
    case 'BOTTOM':
      return handleBottom(synced, effectiveValue, depth, t, rules, thresholds)
    case 'RETURNING':
      return handleReturning(synced, effectiveValue, depth, t, rules, thresholds)
    default:
      return { state: { ...synced, lastTimestampMs: t }, events: [] }
  }
}
