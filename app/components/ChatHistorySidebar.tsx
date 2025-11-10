import { Icon } from '@iconify/react';
import { useState, useEffect } from 'react';
import { chatDB } from '../lib/chat-db';
import type { ChatSession } from '../lib/chat-db.types';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatHistorySidebarProps {
  onSessionSelect: (sessionId: string) => void;
  currentSessionId: string | null;
  onNewChat: () => void;
}

export function ChatHistorySidebar({ onSessionSelect, currentSessionId, onNewChat }: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    if (typeof window === 'undefined') return;

    try {
      setIsLoading(true);
      const allSessions = await chatDB.getAllSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('确定要删除这个会话吗？')) return;

    if (typeof window === 'undefined') return;

    try {
      await chatDB.deleteSession(sessionId);
      await loadSessions();

      // If deleted session is current, start new chat
      if (currentSessionId === sessionId) {
        onNewChat();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('删除失败，请重试');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className="w-64 h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors text-sm font-medium"
        >
          <Icon icon="solar:add-circle-bold" className="w-4 h-4" />
          <span>新建对话</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading && sessions.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Icon icon="svg-spinners:3-dots-fade" className="w-8 h-8 text-gray-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-center px-4">
            <Icon icon="solar:inbox-line-bold" className="w-12 h-12 mb-2" />
            <p className="text-xs">暂无聊天记录</p>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    onClick={() => onSessionSelect(session.id)}
                    className={`group w-full text-left p-3 rounded-lg transition-all ${
                      currentSessionId === session.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {currentSessionId === session.id && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {formatDate(session.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600 transition-all"
                        title="删除会话"
                      >
                        <Icon icon="solar:trash-bin-trash-bold" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                      {session.lastMessage || '空会话'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
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
    </div>
  );
}
