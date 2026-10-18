import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { useGoogleLogin } from '@react-oauth/google';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Copy,
  Download,
  Lightbulb,
  Menu,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { addMemory, listMemories, listMessages, listThreads, LOCAL_USER_ID, removeMemory, removeThread, sendMessage, type ChatMessage, type Memory, type Thread } from './data';
import { auth, firebaseReady, signInWithGoogle, signOutAgentZ } from './firebase';

type LocalGoogleUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  localOnly: true;
};

type AgentZUser = User | LocalGoogleUser;

const logo = import.meta.env.BASE_URL + 'icons/agent-z-mark.png';
const suggestions = [
  { icon: Compass, title: '생각을 정리해줘', prompt: '머릿속에 여러 생각이 엉켜 있어. 질문을 하나씩 하면서 우선순위를 정리해줘.' },
  { icon: Lightbulb, title: '아이디어를 발전시켜줘', prompt: '이 아이디어를 더 구체적이고 차별화된 방향으로 함께 발전시켜줘.' },
  { icon: BookOpen, title: '어렵게 느껴지는 걸 설명해줘', prompt: '이 주제를 처음 배우는 사람도 이해할 수 있게 비유와 예시를 들어 설명해줘.' },
  { icon: BrainCircuit, title: '실행 계획을 만들어줘', prompt: '내 목표를 현실적인 단계별 실행 계획으로 바꾸고, 오늘 할 첫 번째 행동도 정해줘.' }
];

function MessageText({ children }: { children: string }) {
  return <div className="message-copy">{children}</div>;
}

function MemoryDialog({
  user,
  onClose,
  notify
}: {
  user: AgentZUser | null;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const ownerId = user?.uid || LOCAL_USER_ID;
  const accountSync = Boolean(user && firebaseReady && !('localOnly' in user));

  useEffect(() => {
    listMemories(ownerId).then(setMemories).catch(() => notify('기억을 불러오지 못했습니다.'));
  }, [ownerId, notify]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || value.length > 400) return;
    setBusy(true);
    try {
      await addMemory(ownerId, value);
      setMemories(await listMemories(ownerId));
      setDraft('');
      notify(accountSync ? 'Agent Z 계정 기억에 저장했어요.' : '이 기기의 Agent Z 기억에 저장했어요.');
    } catch {
      notify('저장하지 못했습니다. Firebase 설정을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeMemory(ownerId, id);
      setMemories((items) => items.filter((item) => item.id !== id));
    } catch {
      notify('기억을 삭제하지 못했습니다.');
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-title">
        <div className="dialog-header">
          <div className="dialog-title-wrap">
            <span className="dialog-icon"><BrainCircuit size={19} /></span>
            <div>
              <h2 id="memory-title">Agent Z의 기억</h2>
              <p>대화에 참고할 내용을 직접 선택해 저장하세요.</p>
            </div>
          </div>
          <button className="icon-button quiet" aria-label="닫기" onClick={onClose}><X size={19} /></button>
        </div>

        <>
            <form className="memory-form" onSubmit={handleAdd}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={400}
                rows={3}
                placeholder="예: 저는 답변을 짧고 구체적으로 받는 걸 좋아해요."
                aria-label="새 기억"
              />
              <div className="memory-form-foot">
                <span>{draft.length}/400</span>
                <button className="small-primary" disabled={!draft.trim() || busy} type="submit">
                  <Plus size={15} /> 기억 추가
                </button>
              </div>
            </form>
            <div className="memory-list">
              {memories.length === 0 ? (
                <div className="memory-empty">
                  <span className="memory-empty-icon"><Sparkles size={18} /></span>
                  <p>저장된 기억이 아직 없어요.</p>
                  <small>추가한 기억은 이후 대화에서 참고합니다.</small>
                </div>
              ) : memories.map((memory) => (
                <div className="memory-item" key={memory.id}>
                  <span className="memory-bullet" />
                  <p>{memory.text}</p>
                  <button className="icon-button memory-delete" onClick={() => void handleRemove(memory.id)} aria-label="기억 삭제">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <p className="privacy-note">{accountSync
              ? '저장된 기억은 이 Google 계정에 보관되며, 언제든지 삭제할 수 있습니다. 기억은 모델을 재학습시키지 않습니다.'
              : '저장된 기억은 이 브라우저와 Google 로그인 프로필에 맞춰 이 기기에 보관됩니다. Firebase를 연결하면 계정 간 동기화를 사용할 수 있습니다.'}</p>
        </>
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AgentZUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ownerId = user?.uid || LOCAL_USER_ID;

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3400);
  }, []);

  const googleLogin = useGoogleLogin({
    scope: 'openid email profile',
    onSuccess: async (token) => {
      try {
        const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${token.access_token}` }
        });
        if (!response.ok) throw new Error('Google 프로필을 불러오지 못했습니다.');
        const profile = await response.json() as { sub?: string; email?: string; name?: string; picture?: string };
        if (!profile.sub || !profile.email) throw new Error('Google 계정 정보를 확인하지 못했습니다.');
        setUser({
          uid: `google-local-${profile.sub}`,
          email: profile.email,
          displayName: profile.name || profile.email,
          photoURL: profile.picture || null,
          localOnly: true
        });
        notify('Google 로그인했습니다. Firebase 동기화 설정 전까지 기록은 이 기기에 저장됩니다.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Google 계정 정보를 불러오지 못했습니다.');
      }
    },
    onError: () => notify('Google 로그인에 실패했습니다. OAuth 승인 도메인을 확인해 주세요.')
  });

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setActiveThreadId(null);
      setMessages([]);
    });
  }, []);

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> });
    };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    return () => window.removeEventListener('beforeinstallprompt', capturePrompt);
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 176) + 'px';
  }, [draft]);

  useEffect(() => {
    listThreads(ownerId)
      .then(setThreads)
      .catch(() => notify('대화 목록을 불러오지 못했습니다.'));
  }, [ownerId, notify]);

  useEffect(() => {
    if (messages.length && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, busy]);

  async function handleSignIn() {
    if (!firebaseReady) {
      if (Capacitor.isNativePlatform()) {
        notify('네이티브 앱의 Google 로그인에는 Firebase Web 설정과 플랫폼별 서비스 파일이 필요합니다.');
        return;
      }
      googleLogin();
      return;
    }
    try {
      await signInWithGoogle();
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(code === 'auth/popup-closed-by-user' ? '로그인 창을 닫았습니다.' : 'Google 로그인에 실패했습니다. Firebase와 승인 도메인을 확인해 주세요.');
    }
  }

  async function handleSignOut() {
    try {
      await signOutAgentZ();
      setUser(null);
      setUserMenuOpen(false);
      setActiveThreadId(null);
      setMessages([]);
      notify('로그아웃했습니다.');
    } catch {
      notify('로그아웃하지 못했습니다.');
    }
  }

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function handleNewChat() {
    setActiveThreadId(null);
    setMessages([]);
    setDraft('');
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  async function openThread(thread: Thread) {
    if (loadingHistory) return;
    setLoadingHistory(true);
    setSidebarOpen(false);
    try {
      const history = await listMessages(ownerId, thread.id);
      setActiveThreadId(thread.id);
      setMessages(history);
    } catch {
      notify('대화를 불러오지 못했습니다.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function deleteThread(threadId: string) {
    try {
      await removeThread(ownerId, threadId);
      setThreads((items) => items.filter((item) => item.id !== threadId));
      if (activeThreadId === threadId) handleNewChat();
      notify('대화를 삭제했습니다.');
    } catch {
      notify('대화를 삭제하지 못했습니다.');
    }
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const threadId = activeThreadId || crypto.randomUUID();
    const optimisticId = 'pending-' + Date.now();
    const optimisticMessage: ChatMessage = { id: optimisticId, role: 'user', content: text };
    setActiveThreadId(threadId);
    setMessages((items) => [...items, optimisticMessage]);
    setDraft('');
    setBusy(true);
    setAiStatus('기기에서 Agent Z를 준비하고 있어요…');

    try {
      const memories = await listMemories(ownerId);
      const reply = await sendMessage(
        text,
        threadId,
        messages.filter((item) => !item.id.startsWith('pending-')),
        memories,
        ownerId,
        setAiStatus
      );
      setMessages((items) => [...items, {
        id: 'reply-' + Date.now(),
        role: 'assistant',
        content: reply
      }]);
      setThreads(await listThreads(ownerId));
    } catch (error) {
      setMessages((items) => items.filter((item) => item.id !== optimisticId));
      setDraft(text);
      notify(error instanceof Error ? error.message : '답변을 가져오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
      setAiStatus('');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  function chooseSuggestion(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify('답변을 복사했습니다.');
    } catch {
      notify('복사할 수 없습니다.');
    }
  }

  const hasConversation = messages.length > 0;
  const initials = user?.displayName?.trim().slice(0, 1) || user?.email?.slice(0, 1) || 'Z';

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="drawer-scrim" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}
      <aside className={'sidebar' + (sidebarOpen ? ' sidebar-open' : '')}>
        <div className="sidebar-top">
          <a className="brand" href={import.meta.env.BASE_URL} aria-label="Agent Z 홈">
            <span className="brand-mark"><img src={logo} alt="" /></span>
            <span className="brand-name">Agent <b>Z</b></span>
          </a>
          <button className="icon-button sidebar-close" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)}><X size={19} /></button>
          <button className="new-chat-button" onClick={handleNewChat}>
            <Plus size={17} strokeWidth={2.3} /> <span>새 대화</span>
            <span className="shortcut">⌘ K</span>
          </button>

          <div className="sidebar-nav">
            <button className="nav-item active" onClick={handleNewChat}>
              <MessageCircle size={17} /> <span>대화</span>
            </button>
            <button className="nav-item" onClick={() => { setMemoryOpen(true); setSidebarOpen(false); }}>
              <BrainCircuit size={17} /> <span>나의 기억</span>
            </button>
          </div>

          <div className="history-heading">
            <span>최근 대화</span>
            <button className="icon-button mini" aria-label="새 대화" onClick={handleNewChat}><Plus size={16} /></button>
          </div>
          <div className="thread-list">
            {threads.length === 0 ? (
              <div className="sidebar-hint">아직 대화가 없어요.<br />새로운 생각을 시작해 보세요.</div>
            ) : threads.map((thread) => (
              <div className={'thread-row' + (activeThreadId === thread.id ? ' selected' : '')} key={thread.id}>
                <button className="thread-button" onClick={() => void openThread(thread)} title={thread.title}>
                  <MessageCircle size={15} />
                  <span>{thread.title}</span>
                </button>
                <button className="icon-button thread-delete" aria-label="대화 삭제" onClick={() => void deleteThread(thread.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-bottom">
          <a className="sidebar-help" href="https://github.com/tkxl1214-web/agent-z" target="_blank" rel="noreferrer">
            <CircleHelp size={16} /> <span>Agent Z 소개</span>
          </a>
          <a className="privacy-link" href={import.meta.env.BASE_URL + 'privacy.html'}>개인정보 안내</a>
          <div className="profile-wrap">
            {userMenuOpen && user && (
              <div className="user-menu">
                <span className="user-menu-email">{user.email}</span>
                <button onClick={() => void handleSignOut()}>로그아웃</button>
              </div>
            )}
            {user ? (
              <button className="profile-button" onClick={() => setUserMenuOpen((open) => !open)}>
                <span className="avatar">
                  {user.photoURL ? <img src={user.photoURL} alt="" /> : initials.toUpperCase()}
                </span>
                <span className="profile-label"><b>{user.displayName || 'Agent Z 사용자'}</b><small>{user.email}</small></span>
                <ChevronDown size={15} className="profile-chevron" />
              </button>
            ) : (
              <button className="profile-button signed-out" onClick={() => void handleSignIn()}>
                <span className="avatar guest-avatar">Z</span>
                <span className="profile-label"><b>{authLoading ? '확인 중…' : '로그인'}</b><small>{firebaseReady ? '기기 간 동기화' : 'Google 로그인 · 기기 저장'}</small></span>
                <ArrowDown size={15} className="profile-chevron" />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-trigger" aria-label="메뉴 열기" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <span className="mobile-brand"><img src={logo} alt="" /> Agent Z</span>
            <span className="topbar-context">{activeThreadId ? '대화' : '새로운 대화'}</span>
          </div>
          <div className="topbar-right">
            <span className="model-pill" title="대화는 기기 안의 공개 가중치 모델로 생성됩니다."><span className="model-dot" /> Agent Z · 기기 내 AI</span>
            {installPrompt && (
              <button className="install-app" onClick={() => void handleInstall()} title="Agent Z 앱 설치">
                <Download size={14} /><span>앱 설치</span>
              </button>
            )}
            {user ? (
              <button className="top-avatar" aria-label="계정 메뉴" onClick={() => { setSidebarOpen(true); setUserMenuOpen(true); }}>
                {user.photoURL ? <img src={user.photoURL} alt="" /> : initials.toUpperCase()}
              </button>
            ) : (
              <button className="top-signin" onClick={() => void handleSignIn()} disabled={authLoading}>
                {authLoading ? '확인 중…' : 'Google 로그인'}
              </button>
            )}
          </div>
        </header>

        <div className="chat-area" ref={scrollRef}>
          {!hasConversation && !loadingHistory ? (
            <section className="welcome-screen">
              <div className="welcome-brand">
                <span className="welcome-mark"><img src={logo} alt="Agent Z 로고" /></span>
                <span>당신의 생각을 넓히는 AI</span>
              </div>
              <h1>안녕하세요{user?.displayName ? ', ' + user.displayName.split(' ')[0] : ''}.<br />오늘은 <em>무엇을 함께</em> 생각해볼까요?</h1>
              <p className="welcome-copy">질문을 더 깊게, 아이디어를 더 멀리.<br className="mobile-break" /> Agent Z가 당신의 다음 생각을 함께 만듭니다.</p>

              <div className="suggestion-grid">
                {suggestions.map(({ icon: Icon, title, prompt }) => (
                  <button className="suggestion-card" onClick={() => chooseSuggestion(prompt)} key={title}>
                    <span className="suggestion-icon"><Icon size={18} strokeWidth={1.8} /></span>
                    <span className="suggestion-title">{title}</span>
                    <span className="suggestion-arrow"><ArrowUp size={15} /></span>
                  </button>
                ))}
              </div>

              {!user && !authLoading && (
                <button className="welcome-signin" onClick={() => void handleSignIn()}>
                  <span className="google-g">G</span> Google 계정으로 시작하기 <ArrowUp size={15} />
                </button>
              )}
              <p className="setup-caption">첫 사용 시 AI 모델 약 650MB를 내려받습니다. GPU가 없는 기기는 더 큰 모델을 내려받고 답변이 느릴 수 있어요.</p>
              {!firebaseReady && <p className="setup-caption">Google 로그인은 가능하며, Firebase 설정 전까지 대화와 기억은 로그인한 기기에 저장됩니다.</p>}
            </section>
          ) : (
            <section className="conversation" aria-live="polite">
              {loadingHistory && <div className="history-loading"><span className="spinner" /> 대화를 불러오고 있어요</div>}
              {messages.map((message) => (
                <article className={'message-row ' + (message.role === 'user' ? 'user-message' : 'assistant-message')} key={message.id}>
                  {message.role === 'assistant' && <span className="message-avatar"><img src={logo} alt="Agent Z" /></span>}
                  <div className="message-content">
                    {message.role === 'assistant' && <div className="message-author">Agent Z</div>}
                    <MessageText>{message.content}</MessageText>
                    {message.role === 'assistant' && !message.id.startsWith('pending-') && (
                      <div className="message-tools">
                        <button className="icon-button mini" aria-label="답변 복사" onClick={() => void copyMessage(message.content)}><Copy size={14} /></button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {busy && (
                <article className="message-row assistant-message">
                  <span className="message-avatar"><img src={logo} alt="Agent Z" /></span>
                  <div className="message-content"><div className="message-author">Agent Z</div><div className="typing-indicator"><i /><i /><i /></div><p className="ai-progress">{aiStatus}</p></div>
                </article>
              )}
              <div className="scroll-anchor" />
            </section>
          )}
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={(event) => void handleSend(event)}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={8_000}
              placeholder="Agent Z에게 무엇이든 물어보세요…"
              aria-label="Agent Z에게 메시지 보내기"
              disabled={busy}
            />
            <div className="composer-footer">
              <div className="composer-left">
                <button type="button" className="memory-chip" onClick={() => setMemoryOpen(true)}>
                  <BrainCircuit size={14} /> <span>기억</span>
                </button>
                <span className="composer-hint">Shift + Enter로 줄 바꾸기</span>
              </div>
              <div className="composer-right">
                {draft.length > 0 && <span className="character-count">{draft.length}</span>}
                <button type="submit" className="send-button" disabled={!draft.trim() || busy} aria-label="메시지 보내기">
                  <ArrowUp size={19} strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </form>
          <p className="composer-disclaimer">Agent Z는 AI입니다. 중요한 내용은 한 번 더 확인해 주세요.</p>
        </div>
      </main>

      {memoryOpen && <MemoryDialog user={user} onClose={() => setMemoryOpen(false)} notify={notify} />}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </div>
  );
}
