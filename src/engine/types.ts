// 規格 v0.1（schema_version 0.1.0）純邏輯資料型別定義
// 零 DOM、零瀏覽器 API，所有欄位皆為唯讀以維持不可變性

export const SCHEMA_VERSION = '0.1.0' as const

export interface NormalizedLandmark {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly visibility?: number
}

export interface PoseSample {
  readonly t_ms: number
  readonly landmarks: readonly NormalizedLandmark[]
  readonly valid: boolean
}

export type Side = 'left' | 'right'

export interface FrameFeatures {
  readonly valid: boolean
  readonly side: Side
  readonly kneeAngle: number | null
  readonly hipAngle: number | null
  readonly leftKneeAngle: number | null
  readonly rightKneeAngle: number | null
  readonly leftHipAngle: number | null
  readonly rightHipAngle: number | null
  readonly hipY: number | null
  readonly hipDisplacementRatio: number | null
  readonly minVisibility: number
}

export type SquatPhase =
  | 'NOT_READY'
  | 'STANDING'
  | 'DESCENDING'
  | 'BOTTOM'
  | 'ASCENDING'

export interface SquatRules {
  readonly rules_version: string
  readonly minVisibility: number
  readonly calibrationDurationMs: number
  readonly standUpAngle: number
  readonly descendEnter: number
  readonly bottomEnter: number
  readonly bottomExit: number
  readonly minRepDurationMs: number
  readonly minBottomSamples: number
  readonly maxTrackingGapMs: number
  readonly maxInvalidStreakMs: number
}

export type RepStatus = 'complete' | 'uncertain'

export interface RepMetrics {
  readonly tempo_ms: number
  readonly min_knee_angle: number | null
}

export interface RepQuality {
  readonly valid_sample_count: number
  readonly tracking_gap_ms: number
}

export interface Rep {
  readonly rep_id: string
  readonly start_ms: number
  readonly end_ms: number
  readonly status: RepStatus
  readonly metrics: RepMetrics
  readonly quality: RepQuality
  readonly reason: string
}

export interface WorkoutSet {
  readonly set_id: string
  readonly exercise: 'squat'
  readonly view: 'side'
  readonly reps: readonly Rep[]
}

export interface SetSummary extends WorkoutSet {
  readonly total_sample_count: number
  readonly valid_sample_count: number
  readonly total_tracking_gap_ms: number
  readonly rules_version: string
}

export interface CameraMetadata {
  readonly facing: string
  readonly width: number
  readonly height: number
  readonly frameRate?: number
  readonly label?: string
}

export interface ConsentMetadata {
  readonly accepted: boolean
  readonly version: string
  readonly timestamp: string
}

export interface Session {
  readonly schema_version: typeof SCHEMA_VERSION
  readonly session_id: string
  readonly device_profile_id: string
  readonly started_at: string
  readonly pose_model: string
  readonly rules_version: string
  readonly camera: CameraMetadata
  readonly consent: ConsentMetadata
  readonly sets: readonly WorkoutSet[]
}

export interface StateChangeEvent {
  readonly type: 'state_change'
  readonly t_ms: number
  readonly from: SquatPhase
  readonly to: SquatPhase
  readonly reason: string
}

export interface FsmRepEvent {
  readonly type: 'rep_complete' | 'rep_uncertain'
  readonly t_ms: number
  readonly start_ms: number
  readonly end_ms: number
  readonly status: RepStatus
  readonly metrics: RepMetrics
  readonly quality: RepQuality
  readonly reason: string
}

export type FsmEvent = StateChangeEvent | FsmRepEvent

export interface CoachRepEvent {
  readonly type: 'rep_complete' | 'rep_uncertain'
  readonly t_ms: number
  readonly rep: Rep
  readonly quality: RepQuality
  readonly reason: string
}

export type CoachEvent = StateChangeEvent | CoachRepEvent
