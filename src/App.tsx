import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
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
import { addMemory, listMemories, listMessages, listThreads, removeMemory, removeThread, sendMessage, type ChatMessage, type Memory, type Thread } from './data';
import { auth, firebaseReady, signInWithGoogle, signOutAgentZ } from './firebase';

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
  onSignIn,
  notify
}: {
  user: User | null;
  onClose: () => void;
  onSignIn: () => void;
  notify: (message: string) => void;
}) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    listMemories(user.uid).then(setMemories).catch(() => notify('기억을 불러오지 못했습니다.'));
  }, [user?.uid, notify]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!user) {
      notify('기억을 관리하려면 Google 계정으로 로그인해 주세요.');
      return;
    }
    if (!value || value.length > 400) return;
    setBusy(true);
    try {
      await addMemory(user.uid, value);
      setMemories(await listMemories(user.uid));
      setDraft('');
      notify('Agent Z의 기억에 저장했어요.');
    } catch {
      notify('저장하지 못했습니다. Firebase 설정을 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!user) return;
    try {
      await removeMemory(user.uid, id);
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

        {!user ? (
          <div className="memory-empty login-needed">
            <p>기억은 Google 계정에 안전하게 보관됩니다.</p>
            <button className="text-action" onClick={onSignIn}>Google 로그인 후 사용할 수 있어요</button>
          </div>
        ) : (
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
            <p className="privacy-note">저장된 내용은 언제든지 삭제할 수 있으며, Agent Z의 기본 모델을 재학습시키지는 않습니다.</p>
          </>
        )}
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3400);
  }, []);

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
    if (!user) {
      setThreads([]);
      return;
    }
    listThreads(user.uid)
      .then(setThreads)
      .catch(() => notify('대화 목록을 불러오지 못했습니다.'));
  }, [user]);

  useEffect(() => {
    if (messages.length && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, busy]);

  async function handleSignIn() {
    if (!firebaseReady) {
      notify('Google 로그인을 연결하려면 README의 Firebase 설정을 완료해 주세요.');
      return;
    }
    try {
      await signInWithGoogle();
    } catch (error) {
      const code = (error as { code?: string }).code;
      notify(code === 'auth/popup-closed-by-user' ? '로그인 창을 닫았습니다.' : 'Google 로그인에 실패했습니다. Firebase의 승인 도메인을 확인해 주세요.');
    }
  }

  async function handleSignOut() {
    try {
      await signOutAgentZ();
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
    if (!user || loadingHistory) return;
    setLoadingHistory(true);
    setSidebarOpen(false);
    try {
      const history = await listMessages(user.uid, thread.id);
      setActiveThreadId(thread.id);
      setMessages(history);
    } catch {
      notify('대화를 불러오지 못했습니다.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function deleteThread(threadId: string) {
    if (!user) return;
    try {
      await removeThread(threadId);
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
    if (!user) {
      await handleSignIn();
      return;
    }

    const threadId = activeThreadId || crypto.randomUUID();
    const optimisticId = 'pending-' + Date.now();
    const optimisticMessage: ChatMessage = { id: optimisticId, role: 'user', content: text };
    setActiveThreadId(threadId);
    setMessages((items) => [...items, optimisticMessage]);
    setDraft('');
    setBusy(true);

    try {
      const reply = await sendMessage(text, threadId);
      setMessages((items) => [...items, {
        id: 'reply-' + Date.now(),
        role: 'assistant',
        content: reply
      }]);
      setThreads(await listThreads(user.uid));
    } catch (error) {
      setMessages((items) => items.filter((item) => item.id !== optimisticId));
      setDraft(text);
      const code = (error as { code?: string }).code;
      notify(code === 'functions/resource-exhausted' ? '오늘 사용할 수 있는 대화 횟수에 도달했습니다.' : '답변을 가져오지 못했습니다. 서버 설정을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
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
            {!user ? (
              <div className="sidebar-hint">로그인하면 대화를 저장하고 어디서나 이어갈 수 있어요.</div>
            ) : threads.length === 0 ? (
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
                <span className="profile-label"><b>{authLoading ? '확인 중…' : '로그인'}</b><small>{firebaseReady ? 'Google 계정으로 시작' : 'Firebase 연결 필요'}</small></span>
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
            <span className="model-pill"><span className="model-dot" /> GPT-6.1 Sol</span>
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
              {!firebaseReady && <p className="setup-caption">로그인과 AI 연결은 배포 설정 후 사용할 수 있습니다.</p>}
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
                  <div className="message-content"><div className="message-author">Agent Z</div><div className="typing-indicator"><i /><i /><i /></div></div>
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
              placeholder={user ? 'Agent Z에게 무엇이든 물어보세요…' : '무엇이든 입력하고 Google 로그인 후 대화를 시작하세요…'}
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

      {memoryOpen && <MemoryDialog user={user} onClose={() => setMemoryOpen(false)} onSignIn={() => void handleSignIn()} notify={notify} />}
      {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
    </div>
  );
}
