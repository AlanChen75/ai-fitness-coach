// Pose Landmarker Lite 載入、相機預覽與推論 benchmark
// 規格約束：inferenceInFlight 最大 1、只處理最新影格、記錄掉幀與統計
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

export interface CameraInfo {
  facing: string
  width: number
  height: number
  frameRate: number
  label: string
}

export interface BenchmarkResult {
  duration_s: number
  inference_count: number
  dropped_frames: number
  p50_ms: number
  p95_ms: number
  max_ms: number
  effective_pose_hz: number
  pose_detected_ratio: number
  delegate: string
  model: string
}

export async function startCamera(video: HTMLVideoElement): Promise<CameraInfo> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 }
    },
    audio: false
  })
  video.srcObject = stream
  await video.play()
  const track = stream.getVideoTracks()[0]
  const s = track.getSettings()
  return {
    facing: s.facingMode ?? 'unknown',
    width: s.width ?? video.videoWidth,
    height: s.height ?? video.videoHeight,
    frameRate: s.frameRate ?? 0,
    label: track.label
  }
}

export async function loadPose(): Promise<{ landmarker: PoseLandmarker; delegate: string }> {
  const fileset = await FilesetResolver.forVisionTasks('./wasm')
  // 先試 GPU delegate，失敗退 CPU（WASM）
  try {
    const landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: './models/pose_landmarker_lite.task', delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1
    })
    return { landmarker, delegate: 'GPU' }
  } catch (e) {
    console.warn('GPU delegate failed, falling back to CPU', e)
    const landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: './models/pose_landmarker_lite.task', delegate: 'CPU' },
      runningMode: 'VIDEO',
      numPoses: 1
    })
    return { landmarker, delegate: 'CPU' }
  }
}

const SKELETON: ReadonlyArray<readonly [number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28]
]

function drawSkeleton(ctx: CanvasRenderingContext2D, lm: Array<{ x: number; y: number }>, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#0ea5e9'
  ctx.lineWidth = 3
  for (const [a, b] of SKELETON) {
    if (!lm[a] || !lm[b]) continue
    ctx.beginPath()
    ctx.moveTo(lm[a].x * w, lm[a].y * h)
    ctx.lineTo(lm[b].x * w, lm[b].y * h)
    ctx.stroke()
  }
  ctx.fillStyle = '#10b981'
  for (const p of lm) {
    ctx.beginPath()
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2)
    ctx.fill()
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return Math.round(sorted[idx] * 10) / 10
}

export function runBenchmark(
  landmarker: PoseLandmarker,
  delegate: string,
  video: HTMLVideoElement,
  overlay: HTMLCanvasElement,
  durationS: number,
  onTick: (msg: string) => void
): Promise<BenchmarkResult> {
  return new Promise((resolve) => {
    const ctx = overlay.getContext('2d')
    overlay.width = video.videoWidth
    overlay.height = video.videoHeight

    const latencies: number[] = []
    let framesPresented = 0
    let detected = 0
    let lastInferenceAt = 0
    const TARGET_INTERVAL_MS = 100 // 限頻約 10 Hz（規格 Standard 模式取樣目標）
    let stopped = false
    const start = performance.now()

    // 數相機實際送達的影格（支援時），掉幀 = 送達 - 取樣
    const videoWithRVFC = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number
    }
    const countFrame = () => {
      if (stopped) return
      framesPresented += 1
      videoWithRVFC.requestVideoFrameCallback?.(countFrame)
    }
    videoWithRVFC.requestVideoFrameCallback?.(countFrame)

    const loop = () => {
      if (stopped) return
      const now = performance.now()
      if (now - start >= durationS * 1000) {
        stopped = true
        const sorted = [...latencies].sort((a, b) => a - b)
        const durActual = (now - start) / 1000
        resolve({
          duration_s: Math.round(durActual * 10) / 10,
          inference_count: latencies.length,
          dropped_frames: Math.max(0, framesPresented - latencies.length),
          p50_ms: percentile(sorted, 50),
          p95_ms: percentile(sorted, 95),
          max_ms: sorted.length ? Math.round(sorted[sorted.length - 1] * 10) / 10 : 0,
          effective_pose_hz: Math.round((latencies.length / durActual) * 10) / 10,
          pose_detected_ratio: latencies.length ? Math.round((detected / latencies.length) * 1000) / 1000 : 0,
          delegate,
          model: 'pose_landmarker_lite.task'
        })
        return
      }

      if (now - lastInferenceAt >= TARGET_INTERVAL_MS && video.readyState >= 2) {
        lastInferenceAt = now
        const t0 = performance.now()
        try {
          const result = landmarker.detectForVideo(video, now)
          const dt = performance.now() - t0
          latencies.push(dt)
          if (result.landmarks && result.landmarks.length > 0) {
            detected += 1
            if (ctx) drawSkeleton(ctx, result.landmarks[0], overlay.width, overlay.height)
          } else if (ctx) {
            ctx.clearRect(0, 0, overlay.width, overlay.height)
          }
        } catch (e) {
          console.error('inference failed', e)
        }

        if (latencies.length % 10 === 0 && latencies.length > 0) {
          const remain = Math.max(0, durationS - (now - start) / 1000)
          onTick(`推論 ${latencies.length} 次 · 剩 ${Math.ceil(remain)} 秒`)
        }
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
}
