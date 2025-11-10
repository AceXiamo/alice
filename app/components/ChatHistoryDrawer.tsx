import { Icon } from '@iconify/react';
import { Drawer } from 'vaul';
import { useState, useEffect } from 'react';
import { chatDB, type ChatSession, type ChatMessage } from '~/lib/chat-db';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionSelect: (sessionId: string) => void;
  currentSessionId: string | null;
}

export function ChatHistoryDrawer({ open, onOpenChange, onSessionSelect, currentSessionId }: ChatHistoryDrawerProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch sessions when drawer opens
  useEffect(() => {
    if (open) {
      loadSessions();
    }
  }, [open]);

  // Load messages when a session is selected
  useEffect(() => {
    if (selectedSession) {
      loadMessages(selectedSession);
    }
  }, [selectedSession]);

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

  const loadMessages = async (sessionId: string) => {
    if (typeof window === 'undefined') return;

    try {
      setIsLoading(true);
      const sessionMessages = await chatDB.getMessagesBySession(sessionId);
      setMessages(sessionMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
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
      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('删除失败，请重试');
    }
  };

  const handleLoadSession = (sessionId: string) => {
    onSessionSelect(sessionId);
    onOpenChange(false);
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
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-xl rounded-t-3xl bg-white dark:bg-gray-900 outline-none transition-all duration-300 ease-in-out"
          style={{ height: '80vh' }}
        >
          <div className="mx-auto mt-3 mb-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />

          <div className="px-5 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300">
                  <Icon icon="solar:history-bold" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">聊天历史</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{sessions.length} 个会话</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-2 text-gray-400 transition-colors hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <Icon icon="solar:close-circle-bold" className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {/* Sessions List */}
            <div className={`${selectedSession ? 'w-2/5' : 'w-full'} overflow-y-auto border-r border-gray-200 dark:border-gray-700 transition-all`}>
              {isLoading && sessions.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Icon icon="svg-spinners:3-dots-fade" className="w-8 h-8 text-gray-400" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
                  <Icon icon="solar:inbox-line-bold" className="w-12 h-12 mb-2" />
                  <p className="text-sm">暂无聊天记录</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session.id)}
                      className={`group relative rounded-xl p-3 cursor-pointer transition-all ${
                        selectedSession === session.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                          : currentSessionId === session.id
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                          : 'bg-gray-50 dark:bg-gray-800/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                      } border`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {currentSessionId === session.id && (
                            <span className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                              <Icon icon="solar:check-circle-bold" className="w-3 h-3" />
                            </span>
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Messages Preview */}
            {selectedSession && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    <Icon icon="solar:alt-arrow-left-bold" className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleLoadSession(selectedSession)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    <Icon icon="solar:download-bold" className="w-3.5 h-3.5" />
                    <span>加载此会话</span>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Icon icon="svg-spinners:3-dots-fade" className="w-8 h-8 text-gray-400" />
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-start gap-2"
                        >
                          <div
                            className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                              msg.role === 'user'
                                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                            }`}
                          >
                            <Icon
                              icon={msg.role === 'user' ? 'solar:user-bold' : 'solar:magic-stick-3-bold'}
                              className="w-3 h-3"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
                              {msg.content}
                            </p>
                            {msg.audioUrl && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                                <Icon icon="solar:volume-loud-bold" className="w-3 h-3" />
                                <span>有语音</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
