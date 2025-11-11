/**
 * 全局并发控制管理器
 * 管理在线用户数和并发请求数
 */

interface Stats {
  onlineUsers: number
  concurrent: number
  maxConcurrent: number
}

class ConcurrentManager {
  private activeConnections = new Set<string>() // 使用 Set 存储唯一连接 ID
  private heartbeats = new Map<string, number>() // 存储每个连接的最后心跳时间戳
  private concurrent = 0
  private readonly maxConcurrent = 6
  private readonly heartbeatTimeout = 15000 // 15秒未心跳视为断开
  private heartbeatCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    // 启动心跳超时检查（每5秒检查一次）
    this.startHeartbeatCheck()
  }

  /**
   * 启动心跳超时检查
   */
  private startHeartbeatCheck(): void {
    this.heartbeatCheckInterval = setInterval(() => {
      const now = Date.now()
      const toRemove: string[] = []

      this.heartbeats.forEach((lastHeartbeat, connectionId) => {
        if (now - lastHeartbeat > this.heartbeatTimeout) {
          console.log(`[Heartbeat] Connection timeout: ${connectionId}`)
          toRemove.push(connectionId)
        }
      })

      toRemove.forEach(id => this.removeConnection(id))
    }, 5000)
  }

  /**
   * 添加在线连接（使用连接 ID 去重）
   */
  addConnection(connectionId: string): void {
    this.activeConnections.add(connectionId)
    this.heartbeats.set(connectionId, Date.now())
  }

  /**
   * 更新连接的心跳时间
   */
  updateHeartbeat(connectionId: string): void {
    if (this.activeConnections.has(connectionId)) {
      this.heartbeats.set(connectionId, Date.now())
    } else {
      // 如果连接不存在，自动添加（兼容性处理）
      this.addConnection(connectionId)
    }
  }

  /**
   * 移除在线连接
   */
  removeConnection(connectionId: string): void {
    this.activeConnections.delete(connectionId)
    this.heartbeats.delete(connectionId)
  }

  /**
   * 获取在线用户数（基于活跃连接数）
   */
  getOnlineUsers(): number {
    return this.activeConnections.size
  }

  /**
   * 尝试获取并发槽位
   * @returns true 表示成功获取槽位，false 表示已达上限
   */
  acquireSlot(): boolean {
    if (this.concurrent >= this.maxConcurrent) {
      return false
    }
    this.concurrent++
    return true
  }

  /**
   * 释放并发槽位
   */
  releaseSlot(): void {
    this.concurrent = Math.max(0, this.concurrent - 1)
  }

  /**
   * 获取当前统计数据
   */
  getStats(): Stats {
    return {
      onlineUsers: this.activeConnections.size,
      concurrent: this.concurrent,
      maxConcurrent: this.maxConcurrent,
    }
  }

  /**
   * 获取当前并发数
   */
  getConcurrent(): number {
    return this.concurrent
  }

  /**
   * 检查是否可以接受新请求
   */
  canAcceptRequest(): boolean {
    return this.concurrent < this.maxConcurrent
  }
}

// 导出单例实例
export const concurrentManager = new ConcurrentManager()
