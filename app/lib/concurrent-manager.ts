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
  private concurrent = 0
  private readonly maxConcurrent = 6

  /**
   * 添加在线连接（使用连接 ID 去重）
   */
  addConnection(connectionId: string): void {
    this.activeConnections.add(connectionId)
  }

  /**
   * 移除在线连接
   */
  removeConnection(connectionId: string): void {
    this.activeConnections.delete(connectionId)
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
