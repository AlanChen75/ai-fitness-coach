import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '../src/engine/types'
import {
  checkBodyInFrame,
  coverTransform,
  createInitialPositioningState,
  DEFAULT_FRAMING_RULES,
  detectFacing,
  updatePositioning
} from '../src/framing'
import { makeSquatLandmarks } from './fixtures'

function makeFrontLandmarks(visibility = 0.95): readonly NormalizedLandmark[] {
  const base = makeSquatLandmarks({
    leftKneeAngleDeg: 175,
    rightKneeAngleDeg: 175,
    leftVisibility: visibility,
    rightVisibility: visibility,
    baseVisibility: visibility
  })
  const copy = base.map((p) => ({ ...p }))
  // 正面站姿：左右肩 x 距離 0.24，軀幹長度約 0.25 -> ratio ≈ 0.96 > 0.55
  copy[11] = { x: 0.38, y: 0.35, z: 0, visibility }
  copy[12] = { x: 0.62, y: 0.35, z: 0, visibility }
  copy[23] = { x: 0.42, y: 0.60, z: 0, visibility }
  copy[24] = { x: 0.58, y: 0.60, z: 0, visibility }
  copy[25] = { x: 0.42, y: 0.74, z: 0, visibility }
  copy[26] = { x: 0.58, y: 0.74, z: 0, visibility }
  copy[27] = { x: 0.42, y: 0.88, z: 0, visibility }
  copy[28] = { x: 0.58, y: 0.88, z: 0, visibility }
  return copy
}

function makeSideLandmarks(visibility = 0.95): readonly NormalizedLandmark[] {
  const base = makeSquatLandmarks({
    leftKneeAngleDeg: 175,
    rightKneeAngleDeg: 175,
    leftVisibility: visibility,
    rightVisibility: visibility,
    baseVisibility: visibility
  })
  const copy = base.map((p) => ({ ...p }))
  // 側面站姿：兩肩幾乎重合（x 差 0.02，軀幹長度 0.25 -> ratio = 0.08 < 0.35）
  copy[11] = { x: 0.49, y: 0.35, z: 0, visibility }
  copy[12] = { x: 0.51, y: 0.35, z: 0, visibility }
  copy[23] = { x: 0.49, y: 0.60, z: 0, visibility }
  copy[24] = { x: 0.51, y: 0.60, z: 0, visibility }
  copy[25] = { x: 0.50, y: 0.74, z: 0, visibility }
  copy[26] = { x: 0.50, y: 0.74, z: 0, visibility }
  copy[27] = { x: 0.50, y: 0.88, z: 0, visibility }
  copy[28] = { x: 0.50, y: 0.88, z: 0, visibility }
  return copy
}

describe('Framing & Positioning (R8 / R10)', () => {
  it('T10.1: detects front facing when shoulder x-span is wide', () => {
    const lm = makeFrontLandmarks()
    expect(DEFAULT_FRAMING_RULES.rules_version).toBe('framing-v0.1')
    expect(detectFacing(lm)).toBe('front')
    expect(checkBodyInFrame(lm)).toEqual({ inFrame: true, missing: null })
  })

  it('T10.2: detects side facing when shoulders nearly overlap, and oblique in between', () => {
    const sideLm = makeSideLandmarks()
    expect(detectFacing(sideLm)).toBe('side')

    // 斜向：shoulderSpanX = 0.11, torsoLen = 0.25 -> ratio = 0.44 (0.35..0.55)
    const obliqueLm = sideLm.map((p) => ({ ...p }))
    obliqueLm[11] = { ...obliqueLm[11], x: 0.445 }
    obliqueLm[12] = { ...obliqueLm[12], x: 0.555 }
    expect(detectFacing(obliqueLm)).toBe('oblique')
  })

  it('T10.3: flags missing lower when knees/ankles visibility is 0.2', () => {
    const lm = makeSideLandmarks().map((p, idx) => {
      if (idx === 25 || idx === 26 || idx === 27 || idx === 28) {
        return { ...p, visibility: 0.2 }
      }
      return p
    })
    expect(checkBodyInFrame(lm)).toEqual({ inFrame: false, missing: 'lower' })

    const upperMissing = makeSideLandmarks().map((p, idx) =>
      idx === 11 || idx === 12 ? { ...p, y: 0.01 } : p
    )
    expect(checkBodyInFrame(upperMissing)).toEqual({ inFrame: false, missing: 'upper' })

    const allLow = makeSideLandmarks(0.1)
    expect(checkBodyInFrame(allLow)).toEqual({ inFrame: false, missing: 'all' })
  })

  it('T10.3b: exercise-scoped regions ignore landmarks the metric does not use', () => {
    // 腳踝出鏡（室內前鏡頭距離不足的真實場景）
    const anklesOut = makeFrontLandmarks().map((p, idx) =>
      idx === 27 || idx === 28 ? { ...p, visibility: 0.2 } : p
    )
    // 全身需求（深蹲/坐站）仍擋
    expect(checkBodyInFrame(anklesOut)).toEqual({ inFrame: false, missing: 'lower' })
    // 踏步只需肩髖膝 -> 通過
    expect(
      checkBodyInFrame(anklesOut, DEFAULT_FRAMING_RULES, ['upper', 'hips', 'knees'])
    ).toEqual({ inFrame: true, missing: null })

    // 膝蓋也出鏡時，踏步仍要擋並回報 lower
    const kneesOut = anklesOut.map((p, idx) =>
      idx === 25 || idx === 26 ? { ...p, visibility: 0.2 } : p
    )
    expect(
      checkBodyInFrame(kneesOut, DEFAULT_FRAMING_RULES, ['upper', 'hips', 'knees'])
    ).toEqual({ inFrame: false, missing: 'lower' })
    // 上半身需求（牆壁伏地挺身/提踵）不受下半身影響
    expect(checkBodyInFrame(kneesOut, DEFAULT_FRAMING_RULES, ['upper', 'hips'])).toEqual({
      inFrame: true,
      missing: null
    })
  })

  it('T10.4: updatePositioning holds 1200ms for ready and resets on interruption', () => {
    const s0 = createInitialPositioningState()
    const s1 = updatePositioning(s0, { inFrame: true, facing: 'side' }, 1000)
    expect(s0.holdStartMs).toBeNull()
    expect(s1.ready).toBe(false)
    expect(s1.heldMs).toBe(0)

    const s2 = updatePositioning(s1, { inFrame: true, facing: 'side' }, 1600)
    expect(s2.ready).toBe(false)
    expect(s2.heldMs).toBe(600)

    const s3 = updatePositioning(s2, { inFrame: true, facing: 'side' }, 2200)
    expect(s3.ready).toBe(true)
    expect(s3.heldMs).toBe(1200)

    // 中途 300ms 轉正面 -> 重算計時
    const r0 = createInitialPositioningState()
    const r1 = updatePositioning(r0, { inFrame: true, facing: 'side' }, 1000)
    const r2 = updatePositioning(r1, { inFrame: true, facing: 'front' }, 1300)
    expect(r2).toEqual({ holdStartMs: null, heldMs: 0, ready: false })

    const r3 = updatePositioning(r2, { inFrame: true, facing: 'side' }, 1400)
    const r4 = updatePositioning(r3, { inFrame: true, facing: 'side' }, 2200)
    expect(r4.ready).toBe(false)
    expect(r4.heldMs).toBe(800)

    const r5 = updatePositioning(r4, { inFrame: true, facing: 'side' }, 2600)
    expect(r5.ready).toBe(true)
    expect(r5.heldMs).toBe(1200)
  })

  it('T10.5: returns unknown facing and inFrame false when landmarks are insufficient', () => {
    expect(detectFacing([])).toBe('unknown')
    expect(checkBodyInFrame([])).toEqual({ inFrame: false, missing: 'all' })

    const shortLm = makeSideLandmarks().slice(0, 20)
    expect(detectFacing(shortLm)).toBe('unknown')
    expect(checkBodyInFrame(shortLm)).toEqual({ inFrame: false, missing: 'all' })

    const lowShoulderVis = makeSideLandmarks().map((p, idx) =>
      idx === 11 ? { ...p, visibility: 0.3 } : p
    )
    expect(detectFacing(lowShoulderVis)).toBe('unknown')
  })

  it('T10.6: coverTransform computes scale and offsets matching CSS object-fit cover', () => {
    // 直式視窗 360x800 配直式來源 480x640
    const portraitOnPortrait = coverTransform(480, 640, 360, 800)
    expect(portraitOnPortrait.scale).toBeCloseTo(1.25, 6)
    expect(portraitOnPortrait.offsetX).toBeCloseTo(-120, 6)
    expect(portraitOnPortrait.offsetY).toBeCloseTo(0, 6)

    // 中心點 (0.5, 0.5) 應對映到視窗中心 (180, 400)
    expect(0.5 * 480 * portraitOnPortrait.scale + portraitOnPortrait.offsetX).toBeCloseTo(180, 6)
    expect(0.5 * 640 * portraitOnPortrait.scale + portraitOnPortrait.offsetY).toBeCloseTo(400, 6)

    // 直式視窗 360x800 配橫式來源 640x480
    const landscapeOnPortrait = coverTransform(640, 480, 360, 800)
    const expectedScale = 800 / 480
    const expectedOffsetX = (360 - 640 * expectedScale) / 2
    expect(landscapeOnPortrait.scale).toBeCloseTo(expectedScale, 6)
    expect(landscapeOnPortrait.offsetX).toBeCloseTo(expectedOffsetX, 6)
    expect(landscapeOnPortrait.offsetY).toBeCloseTo(0, 6)
    expect(0.5 * 640 * landscapeOnPortrait.scale + landscapeOnPortrait.offsetX).toBeCloseTo(180, 6)
    expect(0.5 * 480 * landscapeOnPortrait.scale + landscapeOnPortrait.offsetY).toBeCloseTo(400, 6)

    // 橫式視窗 1280x720 配橫式來源 640x480
    const landscapeOnLandscape = coverTransform(640, 480, 1280, 720)
    expect(landscapeOnLandscape.scale).toBeCloseTo(2, 6)
    expect(landscapeOnLandscape.offsetX).toBeCloseTo(0, 6)
    expect(landscapeOnLandscape.offsetY).toBeCloseTo(-120, 6)
  })
})
