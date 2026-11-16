import { describe, expect, it } from 'vitest'
import {
  createCycleState,
  getCycleSetStats,
  stepCycle,
  type CycleFsmState,
  type CycleRepEvent,
  type CycleRules,
  type CycleSample
} from '../src/engine/cycle-fsm'
import { getExercise } from '../src/exercises/catalog'
import { buildCycleSetSummary, mapCycleRepToRep } from '../src/exercise-session'
import { toStoredSet } from '../src/storage'

function runCycleSamples(
  rules: CycleRules,
  samples: readonly CycleSample[]
): { readonly state: CycleFsmState; readonly repEvents: readonly CycleRepEvent[] } {
  let state = createCycleState(rules)
  const repEvents: CycleRepEvent[] = []
  for (const s of samples) {
    const res = stepCycle(state, s, rules)
    state = res.state
    for (const ev of res.events) {
      if (ev.type === 'rep_complete' || ev.type === 'rep_uncertain') {
        repEvents.push(ev)
      }
    }
  }
  return { state, repEvents }
}

function makeCalibration(
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

describe('Exercise Session Cycle-to-SetSummary mapping (R18)', () => {
  it('maps kneeAngle peak_value to min_knee_angle and preserves sit-to-stand metadata', () => {
    const ex = getExercise('sit-to-stand')!
    expect(ex.engine.kind).toBe('cycle')
    if (ex.engine.kind !== 'cycle') return

    const cal = makeCalibration(0, 1000, 100, 175)
    const values = [165, 145, 125, 105, 95, 98, 106, 130, 150, 168]
    const cycle: CycleSample[] = values.map((value, i) => ({
      t_ms: 1100 + i * 150,
      value,
      valid: true
    }))

    const { state, repEvents } = runCycleSamples(ex.engine.rules, [...cal, ...cycle])
    expect(repEvents).toHaveLength(1)

    let seq = 0
    const summary = buildCycleSetSummary({
      setId: 'set-sts-1',
      exercise: ex,
      state,
      reps: repEvents,
      idFactory: () => `rep-${++seq}`
    })

    const stats = getCycleSetStats(state)
    expect(summary.set_id).toBe('set-sts-1')
    expect(summary.exercise).toBe('sit-to-stand')
    expect(summary.view).toBe('side')
    expect(summary.rules_version).toBe(ex.engine.rules.rules_version)
    expect(summary.total_sample_count).toBe(stats.total_sample_count)
    expect(summary.valid_sample_count).toBe(stats.valid_sample_count)
    expect(summary.total_tracking_gap_ms).toBe(stats.total_tracking_gap_ms)

    expect(summary.reps).toHaveLength(1)
    const rep = summary.reps[0]
    expect(rep.rep_id).toBe('rep-1')
    expect(rep.status).toBe('complete')
    expect(rep.metrics.min_knee_angle).toBe(95)
    expect(rep.metrics.tempo_ms).toBe(repEvents[0].tempo_ms)
    expect(rep.quality.valid_sample_count).toBe(repEvents[0].valid_sample_count)
    expect(rep.quality.valid_sample_count).toBeGreaterThan(0)
    expect(rep.quality.tracking_gap_ms).toBe(0)
    expect(rep.reason).toBe('valid_cycle')
  })

  it('sets min_knee_angle to null for non-kneeAngle metrics (march front view & wall-pushup elbowAngle)', () => {
    const march = getExercise('march')!
    expect(march.engine.kind).toBe('cycle')
    if (march.engine.kind !== 'cycle') return

    // 真機幾何：站立 lift 約 -0.7，抬至髖部高度約 0 到 +0.1
    const cal = makeCalibration(0, 1000, 100, -0.7)
    const marchValues = [-0.3, -0.1, 0.1, -0.05, -0.3, -0.6]
    const marchCycle: CycleSample[] = marchValues.map((value, i) => ({
      t_ms: 1100 + i * 100,
      value,
      valid: true
    }))

    const { state, repEvents } = runCycleSamples(march.engine.rules, [...cal, ...marchCycle])
    expect(repEvents).toHaveLength(1)

    let seq = 0
    const summary = buildCycleSetSummary({
      setId: 'set-march-1',
      exercise: march,
      state,
      reps: repEvents,
      idFactory: () => `m-${++seq}`
    })

    expect(summary.exercise).toBe('march')
    expect(summary.view).toBe('front')
    expect(summary.rules_version).toBe('march-v0.2')
    expect(summary.reps).toHaveLength(1)
    expect(summary.reps[0].status).toBe('complete')
    expect(summary.reps[0].metrics.min_knee_angle).toBeNull()

    const wallPushupRep = mapCycleRepToRep(
      {
        start_ms: 1100,
        end_ms: 2100,
        status: 'complete',
        tempo_ms: 1000,
        peak_value: 102,
        tracking_gap_ms: 0,
        valid_sample_count: 10,
        reason: 'valid_cycle'
      },
      'elbowAngle',
      'wp-1'
    )
    expect(wallPushupRep.metrics.min_knee_angle).toBeNull()
    expect(wallPushupRep.quality.valid_sample_count).toBe(10)
  })

  it('never converts uncertain reps to complete and preserves gap/reason', () => {
    const calf = getExercise('calf-raise')!
    expect(calf.engine.kind).toBe('cycle')
    if (calf.engine.kind !== 'cycle') return

    const cal = makeCalibration(0, 1000, 100, -0.8)
    const cycleWithGap: CycleSample[] = [
      { t_ms: 1100, value: -0.76, valid: true },
      { t_ms: 1200, value: -0.74, valid: true },
      // 350ms gap (> maxGapMs 300)
      { t_ms: 1250, value: null, valid: false },
      { t_ms: 1450, value: null, valid: false },
      { t_ms: 1600, value: -0.73, valid: true },
      { t_ms: 1700, value: -0.74, valid: true },
      { t_ms: 1800, value: -0.78, valid: true },
      { t_ms: 1900, value: -0.79, valid: true }
    ]

    const { state, repEvents } = runCycleSamples(calf.engine.rules, [...cal, ...cycleWithGap])
    expect(repEvents).toHaveLength(1)
    expect(repEvents[0].status).toBe('uncertain')

    let seq = 0
    const summary = buildCycleSetSummary({
      setId: 'set-calf-1',
      exercise: calf,
      state,
      reps: repEvents,
      idFactory: () => `c-${++seq}`
    })

    expect(summary.exercise).toBe('calf-raise')
    expect(summary.view).toBe('side')
    expect(summary.rules_version).toBe('calf-raise-v0.1')
    expect(summary.reps).toHaveLength(1)
    expect(summary.reps[0].status).toBe('uncertain')
    expect(summary.reps[0].metrics.min_knee_angle).toBeNull()
    expect(summary.reps[0].quality.tracking_gap_ms).toBe(350)
    expect(summary.reps[0].reason).toBe('tracking_gap_exceeded')
    expect(summary.total_tracking_gap_ms).toBe(350)

    const stored = toStoredSet(summary, 'opfs://sessions/s1/set-calf-1.pose.jsonl')
    expect(stored.reps[0].status).toBe('uncertain')
    expect(stored.reps[0].pose_file_ref).toBe('opfs://sessions/s1/set-calf-1.pose.jsonl')
  })

  it('defaults to state.reps immutably when repEvents are omitted', () => {
    const sts = getExercise('sit-to-stand')!
    if (sts.engine.kind !== 'cycle') throw new Error('expected cycle')

    const cal = makeCalibration(0, 1000, 100, 175)
    const cycle: CycleSample[] = [145, 105, 92, 95, 102, 140, 170].map((value, i) => ({
      t_ms: 1100 + i * 200,
      value,
      valid: true
    }))
    const { state } = runCycleSamples(sts.engine.rules, [...cal, ...cycle])
    const snapshot = JSON.stringify(state)

    let seq = 0
    const summary = buildCycleSetSummary({
      setId: 'set-sts-2',
      exercise: sts,
      state,
      idFactory: () => `r-${++seq}`
    })

    expect(JSON.stringify(state)).toBe(snapshot)
    expect(summary.reps).toHaveLength(1)
    expect(summary.reps[0].metrics.min_knee_angle).toBe(92)
    expect(summary.reps[0].quality.valid_sample_count).toBe(0)
  })
})
