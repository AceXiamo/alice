import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

// Global tweakables (defaults)
export const DEFAULT_SIZE_SCALE = 0.6 // 初始化大小（相对当前为 1）
export const DEFAULT_MOVE_AMP_SCALE = 8 // 粒子移动幅度（相对当前为 1）
export const DEFAULT_PARTICLE_SIZE = 0.3 // 粒子大小（相对当前为 1）
export const DEFAULT_PARTICLE_COUNT = 2400 // 粒子数量（建议：800 / 1200 / 1600 / 2000 / 2400）。说明：数量越大越细腻但更耗性能；推荐选择为 bandCount 的倍数以获得更均匀的频段分配（非强制）。

// Tuning constants
const BAND_COMPRESS_K = 0.9 // 频段能量压缩系数（越大越不易饱和）
const LOCAL_SAT_K = 0.5 // 局部位移软饱和阈值（越大越慢接近上限）
const SAFE_LOCAL_CAP = 2 // 绝对安全上限，防止越界

type ParticleSphereProps = {
  className?: string
  // Optional audio element to drive the wave (TTS playback)
  audioRef?: RefObject<HTMLAudioElement | null>
}

type Vec3 = { x: number; y: number; z: number }

export function ParticleSphere({ className, audioRef }: ParticleSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointsRef = useRef<Vec3[]>([])
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const ampRef = useRef(0)
  const bandERef = useRef<Float32Array | null>(null)
  const bandsRef = useRef<Uint8Array | null>(null)
  const bandAxesRef = useRef<Vec3[] | null>(null)
  const bandCount = 12

  // Build a Fibonacci sphere for uniform points on a sphere
  useEffect(() => {
    const N = DEFAULT_PARTICLE_COUNT
    const pts: Vec3[] = []
    const bands = new Uint8Array(N)
    const phi = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2 // from 1 to -1
      const radius = Math.sqrt(1 - y * y)
      const theta = phi * i
      const x = Math.cos(theta) * radius
      const z = Math.sin(theta) * radius
      pts.push({ x, y, z })
      // 频段标记使用索引哈希近似均匀映射到 [0, bandCount)
      // 粒子数量仅影响每个频段的粒子密度，不改变“分段律动”的机制；
      // 为更均匀的视觉分布，建议 N 取 bandCount 的倍数，但不是必须。
      bands[i] = hashBand(i, bandCount)
    }
    pointsRef.current = pts
    bandsRef.current = bands
    bandERef.current = new Float32Array(bandCount)
    // random unit axes per band for traveling wave directions
    const axes: Vec3[] = []
    for (let i = 0; i < bandCount; i++) {
      const ax = randUnit(i * 97 + 13)
      axes.push(ax)
    }
    bandAxesRef.current = axes
  }, [])

  // Resize canvas for DPR
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current
      if (!c) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth, clientHeight } = c
      c.width = Math.max(1, Math.floor(clientWidth * dpr))
      c.height = Math.max(1, Math.floor(clientHeight * dpr))
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // Hook up analyser to audio element (TTS) if provided
  useEffect(() => {
    const el = audioRef?.current
    if (!el) {
      // no audio source; still animate idle rotation
      if (!rafRef.current) draw()
      return
    }

    let disposed = false
    const init = () => {
      if (disposed) return
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
        audioCtxRef.current = new Ctx()
      }
      const audioCtx = audioCtxRef.current!
      // Use a single media element source; connecting twice throws
      if (!sourceRef.current) {
        try {
          sourceRef.current = audioCtx.createMediaElementSource(el)
        } catch (e) {
          // If already connected in another context, ignore and continue without analyser
          console.warn('media element source init failed:', e)
        }
      }
      if (!analyserRef.current && sourceRef.current) {
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.85
        analyserRef.current = analyser
        sourceRef.current.connect(analyser)
        // Route to output so audio is audible
        analyser.connect(audioCtx.destination)
      }
      if (!rafRef.current) draw()
    }

    const onPlay = () => {
      audioCtxRef.current?.resume().catch(() => {})
      init()
    }
    const onPause = () => {
      // keep analyser for continuous vis, amplitude will decay
    }
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    // If already playing, init immediately
    if (!el.paused) onPlay()
    else if (!rafRef.current) draw()

    return () => {
      disposed = true
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      try {
        analyserRef.current?.disconnect()
        sourceRef.current?.disconnect()
      } catch {}
      analyserRef.current = null
      sourceRef.current = null
      audioCtxRef.current?.close()
      audioCtxRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef?.current])

  const draw = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    const points = pointsRef.current
    const bands = bandsRef.current
    const axes = bandAxesRef.current
    const bandE = bandERef.current
    const analyser = analyserRef.current
    const freq = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    let last = performance.now()

    const render = () => {
      rafRef.current = requestAnimationFrame(render)
      const now = performance.now()
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      // amplitude from frequency bands
      let amp = ampRef.current
      const audioEl = audioRef?.current
      const playing = !!audioEl && !audioEl.paused
      if (analyser && freq && bandE && bands && playing) {
        analyser.getByteFrequencyData(freq)
        const n = freq.length
        // split into bandCount buckets
        const bucket = Math.floor(n / bandCount) || 1
        for (let b = 0; b < bandCount; b++) {
          let s = 0
          let c = 0
          const start = b * bucket
          const end = b === bandCount - 1 ? n : (b + 1) * bucket
          for (let i = start; i < end; i++) {
            s += freq[i]
            c++
          }
          const avg = s / (c * 255)
          // Soft compress to avoid hard cap saturation
          const comp = Math.tanh(avg / BAND_COMPRESS_K)
          bandE[b] = bandE[b] * 0.85 + comp * 0.15
        }
        // global amp as average of bands
        let gs = 0
        for (let b = 0; b < bandCount; b++) gs += bandE[b]
        const gavg = gs / bandCount
        amp = amp * 0.9 + gavg * 0.5
      } else {
        // idle: decay band energies to zero for a fully regular first view
        if (bandE) {
          for (let b = 0; b < bandCount; b++) bandE[b] *= 0.9
        }
        amp *= 0.9
      }
      ampRef.current = amp

      const { width: w, height: h } = c
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const s = Math.min(w, h)
      // Keep a conservative radius; scaled by DEFAULT_SIZE_SCALE
      const radius = s * 0.26 * DEFAULT_SIZE_SCALE
      const f = s * 0.62 // focal length slightly farther

      // rotation
      const t = now * 0.001
      const yaw = t * 0.4
      const pitch = 0.25 + Math.sin(t * 0.3) * 0.1
      const cosY = Math.cos(yaw)
      const sinY = Math.sin(yaw)
      const cosX = Math.cos(pitch)
      const sinX = Math.sin(pitch)

      // dot style
      const baseSize = Math.max(1, s * 0.002 * DEFAULT_PARTICLE_SIZE)

      // subtle background glow
      const grad = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.7)
      grad.addColorStop(0, 'rgba(99,102,241,0.10)')
      grad.addColorStop(1, 'rgba(99,102,241,0.0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // render points from back to front for simple depth cue
      // compute projected positions once to sort by depth
      const projected: { x: number; y: number; z: number; size: number; a: number }[] = []
      for (let i = 0; i < points.length; i++) {
        const p = points[i]
        const b = bands ? bands[i] : 0
        const be = bandE ? bandE[b] : 0.05
        const ax = axes ? axes[b] : { x: 0, y: 1, z: 0 }
        // Rotate around Y
        let x = p.x * cosY + p.z * sinY
        let z = -p.x * sinY + p.z * cosY
        // Rotate around X
        const y = p.y * cosX - z * sinX
        z = p.y * sinX + z * cosX

        // traveling wave gate for this band along its axis
        // dot in [-1,1], scale to spatial phase; add band-dependent speed
        const dot = x * ax.x + y * ax.y + z * ax.z
        const gate = 0.5 + 0.5 * Math.sin(dot * 5.2 + t * (0.7 + (b % 3) * 0.22))
        // per-point slight randomness to avoid perfect sync
        const rj = hash01(i * 13.37 + b * 19.19)
        // Map band energy to a local pulse; apply amplitude scale and soft-saturate instead of hard cap
        const localRaw = DEFAULT_MOVE_AMP_SCALE * be * (0.4 + 0.6 * gate) * (0.8 + 0.4 * rj)
        const targetMax = 0.07 * DEFAULT_MOVE_AMP_SCALE
        const maxLocal = Math.min(SAFE_LOCAL_CAP, targetMax)
        // Soft saturator approaches maxLocal gradually as localRaw grows
        const local = (localRaw / (localRaw + LOCAL_SAT_K)) * maxLocal

        // apply local radial pulse along normal
        const pulse = 1 + local
        x *= pulse
        const yy = y * pulse
        z *= pulse

        const px = x * radius
        const py = yy * radius
        const pz = z * radius
        const m = f / (f + pz + s * 0.2) // avoid division by 0; bring forward a bit
        const sx = cx + px * m
        const sy = cy + py * m
        const depth = (pz + radius) / (2 * radius) // 0..1
        const size = baseSize * (0.85 + 0.65 * (1 - depth) + local * 0.6)
        const alpha = 0.3 + 0.55 * (1 - depth) + local * 0.35
        projected.push({ x: sx, y: sy, z: pz, size, a: alpha })
      }
      projected.sort((a, b) => a.z - b.z)

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i]
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(168, 85, 247, ${Math.min(1, p.a)})`
        ctx.fill()
      }
      ctx.restore()
    }

    render()
  }

  // ---- utils ----
  function hash01(n: number) {
    const s = Math.sin(n) * 43758.5453123
    return s - Math.floor(s)
  }
  function hashBand(i: number, bands: number) {
    return Math.floor(hash01(i * 12.9898 + 78.233) * bands) % bands
  }
  function randUnit(seed: number): Vec3 {
    // generate pseudo-random unit vector
    const u = hash01(seed + 0.123)
    const v = hash01(seed * 1.987 + 3.21)
    const theta = 2 * Math.PI * u
    const z = 2 * v - 1
    const r = Math.sqrt(Math.max(0, 1 - z * z))
    return { x: r * Math.cos(theta), y: r * Math.sin(theta), z }
  }

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
