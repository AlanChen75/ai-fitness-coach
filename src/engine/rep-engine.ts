// R3 串接層：樣本流入 → 品質門 → FSM → Rep 紀錄與 Set 彙總輸出
// 純函式、不可變更新、不自取系統時間（一律使用呼叫端傳入之 t_ms）

import { createInvalidFeatures, extractFeatures } from './features'
import { createInitialFsmState, DEFAULT_SQUAT_RULES, step } from './squat-fsm'
import type { SquatFsmState } from './squat-fsm'
import { SCHEMA_VERSION } from './types'
import type {
  CameraMetadata,
  CoachEvent,
  ConsentMetadata,
  FrameFeatures,
  FsmEvent,
  FsmRepEvent,
  PoseSample,
  Rep,
  Session,
  SetSummary,
  SquatRules,
  WorkoutSet
} from './types'

export interface RepEngineConfig {
  readonly setId: string
  readonly idFactory: () => string
  readonly rules?: SquatRules
  readonly exercise?: 'squat'
  readonly view?: 'side'
}

export interface RepEngineState {
  readonly setId: string
  readonly exercise: 'squat'
  readonly view: 'side'
  readonly rules: SquatRules
  readonly idFactory: () => string
  readonly fsm: SquatFsmState
  readonly reps: readonly Rep[]
  readonly totalSampleCount: number
  readonly validSampleCount: number
}

export interface ProcessSampleResult {
  readonly state: RepEngineState
  readonly features: FrameFeatures
  readonly events: readonly CoachEvent[]
  readonly newReps: readonly Rep[]
}

export interface CreateSessionParams {
  readonly sessionId: string
  readonly deviceProfileId: string
  readonly startedAt: string
  readonly poseModel: string
  readonly rulesVersion: string
  readonly camera: CameraMetadata
  readonly consent: ConsentMetadata
  readonly sets: readonly WorkoutSet[]
}

export function createRepEngineState(config: RepEngineConfig): RepEngineState {
  const rules = config.rules ?? DEFAULT_SQUAT_RULES
  return {
    setId: config.setId,
    exercise: config.exercise ?? 'squat',
    view: config.view ?? 'side',
    rules,
    idFactory: config.idFactory,
    fsm: createInitialFsmState(rules),
    reps: [],
    totalSampleCount: 0,
    validSampleCount: 0
  }
}

function toRepRecord(event: FsmRepEvent, idFactory: () => string): Rep {
  return {
    rep_id: idFactory(),
    start_ms: event.start_ms,
    end_ms: event.end_ms,
    status: event.status,
    metrics: event.metrics,
    quality: event.quality,
    reason: event.reason
  }
}

function mapFsmEvents(
  fsmEvents: readonly FsmEvent[],
  idFactory: () => string
): { readonly events: readonly CoachEvent[]; readonly newReps: readonly Rep[] } {
  const events: CoachEvent[] = []
  const newReps: Rep[] = []

  for (const ev of fsmEvents) {
    if (ev.type === 'state_change') {
      events.push(ev)
      continue
    }
    const rep = toRepRecord(ev, idFactory)
    newReps.push(rep)
    events.push({
      type: ev.type,
      t_ms: ev.t_ms,
      rep,
      quality: rep.quality,
      reason: rep.reason
    })
  }

  return { events, newReps }
}

export function processSample(
  state: RepEngineState,
  sample: PoseSample
): ProcessSampleResult {
  // 品質門：sample.valid 為 false 時不進入特徵角度計算，直接以 invalid 處理
  const features = sample.valid
    ? extractFeatures(sample.landmarks, state.fsm.baselineHipY, state.rules.minVisibility)
    : createInvalidFeatures(0, 'left')

  const fsmResult = step(state.fsm, features, sample.t_ms)
  const { events, newReps } = mapFsmEvents(fsmResult.events, state.idFactory)

  const nextState: RepEngineState = {
    ...state,
    fsm: fsmResult.state,
    reps: newReps.length > 0 ? [...state.reps, ...newReps] : state.reps,
    totalSampleCount: state.totalSampleCount + 1,
    validSampleCount: state.validSampleCount + (features.valid ? 1 : 0)
  }

  return {
    state: nextState,
    features,
    events,
    newReps
  }
}

export function processSampleBatch(
  initialState: RepEngineState,
  samples: readonly PoseSample[]
): { readonly state: RepEngineState; readonly events: readonly CoachEvent[] } {
  let current = initialState
  const allEvents: CoachEvent[] = []
  for (const sample of samples) {
    const res = processSample(current, sample)
    current = res.state
    for (const ev of res.events) {
      allEvents.push(ev)
    }
  }
  return { state: current, events: allEvents }
}

export function getSetSummary(state: RepEngineState): SetSummary {
  const openGapMs =
    state.fsm.invalidStreakStartMs !== null && state.fsm.lastTimestampMs !== null
      ? Math.max(0, state.fsm.lastTimestampMs - state.fsm.invalidStreakStartMs)
      : 0

  return {
    set_id: state.setId,
    exercise: state.exercise,
    view: state.view,
    reps: state.reps,
    total_sample_count: state.totalSampleCount,
    valid_sample_count: state.validSampleCount,
    total_tracking_gap_ms: state.fsm.totalTrackingGapMs + openGapMs,
    rules_version: state.rules.rules_version
  }
}

export function createSession(params: CreateSessionParams): Session {
  return {
    schema_version: SCHEMA_VERSION,
    session_id: params.sessionId,
    device_profile_id: params.deviceProfileId,
    started_at: params.startedAt,
    pose_model: params.poseModel,
    rules_version: params.rulesVersion,
    camera: params.camera,
    consent: params.consent,
    sets: params.sets
  }
}
