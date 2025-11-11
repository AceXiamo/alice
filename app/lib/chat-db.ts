/**
 * IndexedDB service for client-side chat history storage
 */

import type { ChatMessage, ChatSession } from './chat-db.types';

export type { ChatMessage, ChatSession };

// SSR guard - provide a dummy implementation for server-side
const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

const DB_NAME = 'alice-chat-history';
const DB_VERSION = 1;

class ChatDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    if (!isBrowser) {
      console.warn('IndexedDB is not available (running in SSR)');
      return;
    }

    if (this.db) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Create messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
          messagesStore.createIndex('sessionId', 'sessionId', { unique: false });
          messagesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save a message to the database
   */
  async saveMessage(message: ChatMessage): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages', 'sessions'], 'readwrite');
      const messagesStore = transaction.objectStore('messages');
      const sessionsStore = transaction.objectStore('sessions');

      // Save the message
      messagesStore.put(message);

      // Update the session
      const sessionRequest = sessionsStore.get(message.sessionId);

      sessionRequest.onsuccess = () => {
        const session = sessionRequest.result as ChatSession | undefined;
        const now = Date.now();

        const updatedSession: ChatSession = session
          ? {
              ...session,
              updatedAt: now,
              messageCount: session.messageCount + 1,
              lastMessage: message.role === 'user' ? message.content.substring(0, 100) : session.lastMessage,
            }
          : {
              id: message.sessionId,
              createdAt: now,
              updatedAt: now,
              messageCount: 1,
              lastMessage: message.role === 'user' ? message.content.substring(0, 100) : undefined,
            };

        sessionsStore.put(updatedSession);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get all messages for a specific session
   */
  async getMessagesBySession(sessionId: string): Promise<ChatMessage[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('sessionId');
      const request = index.getAll(IDBKeyRange.only(sessionId));

      request.onsuccess = () => {
        const messages = request.result as ChatMessage[];
        messages.sort((a, b) => a.createdAt - b.createdAt);
        resolve(messages);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all sessions sorted by most recent
   */
  async getAllSessions(): Promise<ChatSession[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = request.result as ChatSession[];
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(sessions);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a session and all its messages
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages', 'sessions'], 'readwrite');
      const messagesStore = transaction.objectStore('messages');
      const sessionsStore = transaction.objectStore('sessions');

      // Delete all messages for this session
      const index = messagesStore.index('sessionId');
      const request = index.openCursor(IDBKeyRange.only(sessionId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete the session
      sessionsStore.delete(sessionId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages', 'sessions'], 'readwrite');

      transaction.objectStore('messages').clear();
      transaction.objectStore('sessions').clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | undefined> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(sessionId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export a singleton instance
export const chatDB = new ChatDatabase();
