// R5.4 繁體中文語音播報（含同類提示 cooldown 與不打斷報數設計）
export type TtsCueKind = 'calibration' | 'invalid' | 'facing'

export const DEFAULT_CUE_COOLDOWN_MS = 3000

const ZH_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

export function formatRepCountZh(count: number): string {
  if (!Number.isInteger(count) || count < 1 || count >= 100) {
    return String(count)
  }
  if (count <= 9) return ZH_DIGITS[count]
  if (count === 10) return '十'
  if (count < 20) return `十${ZH_DIGITS[count % 10]}`
  const tens = Math.floor(count / 10)
  const ones = count % 10
  return ones === 0 ? `${ZH_DIGITS[tens]}十` : `${ZH_DIGITS[tens]}十${ZH_DIGITS[ones]}`
}

export interface SpeechSynthLike {
  readonly speaking: boolean
  speak(utterance: SpeechSynthesisUtterance): void
  cancel(): void
  getVoices(): SpeechSynthesisVoice[]
}

export interface CoachTtsOptions {
  readonly enabled?: boolean
  readonly cooldownMs?: number
  readonly synth?: SpeechSynthLike | null
  readonly now?: () => number
  readonly createUtterance?: (text: string) => SpeechSynthesisUtterance
}

export interface CoachTts {
  isSupported(): boolean
  isEnabled(): boolean
  setEnabled(next: boolean): void
  announceRep(count: number): boolean
  announceCalibration(): boolean
  announceInvalid(): boolean
  announceFacing(): boolean
  announceCue(kind: TtsCueKind, text: string): boolean
  stop(): void
}

function pickZhVoice(synth: SpeechSynthLike): SpeechSynthesisVoice | null {
  try {
    const voices = synth.getVoices()
    const zhVoices = voices.filter((v) => v.lang.startsWith('zh'))
    return zhVoices.find((v) => v.lang === 'zh-TW') ?? zhVoices[0] ?? null
  } catch {
    return null
  }
}

function defaultSynth(): SpeechSynthLike | null {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return window.speechSynthesis
  }
  return null
}

function makeDefaultUtterance(text: string): SpeechSynthesisUtterance {
  return new SpeechSynthesisUtterance(text)
}

export function createCoachTts(options: CoachTtsOptions = {}): CoachTts {
  const synth = options.synth !== undefined ? options.synth : defaultSynth()
  const now = options.now ?? (() => Date.now())
  const cooldownMs = Math.max(DEFAULT_CUE_COOLDOWN_MS, options.cooldownMs ?? DEFAULT_CUE_COOLDOWN_MS)
  const makeUtterance = options.createUtterance ?? makeDefaultUtterance

  let enabled = options.enabled ?? true
  const lastCueAt = new Map<TtsCueKind, number>()

  function speakText(text: string): boolean {
    if (!enabled || !synth) return false
    try {
      const utterance = makeUtterance(text)
      utterance.lang = 'zh-TW'
      const voice = pickZhVoice(synth)
      if (voice) utterance.voice = voice
      // 絕不在此呼叫 synth.cancel()，避免打斷進行中的報數
      synth.speak(utterance)
      return true
    } catch {
      return false
    }
  }

  function announceCue(kind: TtsCueKind, text: string): boolean {
    if (!enabled || !synth) return false
    const t = now()
    const prev = lastCueAt.get(kind)
    if (prev !== undefined && t - prev < cooldownMs) {
      return false
    }
    // 正在報數時略過低優先提示（特別是 invalid），避免疊報或干擾報數
    if (kind === 'invalid' && synth.speaking) {
      return false
    }
    lastCueAt.set(kind, t)
    return speakText(text)
  }

  return {
    isSupported: () => synth !== null,
    isEnabled: () => enabled,
    setEnabled(next: boolean): void {
      enabled = next
      if (!next) {
        synth?.cancel()
      }
    },
    announceRep(count: number): boolean {
      return speakText(formatRepCountZh(count))
    },
    announceCalibration(): boolean {
      return announceCue('calibration', '開始')
    },
    announceInvalid(): boolean {
      return announceCue('invalid', '辨識不清，請調整鏡頭')
    },
    announceFacing(): boolean {
      return announceCue('facing', '請側面對鏡頭')
    },
    announceCue,
    stop(): void {
      synth?.cancel()
    }
  }
}
