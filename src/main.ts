import './style.css'
import { EXERCISES } from './exercises/catalog'
import type { ExerciseDef, ExerciseTier, ExerciseView } from './exercises/catalog'
import { registerSw } from './sw-register'

registerSw()

const TIER_ORDER: readonly ExerciseTier[] = ['beginner', 'intermediate', 'advanced']

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

function renderCatalog(activeTier: ExerciseTier): void {
  const root = document.querySelector('#exercise-catalog')
  if (!root) throw new Error('Missing #exercise-catalog')

  const html = TIER_ORDER.map((tier) => {
    const items = EXERCISES.filter((ex) => ex.tier === tier)
    const cardsHtml = items.map(renderExerciseCard).join('')
    const hiddenAttr = tier === activeTier ? '' : ' hidden'

    return `
      <section
        class="tier-panel"
        id="panel-${tier}"
        role="tabpanel"
        aria-labelledby="tab-${tier}"
        data-tier="${tier}"${hiddenAttr}
      >
        <div class="exercise-grid">
          ${cardsHtml}
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
