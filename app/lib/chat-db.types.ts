/**
 * Type definitions for chat database
 */

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  lastMessage?: string;
}
