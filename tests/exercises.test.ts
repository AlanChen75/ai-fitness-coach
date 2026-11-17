import { describe, expect, it } from 'vitest'
import { createCycleState, stepCycle, type CycleRules, type CycleSample } from '../src/engine/cycle-fsm'
import type { NormalizedLandmark } from '../src/engine/types'
import { EXERCISES, TIER_LABELS, getExercise } from '../src/exercises/catalog'
import {
  SUPPORTED_METRIC_IDS,
  computeMetric,
  elbowAngleMetric,
  hipDropMetric,
  hipLiftMetric,
  kneeAngleMetric,
  kneeLiftMetric,
  legAbductionMetric,
  shoulderRiseMetric,
  torsoLeanMetric,
  wristRaiseMetric
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

  it('T4b.1: 5 個新指標於正向案例回傳正確符號與量級，可見度不足回 invalid 且永不 NaN', () => {
    const makeStanding = (): NormalizedLandmark[] => {
      const lms = makeBaseLandmarks()
      // 軀幹長 = 0.3 (肩 y=0.2, 髖 y=0.5)
      setPoint(lms, 11, 0.42, 0.2)
      setPoint(lms, 12, 0.58, 0.2)
      setPoint(lms, 13, 0.4, 0.36)
      setPoint(lms, 14, 0.6, 0.36)
      setPoint(lms, 15, 0.4, 0.5)
      setPoint(lms, 16, 0.6, 0.5)
      setPoint(lms, 23, 0.44, 0.5)
      setPoint(lms, 24, 0.56, 0.5)
      setPoint(lms, 25, 0.44, 0.7)
      setPoint(lms, 26, 0.56, 0.7)
      setPoint(lms, 27, 0.44, 0.88)
      setPoint(lms, 28, 0.56, 0.88)
      return lms
    }

    // 1. legAbduction: 直立為 0；右側腳踝向外展 0.15 -> 0.15 / 0.3 = 0.5
    const abdNeutral = makeStanding()
    const abdRaised = makeStanding()
    setPoint(abdRaised, 28, 0.71, 0.84)
    expect(legAbductionMetric(abdNeutral).value!).toBeCloseTo(0, 5)
    expect(legAbductionMetric(abdRaised).value!).toBeCloseTo(0.5, 5)
    expect(computeMetric('legAbduction', abdRaised).value!).toBeCloseTo(0.5, 5)

    // 2. hipDrop: 蹲下 hipY 變大 -> 值上升（baseline-delta 扣基線後 > 0.25）
    const squatStand = makeStanding()
    const squatDown = makeStanding()
    setPoint(squatDown, 11, 0.42, 0.35)
    setPoint(squatDown, 12, 0.58, 0.35)
    setPoint(squatDown, 23, 0.44, 0.65)
    setPoint(squatDown, 24, 0.56, 0.65)
    const dropStand = hipDropMetric(squatStand)
    const dropLow = hipDropMetric(squatDown)
    expect(dropStand.valid && dropLow.valid).toBe(true)
    expect(dropLow.value! - dropStand.value!).toBeCloseTo(0.5, 5)

    // 3. hipLift: 躺姿抬臀 hipY 變小 -> -(midHipY)/torsoLen 上升
    const bridgeFlat = makeStanding()
    setPoint(bridgeFlat, 11, 0.25, 0.8)
    setPoint(bridgeFlat, 12, 0.25, 0.82)
    setPoint(bridgeFlat, 23, 0.55, 0.8)
    setPoint(bridgeFlat, 24, 0.55, 0.82)
    const bridgeUp = makeStanding()
    setPoint(bridgeUp, 11, 0.25, 0.8)
    setPoint(bridgeUp, 12, 0.25, 0.82)
    setPoint(bridgeUp, 23, 0.55, 0.72)
    setPoint(bridgeUp, 24, 0.55, 0.74)
    const liftFlat = hipLiftMetric(bridgeFlat)
    const liftUp = hipLiftMetric(bridgeUp)
    expect(liftFlat.valid && liftUp.valid).toBe(true)
    expect(liftUp.value! - liftFlat.value!).toBeGreaterThan(0.2)

    // 4. wristRaise: 雙手垂放為負、雙手高舉過頭為正
    const armsDown = makeStanding()
    const armsUp = makeStanding()
    setPoint(armsUp, 15, 0.42, 0.02)
    setPoint(armsUp, 16, 0.58, 0.02)
    expect(wristRaiseMetric(armsDown).value!).toBeCloseTo(-1.0, 5)
    expect(wristRaiseMetric(armsUp).value!).toBeCloseTo(0.6, 5)

    // 5. torsoLean: 直立約 0 度；45 度前傾約 45 度；60 度前傾約 60 度
    const upright = makeStanding()
    const lean60 = makeStanding()
    setPoint(lean60, 11, 0.5 + 0.3 * Math.sin((60 * Math.PI) / 180), 0.5 - 0.3 * Math.cos((60 * Math.PI) / 180))
    setPoint(lean60, 12, 0.5 + 0.3 * Math.sin((60 * Math.PI) / 180), 0.5 - 0.3 * Math.cos((60 * Math.PI) / 180))
    setPoint(lean60, 23, 0.5, 0.5)
    setPoint(lean60, 24, 0.5, 0.5)
    expect(torsoLeanMetric(upright).value!).toBeCloseTo(0, 5)
    expect(torsoLeanMetric(lean60).value!).toBeCloseTo(60, 3)

    // 可見度不足 (< 0.5) 一律回 invalid
    const lowVisAnkle = makeStanding()
    setPoint(lowVisAnkle, 28, 0.56, 0.88, 0.2)
    expect(legAbductionMetric(lowVisAnkle)).toEqual({ value: null, valid: false })

    const lowVisWrist = makeStanding()
    setPoint(lowVisWrist, 15, 0.4, 0.5, 0.2)
    expect(wristRaiseMetric(lowVisWrist)).toEqual({ value: null, valid: false })

    const lowVisHip = makeStanding()
    setPoint(lowVisHip, 23, 0.44, 0.5, 0.2)
    expect(hipDropMetric(lowVisHip)).toEqual({ value: null, valid: false })
    expect(hipLiftMetric(lowVisHip)).toEqual({ value: null, valid: false })
    expect(torsoLeanMetric(lowVisHip)).toEqual({ value: null, valid: false })

    // 退化/空陣列/NaN 座標永不回傳 NaN
    const degenerate = makeStanding()
    setPoint(degenerate, 11, 0.5, 0.5)
    setPoint(degenerate, 12, 0.5, 0.5)
    setPoint(degenerate, 23, 0.5, 0.5)
    setPoint(degenerate, 24, 0.5, 0.5)

    const nanPoints = makeStanding()
    setPoint(nanPoints, 11, Number.NaN, 0.2)
    setPoint(nanPoints, 12, Number.NaN, 0.2)

    const torsoDependentMetrics = [
      'shoulderRise',
      'kneeLift',
      'legAbduction',
      'hipDrop',
      'hipLift',
      'wristRaise',
      'torsoLean'
    ] as const

    for (const metricId of torsoDependentMetrics) {
      expect(computeMetric(metricId, degenerate)).toEqual({ value: null, valid: false })
    }

    for (const metricId of SUPPORTED_METRIC_IDS) {
      for (const bad of [[], nanPoints]) {
        const sample = computeMetric(metricId, bad)
        expect(sample).toEqual({ value: null, valid: false })
        expect(Number.isNaN(sample.value)).toBe(false)
      }
      const degSample = computeMetric(metricId, degenerate)
      expect(Number.isNaN(degSample.value)).toBe(false)
    }
  })

  it('T4b.2 & 5B.R1 & 6.R1: catalog 恰 24 筆、各 tier 6 筆、5 筆 demoOnly 含 steps、seated-row 為 cycle/elbowAngle、id 唯一、metric 支援與欄位合規', () => {
    expect(EXERCISES).toHaveLength(24)
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(24)
    expect(TIER_LABELS.machine).toBe('器械')

    const expectedBeginner = [
      'squat',
      'sit-to-stand',
      'calf-raise',
      'march',
      'wall-pushup',
      'side-leg-raise'
    ]
    const expectedIntermediate = [
      'lunge',
      'knee-pushup',
      'sumo-squat',
      'glute-bridge',
      'jumping-jack',
      'high-knees'
    ]
    const expectedAdvanced = [
      'pushup',
      'jump-squat',
      'jump-lunge',
      'bulgarian-split-squat',
      'single-leg-rdl',
      'pistol-squat'
    ]
    const expectedMachine = [
      'lat-pulldown',
      'chest-press-machine',
      'seated-row',
      'leg-press',
      'shoulder-press-machine',
      'leg-extension'
    ]

    expect(EXERCISES.filter((e) => e.tier === 'beginner').map((e) => e.id)).toEqual(
      expectedBeginner
    )
    expect(EXERCISES.filter((e) => e.tier === 'intermediate').map((e) => e.id)).toEqual(
      expectedIntermediate
    )
    expect(EXERCISES.filter((e) => e.tier === 'advanced').map((e) => e.id)).toEqual(
      expectedAdvanced
    )
    expect(EXERCISES.filter((e) => e.tier === 'machine').map((e) => e.id)).toEqual(
      expectedMachine
    )

    const demoExercises = EXERCISES.filter((e) => e.demoOnly === true)
    expect(demoExercises).toHaveLength(5)
    expect(demoExercises.map((e) => e.id)).toEqual(
      expectedMachine.filter((id) => id !== 'seated-row')
    )

    const seatedRow = getExercise('seated-row')
    expect(seatedRow).not.toBeNull()
    expect(seatedRow?.demoOnly).toBeUndefined()
    expect(seatedRow?.engine.kind).toBe('cycle')
    if (seatedRow?.engine.kind === 'cycle') {
      expect(seatedRow.engine.metric).toBe('elbowAngle')
      expect(seatedRow.engine.rules.rules_version).toBe('seated-row-v0.1')
    }
    expect(seatedRow?.framingRegions).toEqual(['upper', 'hips'])

    // 準備一組所有關節皆有效且有軀幹長度的合成 landmarks 驗證每個 metricId
    const validLandmarks = makeBaseLandmarks()
    setPoint(validLandmarks, 11, 0.42, 0.2)
    setPoint(validLandmarks, 12, 0.58, 0.2)
    setPoint(validLandmarks, 13, 0.4, 0.35)
    setPoint(validLandmarks, 14, 0.6, 0.35)
    setPoint(validLandmarks, 15, 0.4, 0.5)
    setPoint(validLandmarks, 16, 0.6, 0.5)
    setPoint(validLandmarks, 23, 0.44, 0.5)
    setPoint(validLandmarks, 24, 0.56, 0.5)
    setPoint(validLandmarks, 25, 0.44, 0.72)
    setPoint(validLandmarks, 26, 0.56, 0.72)
    setPoint(validLandmarks, 27, 0.44, 0.92)
    setPoint(validLandmarks, 28, 0.56, 0.92)

    const existingIds = new Set(['squat', 'sit-to-stand', 'calf-raise', 'march', 'wall-pushup'])

    for (const ex of EXERCISES) {
      expect(ex.nameZh.trim().length).toBeGreaterThan(0)
      expect(['beginner', 'intermediate', 'advanced', 'machine']).toContain(ex.tier)
      expect(['side', 'front']).toContain(ex.view)
      expect(ex.targetsZh.length).toBeGreaterThanOrEqual(2)
      expect(ex.targetsZh.length).toBeLessThanOrEqual(3)

      if (ex.demoOnly) {
        expect(ex.tier).toBe('machine')
        expect(ex.steps).toBeDefined()
        expect(ex.steps!.length).toBeGreaterThanOrEqual(3)
        expect(ex.steps!.length).toBeLessThanOrEqual(4)
        for (const step of ex.steps!) {
          expect(step.trim().length).toBeGreaterThan(0)
        }
        expect(ex.engine.kind).toBe('demo')
        expect(getExercise(ex.id)).toEqual(ex)
        continue
      }

      expect(ex.stepsZh.length).toBeGreaterThanOrEqual(2)
      expect(ex.stepsZh.length).toBeLessThanOrEqual(4)
      expect(ex.safetyZh.trim().length).toBeGreaterThan(0)
      expect(ex.framingRegions.length).toBeGreaterThan(0)

      if (ex.figureSvg !== '') {
        expect(ex.figureSvg).toContain('<svg')
        expect(ex.figureSvg).toContain('viewBox="0 0 120 180"')
        expect(ex.figureSvg.toLowerCase()).not.toContain('base64')
        expect(ex.figureSvg.toLowerCase()).not.toContain('http://')
        expect(ex.figureSvg.toLowerCase()).not.toContain('https://')
      }

      if (ex.id === 'squat') {
        expect(ex.engine.kind).toBe('squat')
      } else {
        expect(ex.engine.kind).toBe('cycle')
        if (ex.engine.kind !== 'cycle') throw new Error('expected cycle')
        const { metric, rules } = ex.engine
        expect(SUPPORTED_METRIC_IDS).toContain(metric)
        const metricProbe = computeMetric(metric, validLandmarks)
        expect(metricProbe.valid).toBe(true)
        expect(typeof metricProbe.value).toBe('number')
        expect(Number.isFinite(metricProbe.value)).toBe(true)

        expect(rules.rules_version.startsWith(`${ex.id}-`)).toBe(true)
        if (!existingIds.has(ex.id)) {
          expect(rules.rules_version).toBe(`${ex.id}-v0.1`)
        }
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

  it('T4b.3: 13 個新動作各合成「校準 + 2 次標準循環」樣本流皆能數到 2 次 complete', () => {
    const newIds = [
      'side-leg-raise',
      'lunge',
      'knee-pushup',
      'sumo-squat',
      'glute-bridge',
      'jumping-jack',
      'high-knees',
      'pushup',
      'jump-squat',
      'jump-lunge',
      'bulgarian-split-squat',
      'single-leg-rdl',
      'pistol-squat'
    ]

    function buildStream(rules: CycleRules): CycleSample[] {
      const baseline =
        rules.thresholdMode === 'baseline-delta'
          ? 0.5
          : rules.direction === 'down'
            ? rules.exitThreshold + 12
            : rules.exitThreshold - 0.5
      const span = Math.abs(rules.bottomThreshold - rules.enterThreshold)
      const stepDelta = Math.max(span * 0.6, 0.05)

      const readyVal = baseline
      const enterVal =
        rules.thresholdMode === 'baseline-delta'
          ? baseline + (rules.enterThreshold + rules.bottomThreshold) / 2
          : (rules.enterThreshold + rules.bottomThreshold) / 2
      const bottomVal =
        rules.thresholdMode === 'baseline-delta'
          ? baseline + rules.bottomThreshold + stepDelta
          : rules.direction === 'down'
            ? rules.bottomThreshold - stepDelta
            : rules.bottomThreshold + stepDelta
      const returnVal =
        rules.thresholdMode === 'baseline-delta'
          ? baseline + (rules.exitThreshold + rules.enterThreshold) / 2
          : (rules.exitThreshold + rules.enterThreshold) / 2
      const exitVal =
        rules.thresholdMode === 'baseline-delta'
          ? baseline + rules.exitThreshold - 0.03
          : rules.direction === 'down'
            ? rules.exitThreshold + 8
            : rules.exitThreshold - 0.2

      const samples: CycleSample[] = []
      let t = 0
      // 校準 1100ms (>= calibrationMs 1000)
      for (let i = 0; i <= 11; i++) {
        samples.push({ t_ms: t, value: readyVal, valid: true })
        t += 100
      }

      const dt = Math.max(80, Math.ceil((rules.minRepMs + 200) / 6))
      const bottomSamples = Array.from({ length: rules.minBottomSamples + 1 }, () => bottomVal)
      const oneCycle = [enterVal, ...bottomSamples, returnVal, exitVal]

      for (let rep = 0; rep < 2; rep++) {
        for (const v of oneCycle) {
          samples.push({ t_ms: t, value: v, valid: true })
          t += dt
        }
        samples.push({ t_ms: t, value: readyVal, valid: true })
        t += dt
      }
      return samples
    }

    for (const id of newIds) {
      const ex = getExercise(id)
      expect(ex).not.toBeNull()
      if (!ex || ex.engine.kind !== 'cycle') throw new Error(`expected cycle exercise: ${id}`)

      const samples = buildStream(ex.engine.rules)
      let state = createCycleState(ex.engine.rules)
      let completeCount = 0
      for (const s of samples) {
        const res = stepCycle(state, s, ex.engine.rules)
        state = res.state
        for (const ev of res.events) {
          if (ev.type === 'rep_complete') completeCount += 1
        }
      }

      expect(completeCount).toBe(2)
      expect(state.reps.filter((r) => r.status === 'complete')).toHaveLength(2)
    }

    // 額外用真實幾何 landmarks 驅動 5 個新指標 + 對應 rules，驗證符號與門檻完全一致
    const buildAbductionPose = (ankleOffsetX: number): NormalizedLandmark[] => {
      const lms = makeBaseLandmarks()
      setPoint(lms, 11, 0.42, 0.2)
      setPoint(lms, 12, 0.58, 0.2)
      setPoint(lms, 23, 0.44, 0.5)
      setPoint(lms, 24, 0.56, 0.5)
      setPoint(lms, 27, 0.44, 0.9)
      setPoint(lms, 28, 0.56 + ankleOffsetX, 0.9)
      return lms
    }

    const sideLegEx = getExercise('side-leg-raise')!
    if (sideLegEx.engine.kind !== 'cycle') throw new Error('expected cycle')
    let legState = createCycleState(sideLegEx.engine.rules)
    let legT = 0
    for (let i = 0; i <= 10; i++) {
      const m = computeMetric('legAbduction', buildAbductionPose(0))
      legState = stepCycle(legState, { t_ms: legT, value: m.value, valid: m.valid }).state
      legT += 100
    }
    for (let rep = 0; rep < 2; rep++) {
      for (const offset of [0.06, 0.12, 0.14, 0.06, 0.01]) {
        const m = computeMetric('legAbduction', buildAbductionPose(offset))
        legState = stepCycle(legState, { t_ms: legT, value: m.value, valid: m.valid }).state
        legT += 180
      }
    }
    expect(legState.reps.filter((r) => r.status === 'complete')).toHaveLength(2)
  })
})
