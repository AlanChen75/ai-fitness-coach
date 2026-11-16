// R13 全級別動作目錄（初級／中級／高階各 6 個，集中管理動作元資料、指標映射與循環引擎門檻）

import type { CycleRules } from '../engine/cycle-fsm'
import type { FramingRegion } from '../framing'
import { buildAnimatedFigure } from './figure-rig'
import {
  BULGARIAN_SPLIT_SQUAT_FIGURE_SPEC,
  CALF_RAISE_FIGURE_SPEC,
  GLUTE_BRIDGE_FIGURE_SPEC,
  HIGH_KNEES_FIGURE_SPEC,
  JUMP_LUNGE_FIGURE_SPEC,
  JUMP_SQUAT_FIGURE_SPEC,
  JUMPING_JACK_FIGURE_SPEC,
  KNEE_PUSHUP_FIGURE_SPEC,
  LUNGE_FIGURE_SPEC,
  MARCH_FIGURE_SPEC,
  PISTOL_SQUAT_FIGURE_SPEC,
  PUSHUP_FIGURE_SPEC,
  SIDE_LEG_RAISE_FIGURE_SPEC,
  SINGLE_LEG_RDL_FIGURE_SPEC,
  SIT_TO_STAND_FIGURE_SPEC,
  SQUAT_FIGURE_SPEC,
  SUMO_SQUAT_FIGURE_SPEC,
  WALL_PUSHUP_FIGURE_SPEC
} from './figure-specs'
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

type CycleRulesSpecInput = Omit<
  CycleRules,
  'calibrationMs' | 'maxGapMs' | 'invalidResetMs' | 'minBottomSamples'
> & {
  readonly minBottomSamples?: number
}

function makeDefaultCycleRules(input: CycleRulesSpecInput): CycleRules {
  return {
    ...input,
    calibrationMs: 1000,
    minBottomSamples: input.minBottomSamples ?? 2,
    maxGapMs: 300,
    invalidResetMs: 1000
  }
}

// 未校準初始值，待真機實測校準
const SIDE_LEG_RAISE_RULES = makeDefaultCycleRules({
  rules_version: 'side-leg-raise-v0.1',
  direction: 'up',
  thresholdMode: 'baseline-delta',
  enterThreshold: 0.15,
  bottomThreshold: 0.3,
  exitThreshold: 0.08,
  minRepMs: 600
})

// 未校準初始值，待真機實測校準
const LUNGE_RULES = makeDefaultCycleRules({
  rules_version: 'lunge-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 110,
  exitThreshold: 160,
  minRepMs: 800
})

// 未校準初始值，待真機實測校準
const KNEE_PUSHUP_RULES = makeDefaultCycleRules({
  rules_version: 'knee-pushup-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 100,
  exitThreshold: 160,
  minRepMs: 600
})

// 未校準初始值，待真機實測校準
const SUMO_SQUAT_RULES = makeDefaultCycleRules({
  rules_version: 'sumo-squat-v0.1',
  direction: 'up',
  thresholdMode: 'baseline-delta',
  enterThreshold: 0.15,
  bottomThreshold: 0.25,
  exitThreshold: 0.1,
  minRepMs: 800
})

// 未校準初始值，待真機實測校準
const GLUTE_BRIDGE_RULES = makeDefaultCycleRules({
  rules_version: 'glute-bridge-v0.1',
  direction: 'up',
  thresholdMode: 'baseline-delta',
  enterThreshold: 0.08,
  bottomThreshold: 0.15,
  exitThreshold: 0.05,
  minRepMs: 800
})

// 未校準初始值，待真機實測校準
const JUMPING_JACK_RULES = makeDefaultCycleRules({
  rules_version: 'jumping-jack-v0.1',
  direction: 'up',
  thresholdMode: 'absolute',
  enterThreshold: 0.2,
  bottomThreshold: 0.5,
  exitThreshold: 0.0,
  minRepMs: 300,
  minBottomSamples: 1
})

// 未校準初始值，待真機實測校準（沿用 march-v0.2 角度/位移門檻）
const HIGH_KNEES_RULES = makeDefaultCycleRules({
  rules_version: 'high-knees-v0.1',
  direction: 'up',
  thresholdMode: 'absolute',
  enterThreshold: -0.35,
  bottomThreshold: -0.15,
  exitThreshold: -0.5,
  minRepMs: 250,
  minBottomSamples: 1
})

// 未校準初始值，待真機實測校準
const PUSHUP_RULES = makeDefaultCycleRules({
  rules_version: 'pushup-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 95,
  exitThreshold: 160,
  minRepMs: 500
})

// 未校準初始值，待真機實測校準
const JUMP_SQUAT_RULES = makeDefaultCycleRules({
  rules_version: 'jump-squat-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 115,
  exitThreshold: 160,
  minRepMs: 350,
  minBottomSamples: 1
})

// 未校準初始值，待真機實測校準
const JUMP_LUNGE_RULES = makeDefaultCycleRules({
  rules_version: 'jump-lunge-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 120,
  exitThreshold: 160,
  minRepMs: 350,
  minBottomSamples: 1
})

// 未校準初始值，待真機實測校準
const BULGARIAN_SPLIT_SQUAT_RULES = makeDefaultCycleRules({
  rules_version: 'bulgarian-split-squat-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 105,
  exitThreshold: 160,
  minRepMs: 800
})

// 未校準初始值，待真機實測校準
const SINGLE_LEG_RDL_RULES = makeDefaultCycleRules({
  rules_version: 'single-leg-rdl-v0.1',
  direction: 'up',
  thresholdMode: 'absolute',
  enterThreshold: 30,
  bottomThreshold: 55,
  exitThreshold: 20,
  minRepMs: 800
})

// 未校準初始值，待真機實測校準
const PISTOL_SQUAT_RULES = makeDefaultCycleRules({
  rules_version: 'pistol-squat-v0.1',
  direction: 'down',
  thresholdMode: 'absolute',
  enterThreshold: 150,
  bottomThreshold: 90,
  exitThreshold: 160,
  minRepMs: 1000
})

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
  },
  {
    id: 'side-leg-raise',
    nameZh: '站姿側抬腿',
    tier: 'beginner',
    view: 'front',
    targetsZh: ['臀中肌', '髖部穩定'],
    stepsZh: [
      '正面朝鏡頭站直，雙腳自然併攏、上身保持穩定',
      '將單側腿緩慢向身體外側平抬至約三十度，腳尖朝前不外翻',
      '慢慢控制將腿放回站姿，雙側可輪流進行'
    ],
    safetyZh: '身旁可輕扶穩固椅背或牆面維持平衡，抬腿時骨盆保持水平不側傾',
    figureSvg: buildAnimatedFigure(SIDE_LEG_RAISE_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'legAbduction',
      rules: SIDE_LEG_RAISE_RULES
    },
    // legAbduction 用雙側肩、髖與腳踝，需全身入鏡
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
  },
  {
    id: 'lunge',
    nameZh: '弓步蹲',
    tier: 'intermediate',
    view: 'side',
    targetsZh: ['股四頭肌', '臀大肌', '單腳穩定'],
    stepsZh: [
      '雙腳前後分開站穩，軀幹直立、核心微收',
      '垂直向下屈膝下蹲，至前側大腿接近平行地面、後膝接近地面',
      '前腳腳跟踩實發力推回起始站姿，節奏穩定不急衝'
    ],
    safetyZh: '前膝保持朝向腳尖不超過腳尖過多且不內扣，後膝下放時避免重撞地面',
    figureSvg: buildAnimatedFigure(LUNGE_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeAngle',
      rules: LUNGE_RULES
    },
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
  },
  {
    id: 'knee-pushup',
    nameZh: '跪姿伏地挺身',
    tier: 'intermediate',
    view: 'side',
    targetsZh: ['胸大肌', '三頭肌', '核心穩定'],
    stepsZh: [
      '雙膝跪於軟墊上，雙手略寬於肩撐地，頭肩臀呈一直線',
      '屈肘穩定下放胸口靠近地面，手肘朝斜後方約四十五度',
      '雙手推地回到起始直臂姿勢，全程避免塌腰或聳肩'
    ],
    safetyZh: '膝蓋下方建議墊瑜伽墊減壓，保持腹部收緊避免下背代償凹陷',
    figureSvg: buildAnimatedFigure(KNEE_PUSHUP_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'elbowAngle',
      rules: KNEE_PUSHUP_RULES
    },
    framingRegions: ['upper', 'hips']
  },
  {
    id: 'sumo-squat',
    nameZh: '相撲深蹲',
    tier: 'intermediate',
    view: 'front',
    targetsZh: ['大腿內側', '臀部', '核心'],
    stepsZh: [
      '雙腳張開大於肩寬站穩，腳尖向外打開約四十五度',
      '背部保持挺直，臀部垂直下坐至大腿接近水平',
      '腳掌平均踩實地面並夾臀起身，維持膝蓋與腳尖同方向'
    ],
    safetyZh: '下蹲深度依髖關節活動度調整，切勿讓膝蓋向內塌陷',
    figureSvg: buildAnimatedFigure(SUMO_SQUAT_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'hipDrop',
      rules: SUMO_SQUAT_RULES
    },
    framingRegions: ['upper', 'hips']
  },
  {
    id: 'glute-bridge',
    nameZh: '橋式抬臀',
    tier: 'intermediate',
    view: 'side',
    targetsZh: ['臀大肌', '腿後側', '骨盆控制'],
    stepsZh: [
      '仰躺屈膝踩地，雙腳與肩同寬、雙臂平放身體兩側',
      '腳跟踩穩推地，將臀部抬起至肩髖膝呈一直線並停頓',
      '控制速度將臀部下放輕觸地面後進行下一次'
    ],
    safetyZh: '以臀部夾緊發力取代腰椎過度頂高，頸部放鬆不出力頂地',
    figureSvg: buildAnimatedFigure(GLUTE_BRIDGE_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'hipLift',
      rules: GLUTE_BRIDGE_RULES
    },
    framingRegions: ['upper', 'hips']
  },
  {
    id: 'jumping-jack',
    nameZh: '開合跳',
    tier: 'intermediate',
    view: 'front',
    targetsZh: ['心肺耐力', '肩部協調', '全身暖身'],
    stepsZh: [
      '正面站立雙腳併攏，雙手自然垂放於身體兩側',
      '輕快跳起同時雙腳張開、雙臂自側面高舉過頭相近',
      '順暢跳回併攏與垂手起始位置，維持彈性節奏'
    ],
    safetyZh: '落地時以前腳掌著地並微屈膝緩衝衝擊，關節不適者請放慢節奏',
    figureSvg: buildAnimatedFigure(JUMPING_JACK_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'wristRaise',
      rules: JUMPING_JACK_RULES
    },
    framingRegions: ['upper', 'hips']
  },
  {
    id: 'high-knees',
    nameZh: '高抬腿',
    tier: 'intermediate',
    view: 'front',
    targetsZh: ['心肺衝刺', '髖屈肌', '核心'],
    stepsZh: [
      '正面保持直立準備姿勢，核心收緊、手臂微彎預備擺動',
      '快速交替將單膝抬高至髖部高度以上，搭配對側手臂擺動',
      '前腳掌輕盈彈性著地並立即換腳，保持高節奏連貫'
    ],
    safetyZh: '維持軀幹直立不後仰代償，落地時微屈膝踝緩衝以減輕衝擊',
    figureSvg: buildAnimatedFigure(HIGH_KNEES_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeLift',
      rules: HIGH_KNEES_RULES
    },
    framingRegions: ['upper', 'hips', 'knees']
  },
  {
    id: 'pushup',
    nameZh: '標準伏地挺身',
    tier: 'advanced',
    view: 'side',
    targetsZh: ['胸大肌', '三頭肌', '核心抗伸展'],
    stepsZh: [
      '雙手略寬於肩撐地、雙腳伸直腳尖點地，全身維持剛性平板',
      '控制速度屈肘下放至胸口接近地面，手肘微貼近軀幹',
      '爆發力推地回到完全撐直位置，全程不塌腰不翹臀'
    ],
    safetyZh: '高強度上肢與核心訓練，若出現塌腰或手腕疼痛應立即停止調整',
    figureSvg: buildAnimatedFigure(PUSHUP_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'elbowAngle',
      rules: PUSHUP_RULES
    },
    framingRegions: ['upper', 'hips']
  },
  {
    id: 'jump-squat',
    nameZh: '深蹲跳',
    tier: 'advanced',
    view: 'side',
    targetsZh: ['下肢爆發力', '股四頭肌', '臀部'],
    stepsZh: [
      '雙腳與肩同寬站穩，先屈膝下蹲儲力至大腿接近平行地面',
      '雙腳全力蹬地向上跳起，身體於空中完全伸展',
      '前腳掌先觸地並順勢屈膝下蹲緩衝，直接銜接下一次'
    ],
    safetyZh: '務必於防滑平面進行且落地屈膝充分緩衝，避免直膝硬著地傷及膝踝',
    figureSvg: buildAnimatedFigure(JUMP_SQUAT_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeAngle',
      rules: JUMP_SQUAT_RULES
    },
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
  },
  {
    id: 'jump-lunge',
    nameZh: '弓步跳',
    tier: 'advanced',
    view: 'side',
    targetsZh: ['單腿爆發力', '平衡協調', '臀腿'],
    stepsZh: [
      '採取前後弓步蹲低位置準備，軀幹保持直立穩定',
      '雙腿同時用力蹬地垂直跳起，於空中流暢前後換腳',
      '雙腳穩健著地後直接順勢屈膝緩衝進弓步，維持節奏'
    ],
    safetyZh: '高衝擊爆發訓練，落地務必雙腳同時屈膝吸震並確保膝蓋不內扣',
    figureSvg: buildAnimatedFigure(JUMP_LUNGE_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeAngle',
      rules: JUMP_LUNGE_RULES
    },
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
  },
  {
    id: 'bulgarian-split-squat',
    nameZh: '保加利亞分腿蹲',
    tier: 'advanced',
    view: 'side',
    targetsZh: ['單側股四頭肌', '臀大肌', '骨盆穩定'],
    stepsZh: [
      '背對穩固矮凳站立，將後腳腳背平放於凳面上、前腳向前踩穩',
      '上身微前傾並垂直下蹲，直到前側大腿接近平行地面',
      '前腳腳跟發力推起回到起始高點，單側完成後再換腳'
    ],
    safetyZh: '使用穩固不可滑動之支撐物，前腳距須足夠以免下蹲時前膝過度前推',
    figureSvg: buildAnimatedFigure(BULGARIAN_SPLIT_SQUAT_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeAngle',
      rules: BULGARIAN_SPLIT_SQUAT_RULES
    },
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
  },
  {
    id: 'single-leg-rdl',
    nameZh: '單腳硬舉',
    tier: 'advanced',
    view: 'side',
    targetsZh: ['腿後肌群', '臀大肌', '單腳平衡'],
    stepsZh: [
      '單腳微屈膝站穩，另一腳懸空預備、背部打直挺胸',
      '以髖關節為軸心向前俯身，同時後腳向後平伸使身體接近水平',
      '感受支撐側臀腿後側發力拉回直立姿勢，骨盆保持朝下不翻轉'
    ],
    safetyZh: '全程鎖定脊椎中立不圓背，支撐膝保持微彎彈性勿完全鎖死',
    figureSvg: buildAnimatedFigure(SINGLE_LEG_RDL_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'torsoLean',
      rules: SINGLE_LEG_RDL_RULES
    },
    framingRegions: ['upper', 'hips']
  },
  {
    id: 'pistol-squat',
    nameZh: '單腳深蹲',
    tier: 'advanced',
    view: 'side',
    targetsZh: ['極限單腿肌力', '踝髖活動度', '核心平衡'],
    stepsZh: [
      '單腳站穩，另一腳向前伸直抬離地面，雙臂前平舉平衡',
      '控制速度屈膝下蹲至最深處，支撐腳腳跟全程貼實地面',
      '支撐腿發力推回完全站直，下放與起身過程中伸直腳不觸地'
    ],
    safetyZh: '屬高階單腳極限動作，膝踝穩定不足時請勿勉強蹲至最低點或改先扶撐輔助',
    figureSvg: buildAnimatedFigure(PISTOL_SQUAT_FIGURE_SPEC),
    engine: {
      kind: 'cycle',
      metric: 'kneeAngle',
      rules: PISTOL_SQUAT_RULES
    },
    framingRegions: ['upper', 'hips', 'knees', 'ankles']
  }
]

export function getExercise(id: string): ExerciseDef | null {
  return EXERCISES.find((exercise) => exercise.id === id) ?? null
}
