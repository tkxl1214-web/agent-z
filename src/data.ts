import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firestore, functions } from './firebase';

export type Thread = {
  id: string;
  title: string;
  updatedAt?: Timestamp;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Timestamp;
};

export type Memory = {
  id: string;
  text: string;
  updatedAt?: Timestamp;
};

function requireFirestore() {
  if (!firestore) throw new Error('Firebase 프로젝트 연결이 필요합니다.');
  return firestore;
}

function requireFunctions() {
  if (!functions) throw new Error('AI 서버 연결이 아직 완료되지 않았습니다.');
  return functions;
}

export async function listThreads(uid: string): Promise<Thread[]> {
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

export async function sendMessage(text: string, threadId: string): Promise<string> {
  const callable = httpsCallable<{ text: string; threadId: string }, { reply: string }>(
    requireFunctions(),
    'chat'
  );
  const result = await callable({ text, threadId });
  return result.data.reply;
}

export async function removeThread(threadId: string): Promise<void> {
  const callable = httpsCallable<{ threadId: string }, { ok: boolean }>(
    requireFunctions(),
    'deleteConversation'
  );
  await callable({ threadId });
}

export async function listMemories(uid: string): Promise<Memory[]> {
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
  const db = requireFirestore();
  await addDoc(collection(db, 'users', uid, 'memories'), {
    text,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function removeMemory(uid: string, memoryId: string): Promise<void> {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'users', uid, 'memories', memoryId));
}
