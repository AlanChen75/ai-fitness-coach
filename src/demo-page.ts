import './style.css'
import { getExercise } from './exercises/catalog'
import { registerSw } from './sw-register'

registerSw()

const REDIRECT_DELAY_MS = 1200

function getEl<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector)
  if (!el) throw new Error(`Missing element: ${selector}`)
  return el
}

function showErrorAndRedirect(message: string): void {
  const errorEl = getEl('#demo-error')
  const cardEl = getEl('#demo-card')

  errorEl.textContent = message
  errorEl.classList.remove('hidden')
  cardEl.classList.add('hidden')
  document.title = '找不到示範動作 - AI 健身教練'

  window.setTimeout(() => {
    window.location.replace('./index.html')
  }, REDIRECT_DELAY_MS)
}

function initDemoPage(): void {
  const id = new URLSearchParams(window.location.search).get('exercise')?.trim() ?? ''
  const exercise = id ? getExercise(id) : null

  if (!exercise || !exercise.demoOnly) {
    showErrorAndRedirect('找不到對應的器械示範動作，即將返回首頁。')
    return
  }

  const nameEl = getEl('#demo-name')
  const figEl = getEl('#demo-fig')
  const targetsEl = getEl('#demo-targets')
  const stepsEl = getEl('#demo-steps')
  const safetyEl = getEl('#demo-safety')

  document.title = `${exercise.nameZh}示範 - AI 健身教練`
  nameEl.textContent = exercise.nameZh

  const img = document.createElement('img')
  img.src = `./figures/${encodeURIComponent(exercise.id)}.gif`
  img.alt = `${exercise.nameZh}示範`
  figEl.replaceChildren(img)

  targetsEl.textContent = `目標肌群：${exercise.targetsZh.join(' · ')}`

  const steps = exercise.steps ?? exercise.stepsZh
  stepsEl.replaceChildren(
    ...steps.map((step) => {
      const li = document.createElement('li')
      li.textContent = step
      return li
    })
  )

  if (exercise.safetyZh.trim().length > 0) {
    safetyEl.textContent = exercise.safetyZh
    safetyEl.classList.remove('hidden')
  }
}

initDemoPage()
