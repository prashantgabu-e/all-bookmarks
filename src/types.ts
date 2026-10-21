export type Category = { id: string; name: string; sheetName: string; sortOrder: number; active: boolean };
export type Bookmark = {
  id: string; categoryId: string; title: string; description: string; tags: string[]; mainUrl: string;
  additionalUrls: string[]; faviconUrl?: string; ogImageUrl?: string; metadata?: Record<string, string>;
  photoUrl?: string; createdAt?: string; updatedAt?: string; owner?: string;
};
export type Metadata = Pick<Bookmark, 'title' | 'description' | 'faviconUrl' | 'ogImageUrl' | 'metadata'> & { warning?: string };
export type BridgeResponse<T> = { ok: boolean; data?: T; error?: string };
declare global { interface Window { google?: { accounts: { id: { initialize(config: unknown): void; renderButton(element: HTMLElement, options: unknown): void; prompt(): void } } } } }
