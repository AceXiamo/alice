import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import type { Route } from './+types/_main._index'
import { ParticleSphere } from '../components/ParticleSphere'
import { Drawer } from 'vaul'
import { ChatHistorySidebar } from '../components/ChatHistorySidebar'
import { chatDB } from '../lib/chat-db'
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
  const [displayedMessages, setDisplayedMessages] = useState<Array<{ id: number; role: 'user' | 'assistant'; content: string }>>([])
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingDuration, setLoadingDuration] = useState<number>(0)
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false)
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0)
  const ttsAudioRef = useRef<HTMLAudioElement>(null)
  const [audioFileName, setAudioFileName] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState(0) // 0..1
  const [audioTimes, setAudioTimes] = useState<{ cur: number; dur: number }>({ cur: 0, dur: 0 })
  const audioUrlRef = useRef<string | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const providerIcons: Record<AIProvider['type'], string> = {
    vertexai: 'solar:cloud-bold',
    gemini: 'solar:star-bold',
    openai: 'solar:cpu-bolt-bold',
  }
  const providerAccentClass: Record<AIProvider['type'], string> = {
    vertexai: 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
    gemini: 'bg-violet-50 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
    openai: 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  }
  const providerGhostIconClass: Record<AIProvider['type'], string> = {
    vertexai: 'text-amber-600 dark:text-amber-300',
    gemini: 'text-violet-600 dark:text-violet-300',
    openai: 'text-blue-600 dark:text-blue-300',
  }
  const providerTypeOptions: { id: AIProvider['type']; label: string; description: string }[] = [
    { id: 'openai', label: 'OpenAI', description: '兼容 OpenAI / Azure OpenAI' },
    { id: 'gemini', label: 'Gemini', description: 'Google Gemini API' },
    { id: 'vertexai', label: 'Vertex AI', description: 'Google Cloud Vertex AI' },
  ]
  const labelIconWrapper = 'inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-[13px] shadow-[0_4px_12px_rgba(15,23,42,0.08)] dark:bg-white/5'
  const inputBaseClass =
    'w-full rounded-md border border-gray-200/80 bg-gray-50/80 px-3 py-2 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-100 dark:placeholder-gray-500'
  // AI Provider Management
  interface AIProvider {
    id: string
    name: string
    type: 'vertexai' | 'gemini' | 'openai'
    endpoint: string
    apiKey: string
    credentials: string // For Vertex AI: credentials JSON
    location: string // For Vertex AI: region location
    model: string
    enableSearch: boolean
  }

  const [providers, setProviders] = useState<AIProvider[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('alice-providers')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {}
      }
    }
    return []
  })

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('alice-selected-provider')
    }
    return null
  })

  const [showProviderModal, setShowProviderModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)
  const [showHistorySidebar, setShowHistorySidebar] = useState(true)

  // Save providers to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('alice-providers', JSON.stringify(providers))
    }
  }, [providers])

  // Save selected provider to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedProviderId) {
        localStorage.setItem('alice-selected-provider', selectedProviderId)
      } else {
        localStorage.removeItem('alice-selected-provider')
      }
    }
  }, [selectedProviderId])

  // Keyboard shortcut: Cmd/Ctrl + . to toggle history sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        setShowHistorySidebar((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Manage displayed messages for proper exit animations
  useEffect(() => {
    const latestMessages = messages.slice(-5)
    const latestIds = new Set(latestMessages.map((m) => m.id))

    // Find messages that need to exit (in displayedMessages but not in latestMessages)
    const exitingMessages = displayedMessages.filter((m) => !latestIds.has(m.id))

    if (exitingMessages.length > 0) {
      // Show both exiting messages and new messages during transition
      const transitionMessages = [...exitingMessages, ...latestMessages]
      setDisplayedMessages(transitionMessages)

      // After animation completes, show only latest messages
      const timer = setTimeout(() => {
        setDisplayedMessages(latestMessages)
      }, 320) // Slightly longer than animation duration to ensure completion

      return () => clearTimeout(timer)
    } else {
      // No exiting messages, update immediately
      setDisplayedMessages(latestMessages)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  // Save message to IndexedDB helper
  const saveMessageToDB = async (message: { id: number; role: 'user' | 'assistant'; content: string }, audioUrl?: string) => {
    if (typeof window === 'undefined') return

    try {
      const sessionId = sessionStorage.getItem('alice-session-id')
      if (!sessionId) return

      await chatDB.saveMessage({
        id: message.id.toString(),
        sessionId,
        role: message.role,
        content: message.content,
        audioUrl,
        createdAt: Date.now(),
      })

      // Trigger history sidebar refresh
      setHistoryRefreshTrigger((prev) => prev + 1)
    } catch (error) {
      console.error('Failed to save message to IndexedDB:', error)
    }
  }

  // Handle session switching
  const handleSessionSelect = async (sessionId: string) => {
    if (typeof window === 'undefined') return

    try {
      // Load messages from the selected session
      const savedMessages = await chatDB.getMessagesBySession(sessionId)
      const loadedMessages = savedMessages.map((msg) => ({
        id: parseInt(msg.id) || Date.now(),
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))
      setMessages(loadedMessages)
      setDisplayedMessages(loadedMessages.slice(-5))

      // Update session ID in sessionStorage
      sessionStorage.setItem('alice-session-id', sessionId)
    } catch (error) {
      console.error('Failed to load session:', error)
      alert('加载会话失败，请重试')
    }
  }

  // Handle new chat (clear current session)
  const handleNewChat = () => {
    // Generate a new session ID
    const newSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    sessionStorage.setItem('alice-session-id', newSessionId)
    setMessages([])
    setDisplayedMessages([])
  }

  // Provider management functions
  const handleAddProvider = () => {
    setEditingProvider({
      id: Date.now().toString(),
      name: '',
      type: 'openai',
      endpoint: '',
      apiKey: '',
      credentials: '',
      location: 'us-central1',
      model: '',
      enableSearch: false,
    })
    setShowProviderModal(true)
  }

  const handleEditProvider = (provider: AIProvider) => {
    setEditingProvider({ ...provider })
    setShowProviderModal(true)
  }

  const handleSaveProvider = () => {
    if (!editingProvider || !editingProvider.name.trim()) return

    const existingIndex = providers.findIndex((p) => p.id === editingProvider.id)
    if (existingIndex >= 0) {
      // Update existing
      const newProviders = [...providers]
      newProviders[existingIndex] = editingProvider
      setProviders(newProviders)
    } else {
      // Add new
      setProviders([...providers, editingProvider])
      setSelectedProviderId(editingProvider.id)
    }
    setShowProviderModal(false)
    setEditingProvider(null)
  }

  const handleDeleteProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id))
    if (selectedProviderId === id) {
      setSelectedProviderId(null)
    }
  }

  useEffect(() => {
    // 初始化语音识别
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'zh-CN'

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          console.log('Speech recognition result:', event)
          const transcript = event.results[0][0].transcript
          setInputValue(transcript)
          setIsListening(false)
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
        }

        recognition.onend = () => {
          setIsListening(false)
        }

        recognitionRef.current = recognition
        setIsSpeechRecognitionSupported(true)
        console.log('Speech recognition initialized successfully')
      } catch (error) {
        console.error('Failed to initialize speech recognition:', error)
        setIsSpeechRecognitionSupported(false)
      }
    } else {
      console.warn('Speech recognition not supported in this browser')
      setIsSpeechRecognitionSupported(false)
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (error) {
          // Ignore errors on cleanup
        }
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
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error('Failed to start speech recognition:', error)
        setIsListening(false)
      }
    }
  }

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (error) {
        console.error('Failed to stop speech recognition:', error)
      }
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
    // Save user message to IndexedDB
    saveMessageToDB(newMessage)
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

        // Get selected provider config
        const selectedProvider = selectedProviderId ? providers.find((p) => p.id === selectedProviderId) : null

        // Call combined AI + TTS endpoint
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: newMessage.content,
            history: history,
            sessionId: sessionId,
            aiConfig: selectedProvider
              ? {
                  provider: selectedProvider.type,
                  endpoint: selectedProvider.endpoint,
                  apiKey: selectedProvider.apiKey,
                  credentials: selectedProvider.credentials,
                  location: selectedProvider.location,
                  model: selectedProvider.model,
                  enableSearch: selectedProvider.enableSearch,
                }
              : undefined,
          }),
        })

        const data = (await res.json()) as { text?: string; audioUrl?: string; duration?: number; error?: string; message?: string }

        // Handle 429 concurrent limit exceeded
        if (res.status === 429) {
          clearInterval(timerInterval)
          const duration = data.duration || 0
          setLoadingDuration(duration)

          // Show error message to user
          const errorMessage = {
            id: Date.now(),
            role: 'assistant' as const,
            content: data.message || '当前请求繁忙，请稍后重试',
          }
          setMessages((prev) => [...prev, errorMessage])
          saveMessageToDB(errorMessage)
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
        const assistantMessage = {
          id: Date.now(),
          role: 'assistant' as const,
          content: text,
        }
        setMessages((prev) => [...prev, assistantMessage])
        // Save assistant message to IndexedDB
        saveMessageToDB(assistantMessage, audioUrl || undefined)

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
        const fallbackMessage = {
          id: Date.now(),
          role: 'assistant' as const,
          content: '（本地回显）' + newMessage.content,
        }
        setMessages((prev) => [...prev, fallbackMessage])
        saveMessageToDB(fallbackMessage)
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
    <div className="w-full h-full flex">
      {/* Chat History Sidebar */}
      <div
        className={`transition-width duration-300 ${showHistorySidebar ? 'mr-2 w-[256px]' : 'mr-0 w-0'}`}
      >
        <ChatHistorySidebar
          onSessionSelect={handleSessionSelect}
          currentSessionId={typeof window !== 'undefined' ? sessionStorage.getItem('alice-session-id') : null}
          onNewChat={handleNewChat}
          refreshTrigger={historyRefreshTrigger}
        />
      </div>

      {/* chat */}
      <div className="h-full flex-1 rounded-lg relative bg-linear-to-br from-gray-100 via-white to-gray-100 dark:bg-linear-to-br dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-hidden transition-all duration-300">
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
                <AnimatePresence initial={false}>
                  {displayedMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      layout
                      className="max-w-full"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                            msg.role === 'user' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          <Icon icon={msg.role === 'user' ? 'solar:user-bold' : 'solar:magic-stick-3-bold'} className="w-3 h-3" />
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap wrap-break-word text-gray-900 dark:text-gray-100 flex-1">{msg.content}</p>
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
                className="w-full bg-transparent px-4 pt-4 pb-20 text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none max-h-[200px] leading-relaxed overflow-hidden"
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
                    <Icon icon="solar:paperclip-bold" className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={true}
                    className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    title="添加图片"
                  >
                    <Icon icon="solar:gallery-add-bold" className="w-4 h-4" />
                  </button>
                  {/* 上传音频文件 */}
                  <button
                    type="button"
                    disabled={true}
                    onClick={handlePickAudio}
                    className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    title="上传音频（mp3 / wav / m4a）"
                  >
                    <Icon icon="solar:music-note-2-bold" className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/mpeg, audio/mp3, audio/wav, audio/x-wav, audio/wave, audio/mp4, audio/x-m4a, .m4a"
                    onChange={handleAudioFileChange}
                    className="hidden"
                  />
                  {/* 联网搜索开关 - 仅当选中的 Provider 支持搜索时显示 (Vertex AI / Gemini) */}
                  {selectedProviderId && (providers.find((p) => p.id === selectedProviderId)?.type === 'vertexai' || providers.find((p) => p.id === selectedProviderId)?.type === 'gemini') && (
                    <button
                      type="button"
                      onClick={() => {
                        const provider = providers.find((p) => p.id === selectedProviderId)
                        if (provider) {
                          const updatedProviders = providers.map((p) => (p.id === selectedProviderId ? { ...p, enableSearch: !p.enableSearch } : p))
                          setProviders(updatedProviders)
                        }
                      }}
                      className={`p-2.5 rounded-xl transition-colors ${
                        providers.find((p) => p.id === selectedProviderId)?.enableSearch
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={providers.find((p) => p.id === selectedProviderId)?.enableSearch ? '联网搜索已启用' : '联网搜索已禁用'}
                    >
                      <Icon icon="solar:global-bold" className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <motion.button
                    type="button"
                    disabled={isLoading || !isSpeechRecognitionSupported}
                    onClick={isListening ? handleStopListening : handleStartListening}
                    className={`p-2.5 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors ${
                      isListening
                        ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={!isSpeechRecognitionSupported ? '浏览器不支持语音识别' : isListening ? '停止录音' : '语音输入'}
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

            {/* Provider 选择器 - 固定在输入框下方 */}
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {/* 默认配置选项 */}
              <button
                type="button"
                onClick={() => setSelectedProviderId(null)}
                className={`group inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[10px] font-medium transition-colors ${
                  selectedProviderId === null
                    ? 'border-emerald-400 text-emerald-600 dark:border-emerald-500/60 dark:text-emerald-300'
                    : 'border-gray-200/70 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500'
                }`}
                title="使用服务器默认配置"
              >
                <span
                  className={`flex h-3 w-3 items-center justify-center rounded-full border bg-transparent ${selectedProviderId === null ? 'border-emerald-400' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  <Icon icon="solar:settings-bold" className={`w-3 h-3 ${selectedProviderId === null ? 'text-emerald-500 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}`} />
                </span>
                <span>默认</span>
              </button>

              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderId(provider.id)}
                  onDoubleClick={() => handleEditProvider(provider)}
                  className={`group inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[10px] font-medium transition-colors ${
                    selectedProviderId === provider.id
                      ? 'border-emerald-400 text-emerald-600 dark:border-emerald-500/60 dark:text-emerald-300'
                      : 'border-gray-200/70 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500'
                  }`}
                  title="双击编辑"
                >
                  <span
                    className={`flex h-3 w-3 items-center justify-center rounded-full border bg-transparent ${
                      selectedProviderId === provider.id ? 'border-emerald-400' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <Icon
                      icon={providerIcons[provider.type]}
                      className={`w-3 h-3 ${selectedProviderId === provider.id ? 'text-emerald-500 dark:text-emerald-300' : providerGhostIconClass[provider.type]}`}
                    />
                  </span>
                  <span>{provider.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={handleAddProvider}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[10px] font-medium transition-colors border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all"
                title="添加 Provider"
              >
                <Icon icon="solar:add-circle-bold" className="w-3 h-3" />
                <span>添加</span>
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowHistorySidebar((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[10px] font-medium transition-all ${
                  showHistorySidebar
                    ? 'border-blue-400 text-blue-600 bg-blue-50 dark:border-blue-500/60 dark:text-blue-300 dark:bg-blue-900/20'
                    : 'border-gray-200/70 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-500'
                }`}
                title={`${showHistorySidebar ? '关闭' : '打开'}历史记录 (${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+.)`}
              >
                <Icon icon={showHistorySidebar ? 'solar:sidebar-minimalistic-bold' : 'solar:history-bold'} className="w-3 h-3" />
                <span>{showHistorySidebar ? '收起' : '历史'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Provider 配置 Drawer */}
        <Drawer.Root open={showProviderModal} onOpenChange={setShowProviderModal}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
            <Drawer.Content
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-xl rounded-t-3xl bg-white dark:bg-gray-900 outline-none transition-all duration-300 ease-in-out"
              style={{
                height: editingProvider ? (editingProvider.type === 'vertexai' ? '750px' : editingProvider.type === 'gemini' ? '660px' : '590px') : '590px',
                transition: 'height 0.3s',
              }}
            >
              <div className="mx-auto mt-3 mb-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                {editingProvider && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${providerAccentClass[editingProvider.type]}`}>
                          <Icon icon={providerIcons[editingProvider.type]} className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Provider 设置</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">填写信息以连接 API</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setShowProviderModal(false)} className="p-2 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300">
                        <Icon icon="solar:close-circle-bold" className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                          <span className={`${labelIconWrapper} text-sky-500 dark:text-sky-300`}>
                            <Icon icon="solar:tag-bold" className="h-3.5 w-3.5" />
                          </span>
                          <span>名称</span>
                        </label>
                        <input
                          type="text"
                          value={editingProvider.name}
                          onChange={(e) => setEditingProvider({ ...editingProvider, name: e.target.value })}
                          placeholder="My OpenAI"
                          className={inputBaseClass}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                          <span className={`${labelIconWrapper} text-violet-500 dark:text-violet-300`}>
                            <Icon icon="solar:widget-2-bold" className="h-3.5 w-3.5" />
                          </span>
                          <span>类型</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {providerTypeOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setEditingProvider({ ...editingProvider, type: option.id })}
                              className={`flex items-center justify-center gap-3 rounded-lg border bg-white px-2 py-2.5 transition-all dark:bg-gray-800/50 ${
                                editingProvider.type === option.id
                                  ? 'border-blue-500 dark:border-blue-400 bg-blue-100 dark:bg-blue-900/20'
                                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${providerAccentClass[option.id]}`}>
                                <Icon icon={providerIcons[option.id]} className="h-4 w-4" />
                              </span>
                              <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-100">{option.label}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 transition-all duration-200 ease-in-out">
                      {editingProvider.type !== 'vertexai' && (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                            <span className={`${labelIconWrapper} text-emerald-500 dark:text-emerald-300`}>
                              <Icon icon="solar:link-bold" className="h-3.5 w-3.5" />
                            </span>
                            <span>Endpoint</span>
                          </label>
                          <input
                            type="text"
                            value={editingProvider.endpoint}
                            onChange={(e) => setEditingProvider({ ...editingProvider, endpoint: e.target.value })}
                            placeholder={editingProvider.type === 'openai' ? 'https://api.openai.com/v1' : 'https://generativelanguage.googleapis.com/v1beta'}
                            className={inputBaseClass}
                          />
                        </div>
                      )}

                      {editingProvider.type === 'vertexai' ? (
                        <>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                              <span className={`${labelIconWrapper} text-amber-500 dark:text-amber-300`}>
                                <Icon icon="solar:document-text-bold" className="h-3.5 w-3.5" />
                              </span>
                              <span>Credentials JSON</span>
                            </label>
                            <textarea
                              value={editingProvider.credentials}
                              onChange={(e) => setEditingProvider({ ...editingProvider, credentials: e.target.value })}
                              placeholder='{"type":"service_account","project_id":"...","private_key":"..."}'
                              rows={4}
                              className={`${inputBaseClass} resize-none font-mono text-[11px]`}
                            />
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">Vertex AI 服务账号凭据 JSON，留空使用服务器配置</p>
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                              <span className={`${labelIconWrapper} text-orange-500 dark:text-orange-300`}>
                                <Icon icon="solar:global-bold" className="h-3.5 w-3.5" />
                              </span>
                              <span>Location</span>
                            </label>
                            <input
                              type="text"
                              value={editingProvider.location}
                              onChange={(e) => setEditingProvider({ ...editingProvider, location: e.target.value })}
                              placeholder="us-central1"
                              className={inputBaseClass}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                            <span className={`${labelIconWrapper} text-blue-500 dark:text-blue-300`}>
                              <Icon icon="solar:key-bold" className="h-3.5 w-3.5" />
                            </span>
                            <span>API Key</span>
                          </label>
                          <input
                            type="password"
                            value={editingProvider.apiKey}
                            onChange={(e) => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                            placeholder="留空使用服务器配置"
                            className={inputBaseClass}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                          <span className={`${labelIconWrapper} text-indigo-500 dark:text-indigo-300`}>
                            <Icon icon="solar:server-bold" className="h-3.5 w-3.5" />
                          </span>
                          <span>Model</span>
                        </label>
                        <input
                          type="text"
                          value={editingProvider.model}
                          onChange={(e) => setEditingProvider({ ...editingProvider, model: e.target.value })}
                          placeholder={editingProvider.type === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'}
                          className={inputBaseClass}
                        />
                      </div>

                      {(editingProvider.type === 'vertexai' || editingProvider.type === 'gemini') && (
                        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-800 dark:bg-gray-800/60">
                          <div className="flex items-center gap-2">
                            <span className={`${labelIconWrapper} text-emerald-500 dark:text-emerald-300`}>
                              <Icon icon="solar:global-bold" className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <p className="text-xs font-medium text-gray-800 dark:text-gray-100">联网搜索</p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">让模型结合最新资料回答</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingProvider({ ...editingProvider, enableSearch: !editingProvider.enableSearch })}
                            className={`h-7 w-12 rounded-full border-2 transition-all ${
                              editingProvider.enableSearch ? 'border-blue-500 bg-blue-500/20' : 'border-gray-300 bg-transparent dark:border-gray-700'
                            }`}
                          >
                            <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-gray-200 ${editingProvider.enableSearch ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      {providers.find((p) => p.id === editingProvider.id) && (
                        <button
                          type="button"
                          onClick={() => {
                            handleDeleteProvider(editingProvider.id)
                            setShowProviderModal(false)
                          }}
                          className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[13px] font-medium text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="h-3.5 w-3.5" />
                          <span>删除</span>
                        </button>
                      )}
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setShowProviderModal(false)}
                        className="rounded-xl px-4 py-2 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProvider}
                        disabled={!editingProvider.name.trim()}
                        className="inline-flex items-center gap-1 rounded-xl bg-blue-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon icon="solar:check-circle-bold" className="h-3.5 w-3.5" />
                        <span>保存</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </div>
  )
}
