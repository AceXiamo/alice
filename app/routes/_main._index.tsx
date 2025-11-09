import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import type { Route } from './+types/_main._index'
import { ParticleSphere } from '../components/ParticleSphere'
// import { Meteors } from '../components/meteors'

export function meta({}: Route.MetaArgs) {
  return [{ title: 'alice' }, { name: 'description', content: 'Voice-first AI chat companion' }]
}

// 定义 SpeechRecognition 类型
interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

export default function HomePage() {
  const [messages, setMessages] = useState<Array<{ id: number; role: 'user' | 'assistant'; content: string }>>([])
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingDuration, setLoadingDuration] = useState<number>(0)
  const ttsAudioRef = useRef<HTMLAudioElement>(null)
  const [audioFileName, setAudioFileName] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState(0) // 0..1
  const [audioTimes, setAudioTimes] = useState<{ cur: number; dur: number }>({ cur: 0, dur: 0 })
  const audioUrlRef = useRef<string | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // 初始化语音识别
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'zh-CN'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript
        setInputValue(transcript)
        setIsListening(false)
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  // 自动调整 textarea 高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [inputValue])

  const handleStartListening = () => {
    if (recognitionRef.current && !isListening) {
      setIsListening(true)
      recognitionRef.current.start()
    }
  }

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return

    const newMessage = {
      id: Date.now(),
      role: 'user' as const,
      content: inputValue,
    }
    setMessages((prev) => [...prev, newMessage])
    setInputValue('')
    setIsLoading(true)
    setLoadingDuration(0)

    // Start a timer to show loading duration
    const startTime = Date.now()
    const timerInterval = setInterval(() => {
      setLoadingDuration(Number(((Date.now() - startTime) / 1000).toFixed(1)))
    }, 100)

    ;(async () => {
      try {
        // Get sessionId from sessionStorage (same as SSE connection)
        const sessionId = sessionStorage.getItem('alice-session-id') || null

        // Get conversation history (last 5 messages)
        const history = messages.slice(-5).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

        // Call combined AI + TTS endpoint
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: newMessage.content,
            history: history,
            sessionId: sessionId,
          }),
        })

        const data = (await res.json()) as { text?: string; audioUrl?: string; duration?: number; error?: string; message?: string }

        // Handle 429 concurrent limit exceeded
        if (res.status === 429) {
          clearInterval(timerInterval)
          const duration = data.duration || 0
          setLoadingDuration(duration)

          // Show error message to user
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'assistant' as const,
              content: data.message || '当前请求繁忙，请稍后重试',
            },
          ])
          return
        }

        if (!res.ok) {
          throw new Error(data.error || 'api_error')
        }

        const text = data.text || '...'
        const audioUrl = data.audioUrl
        const duration = data.duration || 0

        // Update loading duration with actual API duration
        clearInterval(timerInterval)
        setLoadingDuration(duration)

        // Add assistant message to UI only after receiving both text and audio
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant' as const,
            content: text,
          },
        ])

        // Play TTS audio if available
        if (audioUrl) {
          if (audioUrlRef.current && audioUrlRef.current.startsWith('blob:')) {
            URL.revokeObjectURL(audioUrlRef.current)
          }
          audioUrlRef.current = audioUrl
          setAudioFileName('alice-response.wav')
          setAudioProgress(0)
          setAudioTimes({ cur: 0, dur: 0 })

          const audioEl = ttsAudioRef.current
          if (audioEl) {
            audioEl.src = audioUrl
            audioEl.muted = false
            audioEl.volume = 1
            try {
              await audioEl.play()
              console.log('Playing TTS audio:', audioUrl)
            } catch (err) {
              console.warn('Audio playback failed:', err)
            }
          }
        }
      } catch (e) {
        clearInterval(timerInterval)
        // fallback: simple echo for preview when backend is unavailable
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            role: 'assistant' as const,
            content: '（本地回显）' + newMessage.content,
          },
        ])
      } finally {
        setIsLoading(false)
        // Keep duration visible for a moment, then reset
        setTimeout(() => setLoadingDuration(0), 2000)
      }
    })()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Audio upload + progress handling
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handlePickAudio = () => fileInputRef.current?.click()
  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type
    if (!type.startsWith('audio/') && !/\.(mp3|wav|m4a)$/i.test(file.name)) {
      alert('请选择音频文件（mp3 / wav / m4a）')
      return
    }
    const url = URL.createObjectURL(file)
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = url
    setAudioFileName(file.name)
    setAudioProgress(0)
    setAudioTimes({ cur: 0, dur: 0 })
    const el = ttsAudioRef.current
    if (el) {
      el.src = url
      el.muted = false
      el.volume = 1
      try {
        await el.play()
      } catch (err) {
        console.warn('Audio play failed:', err)
      }
    }
  }

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return '00:00'
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  useEffect(() => {
    const el = ttsAudioRef.current
    if (!el) return
    const onTime = () => {
      const dur = el.duration || 0
      const cur = el.currentTime || 0
      setAudioTimes({ cur, dur })
      setAudioProgress(dur > 0 ? Math.min(1, cur / dur) : 0)
    }
    const onLoaded = () => onTime()
    const onEnded = () => {
      onTime()
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('ended', onEnded)
    }
  }, [])

  return (
    <div className="h-full relative bg-gradient-to-br from-gray-100 via-white to-gray-100 dark:bg-gradient-to-br dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-hidden">
      {/* 主显示：粒子球（3D 大圆球），全屏覆盖；音波由 TTS 音频驱动 */}
      <div className="absolute inset-0">
        <ParticleSphere className="absolute inset-0 translate-y-[-150px] pointer-events-none" audioRef={ttsAudioRef} />
        <audio ref={ttsAudioRef} className="hidden" />
      </div>

      {/* 底部输入区域 - 保持原位置（悬浮） */}
      <div className="absolute bottom-20 left-0 right-0 px-6 pb-6 pt-4 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto relative">
          {/* 聊天记录展示区域 - 浮动在输入框上方 */}
          <div className="absolute bottom-full left-0 right-0 mb-5 max-h-[500px] overflow-hidden">
            <div className="flex flex-col gap-2.5 pb-2">
              <AnimatePresence mode="popLayout">
                {messages.slice(-5).map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="max-w-full"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            : 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                        }`}
                      >
                        <Icon
                          icon={msg.role === 'user' ? 'solar:user-bold' : 'solar:magic-stick-3-bold'}
                          className="w-3.5 h-3.5"
                        />
                      </div>
                      <div
                        className={`flex-1 px-3.5 py-2.5 rounded-2xl shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50'
                            : 'bg-gradient-to-br from-blue-50/90 to-purple-50/90 dark:from-blue-950/50 dark:to-purple-950/50 backdrop-blur-sm border border-blue-200/30 dark:border-blue-800/30'
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word text-gray-800 dark:text-gray-100">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-md focus-within:shadow-xl transition-all">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              className="w-full bg-transparent px-4 pt-4 pb-20 text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none max-h-[200px] leading-relaxed overflow-hidden"
              rows={1}
              style={{ minHeight: '72px' }}
            />
            {/* 音频进度条 */}
            {/* {audioFileName && (
              <div className="absolute left-3 right-3 bottom-14">
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span className="truncate max-w-[60%]" title={audioFileName}>{audioFileName}</span>
                  <span className="ml-auto tabular-nums">{formatTime(audioTimes.cur)} / {formatTime(audioTimes.dur)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-blue-500 via-violet-500 to-pink-500"
                    style={{ width: `${Math.round(audioProgress * 100)}%` }}
                  />
                </div>
              </div>
            )} */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={true}
                  className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="附加文件"
                >
                  <Icon icon="solar:paperclip-bold" className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  disabled={true}
                  className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="添加图片"
                >
                  <Icon icon="solar:gallery-add-bold" className="w-5 h-5" />
                </button>
                {/* 上传音频文件 */}
                <button
                  type="button"
                  disabled={true}
                  onClick={handlePickAudio}
                  className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="上传音频（mp3 / wav / m4a）"
                >
                  <Icon icon="solar:music-note-2-bold" className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg, audio/mp3, audio/wav, audio/x-wav, audio/wave, audio/mp4, audio/x-m4a, .m4a"
                  onChange={handleAudioFileChange}
                  className="hidden"
                />
              </div>
              <div className="flex items-center gap-1">
                <motion.button
                  type="button"
                  disabled={true}
                  onClick={isListening ? handleStopListening : handleStartListening}
                  className={`p-2.5 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors ${
                    isListening
                      ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={isListening ? '停止录音' : '语音输入'}
                  animate={isListening ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Icon icon="solar:microphone-bold" className="w-5 h-5" />
                </motion.button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-all min-w-[40px] flex items-center justify-center"
                  title={isLoading ? `加载中... ${loadingDuration}s` : '发送消息'}
                >
                  {isLoading && loadingDuration > 0 ? (
                    <span className="text-xs font-medium tabular-nums min-w-[45px]">{loadingDuration.toFixed(1)}s</span>
                  ) : (
                    <Icon icon={isLoading ? 'svg-spinners:3-dots-fade' : 'solar:alt-arrow-up-bold'} className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
