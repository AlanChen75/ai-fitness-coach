// 合成 MediaPipe 33 landmarks 與動作序列產生器（供 T1-T9 單元測試使用）

import type { NormalizedLandmark, PoseSample } from '../src/engine/types'

const LANDMARK_COUNT = 33
const SHIN_LEN = 0.25
const THIGH_LEN = 0.25
const TORSO_LEN = 0.25

export interface LandmarkFrameOptions {
  readonly leftKneeAngleDeg?: number
  readonly rightKneeAngleDeg?: number
  readonly leftVisibility?: number
  readonly rightVisibility?: number
  readonly baseVisibility?: number
  readonly visibilityOverrides?: Readonly<Record<number, number>>
}

function buildLegAndTorso(
  kneeAngleDeg: number,
  visibility: number
): {
  readonly shoulder: NormalizedLandmark
  readonly hip: NormalizedLandmark
  readonly knee: NormalizedLandmark
  readonly ankle: NormalizedLandmark
} {
  const ankle: NormalizedLandmark = { x: 0.5, y: 0.85, z: 0, visibility }
  const depthFactor = Math.max(0, Math.min(1, (180 - kneeAngleDeg) / 90))
  const shinTiltRad = depthFactor * ((15 * Math.PI) / 180)

  const knee: NormalizedLandmark = {
    x: ankle.x + SHIN_LEN * Math.sin(shinTiltRad),
    y: ankle.y - SHIN_LEN * Math.cos(shinTiltRad),
    z: 0,
    visibility
  }

  const thetaKA = Math.atan2(ankle.y - knee.y, ankle.x - knee.x)
  const thetaKH = thetaKA + (kneeAngleDeg * Math.PI) / 180
  const hip: NormalizedLandmark = {
    x: knee.x + THIGH_LEN * Math.cos(thetaKH),
    y: knee.y + THIGH_LEN * Math.sin(thetaKH),
    z: 0,
    visibility
  }

  const torsoLeanRad = depthFactor * ((25 * Math.PI) / 180)
  const shoulder: NormalizedLandmark = {
    x: hip.x + TORSO_LEN * Math.sin(torsoLeanRad),
    y: hip.y - TORSO_LEN * Math.cos(torsoLeanRad),
    z: 0,
    visibility
  }

  return { shoulder, hip, knee, ankle }
}

export function makeSquatLandmarks(
  options: LandmarkFrameOptions = {}
): readonly NormalizedLandmark[] {
  const leftKneeDeg = options.leftKneeAngleDeg ?? 175
  const rightKneeDeg = options.rightKneeAngleDeg ?? leftKneeDeg
  const leftVis = options.leftVisibility ?? 0.95
  const rightVis = options.rightVisibility ?? 0.9
  const baseVis = options.baseVisibility ?? 0.9

  const left = buildLegAndTorso(leftKneeDeg, leftVis)
  const right = buildLegAndTorso(rightKneeDeg, rightVis)

  const landmarks: NormalizedLandmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: baseVis
  }))

  landmarks[11] = left.shoulder
  landmarks[23] = left.hip
  landmarks[25] = left.knee
  landmarks[27] = left.ankle

  landmarks[12] = right.shoulder
  landmarks[24] = right.hip
  landmarks[26] = right.knee
  landmarks[28] = right.ankle

  if (options.visibilityOverrides) {
    for (const [key, vis] of Object.entries(options.visibilityOverrides)) {
      const idx = Number(key)
      if (idx >= 0 && idx < LANDMARK_COUNT) {
        landmarks[idx] = { ...landmarks[idx], visibility: vis }
      }
    }
  }

  return landmarks
}

export function makePoseSample(
  t_ms: number,
  options: LandmarkFrameOptions = {},
  valid = true
): PoseSample {
  return {
    t_ms,
    landmarks: makeSquatLandmarks(options),
    valid
  }
}

export function generateStandingSamples(
  startMs: number,
  durationMs: number,
  stepMs = 50,
  kneeAngleDeg = 175
): readonly PoseSample[] {
  const samples: PoseSample[] = []
  for (let t = startMs; t <= startMs + durationMs; t += stepMs) {
    samples.push(makePoseSample(t, { leftKneeAngleDeg: kneeAngleDeg }))
  }
  return samples
}

export interface SquatCycleOptions {
  readonly startMs: number
  readonly stepMs?: number
  readonly standAngle?: number
  readonly bottomAngle?: number
  readonly descendSteps?: number
  readonly bottomSteps?: number
  readonly ascendSteps?: number
  readonly invalidGap?: {
    readonly startOffsetMs: number
    readonly durationMs: number
    readonly mode?: 'low_vis' | 'sample_invalid'
  }
}

function interpolate(a: number, b: number, ratio: number): number {
  return a + (b - a) * ratio
}

export function generateSquatCycle(options: SquatCycleOptions): {
  readonly samples: readonly PoseSample[]
  readonly endMs: number
} {
  const stepMs = options.stepMs ?? 50
  const standAngle = options.standAngle ?? 175
  const bottomAngle = options.bottomAngle ?? 90
  const descendSteps = options.descendSteps ?? 8
  const bottomSteps = options.bottomSteps ?? 5
  const ascendSteps = options.ascendSteps ?? 8

  const angles: number[] = []
  for (let i = 1; i <= descendSteps; i++) {
    angles.push(interpolate(standAngle, bottomAngle, i / descendSteps))
  }
  for (let i = 0; i < bottomSteps; i++) {
    angles.push(bottomAngle)
  }
  for (let i = 1; i <= ascendSteps; i++) {
    angles.push(interpolate(bottomAngle, standAngle, i / ascendSteps))
  }

  const samples: PoseSample[] = []
  let t = options.startMs
  for (const angle of angles) {
    const offset = t - options.startMs
    const gap = options.invalidGap
    const inGap =
      gap !== undefined &&
      offset >= gap.startOffsetMs &&
      offset < gap.startOffsetMs + gap.durationMs

    if (inGap && gap.mode === 'sample_invalid') {
      samples.push(makePoseSample(t, { leftKneeAngleDeg: angle }, false))
    } else if (inGap) {
      samples.push(
        makePoseSample(t, {
          leftKneeAngleDeg: angle,
          leftVisibility: 0.2,
          rightVisibility: 0.2
        })
      )
    } else {
      samples.push(makePoseSample(t, { leftKneeAngleDeg: angle }))
    }
    t += stepMs
  }

  return { samples, endMs: t }
}

export function generateInvalidSamples(
  startMs: number,
  durationMs: number,
  stepMs = 50,
  mode: 'low_vis' | 'sample_invalid' = 'low_vis'
): readonly PoseSample[] {
  const samples: PoseSample[] = []
  for (let t = startMs; t <= startMs + durationMs; t += stepMs) {
    if (mode === 'sample_invalid') {
      samples.push(makePoseSample(t, {}, false))
    } else {
      samples.push(
        makePoseSample(t, {
          leftVisibility: 0.3,
          rightVisibility: 0.3
        })
      )
    }
  }
  return samples
}
