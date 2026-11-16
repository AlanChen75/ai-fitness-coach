// R17.4 / R18 循環動作組別摘要與 Rep 映射（純函式、不可變、零 DOM）

import { getCycleSetStats } from './engine/cycle-fsm'
import type { CycleFsmState } from './engine/cycle-fsm'
import type { Rep, SetSummary } from './engine/types'
import type { ExerciseDef } from './exercises/catalog'
import type { MetricId } from './exercises/metrics'

export interface CycleRepInput {
  readonly start_ms: number
  readonly end_ms: number
  readonly status: 'complete' | 'uncertain'
  readonly tempo_ms: number
  readonly peak_value: number
  readonly tracking_gap_ms: number
  readonly reason: string
  readonly valid_sample_count?: number
}

export interface BuildCycleSetSummaryParams {
  readonly setId: string
  readonly exercise: ExerciseDef
  readonly state: CycleFsmState
  readonly idFactory: () => string
  readonly reps?: readonly CycleRepInput[]
}

/** 將單筆循環引擎 rep 紀錄映射為既有 Rep 型別，uncertain 永遠保留不升格 */
export function mapCycleRepToRep(
  rep: CycleRepInput,
  metric: MetricId,
  repId: string
): Rep {
  return {
    rep_id: repId,
    start_ms: rep.start_ms,
    end_ms: rep.end_ms,
    status: rep.status,
    metrics: {
      tempo_ms: rep.tempo_ms,
      min_knee_angle: metric === 'kneeAngle' ? rep.peak_value : null
    },
    quality: {
      valid_sample_count: rep.valid_sample_count ?? 0,
      tracking_gap_ms: rep.tracking_gap_ms
    },
    reason: rep.reason
  }
}

/** 將循環引擎組別狀態與 rep 紀錄組裝為 SetSummary（不修改既有 engine types） */
export function buildCycleSetSummary(
  params: BuildCycleSetSummaryParams
): SetSummary {
  const { setId, exercise, state, idFactory } = params
  if (exercise.engine.kind !== 'cycle') {
    throw new Error(`Expected cycle exercise, received: ${exercise.id}`)
  }

  const metric = exercise.engine.metric
  const sourceReps = params.reps ?? state.reps
  const stats = getCycleSetStats(state)
  const reps: Rep[] = sourceReps.map((rep) =>
    mapCycleRepToRep(rep, metric, idFactory())
  )

  return {
    set_id: setId,
    exercise: exercise.id as SetSummary['exercise'],
    view: exercise.view as SetSummary['view'],
    reps,
    total_sample_count: stats.total_sample_count,
    valid_sample_count: stats.valid_sample_count,
    total_tracking_gap_ms: stats.total_tracking_gap_ms,
    rules_version: exercise.engine.rules.rules_version
  }
}
