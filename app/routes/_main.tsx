import { Outlet } from 'react-router'
import { Icon } from '@iconify/react'
import { useState, useEffect } from 'react'
import type { Route } from './+types/_main'

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Alice' }, { name: 'description', content: 'Welcome to Alice!' }]
}

export default function MainLayout() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // 检查系统主题偏好和当前状态
    const isDarkMode = document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDark(isDarkMode)
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    }
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
        {/* Header - 无背景色 */}
        <header className="px-6 py-2 shrink-0">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1
                className="text-2xl font-bold animate-gradient bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-size-[300%_100%] bg-clip-text text-transparent"
                style={{ fontFamily: '"Dancing Script", cursive' }}
              >
                Alice
              </h1>
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <Icon icon={isDark ? 'mdi:white-balance-sunny' : 'mdi:moon-waning-crescent'} className="w-5 h-5" />
            </button>
          </nav>
        </header>

        {/* Main Content - 对话区域 */}
        <main className="flex-1 overflow-hidden rounded-lg">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
