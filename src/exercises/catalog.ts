// R13 初級動作目錄（集中管理動作元資料、指標映射與循環引擎門檻）

import type { CycleRules } from '../engine/cycle-fsm'
import type { FramingRegion } from '../framing'
import { buildAnimatedFigure } from './figure-rig'
import type { FigureSpec } from './figure-rig'
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
  /** 入鏡檢查只要求計數指標實際用到的區段；室內距離不足時不會被腳踝卡關 */
  readonly framingRegions: readonly FramingRegion[]
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
// v0.2 門檻由真機實測校準（2026-11-16 Xiaomi 13 Pro session 6c41c6b2）：
// 站立 lift 約 -0.70，抬到髖部高度峰值 0.25-0.32。v0.1 的 bottom 0.40
// 幾何上不可達（要求膝高過髖 0.4 軀幹長），導致全部動作 aborted_before_bottom。
const MARCH_RULES: CycleRules = {
  rules_version: 'march-v0.2',
  direction: 'up',
  thresholdMode: 'absolute',
  enterThreshold: -0.35,
  bottomThreshold: -0.15,
  exitThreshold: -0.5,
  calibrationMs: 1000,
  minRepMs: 400,
  minBottomSamples: 2,
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

const SQUAT_FIGURE_SPEC: FigureSpec = {
  id: 'squat',
  view: 'side',
  durationMs: 1800,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 6,
    upperArmR: 6,
    forearmL: -10,
    forearmR: -10,
    heelRaise: 0
  },
  action: {
    torsoTilt: 28,
    hipY: 26,
    thighL: -103,
    thighR: -103,
    shinL: 85,
    shinR: 85,
    upperArmL: -95,
    upperArmR: -95,
    forearmL: -10,
    forearmR: -10,
    heelRaise: 0
  }
}

const SIT_TO_STAND_FIGURE_SPEC: FigureSpec = {
  id: 'sit-to-stand',
  view: 'side',
  prop: 'chair',
  durationMs: 2200,
  start: {
    torsoTilt: 8,
    hipY: 30,
    thighL: -95,
    thighR: -95,
    shinL: 87,
    shinR: 87,
    upperArmL: -35,
    upperArmR: -35,
    forearmL: -25,
    forearmR: -25,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 6,
    upperArmR: 6,
    forearmL: -8,
    forearmR: -8,
    heelRaise: 0
  }
}

const CALF_RAISE_FIGURE_SPEC: FigureSpec = {
  id: 'calf-raise',
  view: 'side',
  durationMs: 1400,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 6,
    upperArmR: 6,
    forearmL: -10,
    forearmR: -10,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 10,
    upperArmR: 10,
    forearmL: -14,
    forearmR: -14,
    heelRaise: 14
  }
}

const MARCH_FIGURE_SPEC: FigureSpec = {
  id: 'march',
  view: 'front',
  durationMs: 1200,
  start: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: 8,
    upperArmR: -8,
    forearmL: -6,
    forearmR: 6,
    heelRaise: 0
  },
  action: {
    torsoTilt: 0,
    hipY: 0,
    thighL: 0,
    thighR: -78,
    shinL: 0,
    shinR: 78,
    upperArmL: 24,
    upperArmR: -18,
    forearmL: -35,
    forearmR: 25,
    heelRaise: 0
  }
}

const WALL_PUSHUP_FIGURE_SPEC: FigureSpec = {
  id: 'wall-pushup',
  view: 'side',
  prop: 'wall',
  durationMs: 1800,
  start: {
    torsoTilt: 12,
    hipY: 2,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: -102,
    upperArmR: -102,
    forearmL: 0,
    forearmR: 0,
    heelRaise: 0
  },
  action: {
    torsoTilt: 26,
    hipY: 7,
    thighL: 0,
    thighR: 0,
    shinL: 0,
    shinR: 0,
    upperArmL: -64,
    upperArmR: -64,
    forearmL: -94,
    forearmR: -94,
    heelRaise: 0
  }
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
    figureSvg: buildAnimatedFigure(SQUAT_FIGURE_SPEC),
    engine: { kind: 'squat' },
    // 膝角度 = 髖-膝-踝 三點，腳踝必要
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
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
    figureSvg: buildAnimatedFigure(SIT_TO_STAND_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeAngle',
      rules: SIT_TO_STAND_RULES
    },
    // 膝角度 = 髖-膝-踝 三點，腳踝必要
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
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
    figureSvg: buildAnimatedFigure(CALF_RAISE_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'shoulderRise',
      rules: CALF_RAISE_RULES
    },
    // shoulderRise 只用肩與軀幹長，下半身不需入鏡
    framingRegions: ['upper', 'hips']
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
      '依自身節奏穩定交替踏步，每次抬腿都算一下'
    ],
    safetyZh: '身旁可擺放椅子方便隨時輕扶，抬腿高度以骨盆不歪斜為原則',
    figureSvg: buildAnimatedFigure(MARCH_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeLift',
      rules: MARCH_RULES
    },
    // kneeLift 只用肩、髖、膝，腳踝出鏡不影響計數（室內前鏡頭距離常不夠）
    framingRegions: ['upper', 'hips', 'knees']
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
    figureSvg: buildAnimatedFigure(WALL_PUSHUP_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'elbowAngle',
      rules: WALL_PUSHUP_RULES
    },
    // elbowAngle 用肩-肘-腕，下半身不需入鏡
    framingRegions: ['upper', 'hips']
  }
]

export function getExercise(id: string): ExerciseDef | null {
  return EXERCISES.find((exercise) => exercise.id === id) ?? null
}
