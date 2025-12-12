// IndexedDB 工具函数，用于存储聊天记录

const DB_NAME = 'ai_tools_db';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    images?: Array<{ data: string; mimeType: string }>;
    thinking?: string;
  }>;
}

let db: IDBDatabase | null = null;

// 初始化数据库
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment'));
      return;
    }

    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // 创建对象存储
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // 创建索引以便按更新时间排序
        objectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
  });
}

// 获取数据库实例
async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    db = await initDB();
  }
  return db;
}

// 计算数据大小（字节）
function calculateSize(data: any): number {
  return new Blob([JSON.stringify(data)]).size;
}

// 获取所有会话
export async function loadConversations(): Promise<Conversation[]> {
  if (typeof window === 'undefined') return [];

  try {
    const database = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('updatedAt');
      const request = index.openCursor(null, 'prev'); // 降序排列（最新的在前）

      const conversations: Conversation[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          conversations.push(cursor.value);
          cursor.continue();
        } else {
          resolve(conversations);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to load conversations'));
      };
    });
  } catch (error) {
    console.error('加载会话失败:', error);
    return [];
  }
}

// 保存单个会话
async function saveConversation(conversation: Conversation): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
    const request = store.put(conversation);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save conversation'));
  });
}

// 删除会话
async function deleteConversation(id: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete conversation'));
  });
}

// 获取所有会话的总大小
async function getTotalSize(): Promise<number> {
  const conversations = await loadConversations();
  return conversations.reduce((total, conv) => total + calculateSize(conv), 0);
}

// 清理旧会话直到总大小小于限制
async function cleanupOldConversations(maxSize: number): Promise<number> {
  const conversations = await loadConversations();
  
  // 按更新时间排序（最早的在前）
  const sorted = [...conversations].sort((a, b) => a.updatedAt - b.updatedAt);
  
  let totalSize = conversations.reduce((total, conv) => total + calculateSize(conv), 0);
  let deletedCount = 0;

  // 从最早的会话开始删除，直到总大小小于限制
  for (const conversation of sorted) {
    if (totalSize <= maxSize) {
      break;
    }
    
    const conversationSize = calculateSize(conversation);
    await deleteConversation(conversation.id);
    totalSize -= conversationSize;
    deletedCount++;
  }

  return deletedCount;
}

// 保存所有会话
export async function saveConversations(conversations: Conversation[]): Promise<void> {
  if (typeof window === 'undefined') return;

  const MAX_SIZE = 100 * 1024 * 1024; // 100MB

  try {
    // 先保存所有会话
    for (const conversation of conversations) {
      await saveConversation(conversation);
    }

    // 检查总大小，如果超过限制则清理
    const totalSize = await getTotalSize();
    if (totalSize > MAX_SIZE) {
      console.warn(`存储空间超过 ${MAX_SIZE / 1024 / 1024}MB，开始清理旧会话...`);
      const deletedCount = await cleanupOldConversations(MAX_SIZE);
      if (deletedCount > 0) {
        console.warn(`已清理 ${deletedCount} 个旧会话`);
      }
    }
  } catch (error) {
    console.error('保存会话失败:', error);
    throw error;
  }
}

// 删除会话
export async function removeConversation(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    await deleteConversation(id);
  } catch (error) {
    console.error('删除会话失败:', error);
    throw error;
  }
}

// 迁移 localStorage 数据到 IndexedDB（一次性操作）
export async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'ai_conversations';
  const MIGRATION_KEY = 'ai_conversations_migrated';

  // 检查是否已经迁移过
  if (localStorage.getItem(MIGRATION_KEY)) {
    return;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const conversations: Conversation[] = JSON.parse(stored);
      if (conversations.length > 0) {
        console.log(`开始迁移 ${conversations.length} 个会话到 IndexedDB...`);
        
        // 初始化数据库
        await initDB();
        
        // 保存到 IndexedDB
        for (const conversation of conversations) {
          await saveConversation(conversation);
        }
        
        console.log('迁移完成');
      }
    }
    
    // 标记为已迁移
    localStorage.setItem(MIGRATION_KEY, 'true');
    
    // 可选：删除 localStorage 中的数据（保留作为备份）
    // localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('迁移数据失败:', error);
  }
}

