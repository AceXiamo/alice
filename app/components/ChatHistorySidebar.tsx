import { Icon } from '@iconify/react'
import { useState, useEffect } from 'react'
import { chatDB } from '../lib/chat-db'
import type { ChatSession } from '../lib/chat-db.types'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatHistorySidebarProps {
  onSessionSelect: (sessionId: string) => void
  currentSessionId: string | null
  onNewChat: () => void
  refreshTrigger?: number
}

export function ChatHistorySidebar({ onSessionSelect, currentSessionId, onNewChat, refreshTrigger }: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load sessions on mount and when refreshTrigger changes
  useEffect(() => {
    loadSessions()
  }, [refreshTrigger])

  const loadSessions = async () => {
    if (typeof window === 'undefined') return

    try {
      setIsLoading(true)
      const allSessions = await chatDB.getAllSessions()
      setSessions(allSessions)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm('确定要删除这个会话吗？')) return

    if (typeof window === 'undefined') return

    try {
      await chatDB.deleteSession(sessionId)
      await loadSessions()

      // If deleted session is current, start new chat
      if (currentSessionId === sessionId) {
        onNewChat()
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      alert('删除失败，请重试')
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins} 分钟前`
    if (diffHours < 24) return `${diffHours} 小时前`
    if (diffDays < 7) return `${diffDays} 天前`

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  return (
    <div className="w-64 h-full flex flex-col rounded-lg bg-gradient-to-b from-gray-50 to-gray-100/50 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="p-4 border-b border-gray-200/60 dark:border-gray-800/60">
        <button
          onClick={onNewChat}
          className="w-full group flex items-center justify-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all duration-200 text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Icon icon="solar:add-circle-bold" className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
          <span>新建对话</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Icon icon="svg-spinners:3-dots-fade" className="w-8 h-8 text-blue-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <Icon icon="solar:inbox-line-bold" className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium">暂无聊天记录</p>
            <p className="text-xs mt-1 text-gray-400">开始新对话来创建记录</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {sessions.map((session) => (
                <motion.div key={session.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                  <button
                    onClick={() => onSessionSelect(session.id)}
                    className={`group relative w-full text-left p-2 rounded-lg transition-all duration-200 ${
                      currentSessionId === session.id
                        ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-950/50 border border-blue-200/60 dark:border-blue-700/60 shadow-sm'
                        : 'bg-white/50 dark:bg-gray-800/30 hover:bg-white dark:hover:bg-gray-800/50 border border-gray-200/40 dark:border-gray-700/40 hover:border-gray-300/60 dark:hover:border-gray-600/60 hover:shadow-md'
                    }`}
                  >
                    {/* Active indicator */}
                    {currentSessionId === session.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full" />}

                    <div className="flex items-start justify-between gap-1.5 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {currentSessionId === session.id && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50 animate-pulse" />}
                        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">{formatDate(session.updatedAt)}</p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-all duration-200"
                        title="删除会话"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-0.5 leading-snug">{session.lastMessage || '空会话'}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      <Icon icon="solar:chat-line-bold" className="w-3 h-3" />
                      <span>{session.messageCount} 条消息</span>
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer Tips */}
      <div className="p-3 border-t border-gray-200/60 dark:border-gray-800/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono">
              <span className="text-gray-600 dark:text-gray-300">{navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>
              <span>+</span>
              <span className="text-gray-600 dark:text-gray-300">.</span>
            </div>
            <span>切换历史记录</span>
          </div>
          <div className="flex items-start gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <Icon icon="solar:info-circle-bold" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p className="leading-relaxed">历史记录保存在浏览器中，清除浏览器数据将丢失记录</p>
          </div>
        </div>
      </div>
    </div>
  )
}
