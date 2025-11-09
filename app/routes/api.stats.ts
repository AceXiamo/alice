import type { Route } from './+types/api.stats'
import { concurrentManager } from '../lib/concurrent-manager'

/**
 * SSE (Server-Sent Events) 实时统计推送
 *
 * 用法：
 * const eventSource = new EventSource('/api/stats?sessionId=xxx')
 * eventSource.onmessage = (e) => {
 *   const stats = JSON.parse(e.data)
 *   console.log(stats) // { onlineUsers, concurrent, maxConcurrent }
 * }
 */
export async function loader({ request }: Route.LoaderFunctionArgs) {
  // 从 URL 参数获取客户端会话 ID
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId')

  // 如果没有 sessionId，生成一个（兜底方案）
  const clientId = sessionId || `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

  // 添加连接（使用客户端 sessionId，同一标签页的重连会自动去重）
  concurrentManager.addConnection(clientId)

  // 创建 SSE 流
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // 发送统计数据的函数
      const sendStats = () => {
        const stats = concurrentManager.getStats()
        const data = `data: ${JSON.stringify(stats)}\n\n`
        try {
          controller.enqueue(encoder.encode(data))
        } catch (err) {
          console.error('SSE send error:', err)
          clearInterval(intervalId)
        }
      }

      // 立即发送一次
      sendStats()

      // 每 2 秒推送一次统计数据
      const intervalId = setInterval(sendStats, 2000)

      // 处理连接关闭
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId)
        concurrentManager.removeConnection(clientId)
        console.log('[SSE] Connection closed, session:', clientId)
        try {
          controller.close()
        } catch (err) {
          // 流可能已经关闭，忽略错误
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    },
  })
}
