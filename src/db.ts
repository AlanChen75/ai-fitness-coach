// IndexedDB 薄封裝：device_capability_profile 與 sessions 的保存與讀回
const DB_NAME = 'fitness-coach-v01'
const DB_VERSION = 2
const STORE_PROFILES = 'capability_profiles'
export const STORE_SESSIONS = 'sessions'

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROFILES)) {
        db.createObjectStore(STORE_PROFILES, { keyPath: 'profile_id' })
      }
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: 'session_id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function putProfile(profile: Record<string, unknown>): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, 'readwrite')
      tx.objectStore(STORE_PROFILES).put(profile)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
    })
  } finally {
    db.close()
  }
}

export async function getLatestProfile(): Promise<Record<string, unknown> | null> {
  const db = await openDb()
  try {
    const all = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROFILES, 'readonly')
      const req = tx.objectStore(STORE_PROFILES).getAll()
      req.onsuccess = () => resolve(req.result as Record<string, unknown>[])
      req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
    })
    if (all.length === 0) return null
    return all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
  } finally {
    db.close()
  }
}

// 實測：寫入 → 讀回 → 刪除，回傳每一步結果
export async function idbRoundtrip(): Promise<{ ok: boolean; detail: string }> {
  try {
    const key = 'idb-selftest'
    const payload = { profile_id: key, created_at: new Date().toISOString(), nonce: Math.random() }
    await putProfile(payload)
    const db = await openDb()
    try {
      const read = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_PROFILES, 'readonly')
        const req = tx.objectStore(STORE_PROFILES).get(key)
        req.onsuccess = () => resolve(req.result as Record<string, unknown> | undefined)
        req.onerror = () => reject(req.error ?? new Error('read failed'))
      })
      if (!read || read.nonce !== payload.nonce) return { ok: false, detail: '讀回內容不一致' }
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PROFILES, 'readwrite')
        tx.objectStore(STORE_PROFILES).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('delete failed'))
      })
      return { ok: true, detail: '寫入、讀回、刪除皆成功' }
    } finally {
      db.close()
    }
  } catch (e) {
    return { ok: false, detail: String(e) }
  }
}

// OPFS 實測：寫檔 → 讀回 → 刪除；不支援時明確回報
export async function opfsRoundtrip(): Promise<{ ok: boolean; supported: boolean; detail: string }> {
  if (!('storage' in navigator) || typeof navigator.storage.getDirectory !== 'function') {
    return { ok: false, supported: false, detail: '此瀏覽器不支援 OPFS（navigator.storage.getDirectory）' }
  }
  try {
    const root = await navigator.storage.getDirectory()
    const name = 'opfs-selftest.json'
    const content = JSON.stringify({ t: Date.now(), nonce: Math.random() })
    const handle = await root.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
    const file = await (await root.getFileHandle(name)).getFile()
    const readBack = await file.text()
    await root.removeEntry(name)
    if (readBack !== content) return { ok: false, supported: true, detail: '讀回內容不一致' }
    return { ok: true, supported: true, detail: `寫入 ${content.length} bytes、讀回一致、已刪除` }
  } catch (e) {
    return { ok: false, supported: true, detail: String(e) }
  }
}
