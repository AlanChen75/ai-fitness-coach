// 真實影片回歸測試：2026-11-17 兩支健身房實拍坐姿划船影片（斜側面）
// 使用 pose_landmarker_lite.task 與 elbowAngleMetric 相同邏輯離線重算序列：
// 影片 A 實際 12 次，影片 B 實際 8 次（含一次中途停頓於約 137 度後繼續拉到底）。
import { describe, expect, it } from 'vitest'
import { createCycleState, stepCycle } from '../src/engine/cycle-fsm'
import type { CycleRules } from '../src/engine/cycle-fsm'
import { getExercise } from '../src/exercises/catalog'
import videoAFixture from './fixtures/seated-row-video-a-metric.json'
import videoBFixture from './fixtures/seated-row-video-b-metric.json'

interface FixtureRow {
  readonly t: number
  readonly v: number | null
}

function getSeatedRowRules(): CycleRules {
  const exercise = getExercise('seated-row')
  if (exercise === null || exercise.engine.kind !== 'cycle') {
    throw new Error('seated-row must use cycle engine')
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

describe('seated-row real-video regression', () => {
  it('counts all 12 actual reps in video A', () => {
    const rules = getSeatedRowRules()
    const { complete, uncertain } = runSequence(videoAFixture as FixtureRow[], rules)
    expect(complete + uncertain).toBe(12)
    expect(complete).toBeGreaterThanOrEqual(11)
  })

  it('counts all 8 actual reps in video B (without double-counting the midway pause)', () => {
    const rules = getSeatedRowRules()
    const { complete, uncertain } = runSequence(videoBFixture as FixtureRow[], rules)
    expect(complete + uncertain).toBe(8)
    expect(complete).toBeGreaterThanOrEqual(7)
  })

  it('counts 0 reps when video B angles are clamped to >= 135 (half-range pull)', () => {
    const rules = getSeatedRowRules()
    const clamped = (videoBFixture as FixtureRow[]).map((row) => ({
      t: row.t,
      v: row.v === null ? null : Math.max(135, row.v)
    }))
    const { complete, uncertain } = runSequence(clamped, rules)
    expect(complete + uncertain).toBe(0)
  })

  it('does not double-count synthetic pause sequence 170 -> 109 -> 137 (600ms) -> 109 -> 170', () => {
    const rules = getSeatedRowRules()
    const values = [
      // 校準 1200ms (>= calibrationMs 1000)
      170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
      // 下拉到底
      155, 140, 125, 109, 109,
      // 回升到 137 停頓 600ms（6 筆 @ 100ms）
      137, 137, 137, 137, 137, 137,
      // 繼續拉回 109 後完全伸直回 170
      120, 109, 109, 135, 155, 170, 170
    ]
    const rows: FixtureRow[] = values.map((v, idx) => ({ t: idx * 100, v }))
    const { complete, uncertain } = runSequence(rows, rules)
    expect(complete + uncertain).toBe(1)
    expect(complete).toBe(1)
  })

  it('still captures all 12 reps in video A when 3 consecutive bottom samples (~300ms) are null', () => {
    const rules = getSeatedRowRules()
    // 影片 A 第 3 下底點區間（t = 8498..8698）連續 3 筆設為 null 模擬短暫追蹤中斷
    const gapRows = (videoAFixture as FixtureRow[]).map((row, index) =>
      index >= 85 && index <= 87 ? { ...row, v: null } : row
    )
    const { complete, uncertain } = runSequence(gapRows, rules)
    expect(complete + uncertain).toBe(12)
  })
})
