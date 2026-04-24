"use client";

import { getClient } from "./client";

const cache = new Map<string, Promise<string>>();

type AuthedClient = {
  getAccessToken: () => string | null;
  mxcUrlToHttp: (
    mxc: string,
    w?: number,
    h?: number,
    method?: string,
    allowDirect?: boolean,
    allowRedirect?: boolean,
    useAuthentication?: boolean
  ) => string | null;
};

export type EncryptedFileInfo = {
  url: string;
  key: JsonWebKey;
  iv: string;
  hashes: { sha256: string };
  v?: string;
};

function b64decode(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64encodeUnpadded(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, "");
}

async function decryptAttachment(ciphertext: ArrayBuffer, file: EncryptedFileInfo): Promise<ArrayBuffer> {
  const expected = file.hashes?.sha256;
  if (expected) {
    const digest = await crypto.subtle.digest("SHA-256", ciphertext);
    const actual = b64encodeUnpadded(new Uint8Array(digest));
    if (actual !== expected.replace(/=+$/, "")) throw new Error("hash mismatch");
  }
  const key = await crypto.subtle.importKey("jwk", file.key, { name: "AES-CTR" }, false, ["decrypt"]);
  const iv = b64decode(file.iv);
  return crypto.subtle.decrypt({ name: "AES-CTR", counter: iv as BufferSource, length: 64 }, key, ciphertext);
}

type ResolveOpts = {
  width?: number;
  height?: number;
  method?: "crop" | "scale";
  encryptedFile?: EncryptedFileInfo;
  mimeType?: string;
};

export type EncryptAttachmentResult = {
  ciphertext: ArrayBuffer;
  info: {
    key: JsonWebKey;
    iv: string;
    hashes: { sha256: string };
    v: "v2";
  };
};

export async function encryptAttachment(plaintext: ArrayBuffer): Promise<EncryptAttachmentResult> {
  // Random 256-bit AES key + 128-bit IV (top 8 bytes random, bottom 8 zero).
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = new Uint8Array(16);
  crypto.getRandomValues(iv.subarray(0, 8));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    true,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-CTR", counter: iv as BufferSource, length: 64 },
    cryptoKey,
    plaintext,
  );
  const digest = await crypto.subtle.digest("SHA-256", ciphertext);
  const hashB64 = b64encodeUnpadded(new Uint8Array(digest));
  const ivB64 = b64encodeUnpadded(iv);
  const jwk = await crypto.subtle.exportKey("jwk", cryptoKey);
  return {
    ciphertext,
    info: {
      key: {
        ...(jwk as JsonWebKey),
        alg: "A256CTR",
        ext: true,
        key_ops: ["encrypt", "decrypt"],
      },
      iv: ivB64,
      hashes: { sha256: hashB64 },
      v: "v2",
    },
  };
}

export function resolveMediaUrl(
  mxcArg: string,
  width = 96,
  height = 96,
  method: "crop" | "scale" = "crop",
  opts?: { encryptedFile?: EncryptedFileInfo; mimeType?: string }
): Promise<string> | null {
  // Encrypted media: use its own mxc, skip thumbnail dims (server can't
  // thumbnail ciphertext meaningfully); dimensions are honored on <img>.
  const enc = opts?.encryptedFile;
  const mxc = enc?.url ?? mxcArg;
  if (!mxc || !mxc.startsWith("mxc://")) return null;
  const key = enc
    ? `enc|${mxc}|${opts?.mimeType ?? ""}`
    : `${mxc}|${width}x${height}|${method}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const client = getClient() as unknown as AuthedClient | null;
  if (!client) return null;

  const promise = (async () => {
    const w = enc ? 0 : width;
    const h = enc ? 0 : height;
    const authedUrl = enc
      ? client.mxcUrlToHttp(mxc, undefined, undefined, undefined, true, true, true)
      : client.mxcUrlToHttp(mxc, w, h, method, false, true, true);
    const legacyUrl = enc
      ? client.mxcUrlToHttp(mxc, undefined, undefined, undefined, true, true, false)
      : client.mxcUrlToHttp(mxc, w, h, method, false, true, false);

    const token = client.getAccessToken();
    const tryUrls: Array<{ url: string; auth: boolean }> = [];
    if (authedUrl) tryUrls.push({ url: authedUrl, auth: true });
    if (legacyUrl && legacyUrl !== authedUrl) tryUrls.push({ url: legacyUrl, auth: false });
    if (tryUrls.length === 0) throw new Error("no resolvable url");

    let lastErr: unknown = null;
    for (const { url, auth } of tryUrls) {
      try {
        const res = await fetch(url, {
          headers: auth && token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "force-cache",
        });
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status}`);
          continue;
        }
        if (enc) {
          const cipherBuf = await res.arrayBuffer();
          const plain = await decryptAttachment(cipherBuf, enc);
          const blob = new Blob([plain], { type: opts?.mimeType ?? "application/octet-stream" });
          return URL.createObjectURL(blob);
        }
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("media fetch failed");
  })();

  promise.catch(() => cache.delete(key));
  cache.set(key, promise);
  return promise;
}
