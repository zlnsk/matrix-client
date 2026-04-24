"use client";

// Persistent offline outbox for Matrix messages, replies, and file attachments.
// Items sit in IndexedDB until a drainer successfully sends them to the server.

import { openDB, type IDBPDatabase } from "idb";

export type OutboxItem =
  | {
      id: string;
      type: "text";
      roomId: string;
      body: string;
      createdAt: number;
      attempts: number;
      lastError?: string | null;
    }
  | {
      id: string;
      type: "reply";
      roomId: string;
      body: string;
      replyToId: string;
      createdAt: number;
      attempts: number;
      lastError?: string | null;
    }
  | {
      id: string;
      type: "file";
      roomId: string;
      fileBlob: Blob;
      fileName: string;
      mime: string;
      caption?: string;
      info?: { w?: number; h?: number };
      createdAt: number;
      attempts: number;
      lastError?: string | null;
    };

const DB_NAME = "matrix-outbox-v1";
const STORE = "items";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: "id" });
          os.createIndex("roomId", "roomId");
          os.createIndex("createdAt", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  }
  return `ob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function enqueueText(roomId: string, body: string): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: newId(),
    type: "text",
    roomId,
    body,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  const db = await getDB();
  await db.put(STORE, item);
  notify();
  return item;
}

export async function enqueueReply(
  roomId: string,
  body: string,
  replyToId: string,
): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: newId(),
    type: "reply",
    roomId,
    body,
    replyToId,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  const db = await getDB();
  await db.put(STORE, item);
  notify();
  return item;
}

export async function enqueueFile(
  roomId: string,
  fileBlob: Blob,
  fileName: string,
  mime: string,
  caption?: string,
  info?: { w?: number; h?: number },
): Promise<OutboxItem> {
  const item: OutboxItem = {
    id: newId(),
    type: "file",
    roomId,
    fileBlob,
    fileName,
    mime,
    caption,
    info,
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  const db = await getDB();
  await db.put(STORE, item);
  notify();
  return item;
}

export async function listAll(): Promise<OutboxItem[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as OutboxItem[];
  all.sort((a, b) => a.createdAt - b.createdAt);
  return all;
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
  notify();
}

export async function markAttempt(id: string, err?: string | null): Promise<void> {
  const db = await getDB();
  const item = (await db.get(STORE, id)) as OutboxItem | undefined;
  if (!item) return;
  item.attempts += 1;
  item.lastError = err ?? null;
  await db.put(STORE, item);
  notify();
}
