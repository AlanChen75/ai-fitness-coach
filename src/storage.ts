// R6 本地儲存：Session 存 IndexedDB，PoseSequence 以 JSONL 分段追加存 OPFS
import { openDb, STORE_SESSIONS } from './db'
import type {
  ConsentMetadata,
  PoseSample,
  Rep,
  Session,
  SetSummary
} from './engine/types'

export interface StoredConsentMetadata extends ConsentMetadata {
  readonly pose: boolean
  readonly video: boolean
  readonly upload: boolean
}

export interface StoredRep extends Rep {
  readonly pose_file_ref?: string
}

export interface StoredSet extends SetSummary {
  readonly reps: readonly StoredRep[]
}

export interface StoredSession extends Session {
  readonly consent: StoredConsentMetadata
  readonly sets: readonly StoredSet[]
  readonly interrupted: boolean
  readonly ended_at: string | null
  readonly pose_evidence_available: boolean
}

const OPFS_SESSIONS_DIR = 'sessions'

// 確保同一組檔案的 OPFS 追加寫入依序排隊，避免並發 checkpoint 互相覆寫
const writeQueues = new Map<string, Promise<boolean>>()

export function buildPoseFileRef(sessionId: string, setId: string): string {
  return `opfs://${OPFS_SESSIONS_DIR}/${sessionId}/${setId}.pose.jsonl`
}

function poseFileName(setId: string): string {
  return `${setId}.pose.jsonl`
}

export function toStoredSet(summary: SetSummary, poseFileRef: string | null): StoredSet {
  const reps: StoredRep[] = summary.reps.map((rep) =>
    poseFileRef ? { ...rep, pose_file_ref: poseFileRef } : { ...rep }
  )
  return { ...summary, reps }
}

export async function isOpfsAvailable(): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !('storage' in navigator) ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    return false
  }
  try {
    await navigator.storage.getDirectory()
    return true
  } catch {
    return false
  }
}

async function getSessionDir(
  sessionId: string,
  create: boolean
): Promise<FileSystemDirectoryHandle | null> {
  if (
    typeof navigator === 'undefined' ||
    !('storage' in navigator) ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    return null
  }
  const root = await navigator.storage.getDirectory()
  const sessionsDir = await root.getDirectoryHandle(OPFS_SESSIONS_DIR, { create })
  return sessionsDir.getDirectoryHandle(sessionId, { create })
}

async function appendChunkToOpfs(
  sessionId: string,
  setId: string,
  samples: readonly PoseSample[]
): Promise<boolean> {
  try {
    const dir = await getSessionDir(sessionId, true)
    if (!dir) return false
    if (samples.length === 0) return true

    const handle = await dir.getFileHandle(poseFileName(setId), { create: true })
    if (typeof handle.createWritable !== 'function') return false

    const existing = await handle.getFile()
    const writable = await handle.createWritable({ keepExistingData: true })
    try {
      await writable.seek(existing.size)
      const lines = samples
        .map((s) => JSON.stringify({ t_ms: s.t_ms, landmarks: s.landmarks, valid: s.valid }))
        .join('\n') + '\n'
      await writable.write(lines)
    } finally {
      await writable.close()
    }
    return true
  } catch (err) {
    console.warn('OPFS append failed, degrading gracefully', err)
    return false
  }
}

export function appendPoseSamples(
  sessionId: string,
  setId: string,
  samples: readonly PoseSample[]
): Promise<boolean> {
  const key = `${sessionId}/${setId}`
  const prev = writeQueues.get(key) ?? Promise.resolve(true)
  const snapshot = [...samples]
  const next = prev
    .catch(() => false)
    .then(() => appendChunkToOpfs(sessionId, setId, snapshot))
  writeQueues.set(key, next)
  return next
}

export async function readPoseSequence(
  sessionId: string,
  setId: string
): Promise<PoseSample[]> {
  try {
    const dir = await getSessionDir(sessionId, false)
    if (!dir) return []
    const handle = await dir.getFileHandle(poseFileName(setId), { create: false })
    const file = await handle.getFile()
    const text = await file.text()
    const out: PoseSample[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parsed = JSON.parse(trimmed) as PoseSample
      if (typeof parsed.t_ms === 'number' && Array.isArray(parsed.landmarks)) {
        out.push({
          t_ms: parsed.t_ms,
          landmarks: parsed.landmarks,
          valid: Boolean(parsed.valid)
        })
      }
    }
    return out
  } catch {
    return []
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite')
      tx.objectStore(STORE_SESSIONS).put({ ...session })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB session write failed'))
    })
  } finally {
    db.close()
  }
}

export async function listSessions(): Promise<StoredSession[]> {
  const db = await openDb()
  try {
    const all = await new Promise<StoredSession[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly')
      const req = tx.objectStore(STORE_SESSIONS).getAll()
      req.onsuccess = () => resolve((req.result as StoredSession[]) ?? [])
      req.onerror = () => reject(req.error ?? new Error('IndexedDB sessions read failed'))
    })
    return [...all].sort((a, b) =>
      String(b.started_at).localeCompare(String(a.started_at))
    )
  } finally {
    db.close()
  }
}

export async function getSession(sessionId: string): Promise<StoredSession | null> {
  const db = await openDb()
  try {
    const record = await new Promise<StoredSession | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly')
      const req = tx.objectStore(STORE_SESSIONS).get(sessionId)
      req.onsuccess = () => resolve(req.result as StoredSession | undefined)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB session read failed'))
    })
    return record ?? null
  } finally {
    db.close()
  }
}

async function deleteOpfsSessionDir(sessionId: string): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    !('storage' in navigator) ||
    typeof navigator.storage.getDirectory !== 'function'
  ) {
    return
  }
  try {
    const root = await navigator.storage.getDirectory()
    const sessionsDir = await root.getDirectoryHandle(OPFS_SESSIONS_DIR, { create: false })
    await sessionsDir.removeEntry(sessionId, { recursive: true })
  } catch (err) {
    // 目錄不存在時視為已清除，不影響刪除流程
    const name = err instanceof Error ? err.name : ''
    if (name !== 'NotFoundError') {
      console.warn('OPFS delete warning', err)
    }
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite')
      tx.objectStore(STORE_SESSIONS).delete(sessionId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB session delete failed'))
    })
  } finally {
    db.close()
  }
  await deleteOpfsSessionDir(sessionId)
}
