import { describe, expect, it } from 'vitest'
import { extractFeatures } from '../src/engine/features'
import {
  createRepEngineState,
  createSession,
  getSetSummary,
  processSample,
  processSampleBatch
} from '../src/engine/rep-engine'
import { createInitialFsmState, DEFAULT_SQUAT_RULES, step } from '../src/engine/squat-fsm'
import { SCHEMA_VERSION } from '../src/engine/types'
import {
  generateInvalidSamples,
  generateSquatCycle,
  generateStandingSamples,
  makePoseSample,
  makeSquatLandmarks
} from './fixtures'

function createTestEngine(setId = 'set-1') {
  let seq = 0
  return createRepEngineState({
    setId,
    idFactory: () => `rep-${++seq}`
  })
}

describe('Squat FSM & RepEngine (Test Matrix T1-T9)', () => {
  it('T1: 標準 3 下深蹲序列應計數 3 下且全部 complete，tempo 與 schema 正確', () => {
    const cal = generateStandingSamples(0, 1000, 50)
    const rep1 = generateSquatCycle({ startMs: 1050 })
    const pause1 = generateStandingSamples(rep1.endMs, 200, 50)
    const rep2 = generateSquatCycle({ startMs: rep1.endMs + 250 })
    const pause2 = generateStandingSamples(rep2.endMs, 200, 50)
    const rep3 = generateSquatCycle({ startMs: rep2.endMs + 250 })

    const allSamples = [...cal, ...rep1.samples, ...pause1, ...rep2.samples, ...pause2, ...rep3.samples]
    const result = processSampleBatch(createTestEngine(), allSamples)
    const summary = getSetSummary(result.state)

    expect(summary.reps).toHaveLength(3)
    expect(summary.reps.map((r) => r.rep_id)).toEqual(['rep-1', 'rep-2', 'rep-3'])
    for (const rep of summary.reps) {
      expect(rep.status).toBe('complete')
      expect(rep.metrics.tempo_ms).toBeGreaterThanOrEqual(DEFAULT_SQUAT_RULES.minRepDurationMs)
      expect(rep.metrics.tempo_ms).toBe(rep.end_ms - rep.start_ms)
      expect(rep.quality.tracking_gap_ms).toBe(0)
      expect(rep.reason).toBe('valid_squat_cycle')
    }
    expect(summary.rules_version).toBe('squat-side-v0.1')
    expect(summary.total_sample_count).toBe(allSamples.length)
    expect(summary.total_tracking_gap_ms).toBe(0)

    const session = createSession({
      sessionId: 'sess-1',
      deviceProfileId: 'oppo-reno2',
      startedAt: '2026-11-16T07:00:00Z',
      poseModel: 'pose_landmarker_lite',
      rulesVersion: summary.rules_version,
      camera: { facing: 'environment', width: 640, height: 480, frameRate: 15 },
      consent: { accepted: true, version: '0.1.0', timestamp: '2026-11-16T07:00:00Z' },
      sets: [summary]
    })
    expect(session.schema_version).toBe(SCHEMA_VERSION)
    expect(session.sets[0].reps).toHaveLength(3)
  })

  it('T2: 半蹲（最低只到 110 度，未達 bottomEnter）應 count=0 且能回到 STANDING', () => {
    const cal = generateStandingSamples(0, 1000, 50)
    const halfSquat = generateSquatCycle({
      startMs: 1050,
      bottomAngle: 110,
      descendSteps: 8,
      bottomSteps: 4,
      ascendSteps: 8
    })

    const result = processSampleBatch(createTestEngine(), [...cal, ...halfSquat.samples])
    const repEvents = result.events.filter(
      (e) => e.type === 'rep_complete' || e.type === 'rep_uncertain'
    )

    expect(result.state.reps).toHaveLength(0)
    expect(repEvents).toHaveLength(0)
    expect(result.state.fsm.phase).toBe('STANDING')
  })

  it('T3: 抖動（158-163 震盪與 <600ms 快速假動作）應 count=0', () => {
    const cal = generateStandingSamples(0, 1000, 50)
    const oscillation = Array.from({ length: 20 }, (_, i) =>
      makePoseSample(1050 + i * 50, { leftKneeAngleDeg: i % 2 === 0 ? 158 : 163 })
    )
    const resOsc = processSampleBatch(createTestEngine(), [...cal, ...oscillation])
    expect(resOsc.state.reps).toHaveLength(0)
    expect(resOsc.state.fsm.phase).toBe('STANDING')

    // R2.4 直接驗證：完整深度但在 400ms 內完成（< 600ms）視為抖動不計數
    const fastGlitch = generateSquatCycle({
      startMs: 1050,
      stepMs: 25,
      descendSteps: 4,
      bottomSteps: 4,
      ascendSteps: 4
    })
    const resFast = processSampleBatch(createTestEngine(), [...cal, ...fastGlitch.samples])
    expect(resFast.state.reps).toHaveLength(0)
  })

  it('T4: 下蹲途中遮擋 500ms（invalid 缺口 > 300ms）後完成，該下 status 應為 uncertain', () => {
    const cal = generateStandingSamples(0, 1000, 50)
    const occludedRep = generateSquatCycle({
      startMs: 1050,
      stepMs: 50,
      descendSteps: 10,
      bottomSteps: 8,
      ascendSteps: 10,
      invalidGap: {
        startOffsetMs: 300,
        durationMs: 500,
        mode: 'low_vis'
      }
    })

    const result = processSampleBatch(createTestEngine(), [...cal, ...occludedRep.samples])
    const summary = getSetSummary(result.state)

    expect(summary.reps).toHaveLength(1)
    expect(summary.reps[0].status).toBe('uncertain')
    expect(summary.reps[0].quality.tracking_gap_ms).toBe(500)
    expect(summary.total_tracking_gap_ms).toBe(500)
  })

  it('T5: 連續 invalid 1.2s 應退回 NOT_READY，且未完成 rep 以 uncertain 丟出', () => {
    const cal = generateStandingSamples(0, 1000, 50)
    // 開始下蹲進入 DESCENDING -> BOTTOM
    const partialDescent = [
      makePoseSample(1050, { leftKneeAngleDeg: 125 }),
      makePoseSample(1100, { leftKneeAngleDeg: 115 }),
      makePoseSample(1150, { leftKneeAngleDeg: 98 })
    ]
    const invalidStreak = generateInvalidSamples(1200, 1200, 50, 'low_vis')

    const result = processSampleBatch(createTestEngine(), [
      ...cal,
      ...partialDescent,
      ...invalidStreak
    ])

    expect(result.state.fsm.phase).toBe('NOT_READY')
    expect(result.state.reps).toHaveLength(1)
    expect(result.state.reps[0].status).toBe('uncertain')
    expect(result.state.reps[0].reason).toBe('invalid_streak_exceeded')
    expect(result.state.reps[0].quality.tracking_gap_ms).toBeGreaterThan(1000)

    const uncertainEvents = result.events.filter((e) => e.type === 'rep_uncertain')
    expect(uncertainEvents).toHaveLength(1)
  })

  it('T6: visibility 0.4 的幀應輸出 valid:false、角度為 null、無 NaN', () => {
    const lowVisLandmarks = makeSquatLandmarks({
      leftKneeAngleDeg: 120,
      rightKneeAngleDeg: 120,
      leftVisibility: 0.4,
      rightVisibility: 0.4,
      baseVisibility: 0.4
    })
    const features = extractFeatures(lowVisLandmarks, 0.4)

    expect(features.valid).toBe(false)
    expect(features.kneeAngle).toBeNull()
    expect(features.hipAngle).toBeNull()
    expect(features.leftKneeAngle).toBeNull()
    expect(features.rightKneeAngle).toBeNull()
    expect(features.leftHipAngle).toBeNull()
    expect(features.rightHipAngle).toBeNull()
    expect(features.hipY).toBeNull()
    expect(features.hipDisplacementRatio).toBeNull()
    expect(features.minVisibility).toBeCloseTo(0.4, 6)
    expect(Number.isNaN(features.minVisibility)).toBe(false)
  })

  it('T7: 同一序列跑兩次 step 鏈結果應完全相同（純函式與不可變性）', () => {
    const cal = generateStandingSamples(0, 1000, 50)
    const rep = generateSquatCycle({ startMs: 1050 })
    const featureSeq = [...cal, ...rep.samples].map((s) => ({
      t_ms: s.t_ms,
      features: extractFeatures(s.landmarks)
    }))

    const runChain = () => {
      let state = createInitialFsmState()
      const allEvents = []
      for (const item of featureSeq) {
        const res = step(state, item.features, item.t_ms)
        state = res.state
        allEvents.push(...res.events)
      }
      return { state, allEvents }
    }

    const initialSnapshot = createInitialFsmState()
    const run1 = runChain()
    const run2 = runChain()

    expect(run1).toEqual(run2)
    expect(createInitialFsmState()).toEqual(initialSnapshot)
  })

  it('T8: 左側清楚右側遮擋應選 side="left" 且角度取左側', () => {
    const landmarks = makeSquatLandmarks({
      leftKneeAngleDeg: 112,
      rightKneeAngleDeg: 170,
      leftVisibility: 0.94,
      rightVisibility: 0.25
    })
    const features = extractFeatures(landmarks)

    expect(features.valid).toBe(true)
    expect(features.side).toBe('left')
    expect(features.kneeAngle).not.toBeNull()
    expect(features.leftKneeAngle).not.toBeNull()
    expect(features.kneeAngle!).toBeCloseTo(112, 3)
    expect(features.kneeAngle).toBe(features.leftKneeAngle)
    expect(features.rightKneeAngle).toBeNull()
    expect(features.rightHipAngle).toBeNull()
  })

  it('T9: rep 完成事件帶的 quality 欄位 valid_sample_count 與 tracking_gap_ms 數值正確', () => {
    const cal = generateStandingSamples(0, 1000, 50)
    // 100ms invalid gap (<= 300ms) -> 仍為 complete，但 tracking_gap_ms=100
    const rep = generateSquatCycle({
      startMs: 1050,
      stepMs: 50,
      descendSteps: 8,
      bottomSteps: 5,
      ascendSteps: 8,
      invalidGap: {
        startOffsetMs: 250,
        durationMs: 100,
        mode: 'sample_invalid'
      }
    })
    // 計算預期進入 rep 期間的有效幀數（第 1 幀 kneeAngle=164.375 尚未 <130，不屬 activeRep）
    let engine = createTestEngine()
    for (const s of cal) {
      engine = processSample(engine, s).state
    }

    const batch = processSampleBatch(engine, rep.samples)
    const completeEvents = batch.events.filter((e) => e.type === 'rep_complete')
    expect(completeEvents).toHaveLength(1)

    const ev = completeEvents[0]
    if (ev.type !== 'rep_complete') throw new Error('expected rep_complete')

    // 進入 DESCENDING 後之有效樣本數：8+5+8=21 幀中，扣掉進入前 (>=130) 的幀與 2 幀 invalid（100ms / 50ms）
    const activeSamplesAfterEnter = rep.samples.filter((s) => s.t_ms >= ev.rep.start_ms && s.t_ms <= ev.rep.end_ms)
    const expectedValidCount = activeSamplesAfterEnter.filter((s) => s.valid).length

    expect(ev.quality.valid_sample_count).toBe(expectedValidCount)
    expect(ev.quality.tracking_gap_ms).toBe(100)
    expect(ev.rep.quality).toEqual(ev.quality)
  })

  it('補充驗證：校準後可計算髖部相對站立基線位移比且無 NaN', () => {
    const cal = generateStandingSamples(0, 1000, 50, 175)
    let engine = createTestEngine()
    for (const s of cal) {
      engine = processSample(engine, s).state
    }
    expect(engine.fsm.phase).toBe('STANDING')
    expect(engine.fsm.baselineHipY).not.toBeNull()

    const squatSample = makePoseSample(1100, { leftKneeAngleDeg: 95 })
    const res = processSample(engine, squatSample)
    expect(res.features.hipDisplacementRatio).not.toBeNull()
    expect(res.features.hipDisplacementRatio!).toBeGreaterThan(0)
  })
})
