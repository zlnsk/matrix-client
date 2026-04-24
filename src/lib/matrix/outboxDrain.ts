"use client";

// Drain the offline outbox: iterate queued items, try to send each, remove on
// success. Retries on `online` events, matrix-js-sdk Sync state changes, and
// periodically while items remain.

import type { MatrixClient } from "matrix-js-sdk";
import { listAll, markAttempt, remove, type OutboxItem } from "./outbox";
import { lockedSend } from "./sendLock";
import { useApp } from "@/lib/store";

type AnyClient = {
  sendTextMessage: (roomId: string, body: string) => Promise<{ event_id: string }>;
  sendEvent: (
    roomId: string,
    type: string,
    content: Record<string, unknown>,
  ) => Promise<{ event_id: string }>;
  sendMessage: (
    roomId: string,
    content: Record<string, unknown>,
  ) => Promise<{ event_id: string }>;
  uploadContent: (
    file: File | Blob,
    opts?: {
      type?: string;
      name?: string;
      progressHandler?: (p: { loaded: number; total: number }) => void;
    },
  ) => Promise<{ content_uri: string }>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb: (...args: unknown[]) => void) => void;
};

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /network|offline|failed to fetch|ECONNREFUSED|ETIMEDOUT|NetworkError|timeout/i.test(
      msg,
    ) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  );
}

function isFatalError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /M_UNKNOWN_TOKEN|401|Cannot encrypt event in unconfigured room/i.test(msg);
}

async function sendItem(client: AnyClient, item: OutboxItem): Promise<void> {
  const setInFlight = useApp.getState().setOutboxInFlight;
  const setUploading = useApp.getState().setOutboxUploading;
  if (item.type === "text") {
    setInFlight(item.id, true);
    await client.sendTextMessage(item.roomId, item.body);
    return;
  }
  if (item.type === "reply") {
    setInFlight(item.id, true);
    await client.sendEvent(item.roomId, "m.room.message", {
      msgtype: "m.text",
      body: item.body,
      "m.relates_to": { "m.in_reply_to": { event_id: item.replyToId } },
    });
    return;
  }
  // file: keep the optimistic bubble visible with a progress bar during upload;
  // only hide it once matrix-js-sdk takes over the local echo on sendMessage.
  const msgtype = item.mime.startsWith("image/")
    ? "m.image"
    : item.mime.startsWith("video/")
      ? "m.video"
      : item.mime.startsWith("audio/")
        ? "m.audio"
        : "m.file";
  const info: Record<string, unknown> = { mimetype: item.mime, size: item.fileBlob.size };
  if (item.info?.w) info.w = item.info.w;
  if (item.info?.h) info.h = item.info.h;
  setUploading(item.id, 0);
  try {
    const upload = await client.uploadContent(item.fileBlob, {
      type: item.mime,
      name: item.fileName,
      progressHandler: ({ loaded, total }) => {
        if (total > 0) {
          setUploading(item.id, Math.min(0.99, loaded / total));
        }
      },
    });
    setUploading(item.id, null);
    setInFlight(item.id, true);
    const body = item.caption && item.caption.trim() ? item.caption : item.fileName;
    await client.sendMessage(item.roomId, {
      msgtype,
      body,
      url: upload.content_uri,
      info,
    });
  } catch (err) {
    setUploading(item.id, null);
    throw err;
  }
}

const MIN_RETRY_MS = 5_000;
const lastAttemptAt = new Map<string, number>();
let lastDrainAt = 0;
let inFlight: Promise<void> | null = null;

export async function drainOnce(client: MatrixClient): Promise<void> {
  if (inFlight) return inFlight;
  const now = Date.now();
  if (now - lastDrainAt < 2_000) {
    return;
  }
  lastDrainAt = now;
  const any = client as unknown as AnyClient;
  inFlight = (async () => {
    const items = await listAll();
    const setInFlight = useApp.getState().setOutboxInFlight;
    for (const item of items) {
      const lastAttempt = lastAttemptAt.get(item.id) ?? 0;
      if (now - lastAttempt < MIN_RETRY_MS) {
        continue;
      }
      lastAttemptAt.set(item.id, Date.now());
      try {
        await lockedSend(client, () => sendItem(any, item));
        lastAttemptAt.delete(item.id);
        await remove(item.id);
        useApp.getState().removeOutboxItem(item.id);
      } catch (err) {
        const fatal = isFatalError(err);
        if (fatal) {
          // Permanently failed — remove from outbox so it stops retrying
          lastAttemptAt.delete(item.id);
          await remove(item.id);
          useApp.getState().removeOutboxItem(item.id);
          setInFlight(item.id, false);
          continue;
        }
        const network = isNetworkError(err);
        await markAttempt(
          item.id,
          err instanceof Error ? err.message : String(err),
        );
        setInFlight(item.id, false);
        if (network) {
          break;
        }
        continue;
      }
      setInFlight(item.id, false);
    }
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

export function attachOutboxDrainer(client: MatrixClient): () => void {
  const any = client as unknown as AnyClient;

  const tryDrain = () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    void drainOnce(client);
  };

  const onOnline = () => tryDrain();
  const onSync = (state: string) => {
    if (state === "PREPARED" || state === "SYNCING") tryDrain();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
  }
  any.on("sync", onSync as unknown as (...args: unknown[]) => void);

  // Initial attempt on attach.
  tryDrain();

  // Periodic safety net for cases where sync stays silent on a lossy network.
  const interval = typeof window !== "undefined"
    ? window.setInterval(tryDrain, 30_000)
    : null;

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
      if (interval != null) window.clearInterval(interval);
    }
    const off = any.off ?? any.removeListener;
    off?.call(any, "sync", onSync as unknown as (...args: unknown[]) => void);
  };
}
