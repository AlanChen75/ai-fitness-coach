import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../src/exercises/catalog'
import { buildAnimatedFigure } from '../src/exercises/figure-rig'
import type { FigureSpec, RigPose } from '../src/exercises/figure-rig'

const NEUTRAL_POSE: RigPose = {
  torsoTilt: 0,
  hipY: 0,
  thighL: 0,
  thighR: 0,
  shinL: 0,
  shinR: 0,
  upperArmL: 0,
  upperArmR: 0,
  forearmL: 0,
  forearmR: 0,
  heelRaise: 0
}

const SAMPLE_SPEC: FigureSpec = {
  id: 'sample-squat',
  view: 'side',
  durationMs: 1600,
  start: NEUTRAL_POSE,
  action: {
    ...NEUTRAL_POSE,
    torsoTilt: 25,
    hipY: 24,
    thighL: -95,
    thighR: -95,
    shinL: 80,
    shinR: 80
  }
}

describe('Figure Rig (R2 T4a.1-T4a.3)', () => {
  it('T4a.1: buildAnimatedFigure 輸出含 svg 根節點、keyframes、alternate、reduced-motion 區塊', () => {
    const svg = buildAnimatedFigure(SAMPLE_SPEC)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('viewBox="0 0 120 180"')
    expect(svg).toContain('<style>')
    expect(svg).toContain('@keyframes ')
    expect(svg).toContain('alternate')
    expect(svg).toContain('infinite')
    expect(svg).toContain('@media (prefers-reduced-motion:reduce)')
    expect(svg).toContain('animation:none')
  })

  it('T4a.2: 同一 spec 輸出為決定性字串；不同 id 的 animation 名稱不同', () => {
    const first = buildAnimatedFigure(SAMPLE_SPEC)
    const second = buildAnimatedFigure(SAMPLE_SPEC)
    expect(first).toBe(second)

    const other = buildAnimatedFigure({
      ...SAMPLE_SPEC,
      id: 'other-pose'
    })
    expect(other).not.toBe(first)

    const extractAnimNames = (svg: string): string[] => {
      const matches = svg.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/g)
      return Array.from(matches, (m) => m[1])
    }

    const namesA = extractAnimNames(first)
    const namesB = extractAnimNames(other)
    expect(namesA.length).toBeGreaterThan(0)
    expect(namesB.length).toBeGreaterThan(0)
    expect(namesA.every((n) => n.includes('sample-squat'))).toBe(true)
    expect(namesB.every((n) => n.includes('other-pose'))).toBe(true)
    expect(namesA.some((n) => namesB.includes(n))).toBe(false)
  })

  it('T4b.4: 18 個動作的 figureSvg 皆由 rig 產生且非空、含 animation 且各 id 獨立', () => {
    expect(EXERCISES).toHaveLength(18)

    for (const ex of EXERCISES) {
      expect(ex.figureSvg.length).toBeGreaterThan(0)
      expect(ex.figureSvg).toContain('<svg')
      expect(ex.figureSvg).toContain('viewBox="0 0 120 180"')
      expect(ex.figureSvg).toContain('animation:')
      expect(ex.figureSvg).toContain(`@keyframes rig-${ex.id}-`)
      expect(ex.figureSvg).toContain('prefers-reduced-motion')
    }
  })

  it('front view 包含雙側手臂與雙腿，prop 會渲染對應道具幾何，side 分腿動作含後側腿', () => {
    const frontSvg = buildAnimatedFigure({
      ...SAMPLE_SPEC,
      id: 'front-test',
      view: 'front'
    })
    expect(frontSvg).toContain('rig-front-test-th-l')
    expect(frontSvg).toContain('rig-front-test-th-r')
    expect(frontSvg).toContain('rig-front-test-ua-r')

    const chairSvg = buildAnimatedFigure({
      ...SAMPLE_SPEC,
      id: 'chair-test',
      prop: 'chair'
    })
    expect(chairSvg).toContain('<path d="M14 84')

    const wallSvg = buildAnimatedFigure({
      ...SAMPLE_SPEC,
      id: 'wall-test',
      prop: 'wall'
    })
    expect(wallSvg).toContain('x1="98"')

    const benchSvg = buildAnimatedFigure({
      ...SAMPLE_SPEC,
      id: 'bench-test',
      prop: 'bench'
    })
    expect(benchSvg).toContain('<path d="M12 138')

    const splitSvg = buildAnimatedFigure({
      ...SAMPLE_SPEC,
      id: 'split-test',
      view: 'side',
      action: {
        ...SAMPLE_SPEC.action,
        thighR: 15,
        shinR: 60
      }
    })
    expect(splitSvg).toContain('rig-split-test-th-l')
    expect(splitSvg).toContain('rig-split-test-th-r')
  })
})

describe('Foot anchoring invariant (planted feet never slide)', () => {
  it('anchored specs keep the left ankle at the canonical floor point in both poses', async () => {
    const specs = await import('../src/exercises/figure-specs')
    const { anchoredHipOffset, leftAnkleOffset } = await import('../src/exercises/figure-rig')
    const all = Object.values(specs).filter(
      (v): v is FigureSpec => typeof v === 'object' && v !== null && 'start' in v && 'action' in v
    )
    expect(all.length).toBe(18)
    for (const spec of all) {
      if ((spec.anchor ?? 'leftFoot') === 'none') continue
      for (const pose of [spec.start, spec.action]) {
        const t = anchoredHipOffset(spec.view, pose)
        const ankle = leftAnkleOffset(spec.view, pose)
        const globalX = t.x + ankle.x
        const globalY = t.y + ankle.y + (pose.heelRaise ?? 0)
        const anchorX = spec.view === 'side' ? 0 : -10
        expect(Math.abs(globalX - anchorX), `${spec.id} ankle x`).toBeLessThan(0.01)
        expect(Math.abs(globalY - 66), `${spec.id} ankle y`).toBeLessThan(0.01)
      }
    }
  })

  it('calf-raise heel raise lifts the body while the toe point stays on the floor line', async () => {
    const { CALF_RAISE_FIGURE_SPEC } = await import('../src/exercises/figure-specs')
    const { anchoredHipOffset } = await import('../src/exercises/figure-rig')
    const start = anchoredHipOffset('side', CALF_RAISE_FIGURE_SPEC.start)
    const action = anchoredHipOffset('side', CALF_RAISE_FIGURE_SPEC.action)
    expect(action.y).toBeLessThan(start.y)
  })
})
