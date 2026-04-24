"use client";

import type {
  MatrixClient,
  ICreateClientOpts,
  LoginResponse,
  Room,
  MatrixEvent,
} from "matrix-js-sdk";
import { loadSession, saveSession, clearSession, wipeMatrixStorage, type Session } from "./session";

let singleton: MatrixClient | null = null;
let startingPromise: Promise<MatrixClient> | null = null;

// createClient({ cryptoCallbacks? }) stores ONE reference on the client AND
// passes the SAME reference to ServerSideSecretStorageImpl. Mutate this exact
// object when installing an SSSS unlock callback — allocating a new object
// after init is invisible to the SDK.
export const cryptoCallbacks: Record<string, unknown> = {};

// Stage the key on globalThis, not in a module-local. Next.js can end up with
// two copies of a module evaluated in different chunks; module-locals in the
// two copies diverge, so a setter in one copy never reaches a reader in the
// other. globalThis is shared.
type GlobalSSSS = { __matrixSSSSKey?: Uint8Array | null };
const g = globalThis as unknown as GlobalSSSS;

export function setSecretStorageKey(key: Uint8Array | null): void {
  g.__matrixSSSSKey = key;
}

cryptoCallbacks.getSecretStorageKey = async (
  opts: unknown,
): Promise<[string, Uint8Array] | null> => {
  const key = g.__matrixSSSSKey ?? null;
  if (!key) {
    console.warn("[matrix] getSecretStorageKey: no key staged");
    return null;
  }
  const map =
    (opts as { keys?: Record<string, unknown> } | undefined)?.keys ?? {};
  const keyId = Object.keys(map)[0];
  if (!keyId) {
    console.warn("[matrix] getSecretStorageKey: no key descriptors from SDK");
    return null;
  }
  return [keyId, key];
};

cryptoCallbacks.cacheSecretStorageKey = (
  _keyId: string,
  _keyInfo: unknown,
  _key: Uint8Array,
): void => {
  /* no-op: we hold the key only for the duration of one operation */
};

type AnyMatrixModule = typeof import("matrix-js-sdk") & Record<string, unknown>;

async function loadSdk(): Promise<AnyMatrixModule> {
  const mod = (await import("matrix-js-sdk")) as unknown as AnyMatrixModule;
  // Quiet the SDK logger; avoid secret-noise in console.
  try {
    const logger = (mod as unknown as { logger?: { setLevel?: (lvl: string) => void } }).logger;
    logger?.setLevel?.("warn");
  } catch {
    /* noop */
  }
  return mod;
}

/**
 * Initialize Rust crypto. If the on-disk schema was written by a newer crypto
 * library (shared IndexedDB with another app at this origin, for example) we
 * fall back to wiping just the crypto databases and retrying — better than
 * leaving the client in a no-crypto state where encrypted rooms can't send.
 */
const CRYPTO_INIT_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`[matrix] ${label} timeout after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
  });
}

async function bootstrapCrypto(client: MatrixClient): Promise<void> {
  const fn = (client as unknown as { initRustCrypto?: (opts?: { useIndexedDB?: boolean }) => Promise<void> })
    .initRustCrypto;
  if (!fn) return;

  const isSchemaError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return /schema version|too new|version: \d+|doesn't match/i.test(msg);
  };

  // Attempt 1: IDB. Schema errors wipe + retry; timeouts and unknown errors
  // fall straight through to the in-memory fallback.
  let doIdbRetry = false;
  try {
    await withTimeout(fn.call(client, { useIndexedDB: true }), CRYPTO_INIT_TIMEOUT_MS, "initRustCrypto(IDB)");
    return;
  } catch (err) {
    if (isSchemaError(err)) {
      console.warn("[matrix] initRustCrypto(IDB) schema mismatch, wiping crypto DBs and retrying", err);
      await wipeCryptoDatabases();
      doIdbRetry = true;
    } else {
      console.warn("[matrix] initRustCrypto(IDB) failed, falling back to in-memory crypto", err);
    }
  }

  // Attempt 2: IDB after wipe (schema errors only).
  if (doIdbRetry) {

    try {
      await withTimeout(fn.call(client, { useIndexedDB: true }), CRYPTO_INIT_TIMEOUT_MS, "initRustCrypto(IDB-retry)");
      return;
    } catch (err) {
      console.warn("[matrix] initRustCrypto(IDB-retry) failed, falling back to in-memory crypto", err);
    }
  }

  // Attempt 3: in-memory fallback. Keys don't persist across reload but the
  // session is usable instead of hanging forever.
  try {
    await withTimeout(fn.call(client, { useIndexedDB: false }), CRYPTO_INIT_TIMEOUT_MS, "initRustCrypto(memory)");
  } catch (err) {
    console.warn("[matrix] initRustCrypto(memory) failed — continuing without crypto", err);
  }
}

async function wipeCryptoDatabases(): Promise<void> {
  const dbs = await (indexedDB as unknown as { databases?: () => Promise<{ name?: string }[]> })
    .databases?.()
    .catch(() => []);
  if (!dbs) return;
  await Promise.all(
    dbs
      .map((d) => d.name)
      .filter((n): n is string => typeof n === "string" && /matrix.*crypto|crypto.*store/i.test(n))
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

async function buildClient(sdk: AnyMatrixModule, session: Session): Promise<MatrixClient> {
  const { createClient, IndexedDBStore } = sdk as unknown as {
    createClient: (opts: ICreateClientOpts) => MatrixClient;
    IndexedDBStore: new (opts: { indexedDB: IDBFactory; localStorage?: Storage; dbName?: string }) => unknown;
  };

  let lsRef: Storage | undefined;
  try {
    lsRef = window.localStorage;
  } catch {
    lsRef = undefined;
  }
  const store = new IndexedDBStore({
    indexedDB: window.indexedDB,
    localStorage: lsRef,
    dbName: `matrix-js-sdk:${session.userId}`,
  }) as unknown as ICreateClientOpts["store"];

  const client = createClient({
    baseUrl: session.baseUrl,
    userId: session.userId,
    deviceId: session.deviceId,
    accessToken: session.accessToken,
    store,
    useAuthorizationHeader: true,
    timelineSupport: true,
    cryptoCallbacks: cryptoCallbacks as unknown as ICreateClientOpts["cryptoCallbacks"],
  });

  // matrix-js-sdk >= 41 requires startup to run AFTER the store is attached to
  // the client; calling it earlier throws "startup must be called after
  // assigning it to the client, not before".
  await (store as unknown as { startup: () => Promise<void> }).startup();

  return client;
}

/** Returns the singleton if one has been started, else null. */
export function getClient(): MatrixClient | null {
  return singleton;
}

/**
 * Start (or return an in-flight start promise for) the client using a given session.
 * Idempotent — calling twice returns the same client.
 */
export async function startClientFromSession(session: Session): Promise<MatrixClient> {
  if (singleton) return singleton;
  if (startingPromise) return startingPromise;

  startingPromise = (async () => {
    const sdk = await loadSdk();
    const client = await buildClient(sdk, session);

    await bootstrapCrypto(client);
    await client.startClient({ initialSyncLimit: 30, lazyLoadMembers: true });
    singleton = client;
    saveSession(session);
    return client;
  })();

  try {
    return await startingPromise;
  } finally {
    startingPromise = null;
  }
}

/** Restore session from localStorage and start. Resolves `null` if not signed in. */
export async function restoreClient(): Promise<MatrixClient | null> {
  const session = loadSession();
  if (!session) return null;
  return await startClientFromSession(session);
}

export type LoginInput = {
  baseUrl: string;
  user: string;
  password: string;
  deviceDisplayName?: string;
};

export async function loginWithPassword(input: LoginInput): Promise<Session> {
  const sdk = await loadSdk();
  const { createClient } = sdk as unknown as {
    createClient: (opts: ICreateClientOpts) => MatrixClient;
  };
  const tmp = createClient({ baseUrl: input.baseUrl });
  const res: LoginResponse = await tmp.login("m.login.password", {
    identifier: { type: "m.id.user", user: normalizeLocalpart(input.user) },
    password: input.password,
    initial_device_display_name: input.deviceDisplayName ?? "Matrix Web",
  });
  return {
    baseUrl: input.baseUrl,
    userId: res.user_id,
    deviceId: res.device_id,
    accessToken: res.access_token,
  };
}

export async function loginWithToken(baseUrl: string, loginToken: string): Promise<Session> {
  const sdk = await loadSdk();
  const { createClient } = sdk as unknown as {
    createClient: (opts: ICreateClientOpts) => MatrixClient;
  };
  const tmp = createClient({ baseUrl });
  const res: LoginResponse = await tmp.login("m.login.token", {
    token: loginToken,
    initial_device_display_name: "Matrix Web",
  });
  return {
    baseUrl,
    userId: res.user_id,
    deviceId: res.device_id,
    accessToken: res.access_token,
  };
}

export async function getSsoRedirectUrl(baseUrl: string, redirectTo: string): Promise<string> {
  const sdk = await loadSdk();
  const { createClient } = sdk as unknown as {
    createClient: (opts: ICreateClientOpts) => MatrixClient;
  };
  const tmp = createClient({ baseUrl });
  const get = (tmp as unknown as { getSsoLoginUrl?: (redirect: string) => string }).getSsoLoginUrl;
  if (!get) throw new Error("SDK does not expose getSsoLoginUrl");
  return get.call(tmp, redirectTo);
}

export async function logout(): Promise<void> {
  const c = singleton;
  singleton = null;
  if (c) {
    try {
      await c.logout(true);
    } catch {
      /* ignore */
    }
    try {
      c.stopClient();
    } catch {
      /* ignore */
    }
    try {
      await c.clearStores();
    } catch {
      /* ignore */
    }
  }
  clearSession();
  await wipeMatrixStorage();
}

/**
 * Discover the canonical homeserver base URL for a given domain or URL using
 * .well-known/matrix/client. Falls back to the original input on any error.
 */
export async function discoverHomeserver(input: string): Promise<string> {
  let hostUrl: URL;
  try {
    hostUrl = new URL(input.startsWith("http") ? input : `https://${input}`);
  } catch {
    throw new Error("Invalid homeserver URL");
  }
  const base = `${hostUrl.protocol}//${hostUrl.host}`;
  try {
    const res = await fetch(`${base}/.well-known/matrix/client`, { cache: "no-store" });
    if (res.ok) {
      const j = (await res.json()) as { "m.homeserver"?: { base_url?: string } };
      const u = j["m.homeserver"]?.base_url;
      if (u) return u.replace(/\/$/, "");
    }
  } catch {
    /* fall through to base */
  }
  return base;
}

function normalizeLocalpart(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) {
    const colon = trimmed.indexOf(":");
    return colon > 0 ? trimmed.slice(1, colon) : trimmed.slice(1);
  }
  return trimmed;
}

export type { Room, MatrixEvent, MatrixClient };
