// R13 初級動作目錄（集中管理動作元資料、指標映射與循環引擎門檻）

import type { CycleRules } from '../engine/cycle-fsm'
import {
  CALF_RAISE_FIGURE_SVG,
  MARCH_FIGURE_SVG,
  SIT_TO_STAND_FIGURE_SVG,
  SQUAT_FIGURE_SVG,
  WALL_PUSHUP_FIGURE_SVG
} from './figures'
import type { MetricId } from './metrics'

export type ExerciseTier = 'beginner' | 'intermediate' | 'advanced'
export type ExerciseView = 'side' | 'front'

export type ExerciseEngineConfig =
  | { readonly kind: 'squat' }
  | {
      readonly kind: 'cycle'
      readonly metric: MetricId
      readonly rules: CycleRules
    }

export interface ExerciseDef {
  readonly id: string
  readonly nameZh: string
  readonly tier: ExerciseTier
  readonly view: ExerciseView
  readonly targetsZh: readonly string[]
  readonly stepsZh: readonly string[]
  readonly safetyZh: string
  readonly figureSvg: string
  readonly engine: ExerciseEngineConfig
}

const SIT_TO_STAND_RULES: CycleRules = {
  rules_version: 'sit-to-stand-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 110,
  exitThreshold: 160,
  calibrationMs: 1000,
  minRepMs: 1000,
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

// v0 限制：以單次最高抬膝幅度計數，不強制左右交替
const MARCH_RULES: CycleRules = {
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

const WALL_PUSHUP_RULES: CycleRules = {
  rules_version: 'wall-pushup-v0.1',
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

export const EXERCISES: readonly ExerciseDef[] = [
  {
    id: 'squat',
    nameZh: '深蹲',
    tier: 'beginner',
    view: 'side',
    targetsZh: ['大腿前側', '臀部'],
    stepsZh: [
      '雙腳與肩同寬站穩，胸口保持挺直',
      '臀部向後坐下，屈膝至大腿接近平行地面',
      '雙腳踩穩推回站姿，動作放慢不急促'
    ],
    safetyZh: '膝蓋朝腳尖方向不內扣，感覺吃力時可扶穩固椅背輔助',
    figureSvg: SQUAT_FIGURE_SVG,
    engine: { kind: 'squat' }
  },
  {
    id: 'sit-to-stand',
    nameZh: '椅子坐站',
    tier: 'beginner',
    view: 'side',
    targetsZh: ['大腿肌群', '臀部', '下肢肌耐力'],
    stepsZh: [
      '站在穩固椅子前方，雙腳平放與肩同寬',
      '慢慢屈膝向後坐下，輕觸椅面後再緩緩站直',
      '全程保持呼吸順暢，避免突然坐重跌落'
    ],
    safetyZh: '請使用無輪子且靠牆放置的穩固椅子，起立前先確認雙腳踩穩',
    figureSvg: SIT_TO_STAND_FIGURE_SVG,
    engine: {
      kind: 'cycle',
      metric: 'kneeAngle',
      rules: SIT_TO_STAND_RULES
    }
  },
  {
    id: 'calf-raise',
    nameZh: '提踵',
    tier: 'beginner',
    view: 'side',
    targetsZh: ['小腿肌群', '踝關節穩定'],
    stepsZh: [
      '雙腳與髖同寬站立，身體保持直立',
      '慢慢將腳跟抬離地面到最高點並短暫停留',
      '控制速度將腳跟放回地面，不重踩'
    ],
    safetyZh: '可輕扶牆面或椅背保持平衡，小腿微痠即可勿勉強踮過高',
    figureSvg: CALF_RAISE_FIGURE_SVG,
    engine: {
      kind: 'cycle',
      metric: 'shoulderRise',
      rules: CALF_RAISE_RULES
    }
  },
  {
    id: 'march',
    nameZh: '原地踏步抬腿',
    tier: 'beginner',
    view: 'front',
    targetsZh: ['髖屈肌', '下肢協調', '心肺活動'],
    stepsZh: [
      '正面對鏡頭站穩，上身保持挺直不後仰',
      '輪流將單側膝蓋抬高至接近腰部高度後放下',
      '依自身節奏穩定交替踏步（v0 不強制左右交替計次）'
    ],
    safetyZh: '身旁可擺放椅子方便隨時輕扶，抬腿高度以骨盆不歪斜為原則',
    figureSvg: MARCH_FIGURE_SVG,
    engine: {
      kind: 'cycle',
      metric: 'kneeLift',
      rules: MARCH_RULES
    }
  },
  {
    id: 'wall-pushup',
    nameZh: '牆壁伏地挺身',
    tier: 'beginner',
    view: 'side',
    targetsZh: ['胸部', '手臂後側', '肩部穩定'],
    stepsZh: [
      '面對牆壁站立約一步距離，雙手略寬於肩平貼牆面',
      '慢慢彎曲手肘讓胸口靠近牆面，身體維持一直線',
      '雙手輕推牆面回到直臂位置，避免聳肩'
    ],
    safetyZh: '地面務必防滑乾燥，手腕或肩膀不適時可縮短腳距減輕負荷',
    figureSvg: WALL_PUSHUP_FIGURE_SVG,
    engine: {
      kind: 'cycle',
      metric: 'elbowAngle',
      rules: WALL_PUSHUP_RULES
    }
  }
]

export function getExercise(id: string): ExerciseDef | null {
  return EXERCISES.find((exercise) => exercise.id === id) ?? null
}
