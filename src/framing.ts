// R8 入位檢查、側面偵測、入位狀態機與 cover 座標映射（純函式、不可變、零 DOM）

import type { NormalizedLandmark } from './engine/types'

export interface FramingRules {
  readonly rules_version: string
  readonly minVisibility: number
  readonly marginMin: number
  readonly marginMax: number
  readonly frontRatioMin: number
  readonly sideRatioMax: number
  readonly holdDurationMs: number
}

export const DEFAULT_FRAMING_RULES: FramingRules = {
  rules_version: 'framing-v0.1',
  minVisibility: 0.5,
  marginMin: 0.03,
  marginMax: 0.97,
  frontRatioMin: 0.55,
  sideRatioMax: 0.35,
  holdDurationMs: 1200
}

export type BodyMissingRegion = 'upper' | 'lower' | 'all' | null

export interface BodyInFrameResult {
  readonly inFrame: boolean
  readonly missing: BodyMissingRegion
}

export type FacingOrientation = 'front' | 'side' | 'oblique' | 'unknown'

export interface PositioningState {
  readonly holdStartMs: number | null
  readonly heldMs: number
  readonly ready: boolean
}

export interface PositioningInput {
  readonly inFrame: boolean
  readonly facing: FacingOrientation
}

export interface CoverTransform {
  readonly scale: number
  readonly offsetX: number
  readonly offsetY: number
}

/** 入鏡檢查的身體區段。各動作只要求計數指標真正用到的區段（室內距離不足時不過度擋人） */
export type FramingRegion = 'upper' | 'hips' | 'knees' | 'ankles'

export const ALL_FRAMING_REGIONS: readonly FramingRegion[] = ['upper', 'hips', 'knees', 'ankles']

const REGION_INDICES: Record<FramingRegion, readonly number[]> = {
  upper: [11, 12],
  hips: [23, 24],
  knees: [25, 26],
  ankles: [27, 28]
}

const FACING_INDICES = [11, 12, 23, 24] as const
const MIN_LANDMARK_COUNT = 29
const EPSILON = 1e-6

function safeVisibility(lm: NormalizedLandmark | undefined): number {
  if (!lm || typeof lm.visibility !== 'number' || !Number.isFinite(lm.visibility)) {
    return 0
  }
  return Math.max(0, Math.min(1, lm.visibility))
}

function isLandmarkVisible(lm: NormalizedLandmark | undefined, minVisibility: number): lm is NormalizedLandmark {
  if (!lm) return false
  if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return false
  return safeVisibility(lm) >= minVisibility
}

function isLandmarkInFrame(lm: NormalizedLandmark | undefined, rules: FramingRules): boolean {
  if (!isLandmarkVisible(lm, rules.minVisibility)) return false
  return (
    lm.x >= rules.marginMin &&
    lm.x <= rules.marginMax &&
    lm.y >= rules.marginMin &&
    lm.y <= rules.marginMax
  )
}

/** 檢查指定區段（預設全身：肩、髖、膝、踝）是否全部在有效視域與可見度門檻內 */
export function checkBodyInFrame(
  landmarks: readonly NormalizedLandmark[],
  rules: FramingRules = DEFAULT_FRAMING_RULES,
  regions: readonly FramingRegion[] = ALL_FRAMING_REGIONS
): BodyInFrameResult {
  if (landmarks.length < MIN_LANDMARK_COUNT) {
    return { inFrame: false, missing: 'all' }
  }

  const requiredRegions = regions.length > 0 ? regions : ALL_FRAMING_REGIONS
  const requiredIndices = requiredRegions.flatMap((region) => REGION_INDICES[region])

  const anyPresent = requiredIndices.some((idx) => isLandmarkInFrame(landmarks[idx], rules))
  if (!anyPresent) {
    return { inFrame: false, missing: 'all' }
  }

  const regionMissing = (region: FramingRegion): boolean =>
    requiredRegions.includes(region) &&
    REGION_INDICES[region].some((idx) => !isLandmarkInFrame(landmarks[idx], rules))

  const upperMissing = regionMissing('upper')
  const lowerMissing = regionMissing('knees') || regionMissing('ankles')
  const hipMissing = regionMissing('hips')

  if (!upperMissing && !lowerMissing && !hipMissing) {
    return { inFrame: true, missing: null }
  }
  if (upperMissing && lowerMissing) {
    return { inFrame: false, missing: 'all' }
  }
  if (lowerMissing) {
    return { inFrame: false, missing: 'lower' }
  }
  if (upperMissing) {
    return { inFrame: false, missing: 'upper' }
  }
  return { inFrame: false, missing: 'all' }
}

/** 依兩肩水平跨距與軀幹長度比值判斷身體朝向 */
export function detectFacing(
  landmarks: readonly NormalizedLandmark[],
  rules: FramingRules = DEFAULT_FRAMING_RULES
): FacingOrientation {
  if (landmarks.length < MIN_LANDMARK_COUNT) {
    return 'unknown'
  }

  for (const idx of FACING_INDICES) {
    if (!isLandmarkVisible(landmarks[idx], rules.minVisibility)) {
      return 'unknown'
    }
  }

  const lShoulder = landmarks[11]
  const rShoulder = landmarks[12]
  const lHip = landmarks[23]
  const rHip = landmarks[24]

  const midShoulderX = (lShoulder.x + rShoulder.x) / 2
  const midShoulderY = (lShoulder.y + rShoulder.y) / 2
  const midHipX = (lHip.x + rHip.x) / 2
  const midHipY = (lHip.y + rHip.y) / 2

  const torsoLen = Math.hypot(midShoulderX - midHipX, midShoulderY - midHipY)
  if (!Number.isFinite(torsoLen) || torsoLen < EPSILON) {
    return 'unknown'
  }

  const shoulderSpanX = Math.abs(lShoulder.x - rShoulder.x)
  const ratio = shoulderSpanX / torsoLen

  if (ratio > rules.frontRatioMin) return 'front'
  if (ratio < rules.sideRatioMax) return 'side'
  return 'oblique'
}

/** 建立初始入位狀態 */
export function createInitialPositioningState(): PositioningState {
  return {
    holdStartMs: null,
    heldMs: 0,
    ready: false
  }
}

/** 更新入位穩定計時（需連續保持全身入鏡且側面 >= holdDurationMs） */
export function updatePositioning(
  state: PositioningState,
  input: PositioningInput,
  nowMs: number,
  rules: FramingRules = DEFAULT_FRAMING_RULES
): PositioningState {
  if (!input.inFrame || input.facing !== 'side') {
    return {
      holdStartMs: null,
      heldMs: 0,
      ready: false
    }
  }

  const holdStartMs = state.holdStartMs ?? nowMs
  const heldMs = Math.max(0, nowMs - holdStartMs)
  const ready = heldMs >= rules.holdDurationMs
  return {
    holdStartMs,
    heldMs,
    ready
  }
}

/** 計算與 CSS object-fit: cover 一致的縮放與平移量 */
export function coverTransform(
  videoW: number,
  videoH: number,
  viewW: number,
  viewH: number
): CoverTransform {
  if (
    !Number.isFinite(videoW) ||
    !Number.isFinite(videoH) ||
    !Number.isFinite(viewW) ||
    !Number.isFinite(viewH) ||
    videoW <= 0 ||
    videoH <= 0 ||
    viewW <= 0 ||
    viewH <= 0
  ) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }

  const scale = Math.max(viewW / videoW, viewH / videoH)
  const scaledW = videoW * scale
  const scaledH = videoH * scale
  const offsetX = (viewW - scaledW) / 2
  const offsetY = (viewH - scaledH) / 2

  return { scale, offsetX, offsetY }
}
