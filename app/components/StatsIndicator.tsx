import { Icon } from '@iconify/react'

interface StatsIndicatorProps {
  onlineUsers: number
  concurrent: number
  maxConcurrent: number
  isConnected: boolean
}

/**
 * 实时统计指示器组件
 * 展示在线用户数和并发情况
 * 采用极简设计风格
 */
export function StatsIndicator({ onlineUsers, concurrent, maxConcurrent, isConnected }: StatsIndicatorProps) {
  // 根据并发情况决定颜色和图标
  const getConcurrentStyle = () => {
    const ratio = concurrent / maxConcurrent
    if (ratio >= 1) {
      return {
        color: 'text-red-500 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200/50 dark:border-red-800/50',
      }
    }
    if (ratio >= 0.8) {
      return {
        color: 'text-orange-500 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200/50 dark:border-orange-800/50',
      }
    }
    return {
      color: 'text-emerald-500 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-200/50 dark:border-emerald-800/50',
    }
  }

  const concurrentStyle = getConcurrentStyle()

  return (
    <div className="flex items-center gap-2">
      {/* 在线用户数 */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50"
        title={`${onlineUsers} 位用户在线`}
      >
        <Icon icon="solar:users-group-rounded-bold" className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{onlineUsers}</span>
        <span className="text-xs text-gray-500 dark:text-gray-500">在线</span>
      </div>

      {/* 并发数/队列 */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${concurrentStyle.bgColor} ${concurrentStyle.borderColor}`}
        title={`当前 ${concurrent}/${maxConcurrent} 并发请求`}
      >
        <Icon icon="solar:server-bold" className={`w-3.5 h-3.5 ${concurrentStyle.color}`} />
        <span className={`text-xs font-semibold tabular-nums ${concurrentStyle.color}`}>
          {concurrent}/{maxConcurrent}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-500">队列</span>
      </div>

      {/* 连接状态指示器 */}
      {!isConnected && (
        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse" title="连接中..." />
      )}
    </div>
  )
}
