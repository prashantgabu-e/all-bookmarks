import type { BridgeResponse } from '../types';

const scriptId = import.meta.env.VITE_APPS_SCRIPT_ID as string | undefined;
let idToken = '';
let accessToken = '';

export function setIdToken(value: string) { idToken = value; }
export function setAccessToken(value: string) { accessToken = value; }
export function isConfigured() { return Boolean(scriptId && !scriptId.includes('YOUR_')); }

/** Calls a deployed Apps Script API executable through Google's supported Execution API. */
export async function rpc<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!isConfigured()) throw new Error('Apps Script project ID is not configured.');
  if (!idToken || !accessToken) throw new Error('Please complete Google sign-in first.');
  const response = await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(scriptId!)}:run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: 'api', parameters: [{ token: idToken, operation, payload }], devMode: false })
  });
  const body = await response.json() as { error?: { message?: string }; response?: { result?: BridgeResponse<T> } };
  if (!response.ok || body.error) throw new Error(body.error?.message || 'Apps Script request failed.');
  const result = body.response?.result;
  if (!result?.ok) throw new Error(result?.error || 'Apps Script request failed.');
  return result.data as T;
}
