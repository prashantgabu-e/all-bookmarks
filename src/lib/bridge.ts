import type { BridgeResponse } from '../types';

const endpoint = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
let frame: HTMLIFrameElement | null = null;
let ready: Promise<void> | null = null;
let token = '';
const pending = new Map<string, { resolve: (value: BridgeResponse<unknown>) => void; reject: (reason: Error) => void }>();

export function setIdToken(value: string) { token = value; }
export function isConfigured() { return Boolean(endpoint && !endpoint.includes('YOUR_')); }
export function ensureBridge() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    if (!isConfigured()) return reject(new Error('Apps Script URL is not configured.'));
    let handshakeTimer = 0;
    const handler = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow || !event.data?.source || event.data.source !== 'violet-bookmarks') return;
      if (event.data.type === 'ready') { clearTimeout(timer); clearInterval(handshakeTimer); resolve(); return; }
      if (event.data.type === 'response' && pending.has(event.data.requestId)) {
        const job = pending.get(event.data.requestId)!; pending.delete(event.data.requestId); job.resolve(event.data.response);
      }
    };
    window.addEventListener('message', handler);
    const timer = window.setTimeout(() => { clearInterval(handshakeTimer); ready = null; reject(new Error('Bookmark service did not load. Confirm the Apps Script /exec URL is deployed and accessible.')); }, 15000);
    frame = document.createElement('iframe'); frame.hidden = true; frame.title = 'Bookmark service';
    frame.src = endpoint!; document.body.appendChild(frame);
    handshakeTimer = window.setInterval(() => frame?.contentWindow?.postMessage({ source: 'violet-bookmarks', type: 'handshake' }, '*'), 250);
  });
  return ready;
}
export async function rpc<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  await ensureBridge();
  if (!token) throw new Error('Please sign in with Google first.');
  const requestId = crypto.randomUUID();
  const response = await new Promise<BridgeResponse<unknown>>((resolve, reject) => {
    const timer = window.setTimeout(() => { pending.delete(requestId); reject(new Error('Request timed out.')); }, 30000);
    pending.set(requestId, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject });
    frame!.contentWindow!.postMessage({ source: 'violet-bookmarks', type: 'request', requestId, operation, token, payload }, '*');
  });
  if (!response.ok) throw new Error(response.error || 'Request failed.');
  return response.data as T;
}
