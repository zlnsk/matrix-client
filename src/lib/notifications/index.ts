"use client";

/**
 * Lightweight in-page notifications for incoming Matrix messages.
 *
 * Strategy: subscribe to `Room.timeline` on the running client, and when a
 * fresh message arrives from someone else for a non-focused room, fire a
 * Notification. We do not register for Web Push at the homeserver — Matrix
 * sygnal/UnifiedPush wiring is out of scope here. Service worker still hosts
 * a `push` handler so a future homeserver push gateway will Just Work.
 */

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { useApp } from "@/lib/store";
import { resolveMediaUrl } from "@/lib/matrix/media";
import { playIncomingSound } from "./sounds";

type AnyEvent = MatrixEvent & {
  getContent: <T = Record<string, unknown>>() => T;
  getType: () => string;
  getSender: () => string | null | undefined;
  getRoomId: () => string | null | undefined;
  getId: () => string | undefined;
  getTs: () => number;
  isRedacted?: () => boolean;
};

type AnyRoom = Room & {
  roomId: string;
  name: string;
  getMyMembership?: () => string;
  getMxcAvatarUrl?: () => string | null;
};

type AnyClient = MatrixClient & {
  on: (event: string, h: (...args: unknown[]) => void) => unknown;
  off: (event: string, h: (...args: unknown[]) => void) => unknown;
  getUserId: () => string | null;
};

const KEY = "matrix:notif:permission-asked";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationsPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "default";
  }
}

/**
 * Ask the browser for notification permission once, the first time the user
 * boots a logged-in session. Stores a flag in localStorage so we don't keep
 * pestering them across reloads.
 */
export async function maybePromptOnFirstRun(): Promise<void> {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "default") return;
  try {
    if (window.localStorage.getItem(KEY)) return;
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* storage disabled */
  }
  // Microtask delay so the first-paint isn't blocked by the prompt.
  setTimeout(() => {
    void ensureNotificationPermission();
  }, 1500);
}

let detacher: (() => void) | null = null;

export function attachNotifications(client: MatrixClient): () => void {
  if (detacher) detacher();
  if (!notificationsSupported()) {
    detacher = () => undefined;
    return detacher;
  }

  const any = client as AnyClient;
  const myUserId = any.getUserId();

  // Suppress alerts for the first few seconds after boot — initial sync replays
  // historical events through Room.timeline.
  const bootTime = Date.now();
  const QUIET_MS = 4_000;

  const onTimeline = (event: unknown, room: unknown) => {
    const e = event as AnyEvent;
    const r = room as AnyRoom | undefined;
    if (!r) return;
    if (Date.now() - bootTime < QUIET_MS) return;
    if (!e?.getType) return;

    const type = e.getType();
    if (type !== "m.room.message" && type !== "m.room.encrypted") return;
    if (e.isRedacted?.()) return;
    const sender = e.getSender();
    if (!sender || sender === myUserId) return;
    if (r.getMyMembership?.() !== "join") return;

    // Incoming ping for any new message from someone else, regardless of
    // which room is focused — matches iPhone behaviour.
    playIncomingSound();

    // System notification: only when tab hidden or a different room is shown.
    if (Notification.permission !== "granted") return;
    const state = useApp.getState();
    const focused = typeof document !== "undefined" && document.visibilityState === "visible";
    if (focused && state.selectedRoomId === r.roomId) return;

    void fireNotification(any, e, r);
  };

  any.on("Room.timeline", onTimeline as (...a: unknown[]) => void);

  detacher = () => {
    any.off("Room.timeline", onTimeline as (...a: unknown[]) => void);
    detacher = null;
  };
  return detacher;
}

async function fireNotification(client: AnyClient, e: AnyEvent, room: AnyRoom) {
  const content = e.getContent<{ body?: string; msgtype?: string }>();
  const sender = e.getSender() ?? "";
  const senderName =
    useApp.getState().displayNames.get(sender) ??
    sender.replace(/^@/, "").replace(/:.*$/, "");
  const isDM = (room.getMyMembership?.() === "join") && room.name && !room.name.startsWith("#");
  const title = isDM ? senderName : room.name || senderName;
  const preview = previewBody(content);
  const body = isDM ? preview : `${senderName}: ${preview}`;

  const avatarMxc = room.getMxcAvatarUrl?.() ?? null;
  let icon: string | undefined;
  if (avatarMxc) {
    try {
      const promise = resolveMediaUrl(avatarMxc, 96, 96);
      if (promise) icon = await promise;
    } catch {
      /* fallthrough */
    }
  }

  try {
    const notif = new Notification(title, {
      body,
      icon,
      tag: room.roomId,
      data: { roomId: room.roomId, eventId: e.getId() },
      silent: false,
    });
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      useApp.getState().selectRoom(room.roomId);
      notif.close();
    };
  } catch {
    /* permission revoked between check and fire */
  }
}

function previewBody(content: { body?: string; msgtype?: string }): string {
  if (content.msgtype === "m.image") return "📷 Image";
  if (content.msgtype === "m.file") return "📎 File";
  if (content.msgtype === "m.video") return "🎬 Video";
  if (content.msgtype === "m.audio") return "🎙️ Audio";
  return (content.body ?? "Encrypted message").slice(0, 140);
}
