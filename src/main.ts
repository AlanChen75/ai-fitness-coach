import './style.css'
import { EXERCISES } from './exercises/catalog'
import type { ExerciseDef, ExerciseTier, ExerciseView } from './exercises/catalog'
import { registerSw } from './sw-register'

registerSw()

const LOCK_ICON_SVG =
  '<svg class="lock-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">' +
  '<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2" />' +
  '<path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />' +
  '</svg>'

interface TierSectionSpec {
  readonly tier: ExerciseTier
  readonly lockedCards: ReadonlyArray<{
    readonly title: string
    readonly subtitle?: string
    readonly wide: boolean
  }>
}

const TIER_SECTIONS: readonly TierSectionSpec[] = [
  {
    tier: 'beginner',
    lockedCards: [{ title: '站姿側抬腿（即將推出）', wide: false }]
  },
  {
    tier: 'intermediate',
    lockedCards: [{ title: '即將推出', subtitle: '線條雕塑 / 體態維持', wide: true }]
  },
  {
    tier: 'advanced',
    lockedCards: [{ title: '即將推出', subtitle: '進階肌力 / 全身協調', wide: true }]
  }
]

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function viewLabel(view: ExerciseView): string {
  return view === 'front' ? '正面' : '側面'
}

function renderExerciseCard(ex: ExerciseDef): string {
  const targetsLine = ex.targetsZh.join(' · ')

  return `
    <a class="exercise-card" href="./train.html?exercise=${encodeURIComponent(ex.id)}">
      <div class="exercise-card-top">
        <span class="exercise-view-tag">${escapeHtml(viewLabel(ex.view))}</span>
      </div>
      <div class="exercise-figure">${ex.figureSvg}</div>
      <div class="exercise-name">${escapeHtml(ex.nameZh)}</div>
      <div class="exercise-targets">${escapeHtml(targetsLine)}</div>
    </a>
  `
}

function renderLockedCard(title: string, subtitle: string | undefined, wide: boolean): string {
  const wideClass = wide ? ' is-locked-wide' : ''
  const subHtml = subtitle
    ? `<div class="exercise-lock-sub">${escapeHtml(subtitle)}</div>`
    : ''
  return `
    <div class="exercise-card is-locked${wideClass}" aria-disabled="true">
      <div class="exercise-lock-wrap">
        ${LOCK_ICON_SVG}
        <div class="exercise-lock-text">${escapeHtml(title)}</div>
        ${subHtml}
      </div>
    </div>
  `
}

function renderCatalog(activeTier: ExerciseTier): void {
  const root = document.querySelector('#exercise-catalog')
  if (!root) throw new Error('Missing #exercise-catalog')

  const html = TIER_SECTIONS.map((sec) => {
    const items = EXERCISES.filter((ex) => ex.tier === sec.tier)
    const activeHtml = items.map(renderExerciseCard).join('')
    const lockedHtml = sec.lockedCards
      .map((card) => renderLockedCard(card.title, card.subtitle, card.wide))
      .join('')
    const hiddenAttr = sec.tier === activeTier ? '' : ' hidden'

    return `
      <section
        class="tier-panel"
        id="panel-${sec.tier}"
        role="tabpanel"
        aria-labelledby="tab-${sec.tier}"
        data-tier="${sec.tier}"${hiddenAttr}
      >
        <div class="exercise-grid">
          ${activeHtml}${lockedHtml}
        </div>
      </section>
    `
  }).join('')

  root.innerHTML = html
}

function setActiveTier(tier: ExerciseTier): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.tier-tab[data-tier]')
  tabs.forEach((tab) => {
    const selected = tab.dataset.tier === tier
    tab.setAttribute('aria-selected', selected ? 'true' : 'false')
    tab.classList.toggle('is-active', selected)
  })

  const panels = document.querySelectorAll<HTMLElement>('.tier-panel[data-tier]')
  panels.forEach((panel) => {
    const visible = panel.dataset.tier === tier
    panel.hidden = !visible
  })
}

function initTierTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tier-tab[data-tier]'))
  if (tabs.length === 0) return

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      const tier = tab.dataset.tier as ExerciseTier | undefined
      if (tier) setActiveTier(tier)
    })

    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const nextIndex = e.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length
      const nextTab = tabs[nextIndex]
      const tier = nextTab?.dataset.tier as ExerciseTier | undefined
      if (nextTab && tier) {
        setActiveTier(tier)
        nextTab.focus()
      }
    })
  })
}

renderCatalog('beginner')
initTierTabs()
