import { Outlet } from 'react-router'
import { Icon } from '@iconify/react'
import { useState, useEffect } from 'react'
import type { Route } from './+types/_main'
import { useRealtimeStats } from '../hooks/useRealtimeStats'
import { StatsIndicator } from '../components/StatsIndicator'

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Alice' }, { name: 'description', content: 'Welcome to Alice!' }]
}

export default function MainLayout() {
  const [isDark, setIsDark] = useState(false)
  const { stats, isConnected } = useRealtimeStats()

  useEffect(() => {
    // 默认使用亮色主题
    const isDarkMode = false
    setIsDark(isDarkMode)
    document.documentElement.classList.remove('dark')
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <div className="h-screen flex items-center justify-center p-2 bg-white dark:bg-gray-950">
      {/* 外层容器 - 白色外框 */}
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Header - 精简优雅设计 */}
        <header className="pb-2 shrink-0">
          <nav className="flex items-center justify-between">
            {/* Left: Logo + Description */}
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Alice Logo" className="w-6 h-6" />
              <h1
                className="text-md font-bold animate-gradient bg-linear-to-r from-emerald-500 via-green-500 to-teal-500 bg-size-[300%_100%] bg-clip-text text-transparent"
                style={{ fontFamily: 'var(--font-logo)' }}
              >
                alice
              </h1>
              {/* <span className="text-sm text-gray-500 dark:text-gray-400">Your Voice-First AI Chat Companion</span> */}
            </div>

            {/* Right: Stats + Theme + Author */}
            <div className="flex items-center gap-3">
              {/* 统计信息 */}
              <StatsIndicator
                onlineUsers={stats.onlineUsers}
                concurrent={stats.concurrent}
                maxConcurrent={stats.maxConcurrent}
                isConnected={isConnected}
              />

              {/* 分隔线 */}
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

              {/* 主题切换 */}
              <button
                onClick={toggleTheme}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                title={isDark ? '切换到浅色模式' : '切换到深色模式'}
              >
                <Icon icon={isDark ? 'solar:sun-bold' : 'solar:moon-bold'} className="w-4 h-4" />
              </button>

              {/* 作者信息 */}
              <a
                href="https://me.axm.moe"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 transition-all group"
                title="访问作者主页"
              >
                <img
                  src="https://axm.moe/avatar"
                  alt="AceXiamo"
                  className="w-4 h-4 rounded-full ring-1 ring-gray-200 dark:ring-gray-700"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  AceXiamo
                </span>
              </a>
            </div>
          </nav>
        </header>

        {/* Main Content - 对话区域 */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
