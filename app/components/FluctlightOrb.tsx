import { useEffect, useRef } from 'react'

type FluctlightOrbProps = {
  active: boolean
  className?: string
}

type Ring = { r: number; alpha: number; speed: number }
type Particle = { x: number; y: number; vx: number; vy: number; size: number; baseX: number; baseY: number }
type Orbiter = { radius: number; angle: number; speed: number; hue: number }

export function FluctlightOrb({ active, className }: FluctlightOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const ringsRef = useRef<Ring[]>([])
  const ampRef = useRef(0)
  const lastPeakRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const orbitersRef = useRef<Orbiter[]>([])

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

  // Init particles and orbiters once
  useEffect(() => {
    const initParticles = () => {
      const c = canvasRef.current
      if (!c) return
      const count = 80
      const arr: Particle[] = []
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const radius = 0.12 + Math.random() * 0.38 // relative to min(width,height)
        const size = 0.002 + Math.random() * 0.006
        const vx = (Math.random() - 0.5) * 0.00035
        const vy = (Math.random() - 0.5) * 0.00035
        const baseX = Math.cos(angle) * radius
        const baseY = Math.sin(angle) * radius
        arr.push({ x: baseX, y: baseY, vx, vy, size, baseX, baseY })
      }
      particlesRef.current = arr
    }
    const initOrbiters = () => {
      const arr: Orbiter[] = []
      const n = 5
      for (let i = 0; i < n; i++) {
        arr.push({
          radius: 0.12 + i * 0.055 + Math.random() * 0.02,
          angle: Math.random() * Math.PI * 2,
          speed: (Math.random() > 0.5 ? 1 : -1) * (0.25 + Math.random() * 0.45),
          hue: 220 + i * 24 + Math.random() * 16,
        })
      }
      orbitersRef.current = arr
    }
    initParticles()
    initOrbiters()
  }, [])

  // Audio lifecycle
  useEffect(() => {
    if (!active) {
      stop()
      // keep idle animation
      if (!rafRef.current) draw()
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) return
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
        const audioCtx: AudioContext = new AudioCtx()
        audioCtxRef.current = audioCtx

        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.85
        analyserRef.current = analyser

        const source = audioCtx.createMediaStreamSource(stream)
        sourceRef.current = source
        streamRef.current = stream
        source.connect(analyser)

        draw()
      } catch (e) {
        console.error('Mic permission / init failed', e)
        draw() // still idle
      }
    })()

    return () => {
      cancelled = true
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    try {
      sourceRef.current?.disconnect()
      analyserRef.current?.disconnect()
    } catch {}
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    sourceRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const timeData = analyser ? new Uint8Array(analyser.fftSize) : null
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    let prevTs = performance.now()

    const render = () => {
      rafRef.current = requestAnimationFrame(render)
      const now = performance.now()
      const dt = Math.min(0.05, (now - prevTs) / 1000)
      prevTs = now

      const { width: w, height: h } = canvas
      const s = Math.min(w, h)
      const cx = w / 2
      const cy = h / 2

      // Amplitude + bands
      let amp = ampRef.current
      let low = 0,
        mid = 0,
        high = 0
      if (analyser && timeData && freqData) {
        analyser.getByteTimeDomainData(timeData)
        let sum = 0
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / timeData.length)
        amp = amp * 0.85 + rms * 0.15
        ampRef.current = amp

        analyser.getByteFrequencyData(freqData)
        const n = freqData.length
        const lEnd = Math.floor(n * 0.12)
        const mEnd = Math.floor(n * 0.45)
        let lSum = 0,
          mSum = 0,
          hSum = 0
        for (let i = 0; i < n; i++) {
          const v = freqData[i] / 255
          if (i < lEnd) lSum += v
          else if (i < mEnd) mSum += v
          else hSum += v
        }
        low = lSum / Math.max(1, lEnd)
        mid = mSum / Math.max(1, mEnd - lEnd)
        high = hSum / Math.max(1, n - mEnd)
      } else {
        // idle breathing
        const t = now * 0.001
        amp = 0.02 + 0.01 * (Math.sin(t * 1.2) + 1) * 0.5
        ampRef.current = amp
        low = 0.03 + 0.02 * (Math.sin(now * 0.0011) + 1) * 0.5
        mid = 0.04 + 0.02 * (Math.sin(now * 0.0014 + 1.7) + 1) * 0.5
        high = 0.03 + 0.02 * (Math.sin(now * 0.0017 + 3.1) + 1) * 0.5
      }

      // Peak -> spawn ring
      if (amp > 0.07) {
        if (now - lastPeakRef.current > 180) {
          ringsRef.current.push({ r: s * 0.02, alpha: 0.5, speed: s * (0.12 + Math.min(0.25, amp * 1.2)) })
          lastPeakRef.current = now
        }
      }

      // Clear frame
      ctx.clearRect(0, 0, w, h)

      // Background radial glow (very subtle)
      const bg = ctx.createRadialGradient(cx, cy, s * 0.1, cx, cy, s * 0.75)
      bg.addColorStop(0, 'rgba(59,130,246,0.12)')
      bg.addColorStop(0.6, 'rgba(139,92,246,0.08)')
      bg.addColorStop(1, 'rgba(236,72,153,0.04)')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      // Core orb with bloom
      const coreR = s * (0.09 + amp * 0.2)
      ctx.save()
      ;(ctx as any).filter = `blur(${Math.max(4, s * 0.01)}px)`
      ctx.globalCompositeOperation = 'lighter'
      const core = ctx.createRadialGradient(cx, cy, coreR * 0.25, cx, cy, coreR)
      core.addColorStop(0, 'rgba(255,255,255,0.95)')
      core.addColorStop(0.6, `rgba(99,102,241,${0.7 + high * 0.2})`)
      core.addColorStop(1, `rgba(59,130,246,${0.3 + mid * 0.2})`)
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fillStyle = core
      ctx.fill()
      ctx.restore()

      // Aura ring
      ctx.save()
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.arc(cx, cy, coreR + s * 0.02 + amp * s * 0.06, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(147,197,253,0.6)'
      ctx.lineWidth = Math.max(1, s * 0.0032)
      ctx.stroke()
      ctx.restore()

      // Radial beams
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const beamCount = 28
      for (let i = 0; i < beamCount; i++) {
        const t = now * 0.0005
        const a = (i / beamCount) * Math.PI * 2 + t * 2
        const len = s * (0.18 + 0.16 * (mid * 0.8 + high * 0.6))
        const w2 = Math.max(1, s * 0.0025)
        const x = cx + Math.cos(a) * (coreR + s * 0.02)
        const y = cy + Math.sin(a) * (coreR + s * 0.02)
        const x2 = cx + Math.cos(a) * (coreR + len)
        const y2 = cy + Math.sin(a) * (coreR + len)
        const grad = ctx.createLinearGradient(x, y, x2, y2)
        grad.addColorStop(0, `rgba(168,85,247,${0.0})`)
        grad.addColorStop(0.2, `rgba(99,102,241,${0.35 + high * 0.25})`)
        grad.addColorStop(1, `rgba(59,130,246,0)`)
        ctx.strokeStyle = grad
        ctx.lineWidth = w2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
      ctx.restore()

      // Expanding rings
      const rings = ringsRef.current
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i]
        ring.r += ring.speed * dt
        ring.alpha *= 0.984
        if (ring.alpha < 0.02 || ring.r > s * 0.8) {
          rings.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ;(ctx as any).filter = `blur(${Math.max(2, s * 0.004)}px)`
        ctx.beginPath()
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(99,102,241,${ring.alpha})`
        ctx.lineWidth = Math.max(1, s * 0.0026)
        ctx.stroke()
        ctx.restore()
      }

      // Particles around core
      const pts = particlesRef.current
      if (pts.length) {
        // subtle rotation
        const rot = (amp * 0.5 + 0.02) * dt
        const sin = Math.sin(rot)
        const cos = Math.cos(rot)

        for (let i = 0; i < pts.length; i++) {
          const p = pts[i]
          // gently drift
          p.x += p.vx
          p.y += p.vy
          // pull back to base
          p.x += (p.baseX - p.x) * 0.005
          p.y += (p.baseY - p.y) * 0.005
          // amplitude push
          p.x *= 1 + amp * 0.03
          p.y *= 1 + amp * 0.03
          // small rotation
          const rx = p.x * cos - p.y * sin
          const ry = p.x * sin + p.y * cos
          p.x = rx
          p.y = ry

          const px = cx + p.x * s
          const py = cy + p.y * s
          const size = Math.max(1, p.size * s)
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ;(ctx as any).filter = `blur(${Math.max(0.5, s * 0.002)}px)`
          ctx.beginPath()
          ctx.arc(px, py, size, 0, Math.PI * 2)
          const a = Math.min(0.9, 0.18 + amp * 1.2)
          ctx.fillStyle = `rgba(236,72,153,${a})`
          ctx.fill()
          ctx.restore()
        }

        // Constellation connections (sampled)
        ctx.save()
        ctx.globalAlpha = 0.35 + amp * 0.4
        ctx.strokeStyle = 'rgba(147,197,253,0.55)'
        for (let i = 0; i < pts.length; i += 4) {
          const p1 = pts[i]
          const x1 = cx + p1.x * s
          const y1 = cy + p1.y * s
          for (let j = i + 4; j < pts.length; j += 4) {
            const p2 = pts[j]
            const dx = (p2.x - p1.x) * s
            const dy = (p2.y - p1.y) * s
            const d = Math.hypot(dx, dy)
            const threshold = s * (0.12 + amp * 0.18)
            if (d < threshold) {
              const alpha = 1 - d / threshold
              ctx.globalAlpha = (0.1 + high * 0.5) * alpha
              ctx.lineWidth = Math.max(0.4, s * 0.001)
              ctx.beginPath()
              ctx.moveTo(x1, y1)
              ctx.lineTo(cx + p2.x * s, cy + p2.y * s)
              ctx.stroke()
            }
          }
        }
        ctx.restore()
      }

      // Orbiters and trails
      const orbs = orbitersRef.current
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i]
        o.angle += o.speed * dt * (0.4 + high * 0.8)
        const rr = s * o.radius * (1 + amp * 0.15)
        const ox = cx + Math.cos(o.angle) * rr
        const oy = cy + Math.sin(o.angle) * rr
        const sz = Math.max(1.5, s * 0.006 * (0.7 + high))
        ;(ctx as any).filter = `blur(${Math.max(0.5, s * 0.003)}px)`
        ctx.fillStyle = `hsla(${o.hue}, 85%, ${70 + high * 25}%, ${0.8})`
        ctx.beginPath()
        ctx.arc(ox, oy, sz, 0, Math.PI * 2)
        ctx.fill()

        // orbit arc
        ctx.lineWidth = Math.max(0.5, s * 0.0016)
        ctx.strokeStyle = `hsla(${o.hue}, 90%, 65%, ${0.35 + mid * 0.25})`
        ctx.beginPath()
        ctx.arc(cx, cy, rr, o.angle - 0.6, o.angle + 0.2)
        ctx.stroke()
      }
      ctx.restore()
    }

    render()
  }

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
