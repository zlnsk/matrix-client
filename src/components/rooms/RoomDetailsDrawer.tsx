"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Image as ImageIcon, Loader2, ShieldCheck, UserPlus, Users, X, LogOut } from "lucide-react";
import { BridgeIcon } from "@/components/common/BridgeIcon";
import { Avatar } from "@/components/common/Avatar";
import { getClient } from "@/lib/matrix/client";
import { useMedia } from "@/hooks/useMedia";
import { resolveMediaUrl, type EncryptedFileInfo } from "@/lib/matrix/media";
import { ImageViewer } from "@/components/timeline/ImageViewer";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roomId: string | null;
  name: string;
  avatar?: string | null;
  encrypted?: boolean;
  bridge?: "signal" | "whatsapp" | null;
  kind?: "dm" | "group" | "public";
  onLeave?: (roomId: string) => void;
};

type MemberRow = { userId: string; name: string; avatar?: string | null };

type MediaItem = {
  eventId: string;
  mxc: string;
  alt: string;
  width?: number;
  height?: number;
  encryptedFile?: EncryptedFileInfo;
  mimeType?: string;
  ts: number;
};

type TimelineEventLike = {
  getId: () => string | undefined;
  getType: () => string;
  getTs: () => number;
  getContent: <T = Record<string, unknown>>() => T;
  isRedacted?: () => boolean;
};

type MediaContent = {
  msgtype?: string;
  body?: string;
  url?: string;
  file?: {
    url?: string;
    key?: JsonWebKey;
    iv?: string;
    hashes?: { sha256?: string };
    v?: string;
  };
  info?: { mimetype?: string; w?: number; h?: number };
  "m.relates_to"?: { rel_type?: string };
};

type AnyRoom = {
  name: string;
  roomId: string;
  currentState?: {
    getStateEvents: (
      type: string,
      key?: string,
    ) => { getContent: <T>() => T }[] | { getContent: <T>() => T } | null;
  };
  getJoinedMembers?: () => Array<{
    userId: string;
    rawDisplayName?: string;
    name?: string;
    getMxcAvatarUrl?: () => string | null;
  }>;
  getMembers?: () => Array<{ userId: string; membership?: string }>;
  getLiveTimeline?: () => { getEvents: () => TimelineEventLike[] };
};

type AnyClient = {
  getRoom: (roomId: string) => AnyRoom | null;
  invite: (roomId: string, userId: string) => Promise<unknown>;
  getUserId: () => string | null;
};

export function RoomDetailsDrawer({
  open,
  onOpenChange,
  roomId,
  name,
  avatar,
  encrypted,
  bridge,
  kind,
  onLeave,
}: Props) {
  const [topic, setTopic] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [viewer, setViewer] = useState<{ src: string; alt?: string } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<
    | { kind: "ok"; message: string }
    | { kind: "err"; message: string }
    | null
  >(null);

  useEffect(() => {
    if (!open || !roomId) return;
    const c = getClient() as unknown as AnyClient | null;
    const room = c?.getRoom(roomId) ?? null;
    if (!room) {
      setTopic(null);
      setMembers([]);
      setMemberCount(0);
      setMedia([]);
      return;
    }

    const topicEv = room.currentState?.getStateEvents("m.room.topic", "");
    const topicOne = Array.isArray(topicEv) ? topicEv[0] : topicEv;
    const topicStr = topicOne?.getContent<{ topic?: string }>()?.topic ?? null;
    setTopic(topicStr && topicStr.trim() ? topicStr : null);

    const joined = room.getJoinedMembers?.() ?? [];
    setMemberCount(joined.length);
    const rows: MemberRow[] = joined
      .map((m) => ({
        userId: m.userId,
        name: m.rawDisplayName || m.name || m.userId.replace(/^@/, "").replace(/:.*$/, ""),
        avatar: m.getMxcAvatarUrl?.() ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setMembers(rows);

    const events = room.getLiveTimeline?.().getEvents() ?? [];
    const items: MediaItem[] = [];
    for (const e of events) {
      if (e.isRedacted?.()) continue;
      const t = e.getType();
      if (t !== "m.room.message" && t !== "m.room.encrypted") continue;
      const content = e.getContent<MediaContent>();
      if (content?.["m.relates_to"]?.rel_type === "m.replace") continue;
      const plainMxc = content.url;
      const encFile = content.file;
      const mxc = plainMxc ?? encFile?.url;
      if (!mxc || !mxc.startsWith("mxc://")) continue;
      const info = content.info ?? {};
      const mt =
        content.msgtype ??
        (info.mimetype?.startsWith("image/") ? "m.image" : undefined);
      if (mt !== "m.image") continue;
      const encryptedFile: EncryptedFileInfo | undefined =
        !plainMxc && encFile?.url && encFile.key && encFile.iv && encFile.hashes?.sha256
          ? {
              url: encFile.url,
              key: encFile.key,
              iv: encFile.iv,
              hashes: { sha256: encFile.hashes.sha256 },
              v: encFile.v,
            }
          : undefined;
      items.push({
        eventId: e.getId() ?? String(e.getTs()),
        mxc,
        alt: content.body ?? "",
        width: info.w,
        height: info.h,
        encryptedFile,
        mimeType: info.mimetype,
        ts: e.getTs(),
      });
    }
    items.sort((a, b) => b.ts - a.ts);
    setMedia(items);
  }, [open, roomId]);

  useEffect(() => {
    if (!open) {
      setInviteInput("");
      setInviteStatus(null);
    }
  }, [open]);

  const inviteTarget = useMemo(() => {
    const v = inviteInput.trim();
    if (!v) return null;
    if (v.startsWith("@") && v.includes(":")) return v;
    if (/^[^:@\s]+:[^:@\s]+$/.test(v)) return "@" + v;
    return null;
  }, [inviteInput]);

  async function openMedia(item: MediaItem) {
    const p = resolveMediaUrl(
      item.mxc,
      1600,
      1600,
      "scale",
      item.encryptedFile
        ? { encryptedFile: item.encryptedFile, mimeType: item.mimeType }
        : undefined,
    );
    if (!p) return;
    setViewerLoading(true);
    try {
      const src = await p;
      setViewer({ src, alt: item.alt });
    } catch {
      /* swallow */
    } finally {
      setViewerLoading(false);
    }
  }

  async function submitInvite() {
    if (!roomId || !inviteTarget) return;
    setInviting(true);
    setInviteStatus(null);
    try {
      const c = getClient() as unknown as AnyClient | null;
      if (!c) throw new Error("Not connected");
      await c.invite(roomId, inviteTarget);
      setInviteStatus({ kind: "ok", message: `Invited ${inviteTarget}` });
      setInviteInput("");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Invite failed";
      setInviteStatus({ kind: "err", message: msg });
    } finally {
      setInviting(false);
    }
  }

  function handleLeave() {
    if (!roomId || !onLeave) return;
    if (!confirm(`Leave ${name}? You won't receive messages until you rejoin.`)) return;
    onLeave(roomId);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[90]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                style={{
                  background: "rgba(0,0,0,0.25)",
                }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-y-0 right-0 z-[91] flex w-full max-w-[400px] flex-col"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 360, damping: 36 }}
                style={{
                  background: "var(--surface)",
                  borderLeft: "1px solid var(--hairline)",
                }}
              >
                <header
                  className="flex items-center gap-3 px-4"
                  style={{ height: 56 }}
                >
                  <Dialog.Title asChild>
                    <h2 className="flex-1 truncate text-lg font-medium">
                      {name}
                    </h2>
                  </Dialog.Title>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => onOpenChange(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X size={18} strokeWidth={1.9} />
                  </button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-6">
                  {/* Identity */}
                  <div className="flex flex-col items-center text-center">
                    <Avatar name={name} src={avatar ?? undefined} size={88} />
                    <div className="mt-3 flex items-center justify-center gap-1.5">
                      <span className="text-lg font-medium">
                        {name}
                      </span>
                    </div>
                    <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                      {kind === "public" ? "Public room" : kind === "dm" ? "Direct message" : "Group chat"}
                      {memberCount ? ` · ${memberCount} member${memberCount === 1 ? "" : "s"}` : ""}
                    </div>
                    {encrypted && (
                      <div
                        className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
                        style={{
                          background: "color-mix(in oklch, var(--accent-success) 10%, transparent)",
                          color: "var(--accent-success)",
                        }}
                      >
                        <ShieldCheck size={11} strokeWidth={2} />
                        <span>End-to-end encrypted</span>
                      </div>
                    )}
                    {bridge && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        <BridgeIcon type={bridge} size={12} />
                        <span>Bridged from {bridge}</span>
                      </div>
                    )}
                    {topic && (
                      <p
                        className="mt-3 text-sm leading-snug"
                        style={{ color: "var(--text-muted)", whiteSpace: "pre-wrap" }}
                      >
                        {topic}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {onLeave && (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={handleLeave}
                        className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-[var(--surface-sunken)]"
                        style={{ color: "var(--accent-danger)", border: "1px solid color-mix(in oklch, var(--accent-danger) 25%, transparent)" }}
                      >
                        <LogOut size={14} strokeWidth={1.8} />
                        Leave room
                      </button>
                    </div>
                  )}

                  {/* Invite */}
                  <section className="mt-8">
                    <div
                      className="mb-2 text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      Invite
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        spellCheck={false}
                        value={inviteInput}
                        onChange={(e) => setInviteInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && inviteTarget) {
                            e.preventDefault();
                            void submitInvite();
                          }
                        }}
                        placeholder="@user:server"
                        className="flex-1 rounded-xl px-3.5 outline-none"
                        style={{
                          height: 36,
                          fontSize: 14,
                          color: "var(--text)",
                          background: "var(--surface-sunken)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void submitInvite()}
                        disabled={!inviteTarget || inviting}
                        className="inline-flex items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white disabled:opacity-50"
                        style={{
                          height: 36,
                          background: "var(--accent-unread)",
                        }}
                      >
                        {inviting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserPlus size={14} strokeWidth={2} />
                        )}
                        <span>Invite</span>
                      </button>
                    </div>
                    {inviteStatus && (
                      <div
                        className="mt-2 rounded-lg px-3 py-2 text-xs"
                        style={{
                          background:
                            inviteStatus.kind === "ok"
                              ? "color-mix(in oklch, var(--accent-success) 10%, transparent)"
                              : "color-mix(in oklch, var(--accent-danger) 10%, transparent)",
                          color:
                            inviteStatus.kind === "ok"
                              ? "var(--accent-success)"
                              : "var(--accent-danger)",
                        }}
                      >
                        {inviteStatus.message}
                      </div>
                    )}
                  </section>

                  {/* Members */}
                  <section className="mt-8">
                    <div
                      className="mb-3 flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      <Users size={14} strokeWidth={2} />
                      <span>Members ({members.length})</span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {members.map((m) => (
                        <li
                          key={m.userId}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--surface-sunken)]"
                        >
                          <Avatar name={m.name} src={m.avatar ?? undefined} size={36} />
                          <div className="min-w-0 flex-1">
                            <div
                              className="truncate text-sm font-medium"
                              style={{ color: "var(--text)" }}
                            >
                              {m.name}
                            </div>
                            <div
                              className="truncate text-xs"
                              style={{ color: "var(--text-faint)" }}
                            >
                              {m.userId}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>

                  {/* Media */}
                  {media.length > 0 && (
                    <section className="mt-8">
                      <div
                        className="mb-3 flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        <ImageIcon size={14} strokeWidth={2} />
                        <span>Media ({media.length})</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {media.map((m) => (
                          <MediaThumb
                            key={m.eventId}
                            item={m}
                            onOpen={() => void openMedia(m)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Room ID */}
                  <section className="mt-8">
                    <div
                      className="mb-2 text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      Room ID
                    </div>
                    <div
                      className="select-all rounded-xl px-3 py-2 text-xs"
                      style={{
                        background: "var(--surface-sunken)",
                        color: "var(--text-muted)",
                        wordBreak: "break-all",
                      }}
                    >
                      {roomId ?? ""}
                    </div>
                  </section>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
      <ImageViewer
        src={viewer?.src ?? null}
        alt={viewer?.alt}
        onClose={() => {
          if (viewer?.src.startsWith("blob:")) URL.revokeObjectURL(viewer.src);
          setViewer(null);
        }}
      />
      {viewerLoading && !viewer && (
        <div
          className="fixed inset-0 z-[99] grid place-items-center"
          style={{ background: "rgba(0,0,0,0.25)", pointerEvents: "none" }}
        >
          <Loader2 size={24} className="animate-spin" color="#fff" />
        </div>
      )}
    </Dialog.Root>
  );
}

function MediaThumb({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  const src = useMedia(
    item.mxc,
    160,
    160,
    item.encryptedFile
      ? { encryptedFile: item.encryptedFile, mimeType: item.mimeType }
      : undefined,
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open image"
      className="relative block aspect-square overflow-hidden rounded-lg"
      style={{
        padding: 0,
        border: 0,
        background: "var(--surface-sunken)",
        cursor: src ? "zoom-in" : "default",
      }}
    >
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={item.alt}
          loading="lazy"
          decoding="async"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            color: "var(--text-faint)",
          }}
        >
          <Loader2 size={14} className="animate-spin" />
        </div>
      )}
    </button>
  );
}
