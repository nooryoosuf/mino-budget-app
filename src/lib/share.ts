/** Web Share Target glue — reads a text shared from Android's share sheet. */
export interface SharedPayload {
  text: string;
  title: string;
}

export function getSharedPayload(search: string): SharedPayload | null {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const text = (params.get('text') ?? '').trim();
  const title = (params.get('title') ?? '').trim();
  const url = (params.get('url') ?? '').trim();
  const combined = [title, text, url].filter(Boolean).join('\n').trim();
  if (!combined) return null;
  return { text: combined, title };
}

/** Remove share params so a reload doesn't re-trigger the import. */
export function clearSharedParams(): void {
  try {
    const u = new URL(window.location.href);
    if (u.search) {
      u.search = '';
      window.history.replaceState(null, '', u.toString());
    }
  } catch { /* non-browser */ }
}
