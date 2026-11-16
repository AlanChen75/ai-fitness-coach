import { describe, expect, it } from 'vitest'
import {
  createCycleState,
  getCycleSetStats,
  stepCycle,
  type CycleRules,
  type CycleSample
} from '../src/engine/cycle-fsm'

const DOWN_ABS_RULES: CycleRules = {
  rules_version: 'test-down-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 110,
  exitThreshold: 160,
  calibrationMs: 1000,
  minRepMs: 600,
  minBottomSamples: 3,
  maxGapMs: 300,
  invalidResetMs: 1000
}

const CALF_RAISE_RULES: CycleRules = {
  rules_version: 'calf-raise-v0.1',
  direction: 'up',
  thresholdMode: 'baseline-delta',
  enterThreshold: 0.03,
  bottomThreshold: 0.05,
  exitThreshold: 0.015,
  calibrationMs: 1000,
  minRepMs: 600,
  minBottomSamples: 3,
  maxGapMs: 300,
  invalidResetMs: 1000
}

function runSequence(rules: CycleRules, samples: readonly CycleSample[]) {
  let state = createCycleState(rules)
  const events = []
  for (const s of samples) {
    const res = stepCycle(state, s, rules)
    state = res.state
    events.push(...res.events)
  }
  return { state, events }
}

function makeCalibrationSamples(
  startMs: number,
  durationMs: number,
  stepMs: number,
  value: number
): CycleSample[] {
  const out: CycleSample[] = []
  for (let t = startMs; t <= startMs + durationMs; t += stepMs) {
    out.push({ t_ms: t, value, valid: true })
  }
  return out
}

describe('Cycle FSM (R11 / R15 T15.1-T15.6)', () => {
  it('T15.1: cycle down/absolute 完整膝角循環應計 1 complete 且 peak_value 正確', () => {
    const cal = makeCalibrationSamples(0, 1000, 50, 175)
    const values = [
      168, 155, 145, 132, 118,
      105, 96, 88, 95, 104,
      120, 138, 152, 165, 172
    ]
    const cycle: CycleSample[] = values.map((value, i) => ({
      t_ms: 1050 + i * 60,
      value,
      valid: true
    }))

    const { state, events } = runSequence(DOWN_ABS_RULES, [...cal, ...cycle])
    const completes = events.filter((e) => e.type === 'rep_complete')

    expect(state.phase).toBe('READY')
    expect(completes).toHaveLength(1)
    expect(state.reps).toHaveLength(1)
    expect(state.reps[0].status).toBe('complete')
    expect(state.reps[0].peak_value).toBe(88)
    expect(state.reps[0].tempo_ms).toBe(state.reps[0].end_ms - state.reps[0].start_ms)
    expect(state.reps[0].tempo_ms).toBeGreaterThanOrEqual(DOWN_ABS_RULES.minRepMs)
    expect(state.reps[0].tracking_gap_ms).toBe(0)
  })

  it('T15.2: 指標在 enter 門檻附近抖動不產生 rep', () => {
    const cal = makeCalibrationSamples(0, 1000, 50, 175)
    // 在 enterThreshold=150 兩側 146..155 抖動，未觸及 bottomThreshold=110，最後回到 166
    const jitterValues = [
      154, 148, 153, 147, 155, 146, 152, 149, 156, 166
    ]
    const jitter: CycleSample[] = jitterValues.map((value, i) => ({
      t_ms: 1050 + i * 80,
      value,
      valid: true
    }))

    const { state, events } = runSequence(DOWN_ABS_RULES, [...cal, ...jitter])
    const repEvents = events.filter(
      (e) => e.type === 'rep_complete' || e.type === 'rep_uncertain'
    )

    expect(state.phase).toBe('READY')
    expect(state.reps).toHaveLength(0)
    expect(repEvents).toHaveLength(0)
  })

  it('T15.3: 過快循環 (< minRepMs) 不計數（與深蹲同語意）', () => {
    const cal = makeCalibrationSamples(0, 1000, 50, 175)
    // 完整深蹲但總時長僅 400ms (< 600ms)
    const fastValues = [140, 105, 95, 95, 105, 135, 165]
    const fastCycle: CycleSample[] = fastValues.map((value, i) => ({
      t_ms: 1050 + i * 50,
      value,
      valid: true
    }))

    const { state, events } = runSequence(DOWN_ABS_RULES, [...cal, ...fastCycle])
    const repEvents = events.filter(
      (e) => e.type === 'rep_complete' || e.type === 'rep_uncertain'
    )

    expect(state.phase).toBe('READY')
    expect(state.reps).toHaveLength(0)
    expect(repEvents).toHaveLength(0)
  })

  it('T15.4: 循環中追蹤缺口 350ms (> maxGapMs 300ms) 該 rep 標為 uncertain', () => {
    const cal = makeCalibrationSamples(0, 1000, 50, 175)
    const cycle: CycleSample[] = [
      { t_ms: 1050, value: 145, valid: true },
      { t_ms: 1100, value: 125, valid: true },
      // 缺口 1150..1450 (於 1500 恢復，gap = 1500 - 1150 = 350ms)
      { t_ms: 1150, value: null, valid: false },
      { t_ms: 1250, value: null, valid: false },
      { t_ms: 1350, value: null, valid: false },
      { t_ms: 1450, value: null, valid: false },
      { t_ms: 1500, value: 100, valid: true },
      { t_ms: 1560, value: 95, valid: true },
      { t_ms: 1620, value: 98, valid: true },
      { t_ms: 1700, value: 130, valid: true },
      { t_ms: 1800, value: 168, valid: true }
    ]

    const { state, events } = runSequence(DOWN_ABS_RULES, [...cal, ...cycle])
    const uncertainEvents = events.filter((e) => e.type === 'rep_uncertain')

    expect(state.phase).toBe('READY')
    expect(state.reps).toHaveLength(1)
    expect(state.reps[0].status).toBe('uncertain')
    expect(state.reps[0].tracking_gap_ms).toBe(350)
    expect(state.reps[0].reason).toBe('tracking_gap_exceeded')
    expect(uncertainEvents).toHaveLength(1)

    const stats = getCycleSetStats(state)
    expect(stats.total_tracking_gap_ms).toBe(350)
    expect(stats.total_sample_count).toBe(cal.length + cycle.length)
  })

  it('T15.5: 連續 invalid 1100ms (> invalidResetMs 1000ms) 重置並將進行中 rep 以 uncertain 結算', () => {
    const cal = makeCalibrationSamples(0, 1000, 50, 175)
    const partial: CycleSample[] = [
      { t_ms: 1050, value: 145, valid: true },
      { t_ms: 1100, value: 105, valid: true },
      { t_ms: 1150, value: 95, valid: true }
    ]
    const invalidStreak: CycleSample[] = []
    for (let t = 1200; t <= 2300; t += 100) {
      invalidStreak.push({ t_ms: t, value: null, valid: false })
    }

    const { state, events } = runSequence(DOWN_ABS_RULES, [
      ...cal,
      ...partial,
      ...invalidStreak
    ])

    expect(state.phase).toBe('NOT_READY')
    expect(state.reps).toHaveLength(1)
    expect(state.reps[0].status).toBe('uncertain')
    expect(state.reps[0].reason).toBe('invalid_streak_exceeded')
    expect(state.reps[0].tracking_gap_ms).toBeGreaterThan(1000)

    const resetChange = events.find(
      (e) => e.type === 'state_change' && e.to === 'NOT_READY'
    )
    expect(resetChange).toBeDefined()
    expect(resetChange?.reason).toBe('invalid_streak_exceeded')
  })

  it('T15.6: baseline-delta + up (提踵參數) 校準後上升 0.06 再回落應計 1 complete', () => {
    // 校準段含穩定值與微幅雜訊，中位數應為 -0.80
    const calValues = [
      -0.80, -0.80, -0.799, -0.801, -0.80, -0.80, -0.798, -0.802, -0.80, -0.80,
      -0.80, -0.80, -0.80, -0.80, -0.80, -0.80, -0.80, -0.80, -0.80, -0.80, -0.80
    ]
    const cal: CycleSample[] = calValues.map((value, i) => ({
      t_ms: i * 50,
      value,
      valid: true
    }))

    // 從 baseline (-0.80) 上升 +0.06 到 -0.74 再回落（動作時長 >= 600ms）
    const deltas = [0.02, 0.035, 0.045, 0.055, 0.06, 0.058, 0.04, 0.02, 0.01, 0.0]
    const cycle: CycleSample[] = deltas.map((d, i) => ({
      t_ms: 1050 + i * 100,
      value: -0.80 + d,
      valid: true
    }))

    const { state, events } = runSequence(CALF_RAISE_RULES, [...cal, ...cycle])
    const completes = events.filter((e) => e.type === 'rep_complete')

    expect(state.baseline).toBeCloseTo(-0.80, 6)
    expect(state.phase).toBe('READY')
    expect(completes).toHaveLength(1)
    expect(state.reps[0].status).toBe('complete')
    expect(state.reps[0].peak_value).toBeCloseTo(0.06, 6)
  })

  it('補充驗證：純函式不可變性，同一序列跑兩次結果完全一致', () => {
    const cal = makeCalibrationSamples(0, 1000, 50, 175)
    const cycle: CycleSample[] = [140, 105, 95, 95, 105, 140, 170].map((value, i) => ({
      t_ms: 1050 + i * 100,
      value,
      valid: true
    }))
    const seq = [...cal, ...cycle]

    const initialSnapshot = createCycleState(DOWN_ABS_RULES)
    const run1 = runSequence(DOWN_ABS_RULES, seq)
    const run2 = runSequence(DOWN_ABS_RULES, seq)

    expect(run1).toEqual(run2)
    expect(createCycleState(DOWN_ABS_RULES)).toEqual(initialSnapshot)
  })
})
