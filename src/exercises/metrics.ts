// R12 動作計量純函式（MediaPipe 33 landmarks -> 標量指標）
// 必要點 visibility < 0.5 時直接回傳 { value: null, valid: false }，絕不回傳 NaN
// wristHeight 為單側指標，供側拍使用；雙側版本 wristRaise 側拍時遠側手常不可見

import { DEFAULT_MIN_VISIBILITY, extractFeatures } from '../engine/features'
import type { NormalizedLandmark } from '../engine/types'

export type MetricId =
  | 'kneeAngle'
  | 'elbowAngle'
  | 'shoulderRise'
  | 'kneeLift'
  | 'legAbduction'
  | 'hipDrop'
  | 'hipLift'
  | 'wristRaise'
  | 'wristHeight'
  | 'torsoLean'

export const SUPPORTED_METRIC_IDS: readonly MetricId[] = [
  'kneeAngle',
  'elbowAngle',
  'shoulderRise',
  'kneeLift',
  'legAbduction',
  'hipDrop',
  'hipLift',
  'wristRaise',
  'wristHeight',
  'torsoLean'
]

export interface MetricSample {
  readonly value: number | null
  readonly valid: boolean
}

const EPSILON = 1e-6

const INVALID_METRIC: MetricSample = { value: null, valid: false }

function safeVisibility(lm: NormalizedLandmark | undefined): number {
  if (!lm || typeof lm.visibility !== 'number' || !Number.isFinite(lm.visibility)) {
    return 0
  }
  return Math.max(0, Math.min(1, lm.visibility))
}

function isPointUsable(
  lm: NormalizedLandmark | undefined,
  minVisibility: number = DEFAULT_MIN_VISIBILITY
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
): { readonly angle: number; readonly avgVis: number } | null {
  if (
    !isPointUsable(a, minVisibility) ||
    !isPointUsable(b, minVisibility) ||
    !isPointUsable(c, minVisibility)
  ) {
    return null
  }
  const bax = a.x - b.x
  const bay = a.y - b.y
  const bcx = c.x - b.x
  const bcy = c.y - b.y
  const magBA = Math.hypot(bax, bay)
  const magBC = Math.hypot(bcx, bcy)
  if (
    magBA < EPSILON ||
    magBC < EPSILON ||
    !Number.isFinite(magBA) ||
    !Number.isFinite(magBC)
  ) {
    return null
  }
  const cosTheta = Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / (magBA * magBC)))
  const angle = (Math.acos(cosTheta) * 180) / Math.PI
  if (!Number.isFinite(angle)) return null
  const avgVis = (safeVisibility(a) + safeVisibility(b) + safeVisibility(c)) / 3
  return { angle, avgVis }
}

interface TorsoMidpoints {
  readonly midSX: number
  readonly midSY: number
  readonly midHX: number
  readonly midHY: number
  readonly torsoLen: number
}

function getTorsoMidpoints(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number
): TorsoMidpoints | null {
  const lShoulder = landmarks[11]
  const rShoulder = landmarks[12]
  const lHip = landmarks[23]
  const rHip = landmarks[24]

  if (
    !isPointUsable(lShoulder, minVisibility) ||
    !isPointUsable(rShoulder, minVisibility) ||
    !isPointUsable(lHip, minVisibility) ||
    !isPointUsable(rHip, minVisibility)
  ) {
    return null
  }

  const midSX = (lShoulder.x + rShoulder.x) / 2
  const midSY = (lShoulder.y + rShoulder.y) / 2
  const midHX = (lHip.x + rHip.x) / 2
  const midHY = (lHip.y + rHip.y) / 2
  const torsoLen = Math.hypot(midSX - midHX, midSY - midHY)
  if (!Number.isFinite(torsoLen) || torsoLen < EPSILON) return null

  return { midSX, midSY, midHX, midHY, torsoLen }
}

function computeTorsoLength(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number,
  allowSingleSide: boolean
): number | null {
  const dual = getTorsoMidpoints(landmarks, minVisibility)
  if (dual !== null) return dual.torsoLen

  if (!allowSingleSide) return null

  const lShoulder = landmarks[11]
  const rShoulder = landmarks[12]
  const lHip = landmarks[23]
  const rHip = landmarks[24]
  const hasLS = isPointUsable(lShoulder, minVisibility)
  const hasRS = isPointUsable(rShoulder, minVisibility)
  const hasLH = isPointUsable(lHip, minVisibility)
  const hasRH = isPointUsable(rHip, minVisibility)

  if (hasLS && hasLH) {
    const len = Math.hypot(lShoulder.x - lHip.x, lShoulder.y - lHip.y)
    return Number.isFinite(len) && len >= EPSILON ? len : null
  }
  if (hasRS && hasRH) {
    const len = Math.hypot(rShoulder.x - rHip.x, rShoulder.y - rHip.y)
    return Number.isFinite(len) && len >= EPSILON ? len : null
  }
  const usableShoulders = [lShoulder, rShoulder].filter((p): p is NormalizedLandmark =>
    isPointUsable(p, minVisibility)
  )
  const usableHips = [lHip, rHip].filter((p): p is NormalizedLandmark =>
    isPointUsable(p, minVisibility)
  )
  if (usableShoulders.length === 0 || usableHips.length === 0) return null

  const avgSX = usableShoulders.reduce((s, p) => s + p.x, 0) / usableShoulders.length
  const avgSY = usableShoulders.reduce((s, p) => s + p.y, 0) / usableShoulders.length
  const avgHX = usableHips.reduce((s, p) => s + p.x, 0) / usableHips.length
  const avgHY = usableHips.reduce((s, p) => s + p.y, 0) / usableHips.length
  const len = Math.hypot(avgSX - avgHX, avgSY - avgHY)
  return Number.isFinite(len) && len >= EPSILON ? len : null
}

/** 膝角指標（複用 engine/features extractFeatures） */
export function kneeAngleMetric(landmarks: readonly NormalizedLandmark[]): MetricSample {
  const features = extractFeatures(landmarks)
  if (!features.valid || features.kneeAngle === null || !Number.isFinite(features.kneeAngle)) {
    return INVALID_METRIC
  }
  return { value: features.kneeAngle, valid: true }
}

/** 側面肘角（肩 11/12 - 肘 13/14 - 腕 15/16，取可見度較高側） */
export function elbowAngleMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const left = computeAngleDeg(landmarks[11], landmarks[13], landmarks[15], minVisibility)
  const right = computeAngleDeg(landmarks[12], landmarks[14], landmarks[16], minVisibility)

  if (left !== null && right !== null) {
    const chosen = right.avgVis > left.avgVis ? right.angle : left.angle
    return { value: chosen, valid: true }
  }
  if (left !== null) return { value: left.angle, valid: true }
  if (right !== null) return { value: right.angle, valid: true }
  return INVALID_METRIC
}

/** 肩部上升量（value = -(midShoulderY) / torsoLen，越高值越大） */
export function shoulderRiseMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const lShoulder = landmarks[11]
  const rShoulder = landmarks[12]
  if (!isPointUsable(lShoulder, minVisibility) || !isPointUsable(rShoulder, minVisibility)) {
    return INVALID_METRIC
  }
  const torsoLen = computeTorsoLength(landmarks, minVisibility, false)
  if (torsoLen === null) return INVALID_METRIC

  const midShoulderY = (lShoulder.y + rShoulder.y) / 2
  const value = -midShoulderY / torsoLen
  if (!Number.isFinite(value)) return INVALID_METRIC
  return { value, valid: true }
}

/** 正面抬腿高度（(hipY - kneeY) / torsoLen，取左右較大值；任一側可見即可算） */
export function kneeLiftMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const torsoLen = computeTorsoLength(landmarks, minVisibility, true)
  if (torsoLen === null) return INVALID_METRIC

  const lHip = landmarks[23]
  const lKnee = landmarks[25]
  const rHip = landmarks[24]
  const rKnee = landmarks[26]

  const leftLift =
    isPointUsable(lHip, minVisibility) && isPointUsable(lKnee, minVisibility)
      ? (lHip.y - lKnee.y) / torsoLen
      : null
  const rightLift =
    isPointUsable(rHip, minVisibility) && isPointUsable(rKnee, minVisibility)
      ? (rHip.y - rKnee.y) / torsoLen
      : null

  const validLeft = leftLift !== null && Number.isFinite(leftLift) ? leftLift : null
  const validRight = rightLift !== null && Number.isFinite(rightLift) ? rightLift : null

  if (validLeft !== null && validRight !== null) {
    return { value: Math.max(validLeft, validRight), valid: true }
  }
  if (validLeft !== null) return { value: validLeft, valid: true }
  if (validRight !== null) return { value: validRight, valid: true }
  return INVALID_METRIC
}

/** 正面側抬腿外展幅度（max(|ankleX_L - hipX_L|, |ankleX_R - hipX_R|) / torsoLen；雙側 11/12/23/24/27/28 皆需可見） */
export function legAbductionMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const torso = getTorsoMidpoints(landmarks, minVisibility)
  if (torso === null) return INVALID_METRIC

  const lAnkle = landmarks[27]
  const rAnkle = landmarks[28]
  if (!isPointUsable(lAnkle, minVisibility) || !isPointUsable(rAnkle, minVisibility)) {
    return INVALID_METRIC
  }

  const leftAbd = Math.abs(lAnkle.x - landmarks[23].x)
  const rightAbd = Math.abs(rAnkle.x - landmarks[24].x)
  const value = Math.max(leftAbd, rightAbd) / torso.torsoLen
  if (!Number.isFinite(value)) return INVALID_METRIC
  return { value, valid: true }
}

/** 正面相撲深蹲降髖比例（midHipY / torsoLen；雙側肩髖 11/12/23/24 需可見，搭配 baseline-delta） */
export function hipDropMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const torso = getTorsoMidpoints(landmarks, minVisibility)
  if (torso === null) return INVALID_METRIC

  const value = torso.midHY / torso.torsoLen
  if (!Number.isFinite(value)) return INVALID_METRIC
  return { value, valid: true }
}

/** 側面躺姿橋式抬臀比例（-(midHipY) / torsoLen；雙側肩髖 11/12/23/24 需可見，搭配 baseline-delta） */
export function hipLiftMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const torso = getTorsoMidpoints(landmarks, minVisibility)
  if (torso === null) return INVALID_METRIC

  const value = -torso.midHY / torso.torsoLen
  if (!Number.isFinite(value)) return INVALID_METRIC
  return { value, valid: true }
}

/** 正面雙手上舉高度（((shoulderY_L - wristY_L) + (shoulderY_R - wristY_R)) / 2 / torsoLen；雙側 11/12/15/16/23/24 皆需可見） */
export function wristRaiseMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const torso = getTorsoMidpoints(landmarks, minVisibility)
  if (torso === null) return INVALID_METRIC

  const lWrist = landmarks[15]
  const rWrist = landmarks[16]
  if (!isPointUsable(lWrist, minVisibility) || !isPointUsable(rWrist, minVisibility)) {
    return INVALID_METRIC
  }

  const avgRaise = (landmarks[11].y - lWrist.y + (landmarks[12].y - rWrist.y)) / 2
  const value = avgRaise / torso.torsoLen
  if (!Number.isFinite(value)) return INVALID_METRIC
  return { value, valid: true }
}

function computeSideWristHeight(
  shoulder: NormalizedLandmark | undefined,
  wrist: NormalizedLandmark | undefined,
  hip: NormalizedLandmark | undefined,
  minVisibility: number
): { readonly value: number; readonly avgVis: number } | null {
  if (
    !isPointUsable(shoulder, minVisibility) ||
    !isPointUsable(wrist, minVisibility) ||
    !isPointUsable(hip, minVisibility)
  ) {
    return null
  }
  const torsoLen = Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y)
  if (!Number.isFinite(torsoLen) || torsoLen < EPSILON) {
    return null
  }
  const value = (shoulder.y - wrist.y) / torsoLen
  if (!Number.isFinite(value)) {
    return null
  }
  const avgVis =
    (safeVisibility(shoulder) + safeVisibility(wrist) + safeVisibility(hip)) / 3
  return { value, avgVis }
}

/** 單側手腕相對肩部高度（(肩.y - 腕.y) / 該側軀幹長，手腕高於肩為正；單側指標供側拍使用） */
export function wristHeightMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const left = computeSideWristHeight(landmarks[11], landmarks[15], landmarks[23], minVisibility)
  const right = computeSideWristHeight(landmarks[12], landmarks[16], landmarks[24], minVisibility)

  if (left !== null && right !== null) {
    const chosen = right.avgVis > left.avgVis ? right.value : left.value
    return { value: chosen, valid: true }
  }
  if (left !== null) return { value: left.value, valid: true }
  if (right !== null) return { value: right.value, valid: true }
  return INVALID_METRIC
}

/** 側面軀幹前傾角（肩中點到髖中點向量與鉛直線夾角，度；雙側肩髖 11/12/23/24 需可見，直立約 0 度） */
export function torsoLeanMetric(
  landmarks: readonly NormalizedLandmark[],
  minVisibility: number = DEFAULT_MIN_VISIBILITY
): MetricSample {
  const torso = getTorsoMidpoints(landmarks, minVisibility)
  if (torso === null) return INVALID_METRIC

  const dx = Math.abs(torso.midSX - torso.midHX)
  const dy = torso.midHY - torso.midSY
  const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI
  if (!Number.isFinite(angleDeg)) return INVALID_METRIC
  return { value: angleDeg, valid: true }
}

export function computeMetric(
  metricId: MetricId,
  landmarks: readonly NormalizedLandmark[]
): MetricSample {
  switch (metricId) {
    case 'kneeAngle':
      return kneeAngleMetric(landmarks)
    case 'elbowAngle':
      return elbowAngleMetric(landmarks)
    case 'shoulderRise':
      return shoulderRiseMetric(landmarks)
    case 'kneeLift':
      return kneeLiftMetric(landmarks)
    case 'legAbduction':
      return legAbductionMetric(landmarks)
    case 'hipDrop':
      return hipDropMetric(landmarks)
    case 'hipLift':
      return hipLiftMetric(landmarks)
    case 'wristRaise':
      return wristRaiseMetric(landmarks)
    case 'wristHeight':
      return wristHeightMetric(landmarks)
    case 'torsoLean':
      return torsoLeanMetric(landmarks)
  }
}
