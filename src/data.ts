import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Timestamp
} from 'firebase/firestore';
import { generateLocalReply, type LocalChatTurn } from './local-ai';
import { firestore } from './firebase';

export const LOCAL_USER_ID = 'agent-z-this-device';
const LOCAL_KEY = 'agent-z-local-data-v1';

export type Thread = {
  id: string;
  title: string;
  updatedAt?: Timestamp | number;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Timestamp | number;
};

export type Memory = {
  id: string;
  text: string;
  updatedAt?: Timestamp | number;
};

type LocalData = {
  threads: Thread[];
  messages: Record<string, ChatMessage[]>;
  memories: Memory[];
};

function readLocalData(uid: string): LocalData {
  try {
    const key = uid === LOCAL_USER_ID ? LOCAL_KEY : `${LOCAL_KEY}:${uid}`;
    const raw = localStorage.getItem(key);
    if (!raw) return { threads: [], messages: {}, memories: [] };
    const parsed = JSON.parse(raw) as Partial<LocalData>;
    return {
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
      messages: parsed.messages && typeof parsed.messages === 'object' ? parsed.messages : {},
      memories: Array.isArray(parsed.memories) ? parsed.memories : []
    };
  } catch {
    return { threads: [], messages: {}, memories: [] };
  }
}

function writeLocalData(uid: string, data: LocalData): void {
  try {
    const key = uid === LOCAL_USER_ID ? LOCAL_KEY : `${LOCAL_KEY}:${uid}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    throw new Error('기기 저장 공간이 부족합니다. 오래된 대화나 기억을 삭제해 주세요.');
  }
}

function isCloudUser(uid: string): boolean {
  return Boolean(firestore) && uid !== LOCAL_USER_ID;
}

function requireFirestore() {
  if (!firestore) throw new Error('Firebase 프로젝트 연결이 필요합니다.');
  return firestore;
}

export async function listThreads(uid: string): Promise<Thread[]> {
  if (!isCloudUser(uid)) {
    return readLocalData(uid).threads.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }
  const db = requireFirestore();
  const threads = collection(db, 'users', uid, 'conversations');
  const result = await getDocs(query(threads, orderBy('updatedAt', 'desc'), limit(40)));
  return result.docs.map((item) => ({
    id: item.id,
    title: String(item.get('title') || '새 대화'),
    updatedAt: item.get('updatedAt') as Timestamp | undefined
  }));
}

export async function listMessages(uid: string, threadId: string): Promise<ChatMessage[]> {
  if (!isCloudUser(uid)) return readLocalData(uid).messages[threadId] || [];
  const db = requireFirestore();
  const messages = collection(db, 'users', uid, 'conversations', threadId, 'messages');
  const result = await getDocs(query(messages, orderBy('createdAt', 'asc'), limit(200)));
  return result.docs.map((item) => ({
    id: item.id,
    role: item.get('role') === 'assistant' ? 'assistant' : 'user',
    content: String(item.get('content') || ''),
    createdAt: item.get('createdAt') as Timestamp | undefined
  }));
}

export async function sendMessage(
  text: string,
  threadId: string,
  history: ChatMessage[],
  memories: Memory[],
  uid: string,
  onStatus: (message: string) => void
): Promise<string> {
  const conversation: LocalChatTurn[] = history.slice(-8).map(({ role, content }) => ({ role, content }));
  const reply = await generateLocalReply(text, conversation, memories.map((item) => item.text), onStatus);
  const now = Date.now();
  const title = text.replace(/\s+/g, ' ').slice(0, 54) || '새 대화';
  const savedMessages: ChatMessage[] = [
    { id: crypto.randomUUID(), role: 'user', content: text, createdAt: now },
    { id: crypto.randomUUID(), role: 'assistant', content: reply, createdAt: now }
  ];

  if (isCloudUser(uid)) {
    const db = requireFirestore();
    const threadRef = doc(db, 'users', uid, 'conversations', threadId);
    const messagesRef = collection(threadRef, 'messages');
    const batch = writeBatch(db);
    for (const message of savedMessages) {
      batch.set(doc(messagesRef, message.id), {
        role: message.role,
        content: message.content,
        createdAt: serverTimestamp()
      });
    }
    batch.set(threadRef, {
      id: threadId,
      title,
      updatedAt: serverTimestamp()
    }, { merge: true });
    await batch.commit();
  } else {
    const data = readLocalData(uid);
    data.messages[threadId] = [...(data.messages[threadId] || []), ...savedMessages].slice(-200);
    data.threads = [
      { id: threadId, title, updatedAt: now },
      ...data.threads.filter((thread) => thread.id !== threadId)
    ].slice(0, 40);
    writeLocalData(uid, data);
  }

  return reply;
}

export async function removeThread(uid: string, threadId: string): Promise<void> {
  if (!isCloudUser(uid)) {
    const data = readLocalData(uid);
    delete data.messages[threadId];
    data.threads = data.threads.filter((thread) => thread.id !== threadId);
    writeLocalData(uid, data);
    return;
  }

  const db = requireFirestore();
  const messages = collection(db, 'users', uid, 'conversations', threadId, 'messages');
  while (true) {
    const result = await getDocs(query(messages, limit(400)));
    if (result.empty) break;
    const batch = writeBatch(db);
    result.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, 'users', uid, 'conversations', threadId));
}

export async function listMemories(uid: string): Promise<Memory[]> {
  if (!isCloudUser(uid)) return readLocalData(uid).memories;
  const db = requireFirestore();
  const memories = collection(db, 'users', uid, 'memories');
  const result = await getDocs(query(memories, orderBy('updatedAt', 'desc'), limit(50)));
  return result.docs.map((item) => ({
    id: item.id,
    text: String(item.get('text') || ''),
    updatedAt: item.get('updatedAt') as Timestamp | undefined
  }));
}

export async function addMemory(uid: string, text: string): Promise<void> {
  if (!isCloudUser(uid)) {
    const data = readLocalData(uid);
    data.memories = [{ id: crypto.randomUUID(), text, updatedAt: Date.now() }, ...data.memories].slice(0, 50);
    writeLocalData(uid, data);
    return;
  }
  const db = requireFirestore();
  await setDoc(doc(collection(db, 'users', uid, 'memories')), {
    text,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function removeMemory(uid: string, memoryId: string): Promise<void> {
  if (!isCloudUser(uid)) {
    const data = readLocalData(uid);
    data.memories = data.memories.filter((memory) => memory.id !== memoryId);
    writeLocalData(uid, data);
    return;
  }
  const db = requireFirestore();
  await deleteDoc(doc(db, 'users', uid, 'memories', memoryId));
}
