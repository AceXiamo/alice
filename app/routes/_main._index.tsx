import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import type { Route } from './+types/_main._index'
import { Meteors } from '../components/meteors'

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Alice - Voice AI Assistant' }, { name: 'description', content: 'Voice-first AI chat companion' }]
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

// Typing Animation Component
function TypingAnimation({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, 80)
      return () => clearTimeout(timeout)
    }
  }, [currentIndex, text])

  return <span className={className}>{displayText}</span>
}

export default function HomePage() {
  const [messages, setMessages] = useState<Array<{ id: number; role: 'user' | 'assistant'; content: string }>>([])
  const [inputValue, setInputValue] = useState('')
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
    if (!inputValue.trim()) return

    const newMessage = {
      id: Date.now(),
      role: 'user' as const,
      content: inputValue,
    }
    setMessages((prev) => [...prev, newMessage])
    setInputValue('')

    // TODO: 发送到后端，接收 AI 回复
    // 模拟 AI 回复
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'assistant',
          content: '我是 Alice，你的语音 AI 助手。这是一个测试回复。',
        },
      ])
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full relative bg-gray-100 dark:bg-gray-900 overflow-hidden">
      {/* Meteors 背景 */}
      {/* <Meteors number={30} /> */}

      {/* 对话消息区域 - 占据整个空间 */}
      <div className="absolute inset-0 overflow-y-auto px-6 py-8 pb-32">
        <AnimatePresence mode="wait">
          {messages.length === 0 ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col items-center justify-center text-center px-4"
            >
              {/* Logo 图标 */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 0.1,
                  type: 'spring',
                  stiffness: 200,
                  damping: 20,
                }}
                className="mb-6"
              >
                <div className="text-7xl">✨</div>
              </motion.div>

              {/* 标题 - Typing Animation */}
              <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-5xl font-bold mb-3">
                <TypingAnimation text="Good to see you!" className="animate-gradient bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-size-[300%_100%] bg-clip-text text-transparent" />
              </motion.h2>

              {/* 副标题 */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 }}
                className="text-base text-gray-500 dark:text-gray-500 max-w-md leading-relaxed mb-12"
              >
                Alice your personal and expert AI assistant for pretty much any tasks you can imagine.
              </motion.p>

              {/* 快捷对话建议 - 融入式设计 */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap items-center justify-center gap-3 max-w-2xl">
                {[
                  { icon: 'solar:chat-round-dots-bold', label: "Let's chat", iconColor: 'text-blue-500' },
                  { icon: 'solar:book-2-bold', label: 'Tell me a story', iconColor: 'text-purple-500' },
                  { icon: 'solar:calendar-mark-bold', label: "What's your plan today?", iconColor: 'text-green-500' },
                ].map((item, index) => (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.08 }}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setInputValue(item.label)}
                    className="group relative flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-white/40 dark:bg-gray-800/40 hover:bg-white/80 dark:hover:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300/80 dark:hover:border-gray-600/80 transition-all shadow-sm hover:shadow"
                  >
                    <Icon icon={item.icon} className={`w-5 h-5 ${item.iconColor}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">{item.label}</span>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="messages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-5 py-3.5 ${
                      message.role === 'user' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                    }`}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部输入区域 - 悬浮 */}
      <div className="absolute bottom-20 left-0 right-0 px-6 pb-6 pt-4 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          {/* 输入框容器 */}
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-md focus-within:shadow-xl transition-all">
            {/* 输入框 */}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              className="w-full bg-transparent px-4 pt-4 pb-16 text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none max-h-[200px] leading-relaxed overflow-hidden"
              rows={1}
              style={{ minHeight: '72px' }}
            />

            {/* 底部按钮行 */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              {/* 左侧工具按钮 */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="附加文件"
                >
                  <Icon icon="solar:paperclip-bold" className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="添加图片"
                >
                  <Icon icon="solar:gallery-add-bold" className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  title="搜索"
                >
                  <Icon icon="solar:minimalistic-magnifer-bold" className="w-5 h-5" />
                </button>
              </div>

              {/* 右侧操作按钮 */}
              <div className="flex items-center gap-1">
                <motion.button
                  type="button"
                  onClick={isListening ? handleStopListening : handleStartListening}
                  className={`p-2.5 rounded-xl transition-colors ${
                    isListening
                      ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title={isListening ? '停止录音' : '语音输入'}
                  animate={isListening ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Icon icon={isListening ? 'solar:microphone-bold' : 'solar:microphone-bold'} className="w-5 h-5" />
                </motion.button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-all"
                  title="发送消息"
                >
                  <Icon icon="solar:alt-arrow-up-bold" className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
