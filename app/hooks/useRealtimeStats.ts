import { useState, useEffect } from 'react'

interface Stats {
  onlineUsers: number
  concurrent: number
  maxConcurrent: number
}

/**
 * 实时统计数据 Hook
 * 通过 SSE 连接获取服务器实时推送的在线用户数和并发数
 */
export function useRealtimeStats() {
  const [stats, setStats] = useState<Stats>({
    onlineUsers: 0,
    concurrent: 0,
    maxConcurrent: 6,
  })
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // 仅在客户端环境运行
    if (typeof window === 'undefined') return

    // 生成或获取客户端唯一会话 ID（存储在 sessionStorage，标签页内唯一）
    let sessionId = sessionStorage.getItem('alice-session-id')
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      sessionStorage.setItem('alice-session-id', sessionId)
    }

    let eventSource: EventSource | null = null

    const connect = () => {
      try {
        // 将 sessionId 作为 URL 参数传递，服务端用于去重
        eventSource = new EventSource(`/api/stats?sessionId=${sessionId}`)

        eventSource.onopen = () => {
          setIsConnected(true)
          console.log('[SSE] Connected to stats stream, session:', sessionId)
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as Stats
            setStats(data)
          } catch (err) {
            console.error('[SSE] Failed to parse stats:', err)
          }
        }

        eventSource.onerror = () => {
          setIsConnected(false)
          console.warn('[SSE] Connection error')
          // EventSource 会自动重连，无需手动处理
        }
      } catch (err) {
        console.error('[SSE] Failed to create connection:', err)
      }
    }

    connect()

    // 页面卸载时主动关闭连接（桌面浏览器）
    const handleBeforeUnload = () => {
      if (eventSource) {
        console.log('[SSE] Page unloading (beforeunload), closing connection')
        eventSource.close()
      }
    }

    // pagehide 事件：移动端更可靠的卸载事件
    const handlePageHide = () => {
      if (eventSource) {
        console.log('[SSE] Page hiding (pagehide), closing connection')
        eventSource.close()
        eventSource = null
      }
    }

    // freeze 事件：Page Lifecycle API，移动端浏览器冻结页面时触发
    const handleFreeze = () => {
      if (eventSource) {
        console.log('[SSE] Page freezing, closing connection')
        eventSource.close()
        eventSource = null
      }
    }

    // resume 事件：页面从冻结恢复时重连
    const handleResume = () => {
      if (!eventSource) {
        console.log('[SSE] Page resuming, reconnecting')
        connect()
      }
    }

    // 页面隐藏时也关闭连接（用户切换标签页或最小化窗口）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && eventSource) {
        console.log('[SSE] Page hidden (visibilitychange), closing connection')
        eventSource.close()
        eventSource = null
      } else if (document.visibilityState === 'visible' && !eventSource) {
        console.log('[SSE] Page visible, reconnecting')
        connect()
      }
    }

    // 注册所有事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('freeze', handleFreeze)
    document.addEventListener('resume', handleResume)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // 清理函数
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('freeze', handleFreeze)
      document.removeEventListener('resume', handleResume)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (eventSource) {
        console.log('[SSE] Component unmounting, closing connection')
        eventSource.close()
      }
    }
  }, [])

  return { stats, isConnected }
}
