import './style.css'
import { getExercise } from './exercises/catalog'
import {
  deleteSession,
  getSession,
  listSessions,
  readPoseSequence
} from './storage'
import type { StoredSession, StoredSet } from './storage'
import { registerSw } from './sw-register'

registerSw()

function $(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing element: ${sel}`)
  return el as HTMLElement
}

const elStatus = $('#review-status')
const elList = $('#session-list')
const elDetailSection = $('#detail-section')
const elDetail = $('#session-detail')

let selectedSessionId: string | null = null
let pendingDeleteId: string | null = null

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function getExerciseNameZh(exerciseId: string): string {
  return getExercise(exerciseId)?.nameZh ?? exerciseId
}

function getSessionExerciseLabel(session: StoredSession): string {
  const names = Array.from(new Set(session.sets.map((s) => getExerciseNameZh(s.exercise))))
  return names.length > 0 ? names.join('、') : '未記錄動作'
}

function summarizeSession(session: StoredSession): {
  complete: number
  uncertain: number
  totalSamples: number
  validSamples: number
  integrityLabel: string
  integrityTone: 'ok' | 'warn' | 'fail'
} {
  let complete = 0
  let uncertain = 0
  let totalSamples = 0
  let validSamples = 0

  for (const s of session.sets) {
    totalSamples += s.total_sample_count ?? 0
    validSamples += s.valid_sample_count ?? 0
    for (const r of s.reps) {
      if (r.status === 'complete') complete += 1
      else uncertain += 1
    }
  }

  const ratioText = totalSamples > 0
    ? ` · 有效 ${Math.round((validSamples / totalSamples) * 100)}%`
    : ''

  if (session.interrupted) {
    return {
      complete,
      uncertain,
      totalSamples,
      validSamples,
      integrityLabel: session.pose_evidence_available
        ? `已中斷${ratioText}`
        : `已中斷 · 無 Pose 證據${ratioText}`,
      integrityTone: 'fail'
    }
  }
  if (!session.pose_evidence_available) {
    return {
      complete,
      uncertain,
      totalSamples,
      validSamples,
      integrityLabel: `無 Pose 證據${ratioText}`,
      integrityTone: 'warn'
    }
  }
  return {
    complete,
    uncertain,
    totalSamples,
    validSamples,
    integrityLabel: `完整（含 Pose 證據${ratioText}）`,
    integrityTone: 'ok'
  }
}

function showBanner(msg: string, tone: 'ok' | 'warn' | 'fail'): void {
  elStatus.textContent = msg
  elStatus.className = `alert-banner ${tone}`
}

function renderSessionList(sessions: readonly StoredSession[]): void {
  if (sessions.length === 0) {
    elList.innerHTML = '<p>尚無訓練紀錄。請先前往 <a href="./exercises.html" style="color:var(--accent)">選擇動作</a> 開始訓練。</p>'
    return
  }

  elList.innerHTML = sessions
    .map((s) => {
      const sum = summarizeSession(s)
      const exerciseLabel = getSessionExerciseLabel(s)
      const selectedClass = s.session_id === selectedSessionId ? ' selected' : ''
      return `
        <button class="session-card-btn${selectedClass}" data-session-id="${escapeHtml(s.session_id)}">
          <div class="session-head">
            <span class="session-date">${escapeHtml(formatDateTime(s.started_at))}</span>
            <span class="badge ${sum.integrityTone}">${escapeHtml(sum.integrityLabel)}</span>
          </div>
          <div class="session-meta">
            ${escapeHtml(exerciseLabel)} · 組數 ${s.sets.length} 組 · 完成 ${sum.complete} 下 · 待確認 ${sum.uncertain} 下
          </div>
        </button>
      `
    })
    .join('')

  elList.querySelectorAll<HTMLButtonElement>('[data-session-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sessionId
      if (id) void openSession(id)
    })
  })
}

function renderSetBlock(set: StoredSet, index: number, poseCount: number): string {
  const validPct = set.total_sample_count > 0
    ? `${Math.round((set.valid_sample_count / set.total_sample_count) * 100)}%`
    : '--'
  const repRows = set.reps.length === 0
    ? '<tr><td colspan="6" style="color:var(--text-dim)">本組無計數 rep</td></tr>'
    : set.reps
        .map((r, i) => {
          const peak = r.metrics.min_knee_angle !== null && r.metrics.min_knee_angle !== undefined
            ? `${Math.round(r.metrics.min_knee_angle)}°`
            : '--'
          const tone = r.status === 'complete' ? 'ok' : 'warn'
          return `
            <tr>
              <td>${i + 1}</td>
              <td><span class="badge ${tone}">${escapeHtml(r.status)}</span></td>
              <td>${Math.round(r.metrics.tempo_ms)}</td>
              <td>${escapeHtml(peak)}</td>
              <td>${Math.round(r.quality.tracking_gap_ms)}</td>
              <td>${escapeHtml(r.reason)}</td>
            </tr>
          `
        })
        .join('')

  const exerciseName = getExerciseNameZh(set.exercise)
  const rawView: string = set.view
  const viewText = rawView === 'front' ? '正面' : rawView === 'side' ? '側面' : rawView

  return `
    <div class="card" style="background:var(--surface-2); margin-top:12px;">
      <h2>第 ${index + 1} 組（${escapeHtml(exerciseName)} / ${escapeHtml(viewText)}）</h2>
      <div class="session-meta">
        樣本 ${set.valid_sample_count}/${set.total_sample_count}（${validPct}） · 總缺口 ${Math.round(set.total_tracking_gap_ms)} ms · OPFS Pose 樣本：${poseCount} 筆
      </div>
      <div class="table-wrap">
        <table class="rep-table">
          <thead>
            <tr>
              <th>序號</th>
              <th>status</th>
              <th>tempo_ms</th>
              <th>峰值</th>
              <th>tracking_gap_ms</th>
              <th>reason</th>
            </tr>
          </thead>
          <tbody>${repRows}</tbody>
        </table>
      </div>
    </div>
  `
}

async function exportSessionJson(session: StoredSession): Promise<void> {
  const poseSequences = await Promise.all(
    session.sets.map(async (set) => ({
      set_id: set.set_id,
      pose_file_ref: set.reps[0]?.pose_file_ref ?? null,
      samples: await readPoseSequence(session.session_id, set.set_id)
    }))
  )

  const payload = {
    ...session,
    pose_sequences: poseSequences
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `session-${session.session_id.slice(0, 8)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function openSession(sessionId: string): Promise<void> {
  selectedSessionId = sessionId
  pendingDeleteId = null
  const session = await getSession(sessionId)
  if (!session) {
    elDetailSection.classList.add('hidden')
    showBanner('找不到該筆訓練紀錄', 'warn')
    return
  }

  const poseCounts = await Promise.all(
    session.sets.map((s) => readPoseSequence(session.session_id, s.set_id).then((arr) => arr.length))
  )

  const sum = summarizeSession(session)
  const camText = `${session.camera.facing} ${session.camera.width}x${session.camera.height}`
  const setsHtml = session.sets
    .map((s, idx) => renderSetBlock(s, idx, poseCounts[idx] ?? 0))
    .join('')

  elDetailSection.classList.remove('hidden')
  elDetail.innerHTML = `
    <div class="result-table">
      <div class="result-row"><span class="k">動作</span><span class="v">${escapeHtml(getSessionExerciseLabel(session))}</span></div>
      <div class="result-row"><span class="k">Session ID</span><span class="v">${escapeHtml(session.session_id)}</span></div>
      <div class="result-row"><span class="k">開始時間</span><span class="v">${escapeHtml(formatDateTime(session.started_at))}</span></div>
      <div class="result-row"><span class="k">資料狀態</span><span class="v ${sum.integrityTone}">${escapeHtml(sum.integrityLabel)}</span></div>
      <div class="result-row"><span class="k">總次數</span><span class="v">完成 ${sum.complete} / 待確認 ${sum.uncertain}</span></div>
      <div class="result-row"><span class="k">Device Profile</span><span class="v">${escapeHtml(session.device_profile_id)}</span></div>
      <div class="result-row"><span class="k">相機設定</span><span class="v">${escapeHtml(camText)}</span></div>
      <div class="result-row"><span class="k">模型 / 規則</span><span class="v">${escapeHtml(session.pose_model)} / ${escapeHtml(session.rules_version)}</span></div>
    </div>

    <div class="row2" style="margin-top:12px;">
      <button id="btn-export-session" class="btn-primary">匯出完整 JSON</button>
      <button id="btn-delete-step1" class="btn-danger">刪除 Session</button>
    </div>

    <div id="delete-confirm-box" class="confirm-box hidden">
      <p>確定要永久刪除此 Session 與 OPFS Pose 序列檔案？此動作無法復原。</p>
      <div class="row2">
        <button id="btn-delete-confirm" class="btn-danger">確認刪除</button>
        <button id="btn-delete-cancel" class="btn-secondary">取消</button>
      </div>
    </div>

    ${setsHtml || '<p style="margin-top:12px;">此 Session 沒有任何組別資料。</p>'}
  `

  $('#btn-export-session').addEventListener('click', () => {
    void exportSessionJson(session)
  })

  const confirmBox = $('#delete-confirm-box')
  $('#btn-delete-step1').addEventListener('click', () => {
    pendingDeleteId = session.session_id
    confirmBox.classList.remove('hidden')
  })
  $('#btn-delete-cancel').addEventListener('click', () => {
    pendingDeleteId = null
    confirmBox.classList.add('hidden')
  })
  $('#btn-delete-confirm').addEventListener('click', () => {
    if (pendingDeleteId !== session.session_id) return
    void handleDelete(session.session_id)
  })

  // 重新標記選中項目
  const sessions = await listSessions()
  renderSessionList(sessions)
}

async function handleDelete(sessionId: string): Promise<void> {
  try {
    await deleteSession(sessionId)
    selectedSessionId = null
    pendingDeleteId = null
    elDetailSection.classList.add('hidden')
    elDetail.innerHTML = ''
    showBanner('已刪除該 Session 與本地 Pose 檔案', 'ok')
    await refreshList()
  } catch (err) {
    showBanner(`刪除失敗：${String(err)}`, 'fail')
  }
}

async function refreshList(): Promise<void> {
  try {
    const sessions = await listSessions()
    renderSessionList(sessions)
    const params = new URLSearchParams(window.location.search)
    const initialId = params.get('session')
    if (initialId && sessions.some((s) => s.session_id === initialId)) {
      await openSession(initialId)
    }
  } catch (err) {
    elList.innerHTML = ''
    showBanner(`讀取紀錄失敗：${String(err)}`, 'fail')
  }
}

void refreshList()
