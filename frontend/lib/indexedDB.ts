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
    images?: Array<{ data: string; mimeType: string; thoughtSignature?: string }>;
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
      
      // 如果没有索引，直接使用 getAll
      let request: IDBRequest<Conversation[]>;
      try {
        const index = store.index('updatedAt');
        request = index.getAll();
      } catch (e) {
        // 如果索引不存在，使用 getAll
        request = store.getAll();
      }

      request.onsuccess = (event) => {
        const conversations = (event.target as IDBRequest<Conversation[]>).result || [];
        // 按更新时间降序排序（最新的在前）
        conversations.sort((a, b) => {
          // 确保 updatedAt 存在，如果不存在则使用 createdAt
          const aTime = a.updatedAt || a.createdAt || 0;
          const bTime = b.updatedAt || b.createdAt || 0;
          return bTime - aTime;
        });
        console.log(`[IndexedDB] 加载了 ${conversations.length} 个会话`, conversations.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })));
        resolve(conversations);
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] 加载会话失败:', event);
        reject(new Error('Failed to load conversations'));
      };
    });
  } catch (error) {
    console.error('[IndexedDB] 加载会话失败:', error);
    return [];
  }
}

// 保存单个会话
async function saveConversation(conversation: Conversation): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(conversation);

    request.onsuccess = () => {
      console.log(`[IndexedDB] 会话已保存: ${conversation.id}`);
      resolve();
    };
    request.onerror = (event) => {
      console.error('[IndexedDB] 保存会话失败:', event);
      reject(new Error('Failed to save conversation'));
    };
    
    transaction.onerror = (event) => {
      console.error('[IndexedDB] 事务失败:', event);
      reject(new Error('Transaction failed'));
    };
  });
}

// 删除会话
async function deleteConversation(id: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`[IndexedDB] 会话已删除: ${id}`);
      resolve();
    };
    request.onerror = (event) => {
      console.error('[IndexedDB] 删除会话失败:', event);
      reject(new Error('Failed to delete conversation'));
    };
    
    transaction.onerror = (event) => {
      console.error('[IndexedDB] 删除事务失败:', event);
      reject(new Error('Transaction failed'));
    };
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
    // 确保数据库已初始化
    const database = await getDB();
    
    console.log(`[IndexedDB] 开始保存 ${conversations.length} 个会话...`);
    
    // 获取当前 IndexedDB 中的所有会话 ID
    const existingConversations = await loadConversations();
    const existingIds = new Set(existingConversations.map(c => c.id));
    const newIds = new Set(conversations.map(c => c.id));
    
    // 删除不在新列表中的会话（被删除的会话）
    const idsToDelete = [...existingIds].filter(id => !newIds.has(id));
    
    if (idsToDelete.length > 0) {
      console.log(`[IndexedDB] 需要删除 ${idsToDelete.length} 个会话:`, idsToDelete);
      for (const id of idsToDelete) {
        await deleteConversation(id);
      }
    }
    
    // 保存所有会话（新增或更新的）
    for (const conversation of conversations) {
      await saveConversation(conversation);
    }
    
    console.log(`[IndexedDB] 所有会话保存完成`);

    // 检查总大小，如果超过限制则清理
    const totalSize = await getTotalSize();
    console.log(`[IndexedDB] 当前总大小: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (totalSize > MAX_SIZE) {
      console.warn(`[IndexedDB] 存储空间超过 ${MAX_SIZE / 1024 / 1024}MB，开始清理旧会话...`);
      const deletedCount = await cleanupOldConversations(MAX_SIZE);
      if (deletedCount > 0) {
        console.warn(`[IndexedDB] 已清理 ${deletedCount} 个旧会话`);
      }
    }
  } catch (error) {
    console.error('[IndexedDB] 保存会话失败:', error);
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


