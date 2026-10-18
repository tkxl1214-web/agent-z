export type LocalChatTurn = { role: 'user' | 'assistant' | 'system'; content: string };

type WorkerResponse =
  | { type: 'status'; message: string }
  | { type: 'done'; reply: string }
  | { type: 'error'; message: string };

type PendingRequest = {
  resolve: (reply: string) => void;
  reject: (error: Error) => void;
  onStatus: (message: string) => void;
};

let worker: Worker | null = null;
let activeRequest: PendingRequest | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./agentz.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const pending = activeRequest;
    if (!pending) return;
    if (event.data.type === 'status') {
      pending.onStatus(event.data.message);
    } else if (event.data.type === 'done') {
      activeRequest = null;
      pending.resolve(event.data.reply);
    } else {
      activeRequest = null;
      pending.reject(new Error(event.data.message));
    }
  };
  worker.onerror = () => {
    activeRequest?.reject(new Error('기기에서 AI 모델을 실행하지 못했습니다. 브라우저를 새로고침한 뒤 다시 시도해 주세요.'));
    activeRequest = null;
    worker?.terminate();
    worker = null;
  };
  return worker;
}

export function generateLocalReply(
  prompt: string,
  history: LocalChatTurn[],
  memories: string[],
  onStatus: (message: string) => void
): Promise<string> {
  if (activeRequest) return Promise.reject(new Error('Agent Z가 앞선 답변을 마무리하고 있습니다.'));
  return new Promise((resolve, reject) => {
    activeRequest = { resolve, reject, onStatus };
    getWorker().postMessage({ prompt, history, memories });
  });
}
