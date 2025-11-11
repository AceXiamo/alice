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
    let heartbeatInterval: NodeJS.Timeout | null = null

    // 发送心跳
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
      } catch (err) {
        console.error('[Heartbeat] Failed to send:', err)
      }
    }

    const connect = () => {
      try {
        // 将 sessionId 作为 URL 参数传递，服务端用于去重
        eventSource = new EventSource(`/api/stats?sessionId=${sessionId}`)

        eventSource.onopen = () => {
          setIsConnected(true)
          console.log('[SSE] Connected to stats stream, session:', sessionId)

          // 启动心跳发送（每5秒发送一次）
          if (heartbeatInterval) clearInterval(heartbeatInterval)
          heartbeatInterval = setInterval(sendHeartbeat, 5000)
          // 立即发送一次心跳
          sendHeartbeat()
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
          // 停止心跳
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
            heartbeatInterval = null
          }
          // EventSource 会自动重连，无需手动处理
        }
      } catch (err) {
        console.error('[SSE] Failed to create connection:', err)
      }
    }

    connect()

    // 清理函数：组件卸载时关闭连接和心跳
    return () => {
      console.log('[SSE] Component unmounting, closing connection')

      // 停止心跳
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval)
        heartbeatInterval = null
      }

      // 关闭 SSE 连接
      if (eventSource) {
        eventSource.close()
        eventSource = null
      }
    }
  }, [])

  return { stats, isConnected }
}
