import { useEffect, useRef } from 'react'

type AudioWaveProps = {
  active: boolean
  className?: string
}

export function AudioWave({ active, className }: AudioWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // Resize canvas to device pixel ratio
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

  useEffect(() => {
    if (!active) {
      stop()
      // Clear canvas when inactive
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      if (c && ctx) {
        ctx.clearRect(0, 0, c.width, c.height)
      }
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
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.8
        analyserRef.current = analyser

        const source = audioCtx.createMediaStreamSource(stream)
        sourceRef.current = source
        streamRef.current = stream
        source.connect(analyser)

        draw()
      } catch (err) {
        // Silently fail if mic permission denied
        console.error('Mic init failed:', err)
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
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const render = () => {
      rafRef.current = requestAnimationFrame(render)
      analyser.getByteFrequencyData(dataArray)

      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      // Background glow
      const gradient = ctx.createLinearGradient(0, 0, width, 0)
      gradient.addColorStop(0, '#3b82f6')
      gradient.addColorStop(0.5, '#8b5cf6')
      gradient.addColorStop(1, '#ec4899')

      const barCount = 48
      const step = Math.floor(bufferLength / barCount)
      const barWidth = (width * 0.9) / (barCount * 2) // mirrored bars
      const centerX = width / 2
      const maxBarHeight = height * 0.9

      for (let i = 0; i < barCount; i++) {
        const v = dataArray[i * step] / 255
        const barHeight = Math.max(2, v * maxBarHeight)
        const xOffset = (i - barCount / 2) * (barWidth + 4)
        const x1 = centerX + xOffset
        const x2 = centerX - xOffset - barWidth

        // Left bar
        drawRoundedBar(ctx, x1, height / 2 - barHeight / 2, barWidth, barHeight, gradient)
        // Right bar (mirror)
        drawRoundedBar(ctx, x2, height / 2 - barHeight / 2, barWidth, barHeight, gradient)
      }
    }

    render()
  }

  const drawRoundedBar = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string | CanvasGradient,
  ) => {
    const r = Math.min(6, w / 2, h / 2)
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
    ctx.fill()
  }

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}

