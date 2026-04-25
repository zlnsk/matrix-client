"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useMatrixBoot } from "@/hooks/useMatrix";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatEmptyState } from "./ChatEmptyState";
import { MessageList } from "@/components/timeline/MessageList";
import { Composer } from "@/components/composer/Composer";
import { NewChatDialog } from "@/components/rooms/NewChatDialog";
import { ForwardDialog } from "@/components/rooms/ForwardDialog";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { RoomDetailsDrawer } from "@/components/rooms/RoomDetailsDrawer";
import { getClient, logout as doLogout } from "@/lib/matrix/client";
import { noteManualUnarchive } from "@/lib/matrix/sync";
import {
  enqueueFile as outboxEnqueueFile,
  enqueueReply as outboxEnqueueReply,
  enqueueText as outboxEnqueueText,
  type OutboxItem,
} from "@/lib/matrix/outbox";
import { drainOnce as outboxDrainOnce } from "@/lib/matrix/outboxDrain";
import { lockedSend } from "@/lib/matrix/sendLock";
import { playSentSound } from "@/lib/notifications/sounds";
import type { TimelineItem } from "@/lib/matrix/model";

function readImageDims(file: File): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

type AnyClient = {
  createRoom: (opts: {
    is_direct?: boolean;
    invite?: string[];
    preset?: string;
    visibility?: string;
  }) => Promise<{ room_id: string }>;
  joinRoom: (target: string) => Promise<{ roomId: string }>;
  leave: (roomId: string) => Promise<void>;
  sendReadReceipt: (event: unknown) => Promise<void>;
  sendTextMessage: (roomId: string, body: string) => Promise<{ event_id: string }>;
  redactEvent: (roomId: string, eventId: string) => Promise<unknown>;
  getRoom: (id: string) =>
    | (Room & {
        getLiveTimeline: () => { getEvents: () => unknown[]; getPaginationToken: (dir: "f" | "b") => string | null };
      })
    | null;
  uploadContent: (
    file: File | Blob,
    opts?: { type?: string; name?: string }
  ) => Promise<{ content_uri: string }>;
  sendMessage: (roomId: string, content: Record<string, unknown>) => Promise<unknown>;
  paginateEventTimeline: (
    timeline: unknown,
    opts?: { backwards?: boolean; limit?: number }
  ) => Promise<boolean>;
};

type Room = Record<string, unknown>;

export default function AppShellLive() {
  const router = useRouter();
  const { booted } = useMatrixBoot();
  const rooms = useApp((s) => s.rooms);
  const selectedRoomId = useApp((s) => s.selectedRoomId);
  const timelines = useApp((s) => s.timelines);
  const typing = useApp((s) => s.typing);
  const outbox = useApp((s) => s.outbox);
  const outboxInFlight = useApp((s) => s.outboxInFlight);
  const outboxUploading = useApp((s) => s.outboxUploading);
  const userId = useApp((s) => s.userId);
  const status = useApp((s) => s.status);
  const connection = useApp((s) => s.connection);
  const selectRoom = useApp((s) => s.selectRoom);
  const ownProfile = useMemo(() => {
    if (!booted || !userId) return { name: null as string | null, avatar: null as string | null };
    const c = getClient() as unknown as {
      getUser?: (id: string) => { avatarUrl?: string | null; displayName?: string | null } | null;
    } | null;
    const u = c?.getUser?.(userId) ?? null;
    return {
      name: u?.displayName ?? userId?.replace(/^@/, "").replace(/:.*$/, "") ?? null,
      avatar: u?.avatarUrl ?? null,
    };
  }, [booted, userId, rooms]);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardEventId, setForwardEventId] = useState<string | null>(null);

  const selected = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  useEffect(() => {
    setReplyTargetId(null);
  }, [selectedRoomId]);

  const replyTarget = useMemo(() => {
    if (!replyTargetId || !selected) return null;
    const list = timelines[selected.id] ?? [];
    const m = list.find((x) => x.id === replyTargetId);
    if (!m) return null;
    return { id: m.id, senderName: m.senderName, body: m.body };
  }, [replyTargetId, selected, timelines]);

  // Turn outbox items for the selected room into optimistic pending bubbles,
  // appended after the server timeline.
  const outboxUrlsRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const cache = outboxUrlsRef.current;
    const liveIds = new Set<string>();
    Object.values(outbox).forEach((list) =>
      list.forEach((it) => {
        if (it.type === "file" && it.mime.startsWith("image/")) liveIds.add(it.id);
      }),
    );
    for (const [id, url] of cache) {
      if (!liveIds.has(id)) {
        URL.revokeObjectURL(url);
        cache.delete(id);
      }
    }
    return () => {
      // Revoke on unmount to avoid leaks.
      for (const [, url] of cache) URL.revokeObjectURL(url);
      cache.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outbox]);

  const outboxItemsToTimeline = (items: OutboxItem[]): TimelineItem[] => {
    const own = true;
    const senderName = ownProfile.name ?? "You";
    const senderAvatar = ownProfile.avatar ?? null;
    const cache = outboxUrlsRef.current;
    return items.map((it) => {
      let body = "";
      let attachment: TimelineItem["attachment"] = null;
      if (it.type === "text" || it.type === "reply") {
        body = it.body;
      } else {
        body = it.caption && it.caption.trim() ? it.caption : it.fileName;
        if (it.mime.startsWith("image/")) {
          let url = cache.get(it.id);
          if (!url) {
            url = URL.createObjectURL(it.fileBlob);
            cache.set(it.id, url);
          }
          attachment = {
            kind: "image",
            url,
            alt: it.fileName,
            width: it.info?.w,
            height: it.info?.h,
            mimeType: it.mime,
          };
        } else {
          attachment = {
            kind: "file",
            url: "",
            name: it.fileName,
            size: it.fileBlob.size,
            mime: it.mime,
          };
        }
      }
      const progress = outboxUploading[it.id];
      return {
        id: `outbox:${it.id}`,
        body,
        timestamp: it.createdAt,
        own,
        senderName,
        senderAvatar: senderAvatar ?? undefined,
        sendState: "sending",
        attachment,
        uploadProgress: typeof progress === "number" ? progress : null,
        isGroupStart: false,
        isGroupEnd: true,
      } as TimelineItem;
    });
  };

  // Reflect total unread count in the document title and PWA badge.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const total = rooms.reduce((acc, r) => acc + (r.unread || 0), 0);
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) Matrix` : "Matrix";
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (total > 0) nav.setAppBadge?.(total).catch(() => undefined);
    else nav.clearAppBadge?.().catch(() => undefined);
  }, [rooms]);

  const mergedTimeline = useMemo<TimelineItem[]>(() => {
    if (!selected) return [];
    const base = timelines[selected.id] ?? [];
    const pending = (outbox[selected.id] ?? []).filter(
      (it) => {
        if (outboxInFlight[it.id]) return false;
        const itBody = it.type === "file" ? (it.caption || it.fileName) : it.body;
        return !base.some((b) => b.own && b.body === itBody && Math.abs(b.timestamp - it.createdAt) < 15_000);
      }
    );
    if (pending.length === 0) return base;
    return [...base, ...outboxItemsToTimeline(pending)];
    // outboxItemsToTimeline reads ownProfile via closure; safe because selected/outbox drive this memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, timelines, outbox, outboxInFlight, outboxUploading, ownProfile.name, ownProfile.avatar]);

  const handleArchive = async (roomId: string) => {
    const c = getClient() as unknown as {
      setRoomTag?: (roomId: string, tagName: string, metadata?: Record<string, unknown>) => Promise<unknown>;
    } | null;
    try {
      await c?.setRoomTag?.(roomId, "m.lowpriority", {});
    } catch {
      /* surface silently; sync listener will re-read tags */
    }
  };
  const handleUnarchive = async (roomId: string) => {
    const c = getClient() as unknown as {
      deleteRoomTag?: (roomId: string, tagName: string) => Promise<unknown>;
    } | null;
    try {
      await c?.deleteRoomTag?.(roomId, "m.lowpriority");
      // Mark the unarchive so the 60s auto-archive scan treats it as fresh
      // activity — otherwise a still-idle room would re-archive within a
      // minute of the user surfacing it.
      noteManualUnarchive(roomId);
    } catch {
      /* ignore */
    }
  };



  // When a room is opened on mobile, push a no-op history entry so the
  // Android/iOS system back gesture pops that entry and we catch it here to
  // deselect the room (instead of navigating away from the app).
  const prevRoomForHistory = useRef<string | null>(selectedRoomId);
  useEffect(() => {
    const prev = prevRoomForHistory.current;
    prevRoomForHistory.current = selectedRoomId;
    if (!prev && selectedRoomId) {
      try {
        window.history.pushState({ matrixRoom: selectedRoomId }, "");
      } catch {
        /* ignore — some browsers restrict history in sandboxed iframes */
      }
    }
  }, [selectedRoomId]);
  useEffect(() => {
    const onPop = () => {
      if (useApp.getState().selectedRoomId) {
        useApp.getState().selectRoom(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goBackToList = () => {
    if (!selectedRoomId) return;
    // Preferred: let the browser pop the entry we pushed; popstate will fire
    // and deselect via the listener above, keeping history aligned with UI.
    if (window.history.state && (window.history.state as { matrixRoom?: string }).matrixRoom) {
      window.history.back();
    } else {
      selectRoom(null);
    }
  };

  const chatSectionRef = useRef<HTMLElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const onChatTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    // Track any touch — we still require an edge start before treating it as a back-swipe.
    swipeStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };
  const onChatTouchMove = (e: React.TouchEvent) => {
    const s0 = swipeStart.current;
    if (!s0) return;
    const t = e.touches[0];
    if (!t) return;
    const dy = t.clientY - s0.y;
    const dx = t.clientX - s0.x;
    // Cancel if vertical scroll wins, or the start wasn't near the left edge.
    if (Math.abs(dy) > Math.abs(dx) + 6) swipeStart.current = null;
    if (s0.x > 48 && dx > 0) swipeStart.current = null;
  };
  const onChatTouchEnd = (e: React.TouchEvent) => {
    const s0 = swipeStart.current;
    if (!s0) return;
    const t = e.changedTouches[0];
    if (!t) {
      swipeStart.current = null;
      return;
    }
    const dx = t.clientX - s0.x;
    const dt = Date.now() - s0.time;
    swipeStart.current = null;
    if (s0.x <= 48 && dx > 60 && dt < 700) goBackToList();
  };

  async function handleLeave(roomId: string) {
    if (!confirm("Leave this room?")) return;
    const client = getClient() as unknown as AnyClient | null;
    if (!client) return;
    try {
      await client.leave(roomId);
      // clear selection after leaving
      goBackToList();
    } catch {
      alert("Leaving room failed. Please try again.");
    }
  }

  if (!booted || status === "starting") {
    return (
      <div className="flex min-h-dvh w-dvw items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <Loader2 size={18} className="animate-spin" />
          <span>Connecting to Matrix…</span>
        </div>
      </div>
    );
  }

  async function handleSend(text: string) {
    const client = getClient();
    if (!client || !selectedRoomId) return;
    playSentSound();
    if (replyTarget) {
      await outboxEnqueueReply(selectedRoomId, text, replyTarget.id);
      setReplyTargetId(null);
    } else {
      await outboxEnqueueText(selectedRoomId, text);
    }
    void outboxDrainOnce(client);
  }

  async function handleReact(eventId: string, emoji: string) {
    const client = getClient();
    if (!client || !selectedRoomId) return;
    // Toggle: if we already reacted with this emoji, redact our reaction instead of sending another.
    const tl = timelines[selectedRoomId] ?? [];
    const msg = tl.find((m) => m.id === eventId);
    const existing = msg?.reactions?.find((r) => r.emoji === emoji);
    if (existing?.mine && existing.myEventId) {
      await lockedSend(client, () => client.redactEvent(selectedRoomId, existing.myEventId!)).catch(() => undefined);
      return;
    }
    await lockedSend(client, () =>
      (client as unknown as {
        sendEvent: (roomId: string, type: string, content: Record<string, unknown>) => Promise<unknown>;
      }).sendEvent(selectedRoomId, "m.reaction", {
        "m.relates_to": { rel_type: "m.annotation", event_id: eventId, key: emoji },
      }),
    ).catch(() => undefined);
  }

  async function handleEdit(eventId: string, newBody: string) {
    const client = getClient();
    if (!client || !selectedRoomId) return;
    try {
      await lockedSend(client, () =>
        (client as unknown as {
          sendEvent: (roomId: string, type: string, content: Record<string, unknown>) => Promise<unknown>;
        }).sendEvent(selectedRoomId, "m.room.message", {
          msgtype: "m.text",
          body: `* ${newBody}`,
          "m.new_content": { msgtype: "m.text", body: newBody },
          "m.relates_to": { rel_type: "m.replace", event_id: eventId },
        }),
      );
    } catch (err) {
      console.error("[matrix] edit failed:", err);
    }
  }

  async function handleSendFile(file: File, caption?: string) {
    const client = getClient();
    if (!client || !selectedRoomId) return;
    playSentSound();
    const mime = file.type || "application/octet-stream";
    let info: { w?: number; h?: number } | undefined;
    if (mime.startsWith("image/") && file.type !== "image/svg+xml") {
      try {
        const dim = await readImageDims(file);
        if (dim) info = { w: dim.w, h: dim.h };
      } catch {
        /* dim probe failed — ok */
      }
    }
    await outboxEnqueueFile(selectedRoomId, file, file.name, mime, caption, info);
    void outboxDrainOnce(client);
  }

  function handleTyping(active: boolean) {
    const client = getClient();
    if (!client || !selectedRoomId) return;
    (client as unknown as { sendTyping: (roomId: string, typing: boolean, timeout?: number) => Promise<void> })
      .sendTyping(selectedRoomId, active, 5_000)
      .catch(() => undefined);
  }

  async function handleNewChat(target: string): Promise<{ roomId: string } | void> {
    const client = getClient() as unknown as AnyClient | null;
    if (!client) throw new Error("Not connected");
    const t = target.trim();
    if (t.startsWith("@")) {
      const res = await client.createRoom({
        is_direct: true,
        invite: [t],
        preset: "trusted_private_chat",
      });
      selectRoom(res.room_id);
      return { roomId: res.room_id };
    }
    // alias or room id → join
    const res = await client.joinRoom(t);
    selectRoom(res.roomId);
    return { roomId: res.roomId };
  }



  function handleReply(eventId: string) {
    setReplyTargetId(eventId);
  }

  async function handlePaginate(): Promise<boolean> {
    const client = getClient() as unknown as AnyClient | null;
    if (!client || !selectedRoomId) return false;
    const room = client.getRoom(selectedRoomId);
    const timeline = room?.getLiveTimeline?.();
    if (!timeline) return false;
    try {
      const more = await client.paginateEventTimeline(timeline, { backwards: true, limit: 30 });
      return Boolean(more);
    } catch {
      return false;
    }
  }

  async function handleCopy(eventId: string) {
    if (!selected) return;
    const m = (timelines[selected.id] ?? []).find((x) => x.id === eventId);
    if (!m) return;
    try {
      await navigator.clipboard.writeText(m.body);
    } catch {
      /* clipboard unavailable */
    }
  }

  function handleForward(eventId: string) {
    setForwardEventId(eventId);
    setForwardOpen(true);
  }

  async function doForward(targetRoomId: string) {
    const client = getClient() as unknown as AnyClient | null;
    if (!client || !selected || !forwardEventId) return;
    const m = (timelines[selected.id] ?? []).find((x) => x.id === forwardEventId);
    if (!m) return;
    const sdk = client as unknown as import("matrix-js-sdk").MatrixClient;
    const room = sdk.getRoom(selected.id);
    const evt = room?.findEventById(forwardEventId);
    const orig = evt?.getContent() as Record<string, unknown> | undefined;
    let content: Record<string, unknown>;
    if (orig && typeof orig.msgtype === "string" && orig.msgtype !== "m.text" && orig.msgtype !== "m.notice" && orig.msgtype !== "m.emote") {
      const { "m.relates_to": _rel, ...rest } = orig as Record<string, unknown>;
      void _rel;
      content = rest;
    } else {
      content = { msgtype: "m.text", body: m.body };
    }
    try {
      await lockedSend(sdk, () => client.sendMessage(targetRoomId, content));
    } catch {
      /* ignore */
    } finally {
      setForwardEventId(null);
    }
  }

  async function handleDelete(eventId: string) {
    const client = getClient() as unknown as AnyClient | null;
    if (!client || !selectedRoomId) return;
    if (!confirm("Delete this message? This cannot be undone.")) return;
    try {
      await lockedSend(client as unknown as import("matrix-js-sdk").MatrixClient, () => client.redactEvent(selectedRoomId, eventId));
      if (replyTargetId === eventId) setReplyTargetId(null);
    } catch {
      /* timeline will refresh either way */
    }
  }

  return (
    <div className="flex h-dvh w-dvw max-w-[100vw] overflow-hidden" style={{ background: "var(--bg)", paddingBottom: "var(--kb-inset, 0px)" }}>
      <Sidebar
        rooms={rooms}
        selectedId={selectedRoomId}
        onSelect={selectRoom}
        onNewChat={() => setNewChatOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onLeave={handleLeave}
        userName={ownProfile.name}
        userAvatar={ownProfile.avatar}
      />
      <section
        ref={chatSectionRef}
        onTouchStart={onChatTouchStart}
        onTouchMove={onChatTouchMove}
        onTouchEnd={onChatTouchEnd}
        onTouchCancel={onChatTouchEnd}
        className={cn(
          "flex-1 min-w-0 min-h-0 flex-col overflow-hidden",
          selected ? "flex" : "hidden md:flex"
        )}
      >
        {connection === "offline" && (
          <div
            className="px-3 py-1.5 text-center text-[14.5px]"
            style={{
              background: "color-mix(in oklch, var(--accent-warning) 10%, transparent)",
              color: "var(--accent-warning)",
              borderBottom: "1px solid color-mix(in oklch, var(--accent-warning) 25%, transparent)",
            }}
          >
            You&apos;re offline — messages will send when you&apos;re back.
          </div>
        )}
        {selected ? (
          <>
            <ChatHeader
              roomId={selected.id}
              encrypted={selected.encrypted}
              name={selected.name}
              avatar={selected.avatar ?? undefined}
              onOpenInfo={() => setDetailsOpen(true)}
              onBack={goBackToList}
            />
            <MessageList
              messages={mergedTimeline}
              typingNames={typing[selected.id] ?? []}
              unreadAfter={null}
              roomId={selected.id}
              encrypted={selected.encrypted}
              roomName={selected.name}
              isDm={selected.kind === "dm" || !selected.kind}
              onReact={handleReact}
              onReply={handleReply}
              onCopy={handleCopy}
              onForward={handleForward}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onPaginate={handlePaginate}
            />
            <Composer
              onSend={handleSend}
              onSendFile={handleSendFile}
              onTyping={handleTyping}
              placeholder={`Message ${selected.name.length > 16 ? selected.name.split(/[\s\u00A0]+/)[0] : selected.name}`}
              replyTo={replyTarget}
              onCancelReply={() => setReplyTargetId(null)}
              focusSignal={selected.id}
            />
          </>
        ) : (
          <ChatEmptyState />
        )}
      </section>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onSubmit={handleNewChat} />
      <ForwardDialog
        open={forwardOpen}
        onOpenChange={(v) => { setForwardOpen(v); if (!v) setForwardEventId(null); }}
        rooms={rooms}
        onForward={({ roomId }) => void doForward(roomId)}
      />
      <SettingsDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      {selected && (
        <RoomDetailsDrawer
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          roomId={selected.id}
          encrypted={selected.encrypted}
          name={selected.name}
          avatar={selected.avatar ?? null}
          bridge={selected.bridge ?? null}
          kind={selected.kind}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}
