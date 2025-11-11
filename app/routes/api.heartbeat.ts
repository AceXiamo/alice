import type { Route } from './+types/api.heartbeat'
import { concurrentManager } from '../lib/concurrent-manager'

/**
 * 心跳 API
 * 客户端定期调用此接口以保持在线状态
 *
 * 用法：
 * POST /api/heartbeat
 * Body: { sessionId: 'xxx' }
 */
export async function action({ request }: Route.ActionFunctionArgs) {
  try {
    const body = await request.json()
    const { sessionId } = body

    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // 更新心跳时间
    concurrentManager.updateHeartbeat(sessionId)

    return Response.json({ success: true })
  } catch (err) {
    console.error('[Heartbeat] Error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
