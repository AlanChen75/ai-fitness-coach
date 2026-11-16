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

const TIER_SECTIONS: ReadonlyArray<{
  readonly tier: ExerciseTier
  readonly titleZh: string
  readonly lockedHint?: string
}> = [
  { tier: 'beginner', titleZh: '初級' },
  { tier: 'intermediate', titleZh: '中級', lockedHint: '即將推出：線條雕塑 / 體態維持' },
  { tier: 'advanced', titleZh: '高級', lockedHint: '即將推出：線條雕塑 / 體態維持' }
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
  const chipsHtml = ex.targetsZh
    .map((t) => `<span class="exercise-chip">${escapeHtml(t)}</span>`)
    .join('')

  return `
    <a class="exercise-card" href="./train.html?exercise=${encodeURIComponent(ex.id)}">
      <div class="exercise-card-top">
        <span class="exercise-view-tag">${escapeHtml(viewLabel(ex.view))}</span>
      </div>
      <div class="exercise-figure">${ex.figureSvg}</div>
      <div class="exercise-name">${escapeHtml(ex.nameZh)}</div>
      <div class="exercise-chips">${chipsHtml}</div>
    </a>
  `
}

function renderLockedCard(hint: string): string {
  return `
    <div class="exercise-card is-locked" aria-disabled="true">
      <div class="exercise-lock-wrap">
        ${LOCK_ICON_SVG}
        <div class="exercise-lock-text">${escapeHtml(hint)}</div>
      </div>
    </div>
  `
}

function renderCatalog(): void {
  const root = document.querySelector('#exercise-catalog')
  if (!root) throw new Error('Missing #exercise-catalog')

  const html = TIER_SECTIONS.map((sec) => {
    const items = EXERCISES.filter((ex) => ex.tier === sec.tier)
    const cardsHtml =
      items.length > 0
        ? items.map(renderExerciseCard).join('')
        : renderLockedCard(sec.lockedHint ?? '即將推出：線條雕塑 / 體態維持')

    return `
      <section class="tier-section">
        <h2 class="tier-heading">${escapeHtml(sec.titleZh)}</h2>
        <div class="exercise-grid">
          ${cardsHtml}
        </div>
      </section>
    `
  }).join('')

  root.innerHTML = html
}

renderCatalog()
