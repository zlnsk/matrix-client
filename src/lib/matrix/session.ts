const KEY = "matrix:session";

export type Session = {
  baseUrl: string;
  userId: string;
  deviceId: string;
  accessToken: string;
};

// localStorage can throw in private mode (Safari), when storage is full,
// or when blocked by Permissions-Policy / cookies-disabled settings.
function safeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSession(): Session | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (!s.baseUrl || !s.userId || !s.deviceId || !s.accessToken) return null;
    return s as Session;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota exceeded or storage disabled */
  }
}

export function clearSession() {
  const ls = safeStorage();
  if (!ls) return;
  try {
    ls.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Remove all matrix-js-sdk IndexedDB databases. Used on logout to make sure
 * stale tokens, olm/megolm keys, and room state don't leak across accounts.
 */
export async function wipeMatrixStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  type Dbs = { name?: string }[];
  const dbs = await (indexedDB as unknown as { databases?: () => Promise<Dbs> })
    .databases?.()
    .catch(() => [] as Dbs);
  if (!dbs) return;
  await Promise.all(
    dbs
      .map((d) => d.name)
      .filter((n): n is string => typeof n === "string" && /^matrix-js-sdk|crypto|matrix-sdk-crypto/.test(n))
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          })
      )
  );
}
