// R2 動態示範圖 rig：純函式組裝階層式 SVG 骨架與 CSS keyframes 動畫（零 DOM、無 path morph）

export interface RigPose {
  readonly torsoTilt: number
  readonly hipY: number
  readonly thighL: number
  readonly thighR: number
  readonly shinL: number
  readonly shinR: number
  readonly upperArmL: number
  readonly upperArmR: number
  readonly forearmL: number
  readonly forearmR: number
  readonly heelRaise: number
}

export type FigureProp = 'chair' | 'wall'

export interface FigureSpec {
  readonly id: string
  readonly view: 'side' | 'front'
  readonly start: RigPose
  readonly action: RigPose
  readonly durationMs: number
  readonly prop?: FigureProp
}

const STROKE_ATTR =
  'fill="none" stroke="var(--accent, #0ea5e9)" stroke-linecap="round" stroke-linejoin="round"'

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_')
  return cleaned.length > 0 ? cleaned : 'fig'
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

function hipTransform(pose: RigPose): string {
  const netY = pose.hipY - (pose.heelRaise ?? 0)
  return `translateY(${fmt(netY)}px)`
}

function rotateTransform(deg: number): string {
  return `rotate(${fmt(deg)}deg)`
}

function footTiltDeg(pose: RigPose): number {
  const raise = pose.heelRaise ?? 0
  return raise > 0 ? Math.min(65, raise * 4.2) : 0
}

interface AnimatedTrack {
  readonly cls: string
  readonly kf: string
  readonly from: string
  readonly to: string
}

function buildTrackCss(track: AnimatedTrack, durationMs: number): string {
  return [
    `.${track.cls}{transform-box:view-box;transform-origin:0px 0px;transform:${track.from};animation:${track.kf} ${durationMs}ms ease-in-out infinite alternate;}`,
    `@keyframes ${track.kf}{0%,100%{transform:${track.from};}50%{transform:${track.to};}}`
  ].join('')
}

function buildReducedMotionCss(tracks: readonly AnimatedTrack[]): string {
  const rules = tracks
    .map((t) => `.${t.cls}{animation:none;transform:${t.to};}`)
    .join('')
  return `@media (prefers-reduced-motion:reduce){${rules}}`
}

function renderProp(prop?: FigureProp): string {
  if (prop === 'chair') {
    return `<path d="M26 82 L26 130 L62 130 M28 130 L28 166 M58 130 L58 166" ${STROKE_ATTR} stroke-width="4" opacity="0.65" />`
  }
  if (prop === 'wall') {
    return `<line x1="98" y1="16" x2="98" y2="168" ${STROKE_ATTR} stroke-width="6" opacity="0.65" />`
  }
  return ''
}

function buildTracks(prefix: string, spec: FigureSpec): readonly AnimatedTrack[] {
  const { start, action, view } = spec
  const base: AnimatedTrack[] = [
    {
      cls: `${prefix}-hip`,
      kf: `${prefix}-kf-hip`,
      from: hipTransform(start),
      to: hipTransform(action)
    },
    {
      cls: `${prefix}-torso`,
      kf: `${prefix}-kf-torso`,
      from: rotateTransform(start.torsoTilt),
      to: rotateTransform(action.torsoTilt)
    },
    {
      cls: `${prefix}-ua-l`,
      kf: `${prefix}-kf-ua-l`,
      from: rotateTransform(start.upperArmL),
      to: rotateTransform(action.upperArmL)
    },
    {
      cls: `${prefix}-fa-l`,
      kf: `${prefix}-kf-fa-l`,
      from: rotateTransform(start.forearmL),
      to: rotateTransform(action.forearmL)
    },
    {
      cls: `${prefix}-th-l`,
      kf: `${prefix}-kf-th-l`,
      from: rotateTransform(start.thighL),
      to: rotateTransform(action.thighL)
    },
    {
      cls: `${prefix}-sh-l`,
      kf: `${prefix}-kf-sh-l`,
      from: rotateTransform(start.shinL),
      to: rotateTransform(action.shinL)
    }
  ]

  if (view === 'side') {
    return [
      ...base,
      {
        cls: `${prefix}-ft-l`,
        kf: `${prefix}-kf-ft-l`,
        from: rotateTransform(footTiltDeg(start)),
        to: rotateTransform(footTiltDeg(action))
      }
    ]
  }

  return [
    ...base,
    {
      cls: `${prefix}-ua-r`,
      kf: `${prefix}-kf-ua-r`,
      from: rotateTransform(start.upperArmR),
      to: rotateTransform(action.upperArmR)
    },
    {
      cls: `${prefix}-fa-r`,
      kf: `${prefix}-kf-fa-r`,
      from: rotateTransform(start.forearmR),
      to: rotateTransform(action.forearmR)
    },
    {
      cls: `${prefix}-th-r`,
      kf: `${prefix}-kf-th-r`,
      from: rotateTransform(start.thighR),
      to: rotateTransform(action.thighR)
    },
    {
      cls: `${prefix}-sh-r`,
      kf: `${prefix}-kf-sh-r`,
      from: rotateTransform(start.shinR),
      to: rotateTransform(action.shinR)
    }
  ]
}

function renderSideBody(prefix: string): string {
  return [
    '<g transform="translate(54, 98)">',
    `<g class="${prefix}-hip">`,
    `<g class="${prefix}-torso">`,
    `<line x1="0" y1="0" x2="0" y2="-42" ${STROKE_ATTR} stroke-width="5" />`,
    `<circle cx="0" cy="-54" r="10" ${STROKE_ATTR} stroke-width="4.5" />`,
    '<g transform="translate(0, -40)">',
    `<g class="${prefix}-ua-l">`,
    `<line x1="0" y1="0" x2="0" y2="18" ${STROKE_ATTR} stroke-width="4.5" />`,
    '<g transform="translate(0, 18)">',
    `<g class="${prefix}-fa-l">`,
    `<line x1="0" y1="0" x2="0" y2="18" ${STROKE_ATTR} stroke-width="4.5" />`,
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    `<g class="${prefix}-th-l">`,
    `<line x1="0" y1="0" x2="0" y2="34" ${STROKE_ATTR} stroke-width="5" />`,
    '<g transform="translate(0, 34)">',
    `<g class="${prefix}-sh-l">`,
    `<line x1="0" y1="0" x2="0" y2="32" ${STROKE_ATTR} stroke-width="5" />`,
    '<g transform="translate(0, 32)">',
    `<g class="${prefix}-ft-l">`,
    `<line x1="0" y1="0" x2="11" y2="0" ${STROKE_ATTR} stroke-width="4.5" />`,
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '</g>'
  ].join('')
}

function renderFrontBody(prefix: string): string {
  return [
    '<g transform="translate(60, 96)">',
    `<g class="${prefix}-hip">`,
    `<g class="${prefix}-torso">`,
    `<line x1="-10" y1="0" x2="10" y2="0" ${STROKE_ATTR} stroke-width="5" />`,
    `<line x1="0" y1="0" x2="0" y2="-42" ${STROKE_ATTR} stroke-width="5" />`,
    `<line x1="-16" y1="-42" x2="16" y2="-42" ${STROKE_ATTR} stroke-width="4.5" />`,
    `<circle cx="0" cy="-54" r="10" ${STROKE_ATTR} stroke-width="4.5" />`,
    '<g transform="translate(-16, -42)">',
    `<g class="${prefix}-ua-l">`,
    `<line x1="0" y1="0" x2="0" y2="18" ${STROKE_ATTR} stroke-width="4.5" />`,
    '<g transform="translate(0, 18)">',
    `<g class="${prefix}-fa-l">`,
    `<line x1="0" y1="0" x2="0" y2="18" ${STROKE_ATTR} stroke-width="4.5" />`,
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '<g transform="translate(16, -42)">',
    `<g class="${prefix}-ua-r">`,
    `<line x1="0" y1="0" x2="0" y2="18" ${STROKE_ATTR} stroke-width="4.5" />`,
    '<g transform="translate(0, 18)">',
    `<g class="${prefix}-fa-r">`,
    `<line x1="0" y1="0" x2="0" y2="18" ${STROKE_ATTR} stroke-width="4.5" />`,
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '<g transform="translate(-10, 0)">',
    `<g class="${prefix}-th-l">`,
    `<line x1="0" y1="0" x2="0" y2="30" ${STROKE_ATTR} stroke-width="5" />`,
    '<g transform="translate(0, 30)">',
    `<g class="${prefix}-sh-l">`,
    `<line x1="0" y1="0" x2="0" y2="36" ${STROKE_ATTR} stroke-width="5" />`,
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '<g transform="translate(10, 0)">',
    `<g class="${prefix}-th-r">`,
    `<line x1="0" y1="0" x2="0" y2="30" ${STROKE_ATTR} stroke-width="5" />`,
    '<g transform="translate(0, 30)">',
    `<g class="${prefix}-sh-r">`,
    `<line x1="0" y1="0" x2="0" y2="36" ${STROKE_ATTR} stroke-width="5" />`,
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '</g>',
    '</g>'
  ].join('')
}

export function buildAnimatedFigure(spec: FigureSpec): string {
  const safeId = sanitizeId(spec.id)
  const prefix = `rig-${safeId}`
  const durationMs = Math.max(200, Math.round(spec.durationMs))
  const tracks = buildTracks(prefix, spec)
  const css = tracks.map((t) => buildTrackCss(t, durationMs)).join('') + buildReducedMotionCss(tracks)
  const propSvg = renderProp(spec.prop)
  const bodySvg = spec.view === 'front' ? renderFrontBody(prefix) : renderSideBody(prefix)
  const floorSvg = `<line x1="18" y1="166" x2="102" y2="166" ${STROKE_ATTR} stroke-width="4" opacity="0.5" />`

  return [
    '<svg class="guide-silhouette" viewBox="0 0 120 180" width="96" height="144" aria-hidden="true">',
    `<style>${css}</style>`,
    propSvg,
    bodySvg,
    floorSvg,
    '</svg>'
  ].join('')
}
