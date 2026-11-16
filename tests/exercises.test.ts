import { describe, expect, it } from 'vitest'
import type { NormalizedLandmark } from '../src/engine/types'
import { EXERCISES, getExercise } from '../src/exercises/catalog'
import {
  elbowAngleMetric,
  kneeAngleMetric,
  kneeLiftMetric,
  shoulderRiseMetric
} from '../src/exercises/metrics'

function makeBaseLandmarks(visibility = 0.95): NormalizedLandmark[] {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility
  }))
}

function setPoint(
  landmarks: NormalizedLandmark[],
  index: number,
  x: number,
  y: number,
  visibility = 0.95
): void {
  landmarks[index] = { x, y, z: 0, visibility }
}

describe('Exercise Metrics & Catalog (R12-R15 T15.7-T15.8)', () => {
  it('T15.7a: elbowAngleMetric 對 90 度肘角應算出 90 度且選可見度較高側', () => {
    const lms = makeBaseLandmarks()
    // 左側：肩 (0.5, 0.3)、肘 (0.5, 0.5)、腕 (0.7, 0.5) => 夾角 90 度
    setPoint(lms, 11, 0.5, 0.3, 0.95)
    setPoint(lms, 13, 0.5, 0.5, 0.95)
    setPoint(lms, 15, 0.7, 0.5, 0.95)
    // 右側：較低可見度且角度 180 度
    setPoint(lms, 12, 0.5, 0.3, 0.6)
    setPoint(lms, 14, 0.5, 0.5, 0.6)
    setPoint(lms, 16, 0.5, 0.7, 0.6)

    const res = elbowAngleMetric(lms)
    expect(res.valid).toBe(true)
    expect(res.value).not.toBeNull()
    expect(res.value!).toBeCloseTo(90, 3)
  })

  it('T15.7b: kneeLiftMetric 單膝抬高取兩側較大值，單側可見即可計算', () => {
    const lms = makeBaseLandmarks()
    // 軀幹長 = 0.3 (肩 y=0.2, 髖 y=0.5)
    setPoint(lms, 11, 0.4, 0.2, 0.95)
    setPoint(lms, 12, 0.6, 0.2, 0.95)
    setPoint(lms, 23, 0.4, 0.5, 0.95)
    setPoint(lms, 24, 0.6, 0.5, 0.95)
    // 左膝低於髖 (y=0.7 -> (0.5 - 0.7)/0.3 = -0.667)
    setPoint(lms, 25, 0.4, 0.7, 0.95)
    // 右膝高於髖 (y=0.35 -> (0.5 - 0.35)/0.3 = +0.5)
    setPoint(lms, 26, 0.6, 0.35, 0.95)

    const bothRes = kneeLiftMetric(lms)
    expect(bothRes.valid).toBe(true)
    expect(bothRes.value!).toBeCloseTo(0.5, 5)

    // 僅左側可見、右側膝蓋與髖部皆不可見 (vis 0.2) -> 仍可算左側
    setPoint(lms, 24, 0.6, 0.5, 0.2)
    setPoint(lms, 26, 0.6, 0.35, 0.2)
    const leftOnlyRes = kneeLiftMetric(lms)
    expect(leftOnlyRes.valid).toBe(true)
    expect(leftOnlyRes.value!).toBeCloseTo(-2 / 3, 5)

    // 兩側膝蓋皆不可見 -> invalid
    setPoint(lms, 25, 0.4, 0.7, 0.2)
    const noneRes = kneeLiftMetric(lms)
    expect(noneRes.valid).toBe(false)
    expect(noneRes.value).toBeNull()
  })

  it('T15.7c: shoulderRiseMetric 越往上值越大且必要點 visibility 0.2 時回傳 invalid/null', () => {
    const low = makeBaseLandmarks()
    setPoint(low, 11, 0.45, 0.3, 0.95)
    setPoint(low, 12, 0.55, 0.3, 0.95)
    setPoint(low, 23, 0.45, 0.6, 0.95)
    setPoint(low, 24, 0.55, 0.6, 0.95)

    const high = makeBaseLandmarks()
    setPoint(high, 11, 0.45, 0.25, 0.95)
    setPoint(high, 12, 0.55, 0.25, 0.95)
    setPoint(high, 23, 0.45, 0.55, 0.95)
    setPoint(high, 24, 0.55, 0.55, 0.95)

    const rLow = shoulderRiseMetric(low)
    const rHigh = shoulderRiseMetric(high)
    expect(rLow.valid).toBe(true)
    expect(rHigh.valid).toBe(true)
    expect(rHigh.value!).toBeGreaterThan(rLow.value!)

    // 必要點 visibility 0.2 -> invalid 且 value null，無 NaN
    setPoint(low, 11, 0.45, 0.3, 0.2)
    const rInvalid = shoulderRiseMetric(low)
    expect(rInvalid).toEqual({ value: null, valid: false })

    // elbowAngle & kneeAngle 必要點 visibility 0.2 -> invalid 且 value null
    setPoint(low, 13, 0.45, 0.4, 0.2)
    setPoint(low, 14, 0.55, 0.4, 0.2)
    expect(elbowAngleMetric(low)).toEqual({ value: null, valid: false })

    setPoint(low, 25, 0.45, 0.7, 0.2)
    setPoint(low, 26, 0.55, 0.7, 0.2)
    expect(kneeAngleMetric(low)).toEqual({ value: null, valid: false })
  })

  it('T15.8: catalog 恰 5 筆、id 唯一、欄位齊全、SVG 合規且門檻方向語意正確', () => {
    expect(EXERCISES).toHaveLength(5)
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(5)
    expect(ids).toEqual([
      'squat',
      'sit-to-stand',
      'calf-raise',
      'march',
      'wall-pushup'
    ])

    for (const ex of EXERCISES) {
      expect(ex.nameZh.trim().length).toBeGreaterThan(0)
      expect(ex.tier).toBe('beginner')
      expect(['side', 'front']).toContain(ex.view)
      expect(ex.targetsZh.length).toBeGreaterThan(0)
      expect(ex.stepsZh.length).toBeGreaterThanOrEqual(2)
      expect(ex.stepsZh.length).toBeLessThanOrEqual(4)
      expect(ex.safetyZh.trim().length).toBeGreaterThan(0)

      // R14 inline SVG 檢查：viewBox 120x180、無 base64、無外部圖檔
      expect(ex.figureSvg).toContain('<svg')
      expect(ex.figureSvg).toContain('viewBox="0 0 120 180"')
      expect(ex.figureSvg.toLowerCase()).not.toContain('base64')
      expect(ex.figureSvg.toLowerCase()).not.toContain('http://')
      expect(ex.figureSvg.toLowerCase()).not.toContain('https://')

      if (ex.id === 'squat') {
        expect(ex.engine.kind).toBe('squat')
      } else {
        expect(ex.engine.kind).toBe('cycle')
        if (ex.engine.kind !== 'cycle') throw new Error('expected cycle')
        const { rules } = ex.engine
        expect(rules.rules_version.trim().length).toBeGreaterThan(0)
        if (rules.direction === 'down') {
          expect(rules.exitThreshold).toBeGreaterThan(rules.enterThreshold)
          expect(rules.enterThreshold).toBeGreaterThan(rules.bottomThreshold)
        } else {
          expect(rules.exitThreshold).toBeLessThan(rules.enterThreshold)
          expect(rules.enterThreshold).toBeLessThan(rules.bottomThreshold)
        }
      }

      expect(getExercise(ex.id)).toEqual(ex)
    }

    expect(getExercise('non-existent')).toBeNull()
  })
})
