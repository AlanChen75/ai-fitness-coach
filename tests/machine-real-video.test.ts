// 真實影片回歸測試：2026-11-17 健身房實拍滑輪下拉（影片 C）與器械划船（影片 D）
// 使用 pose_landmarker_lite.task 離線重算序列：
// - 影片 C（滑輪下拉，側面略斜）：實際共 9 次下拉，但第 1 下在錄影開始前已經拉下，狀態機尚未完成起始校準，正確可計數為 8 次。
// - 影片 D（器械划船，側面略斜手持拍攝）：實際共 12 次划船，最後 1 下影片結束時尚未回放，正確可計數為 11 次；後段幾下握把拉得較淺（手肘最深 135-144 度）。
import { describe, expect, it } from 'vitest'
import { createCycleState, stepCycle } from '../src/engine/cycle-fsm'
import type { CycleRules } from '../src/engine/cycle-fsm'
import { getExercise } from '../src/exercises/catalog'
import videoCFixture from './fixtures/lat-pulldown-video-c-metric.json'
import videoDFixture from './fixtures/machine-row-video-d-metric.json'

interface FixtureRow {
  readonly t: number
  readonly v: number | null
}

function getCycleRules(exerciseId: string): CycleRules {
  const exercise = getExercise(exerciseId)
  if (exercise === null || exercise.engine.kind !== 'cycle') {
    throw new Error(`${exerciseId} must use cycle engine`)
  }
  return exercise.engine.rules
}

function runSequence(
  rows: readonly FixtureRow[],
  rules: CycleRules
): {
  complete: number
  uncertain: number
} {
  let state = createCycleState(rules)
  for (const row of rows) {
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

describe('machine real-video regression (lat-pulldown & machine-row)', () => {
  it('counts 8 countable reps in video C (lat-pulldown; 1st of 9 started before calibration)', () => {
    const rules = getCycleRules('lat-pulldown')
    const { complete, uncertain } = runSequence(videoCFixture as FixtureRow[], rules)
    expect(complete + uncertain).toBe(8)
    expect(complete).toBeGreaterThanOrEqual(7)
  })

  it('counts 11 countable reps in video D (machine-row; 12th did not return before video end)', () => {
    const rules = getCycleRules('machine-row')
    const { complete, uncertain } = runSequence(videoDFixture as FixtureRow[], rules)
    expect(complete + uncertain).toBe(11)
    expect(complete).toBeGreaterThanOrEqual(10)
  })

  it('counts 0 reps when video C wristHeight is clamped to >= 0.5 (half-range pull)', () => {
    const rules = getCycleRules('lat-pulldown')
    const clamped = (videoCFixture as FixtureRow[]).map((row) => ({
      t: row.t,
      v: row.v === null ? null : Math.max(0.5, row.v)
    }))
    const { complete, uncertain } = runSequence(clamped, rules)
    expect(complete + uncertain).toBe(0)
  })

  it('counts 0 reps when video D elbowAngle is clamped to >= 155 (shallow pull)', () => {
    const rules = getCycleRules('machine-row')
    const clamped = (videoDFixture as FixtureRow[]).map((row) => ({
      t: row.t,
      v: row.v === null ? null : Math.max(155, row.v)
    }))
    const { complete, uncertain } = runSequence(clamped, rules)
    expect(complete + uncertain).toBe(0)
  })

  it('still captures all 11 reps in video D when 3 consecutive bottom samples (~300ms) are null', () => {
    const rules = getCycleRules('machine-row')
    // 影片 D 第 2 下底點區間（t = 7217..7417）連續 3 筆設為 null 模擬短暫追蹤中斷
    const gapRows = (videoDFixture as FixtureRow[]).map((row, index) =>
      index >= 72 && index <= 74 ? { ...row, v: null } : row
    )
    const { complete, uncertain } = runSequence(gapRows, rules)
    expect(complete + uncertain).toBe(11)
  })
})
