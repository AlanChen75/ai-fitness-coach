import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendPoseSamples,
  buildPoseFileRef,
  isOpfsAvailable,
  readPoseSequence,
  toStoredSet
} from '../src/storage'
import type { SetSummary } from '../src/engine/types'
import { createCoachTts, formatRepCountZh } from '../src/tts'
import type { SpeechSynthLike } from '../src/tts'

function makeFakeSynth() {
  const spoken: string[] = []
  let cancelCount = 0
  let speaking = false
  const synth: SpeechSynthLike & { setSpeaking: (v: boolean) => void } = {
    get speaking() {
      return speaking
    },
    setSpeaking(v: boolean) {
      speaking = v
    },
    speak(u) {
      spoken.push(u.text)
    },
    cancel() {
      cancelCount += 1
      speaking = false
    },
    getVoices() {
      return []
    }
  }
  return { synth, spoken, getCancelCount: () => cancelCount }
}

describe('TTS (R5.4)', () => {
  it('formats Chinese rep counts and never calls cancel during rep or cue announcements', () => {
    expect(formatRepCountZh(1)).toBe('一')
    expect(formatRepCountZh(10)).toBe('十')
    expect(formatRepCountZh(14)).toBe('十四')
    expect(formatRepCountZh(20)).toBe('二十')
    expect(formatRepCountZh(25)).toBe('二十五')

    let nowMs = 1000
    const { synth, spoken, getCancelCount } = makeFakeSynth()
    const tts = createCoachTts({
      synth,
      now: () => nowMs,
      createUtterance: (text) => ({ text, lang: '', voice: null } as unknown as SpeechSynthesisUtterance)
    })

    expect(tts.announceCalibration()).toBe(true)
    expect(tts.announceCalibration()).toBe(false) // cooldown < 3000ms
    nowMs += 3000
    expect(tts.announceCalibration()).toBe(true)

    expect(tts.announceRep(1)).toBe(true)
    expect(tts.announceRep(2)).toBe(true)
    expect(getCancelCount()).toBe(0)

    synth.setSpeaking(true)
    expect(tts.announceInvalid()).toBe(false) // do not overlap active rep
    synth.setSpeaking(false)
    expect(tts.announceInvalid()).toBe(true)
    expect(tts.announceInvalid()).toBe(false) // cooldown < 3000ms

    expect(spoken).toEqual(['開始', '開始', '一', '二', '辨識不清，請調整鏡頭'])
    expect(getCancelCount()).toBe(0)

    tts.setEnabled(false)
    expect(getCancelCount()).toBe(1)
    expect(tts.announceRep(3)).toBe(false)
  })
})

describe('Storage OPFS & Rep refs (R6.2, R6.3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds opfs:// pose_file_ref and attaches to StoredSet immutably', () => {
    const ref = buildPoseFileRef('sess-1', 'set-1')
    expect(ref).toBe('opfs://sessions/sess-1/set-1.pose.jsonl')

    const summary: SetSummary = {
      set_id: 'set-1',
      exercise: 'squat',
      view: 'side',
      reps: [
        {
          rep_id: 'rep-1',
          start_ms: 100,
          end_ms: 1200,
          status: 'complete',
          metrics: { tempo_ms: 1100, min_knee_angle: 88 },
          quality: { valid_sample_count: 11, tracking_gap_ms: 0 },
          reason: 'valid_squat_cycle'
        }
      ],
      total_sample_count: 20,
      valid_sample_count: 20,
      total_tracking_gap_ms: 0,
      rules_version: 'squat-side-v0.1'
    }

    const stored = toStoredSet(summary, ref)
    expect(stored.reps[0].pose_file_ref).toBe(ref)
    expect((summary.reps[0] as { pose_file_ref?: string }).pose_file_ref).toBeUndefined()
  })

  it('appends JSONL checkpoints incrementally and reads back PoseSample lines', async () => {
    const files = new Map<string, string>()

    function makeFileHandle(path: string) {
      return {
        async getFile() {
          const text = files.get(path) ?? ''
          return {
            size: text.length,
            async text() {
              return text
            }
          }
        },
        async createWritable(opts?: { keepExistingData?: boolean }) {
          let buffer = opts?.keepExistingData ? (files.get(path) ?? '') : ''
          let cursor = 0
          return {
            async seek(pos: number) {
              cursor = pos
            },
            async write(chunk: string) {
              buffer = buffer.slice(0, cursor) + chunk
              cursor += chunk.length
            },
            async close() {
              files.set(path, buffer)
            }
          }
        }
      }
    }

    function makeDirHandle(prefix: string): Record<string, unknown> {
      return {
        async getDirectoryHandle(name: string) {
          return makeDirHandle(`${prefix}/${name}`)
        },
        async getFileHandle(name: string) {
          return makeFileHandle(`${prefix}/${name}`)
        }
      }
    }

    vi.stubGlobal('navigator', {
      storage: {
        getDirectory: async () => makeDirHandle('')
      }
    })

    expect(await isOpfsAvailable()).toBe(true)

    const ok1 = await appendPoseSamples('s1', 'set1', [
      { t_ms: 100, landmarks: [{ x: 0.1, y: 0.2, z: 0, visibility: 0.9 }], valid: true }
    ])
    const ok2 = await appendPoseSamples('s1', 'set1', [
      { t_ms: 200, landmarks: [{ x: 0.2, y: 0.3, z: 0, visibility: 0.8 }], valid: true }
    ])
    expect(ok1).toBe(true)
    expect(ok2).toBe(true)

    const readBack = await readPoseSequence('s1', 'set1')
    expect(readBack).toHaveLength(2)
    expect(readBack[0].t_ms).toBe(100)
    expect(readBack[1].t_ms).toBe(200)
  })

  it('degrades gracefully when OPFS is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    expect(await isOpfsAvailable()).toBe(false)
    const ok = await appendPoseSamples('s2', 'set2', [
      { t_ms: 100, landmarks: [], valid: false }
    ])
    expect(ok).toBe(false)
    expect(await readPoseSequence('s2', 'set2')).toEqual([])
  })
})
