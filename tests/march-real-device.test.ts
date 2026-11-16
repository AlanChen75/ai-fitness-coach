// 真機回歸測試：2026-11-16 Xiaomi 13 Pro 踏步實測序列（session 6c41c6b2）
// 使用者實際抬腿 3 次（峰值 0.32 / 0.31 / 0.25），v0.1 門檻一次都沒算到。
// 此 fixture 為該序列的 kneeLift 指標值（由原始 PoseSequence 離線重算）。
import { describe, expect, it } from 'vitest'
import { createCycleState, stepCycle } from '../src/engine/cycle-fsm'
import type { CycleRules } from '../src/engine/cycle-fsm'
import { getExercise } from '../src/exercises/catalog'
import fixture from './fixtures/march-real-device-metric.json'

const MARCH_V01_RULES: CycleRules = {
  rules_version: 'march-v0.1',
  direction: 'up',
  thresholdMode: 'absolute',
  enterThreshold: 0.25,
  bottomThreshold: 0.4,
  exitThreshold: 0.15,
  calibrationMs: 1000,
  minRepMs: 400,
  minBottomSamples: 3,
  maxGapMs: 300,
  invalidResetMs: 1000
}

interface FixtureRow {
  readonly t: number
  readonly v: number | null
}

function runSequence(rules: CycleRules): {
  complete: number
  uncertain: number
} {
  let state = createCycleState(rules)
  for (const row of fixture as FixtureRow[]) {
    const res = stepCycle(state, {
      t_ms: row.t,
      value: row.v,
      valid: row.v !== null
    })
    state = res.state
  }
  const complete = state.reps.filter((r) => r.status === 'complete').length
  const uncertain = state.reps.filter((r) => r.status === 'uncertain').length
  return { complete, uncertain }
}

describe('march real-device regression (session 6c41c6b2)', () => {
  it('v0.1 rules reproduce the field failure: zero reps counted', () => {
    const { complete, uncertain } = runSequence(MARCH_V01_RULES)
    expect(complete).toBe(0)
    expect(uncertain).toBe(0)
  })

  it('calibrated catalog rules count the 3 actual raises (complete + uncertain)', () => {
    const exercise = getExercise('march')
    expect(exercise).not.toBeNull()
    if (exercise === null || exercise.engine.kind !== 'cycle') {
      throw new Error('march must use cycle engine')
    }
    const { complete, uncertain } = runSequence(exercise.engine.rules)
    // 寧漏不錯：允許部分因追蹤缺口標 uncertain，但總捕捉數必須是 3，
    // 且至少 2 次確定完成
    expect(complete + uncertain).toBe(3)
    expect(complete).toBeGreaterThanOrEqual(2)
  })
})
