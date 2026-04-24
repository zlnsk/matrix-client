"use client";

import type { MatrixClient, Room, RoomMember } from "matrix-js-sdk";
import { useApp } from "@/lib/store";
import { toRoomItem, buildTimeline, isBridgeFailNotice } from "./model";

type AnyClient = MatrixClient & {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  off: (event: string, handler: (...args: unknown[]) => void) => unknown;
  getRooms: () => Room[];
  getRoom: (id: string) => Room | null;
  getUserId: () => string | null;
  mxcUrlToHttp: (
    mxc: string | null,
    w?: number,
    h?: number,
    method?: string,
    allowDirect?: boolean,
    allowRedirect?: boolean
  ) => string | null;
  baseUrl?: string;
};

/**
 * Attach listeners that keep the Zustand store in sync with the Matrix client.
 * Returns a disposer that removes all listeners and marks the store idle.
 */
// Tracks the last time the user manually unarchived a room in this browser
// session. scanAutoArchive uses this as an activity floor so a manual
// unarchive is not instantly undone by the next idle-scan.
const manualUnarchivedAt = new Map<string, number>();
export function noteManualUnarchive(roomId: string): void {
  manualUnarchivedAt.set(roomId, Date.now());
}

export function attachSync(client: MatrixClient): () => void {
  const any = client as unknown as AnyClient;
  const store = useApp;

  const displayNames = new Map<string, string>();
  const cacheDisplayName = (m: RoomMember | null) => {
    if (!m) return;
    if (m.rawDisplayName) displayNames.set(m.userId, m.rawDisplayName);
    else if (m.name) displayNames.set(m.userId, m.name);
  };

  const rebuildRooms = () => {
    const seen = new Set<string>();
    const rooms = any
      .getRooms()
      .filter((r: unknown) => {
        const id = (r as { roomId?: string }).roomId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .filter((r: unknown) => (r as { getMyMembership?: () => string }).getMyMembership?.() !== "leave")
      .filter((r: unknown) => (r as { isSpaceRoom?: () => boolean }).isSpaceRoom?.() !== true)
      .map((r) => toRoomItem(any as unknown as Parameters<typeof toRoomItem>[0], r as unknown as Parameters<typeof toRoomItem>[1]));
    rooms.sort((a, b) => b.timestamp - a.timestamp);
    store.getState().setRooms(rooms);
  };

  const rebuildTimeline = (roomId: string) => {
    const room = any.getRoom(roomId);
    if (!room) return;
    const items = buildTimeline(
      any as unknown as Parameters<typeof buildTimeline>[0],
      room as unknown as Parameters<typeof buildTimeline>[1],
      displayNames
    );
    store.getState().setTimeline(roomId, items);
  };

  // --- listener wiring ---

  const onSync = (state: string) => {
    if (state === "PREPARED" || state === "SYNCING") {
      store.getState().setStatus("ready");
      store.getState().setConnection("online");
    }
    if (state === "ERROR" || state === "RECONNECTING") {
      store.getState().setConnection("offline");
    }
  };
  const onRoomOrName = () => rebuildRooms();
  const onRoomTimeline = (
    event: unknown,
    room: unknown,
    toStartOfTimeline?: boolean,
  ) => {
    const r = room as
      | { roomId?: string; tags?: Record<string, unknown> }
      | undefined;
    if (!r?.roomId) return;
    rebuildRooms();
    if (store.getState().selectedRoomId === r.roomId) {
      rebuildTimeline(r.roomId);
      if (!toStartOfTimeline && typeof document !== "undefined" && !document.hidden) {
        const e = event as unknown;
        (any as unknown as {
          sendReadReceipt?: (ev: unknown) => Promise<unknown>;
        }).sendReadReceipt?.(e).catch(() => undefined);
      }
    }

    // Auto-unarchive: any live message event in a low-priority-tagged room
    // removes the tag so the conversation resurfaces at the top of the list.
    // Skip scrollback (toStartOfTimeline) and bridge "Unable to decrypt"
    // notices — those are noise, not engagement.
    if (toStartOfTimeline) return;
    const e = event as { getType?: () => string } | undefined;
    const t = e?.getType?.();
    if (t !== "m.room.message" && t !== "m.room.encrypted") return;
    const ev = event as import("./model").AnyEventLike | undefined;
    const isBridgeFail = !!ev && isBridgeFailNotice(ev as never);

    if (!isBridgeFail && r.tags?.["m.lowpriority"]) {
      const c = any as unknown as {
        deleteRoomTag?: (roomId: string, tag: string) => Promise<unknown>;
      };
      c.deleteRoomTag?.(r.roomId, "m.lowpriority").catch(() => undefined);
    }

    // If a bridge puppet just posted an "** Unable to decrypt **" notice, its
    // device rotated and our outbound megolm session is stale. Force-discard
    // it so the next send creates a fresh session distributed to ALL current
    // devices of the bridge user.
    if (isBridgeFail) {
      const cr = any as unknown as {
        getCrypto?: () => { forceDiscardSession?: (roomId: string) => Promise<void> } | null;
      };
      cr.getCrypto?.()?.forceDiscardSession?.(r.roomId).catch(() => undefined);
    }
  };
  const onTyping = (event: unknown, member: RoomMember) => {
    cacheDisplayName(member);
    const e = event as { getContent?: () => { user_ids?: string[] }; getRoomId?: () => string | null | undefined };
    const roomId = e.getRoomId?.();
    if (!roomId) return;
    const users = e.getContent?.()?.user_ids ?? [];
    const me = any.getUserId();
    const names = users
      .filter((u) => u !== me)
      .map((u) => displayNames.get(u) ?? u.replace(/^@/, "").replace(/:.*$/, ""));
    store.getState().setTyping(roomId, names);
  };
  const onMember = (_event: unknown, _state: unknown, member: RoomMember) => {
    cacheDisplayName(member);
  };
  const onDecrypted = (event: unknown) => {
    const e = event as { getRoomId?: () => string | null | undefined };
    const roomId = e.getRoomId?.();
    if (!roomId) return;
    if (store.getState().selectedRoomId === roomId) rebuildTimeline(roomId);
    rebuildRooms();
  };

  any.on("sync", onSync as (...a: unknown[]) => void);
  any.on("Room", onRoomOrName as (...a: unknown[]) => void);
  any.on("Room.name", onRoomOrName as (...a: unknown[]) => void);
  any.on("Room.timeline", onRoomTimeline as (...a: unknown[]) => void);
  any.on("Room.receipt", onRoomOrName as (...a: unknown[]) => void);
  const onReceiptAlsoRebuild = (_ev: unknown, room: unknown) => {
    const r = room as { roomId?: string } | undefined;
    if (!r?.roomId) return;
    if (store.getState().selectedRoomId === r.roomId) rebuildTimeline(r.roomId);
  };
  any.on("Room.receipt", onReceiptAlsoRebuild as (...a: unknown[]) => void);
  // Room.localEchoUpdated fires when a locally-sent event transitions status
  // (encrypting → sending → sent / not_sent). Needed so the send-state icon
  // flips in place without waiting for a full sync rebuild.
  const onLocalEcho = (_ev: unknown, room: unknown) => {
    const r = room as { roomId?: string } | undefined;
    if (!r?.roomId) return;
    if (store.getState().selectedRoomId === r.roomId) rebuildTimeline(r.roomId);
  };
  any.on("Room.localEchoUpdated", onLocalEcho as (...a: unknown[]) => void);
  // Room.visibility-read-receipt: if a room is selected and the page becomes
  // visible, mark the latest event read. Keeps the sidebar badge in sync.
  const onVisibility = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    const roomId = store.getState().selectedRoomId;
    if (!roomId) return;
    const room = any.getRoom(roomId) as unknown as {
      getLiveTimeline?: () => { getEvents: () => unknown[] };
    } | null;
    const events = room?.getLiveTimeline?.()?.getEvents?.() ?? [];
    const last = events[events.length - 1];
    if (!last) return;
    (any as unknown as {
      sendReadReceipt?: (ev: unknown) => Promise<unknown>;
    }).sendReadReceipt?.(last).catch(() => undefined);
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  any.on("Room.tags", onRoomOrName as (...a: unknown[]) => void);
  any.on("RoomMember.typing", onTyping as (...a: unknown[]) => void);
  any.on("RoomMember.name", onMember as (...a: unknown[]) => void);
  any.on("Event.decrypted", onDecrypted as (...a: unknown[]) => void);
  any.on("Room.myMembership", onRoomOrName as (...a: unknown[]) => void);

  // Initial build after listeners attached (covers case where sync already PREPARED)
  rebuildRooms();

  // React to selection changes: rebuild timeline for the newly selected room.
  // Auto-archive: every 60s, scan joined rooms and tag any that have been
  // idle for > 3h with m.lowpriority. Skips favourites, rooms with unread
  // notifications, already-archived rooms, spaces, and left rooms. Paired
  // with the auto-unarchive above, so a new message resurfaces the chat.
  const AUTO_ARCHIVE_MS = 3 * 60 * 60 * 1000;
  const scanAutoArchive = () => {
    const now = Date.now();
    const selected = store.getState().selectedRoomId;
    for (const r of any.getRooms()) {
      const ro = r as unknown as {
        roomId: string;
        tags?: Record<string, unknown>;
        isSpaceRoom?: () => boolean;
        getMyMembership?: () => string;
        getLastActiveTimestamp?: () => number;
        getUnreadNotificationCount?: (kind: "total" | "highlight") => number;
        getLiveTimeline?: () => { getEvents: () => Array<{ getTs: () => number }> };
      };
      if (ro.isSpaceRoom?.()) continue;
      if (ro.getMyMembership?.() !== "join") continue;
      if (ro.tags?.["m.lowpriority"]) continue;
      if (ro.tags?.["m.favourite"]) continue;
      if ((ro.getUnreadNotificationCount?.("total") ?? 0) > 0) continue;
      // Don't archive the room the user is currently reading.
      if (ro.roomId === selected) continue;
      const events = ro.getLiveTimeline?.().getEvents?.() ?? [];
      const lastEventTs = events.length ? events[events.length - 1].getTs() : 0;
      // A manual unarchive counts as fresh activity — otherwise the next scan
      // would instantly re-archive a room the user just surfaced on purpose.
      const lastActive = Math.max(
        ro.getLastActiveTimestamp?.() ?? 0,
        lastEventTs,
        manualUnarchivedAt.get(ro.roomId) ?? 0,
      );
      if (!lastActive) continue;
      if (now - lastActive < AUTO_ARCHIVE_MS) continue;
      const c = any as unknown as {
        setRoomTag?: (roomId: string, tag: string, metadata?: Record<string, unknown>) => Promise<unknown>;
      };
      c.setRoomTag?.(ro.roomId, "m.lowpriority", {}).catch(() => undefined);
    }
  };
  scanAutoArchive();
  const autoArchiveTimer =
    typeof window !== "undefined" ? window.setInterval(scanAutoArchive, 60_000) : null;

  const unsubSelect = store.subscribe((s, prev) => {
    if (s.selectedRoomId && s.selectedRoomId !== prev.selectedRoomId) {
      rebuildTimeline(s.selectedRoomId);
      // Mark the room read when selecting it.
      const room = any.getRoom(s.selectedRoomId);
      const events = (room as unknown as { getLiveTimeline: () => { getEvents: () => unknown[] } })
        ?.getLiveTimeline?.()
        ?.getEvents?.();
      const last = events?.[events.length - 1];
      if (room && last) {
        (any as unknown as { sendReadReceipt: (e: unknown) => Promise<void> })
          .sendReadReceipt?.(last)
          .catch(() => undefined);
      }
    }
  });

  return () => {
    any.off("sync", onSync as (...a: unknown[]) => void);
    any.off("Room", onRoomOrName as (...a: unknown[]) => void);
    any.off("Room.name", onRoomOrName as (...a: unknown[]) => void);
    any.off("Room.timeline", onRoomTimeline as (...a: unknown[]) => void);
    any.off("Room.receipt", onRoomOrName as (...a: unknown[]) => void);
    any.off("Room.receipt", onReceiptAlsoRebuild as (...a: unknown[]) => void);
    any.off("Room.localEchoUpdated", onLocalEcho as (...a: unknown[]) => void);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
    any.off("Room.tags", onRoomOrName as (...a: unknown[]) => void);
    any.off("RoomMember.typing", onTyping as (...a: unknown[]) => void);
    any.off("RoomMember.name", onMember as (...a: unknown[]) => void);
    any.off("Event.decrypted", onDecrypted as (...a: unknown[]) => void);
    if (autoArchiveTimer !== null) window.clearInterval(autoArchiveTimer);
    unsubSelect();
  };
}
