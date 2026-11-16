// R1 特徵計算：MediaPipe 33 landmarks（側面）→ FrameFeatures
// 純函式、零 DOM、不修改輸入、不回傳 NaN

import type { FrameFeatures, NormalizedLandmark, Side } from './types'

export const DEFAULT_MIN_VISIBILITY = 0.5

const KEYPOINT_INDICES = [11, 12, 23, 24, 25, 26, 27, 28] as const
const LEFT_INDICES = [11, 23, 25, 27] as const
const RIGHT_INDICES = [12, 24, 26, 28] as const
const MIN_LANDMARK_COUNT = 29
const EPSILON = 1e-6

function safeVisibility(lm: NormalizedLandmark | undefined): number {
  if (!lm || typeof lm.visibility !== 'number' || !Number.isFinite(lm.visibility)) {
    return 0
  }
  return Math.max(0, Math.min(1, lm.visibility))
}

function isPointUsable(
  lm: NormalizedLandmark | undefined,
  minVisibility: number
): lm is NormalizedLandmark {
  if (!lm) return false
  if (!Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return false
  return safeVisibility(lm) >= minVisibility
}

function computeAngleDeg(
  a: NormalizedLandmark | undefined,
  b: NormalizedLandmark | undefined,
  c: NormalizedLandmark | undefined,
  minVisibility: number
): number | null {
  if (!isPointUsable(a, minVisibility) || !isPointUsable(b, minVisibility) || !isPointUsable(c, minVisibility)) {
    return null
  }
  const bax = a.x - b.x
  const bay = a.y - b.y
  const bcx = c.x - b.x
  const bcy = c.y - b.y
  const magBA = Math.hypot(bax, bay)
  const magBC = Math.hypot(bcx, bcy)
  if (magBA < EPSILON || magBC < EPSILON || !Number.isFinite(magBA) || !Number.isFinite(magBC)) {
    return null
  }
  const cosTheta = Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / (magBA * magBC)))
  const deg = (Math.acos(cosTheta) * 180) / Math.PI
  return Number.isFinite(deg) ? deg : null
}

function averageVisibility(
  landmarks: readonly NormalizedLandmark[],
  indices: readonly number[]
): number {
  let sum = 0
  for (const idx of indices) {
    sum += safeVisibility(landmarks[idx])
  }
  return sum / indices.length
}

function isSideUsable(
  landmarks: readonly NormalizedLandmark[],
  indices: readonly number[],
  minVisibility: number
): boolean {
  return indices.every((idx) => isPointUsable(landmarks[idx], minVisibility))
}

function selectPrimarySide(
  landmarks: readonly NormalizedLandmark[],
  leftValid: boolean,
  rightValid: boolean
): Side {
  if (leftValid && !rightValid) return 'left'
  if (rightValid && !leftValid) return 'right'
  const leftAvg = averageVisibility(landmarks, LEFT_INDICES)
  const rightAvg = averageVisibility(landmarks, RIGHT_INDICES)
  return rightAvg > leftAvg ? 'right' : 'left'
}

function computeOverallMinVisibility(landmarks: readonly NormalizedLandmark[]): number {
  let minVis = 1
  for (const idx of KEYPOINT_INDICES) {
    minVis = Math.min(minVis, safeVisibility(landmarks[idx]))
  }
  return minVis
}

function computeHipDisplacementRatio(
  hipY: number | null,
  baselineHipY: number | null | undefined
): number | null {
  if (hipY === null || baselineHipY == null) return null
  if (!Number.isFinite(baselineHipY) || Math.abs(baselineHipY) < EPSILON) return null
  const ratio = (hipY - baselineHipY) / baselineHipY
  return Number.isFinite(ratio) ? ratio : null
}

export function createInvalidFeatures(minVisibility = 0, side: Side = 'left'): FrameFeatures {
  return {
    valid: false,
    side,
    kneeAngle: null,
    hipAngle: null,
    leftKneeAngle: null,
    rightKneeAngle: null,
    leftHipAngle: null,
    rightHipAngle: null,
    hipY: null,
    hipDisplacementRatio: null,
    minVisibility
  }
}

export function extractFeatures(
  landmarks: readonly NormalizedLandmark[],
  baselineHipY?: number | null,
  minVisibilityThreshold = DEFAULT_MIN_VISIBILITY
): FrameFeatures {
  if (landmarks.length < MIN_LANDMARK_COUNT) {
    return createInvalidFeatures(0, 'left')
  }

  const minVisibility = computeOverallMinVisibility(landmarks)
  const leftValid = isSideUsable(landmarks, LEFT_INDICES, minVisibilityThreshold)
  const rightValid = isSideUsable(landmarks, RIGHT_INDICES, minVisibilityThreshold)
  const side = selectPrimarySide(landmarks, leftValid, rightValid)

  const leftKneeAngle = computeAngleDeg(landmarks[23], landmarks[25], landmarks[27], minVisibilityThreshold)
  const rightKneeAngle = computeAngleDeg(landmarks[24], landmarks[26], landmarks[28], minVisibilityThreshold)
  const leftHipAngle = computeAngleDeg(landmarks[11], landmarks[23], landmarks[25], minVisibilityThreshold)
  const rightHipAngle = computeAngleDeg(landmarks[12], landmarks[24], landmarks[26], minVisibilityThreshold)

  const primaryKnee = side === 'left' ? leftKneeAngle : rightKneeAngle
  const primaryHip = side === 'left' ? leftHipAngle : rightHipAngle
  const valid = (side === 'left' ? leftValid : rightValid) && primaryKnee !== null && primaryHip !== null

  const hipLm = side === 'left' ? landmarks[23] : landmarks[24]
  const hipY = valid && hipLm && Number.isFinite(hipLm.y) ? hipLm.y : null
  const hipDisplacementRatio = computeHipDisplacementRatio(hipY, baselineHipY)

  return {
    valid,
    side,
    kneeAngle: valid ? primaryKnee : null,
    hipAngle: valid ? primaryHip : null,
    leftKneeAngle,
    rightKneeAngle,
    leftHipAngle,
    rightHipAngle,
    hipY,
    hipDisplacementRatio,
    minVisibility
  }
}
