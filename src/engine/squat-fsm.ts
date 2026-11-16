// R2 深蹲狀態機（squat-side-v0.1）
// 純函式 step(state, features, timestampMs) -> { state, events }，不可變、無副作用、無 Date.now

import type {
  FrameFeatures,
  FsmEvent,
  FsmRepEvent,
  SquatPhase,
  SquatRules,
  StateChangeEvent
} from './types'
import { DEFAULT_MIN_VISIBILITY } from './features'

export const DEFAULT_SQUAT_RULES: SquatRules = {
  rules_version: 'squat-side-v0.1',
  minVisibility: DEFAULT_MIN_VISIBILITY,
  calibrationDurationMs: 1000,
  standUpAngle: 160,
  descendEnter: 130,
  bottomEnter: 100,
  bottomExit: 110,
  minRepDurationMs: 600,
  minBottomSamples: 3,
  maxTrackingGapMs: 300,
  maxInvalidStreakMs: 1000
}

export interface FsmRepDraft {
  readonly startMs: number
  readonly minKneeAngle: number
  readonly bottomSampleCount: number
  readonly validSampleCount: number
  readonly trackingGapMs: number
  readonly maxGapMs: number
}

export interface SquatFsmState {
  readonly phase: SquatPhase
  readonly rules: SquatRules
  readonly calibrationStartMs: number | null
  readonly calibrationHipYSum: number
  readonly calibrationSampleCount: number
  readonly baselineHipY: number | null
  readonly invalidStreakStartMs: number | null
  readonly totalTrackingGapMs: number
  readonly activeRep: FsmRepDraft | null
  readonly lastTimestampMs: number | null
}

export interface FsmStepResult {
  readonly state: SquatFsmState
  readonly events: readonly FsmEvent[]
}

export function createInitialFsmState(
  rules: SquatRules = DEFAULT_SQUAT_RULES
): SquatFsmState {
  return {
    phase: 'NOT_READY',
    rules,
    calibrationStartMs: null,
    calibrationHipYSum: 0,
    calibrationSampleCount: 0,
    baselineHipY: null,
    invalidStreakStartMs: null,
    totalTrackingGapMs: 0,
    activeRep: null,
    lastTimestampMs: null
  }
}

function makeStateChange(
  t_ms: number,
  from: SquatPhase,
  to: SquatPhase,
  reason: string
): StateChangeEvent {
  return { type: 'state_change', t_ms, from, to, reason }
}

function makeRepEvent(
  type: 'rep_complete' | 'rep_uncertain',
  t_ms: number,
  draft: FsmRepDraft,
  tempoMs: number,
  reason: string,
  extraGapMs = 0
): FsmRepEvent {
  return {
    type,
    t_ms,
    start_ms: draft.startMs,
    end_ms: t_ms,
    status: type === 'rep_complete' ? 'complete' : 'uncertain',
    metrics: {
      tempo_ms: tempoMs,
      min_knee_angle: draft.minKneeAngle
    },
    quality: {
      valid_sample_count: draft.validSampleCount,
      tracking_gap_ms: draft.trackingGapMs + extraGapMs
    },
    reason
  }
}

function handleInvalidFrame(state: SquatFsmState, t: number): FsmStepResult {
  if (state.phase === 'NOT_READY') {
    return {
      state: {
        ...state,
        calibrationStartMs: null,
        calibrationHipYSum: 0,
        calibrationSampleCount: 0,
        lastTimestampMs: t
      },
      events: []
    }
  }

  const streakStart = state.invalidStreakStartMs ?? t
  const streakMs = t - streakStart
  if (streakMs <= state.rules.maxInvalidStreakMs) {
    return {
      state: { ...state, invalidStreakStartMs: streakStart, lastTimestampMs: t },
      events: []
    }
  }

  const events: FsmEvent[] = [
    makeStateChange(t, state.phase, 'NOT_READY', 'invalid_streak_exceeded')
  ]
  if (state.activeRep !== null) {
    const tempoMs = t - state.activeRep.startMs
    events.push(
      makeRepEvent('rep_uncertain', t, state.activeRep, tempoMs, 'invalid_streak_exceeded', streakMs)
    )
  }

  return {
    state: {
      ...state,
      phase: 'NOT_READY',
      calibrationStartMs: null,
      calibrationHipYSum: 0,
      calibrationSampleCount: 0,
      baselineHipY: null,
      invalidStreakStartMs: null,
      totalTrackingGapMs: state.totalTrackingGapMs + streakMs,
      activeRep: null,
      lastTimestampMs: t
    },
    events
  }
}

function handleCalibration(
  state: SquatFsmState,
  features: FrameFeatures,
  t: number
): FsmStepResult {
  const kneeAngle = features.kneeAngle
  if (kneeAngle === null || kneeAngle <= state.rules.standUpAngle) {
    return {
      state: {
        ...state,
        calibrationStartMs: null,
        calibrationHipYSum: 0,
        calibrationSampleCount: 0,
        lastTimestampMs: t
      },
      events: []
    }
  }

  const startMs = state.calibrationStartMs ?? t
  const hipYSum = state.calibrationHipYSum + (features.hipY ?? 0)
  const sampleCount = state.calibrationSampleCount + (features.hipY !== null ? 1 : 0)

  if (t - startMs >= state.rules.calibrationDurationMs) {
    const baselineHipY = sampleCount > 0 ? hipYSum / sampleCount : null
    return {
      state: {
        ...state,
        phase: 'STANDING',
        calibrationStartMs: null,
        calibrationHipYSum: 0,
        calibrationSampleCount: 0,
        baselineHipY,
        invalidStreakStartMs: null,
        lastTimestampMs: t
      },
      events: [makeStateChange(t, 'NOT_READY', 'STANDING', 'calibration_complete')]
    }
  }

  return {
    state: {
      ...state,
      calibrationStartMs: startMs,
      calibrationHipYSum: hipYSum,
      calibrationSampleCount: sampleCount,
      lastTimestampMs: t
    },
    events: []
  }
}

function closeInvalidGapIfNeeded(state: SquatFsmState, t: number): SquatFsmState {
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
  draft: FsmRepDraft,
  kneeAngle: number,
  isBottomAngle: boolean
): FsmRepDraft {
  return {
    ...draft,
    minKneeAngle: Math.min(draft.minKneeAngle, kneeAngle),
    bottomSampleCount: draft.bottomSampleCount + (isBottomAngle ? 1 : 0),
    validSampleCount: draft.validSampleCount + 1
  }
}

function finalizeStandingRep(
  state: SquatFsmState,
  draft: FsmRepDraft,
  t: number
): FsmStepResult {
  const tempoMs = t - draft.startMs
  const events: FsmEvent[] = [
    makeStateChange(t, state.phase, 'STANDING', 'knee_above_stand_up')
  ]
  if (tempoMs >= state.rules.minRepDurationMs) {
    if (draft.maxGapMs > state.rules.maxTrackingGapMs) {
      events.push(makeRepEvent('rep_uncertain', t, draft, tempoMs, 'tracking_gap_exceeded'))
    } else if (draft.bottomSampleCount >= state.rules.minBottomSamples) {
      events.push(makeRepEvent('rep_complete', t, draft, tempoMs, 'valid_squat_cycle'))
    }
  }
  return {
    state: { ...state, phase: 'STANDING', activeRep: null, lastTimestampMs: t },
    events
  }
}

function handleStanding(
  state: SquatFsmState,
  kneeAngle: number,
  t: number
): FsmStepResult {
  if (kneeAngle < state.rules.descendEnter) {
    const activeRep: FsmRepDraft = {
      startMs: t,
      minKneeAngle: kneeAngle,
      bottomSampleCount: 0,
      validSampleCount: 1,
      trackingGapMs: 0,
      maxGapMs: 0
    }
    return {
      state: { ...state, phase: 'DESCENDING', activeRep, lastTimestampMs: t },
      events: [makeStateChange(t, 'STANDING', 'DESCENDING', 'knee_below_descend_enter')]
    }
  }
  return { state: { ...state, lastTimestampMs: t }, events: [] }
}

function handleDescending(
  state: SquatFsmState,
  kneeAngle: number,
  t: number
): FsmStepResult {
  const baseDraft = state.activeRep
  if (baseDraft === null) {
    return { state: { ...state, phase: 'STANDING', lastTimestampMs: t }, events: [] }
  }
  const enteredBottom = kneeAngle < state.rules.bottomEnter
  const draft = updateDraftSample(baseDraft, kneeAngle, enteredBottom)

  if (enteredBottom) {
    return {
      state: { ...state, phase: 'BOTTOM', activeRep: draft, lastTimestampMs: t },
      events: [makeStateChange(t, 'DESCENDING', 'BOTTOM', 'knee_below_bottom_enter')]
    }
  }
  if (kneeAngle > state.rules.standUpAngle) {
    return {
      state: { ...state, phase: 'STANDING', activeRep: null, lastTimestampMs: t },
      events: [makeStateChange(t, 'DESCENDING', 'STANDING', 'aborted_before_bottom')]
    }
  }
  return { state: { ...state, activeRep: draft, lastTimestampMs: t }, events: [] }
}

function handleBottom(
  state: SquatFsmState,
  kneeAngle: number,
  t: number
): FsmStepResult {
  const baseDraft = state.activeRep
  if (baseDraft === null) {
    return { state: { ...state, phase: 'STANDING', lastTimestampMs: t }, events: [] }
  }
  const draft = updateDraftSample(baseDraft, kneeAngle, kneeAngle < state.rules.bottomEnter)

  if (kneeAngle > state.rules.standUpAngle) {
    return finalizeStandingRep(state, draft, t)
  }
  if (kneeAngle > state.rules.bottomExit) {
    return {
      state: { ...state, phase: 'ASCENDING', activeRep: draft, lastTimestampMs: t },
      events: [makeStateChange(t, 'BOTTOM', 'ASCENDING', 'knee_above_bottom_exit')]
    }
  }
  return { state: { ...state, activeRep: draft, lastTimestampMs: t }, events: [] }
}

function handleAscending(
  state: SquatFsmState,
  kneeAngle: number,
  t: number
): FsmStepResult {
  const baseDraft = state.activeRep
  if (baseDraft === null) {
    return { state: { ...state, phase: 'STANDING', lastTimestampMs: t }, events: [] }
  }
  const isBottom = kneeAngle < state.rules.bottomEnter
  const draft = updateDraftSample(baseDraft, kneeAngle, isBottom)

  if (kneeAngle > state.rules.standUpAngle) {
    return finalizeStandingRep(state, draft, t)
  }
  if (isBottom) {
    return {
      state: { ...state, phase: 'BOTTOM', activeRep: draft, lastTimestampMs: t },
      events: [makeStateChange(t, 'ASCENDING', 'BOTTOM', 'reentered_bottom')]
    }
  }
  return { state: { ...state, activeRep: draft, lastTimestampMs: t }, events: [] }
}

export function step(
  state: SquatFsmState,
  features: FrameFeatures,
  timestampMs: number
): FsmStepResult {
  const t =
    state.lastTimestampMs !== null
      ? Math.max(state.lastTimestampMs, timestampMs)
      : timestampMs

  if (!features.valid || features.kneeAngle === null) {
    return handleInvalidFrame(state, t)
  }
  if (state.phase === 'NOT_READY') {
    return handleCalibration(state, features, t)
  }

  const synced = closeInvalidGapIfNeeded(state, t)
  const angle = features.kneeAngle

  switch (synced.phase) {
    case 'STANDING':
      return handleStanding(synced, angle, t)
    case 'DESCENDING':
      return handleDescending(synced, angle, t)
    case 'BOTTOM':
      return handleBottom(synced, angle, t)
    case 'ASCENDING':
      return handleAscending(synced, angle, t)
    default:
      return { state: { ...synced, lastTimestampMs: t }, events: [] }
  }
}
