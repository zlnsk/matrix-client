"use client";

import type { BubbleProps } from "@/components/timeline/Bubble";
import type { Reaction } from "@/components/reactions/ReactionRow";
import type { RoomItem } from "@/components/rooms/RoomListItem";
import { sanitize } from "@/lib/markdown/render";

export type AnyEventLike = AnyEvent;

type AnyEvent = {
  getId(): string | undefined;
  getType(): string;
  getSender(): string | null | undefined;
  getTs(): number;
  getContent<T = Record<string, unknown>>(): T;
  isRedacted?: () => boolean;
  isDecryptionFailure?: () => boolean;
  getOriginalContent?: () => Record<string, unknown>;
  event: { content?: Record<string, unknown>; redacts?: string; unsigned?: Record<string, unknown> };
  getStatus?: () => string | null;
};

type AnyRoom = {
  roomId: string;
  name: string;
  getCanonicalAlias?: () => string | null;
  getJoinedMemberCount?: () => number;
  getInvitedAndJoinedMemberCount?: () => number;
  getLastActiveTimestamp?: () => number;
  getUnreadNotificationCount?: (kind: "total" | "highlight") => number;
  getLiveTimeline(): { getEvents(): AnyEvent[] };
  getAvatarUrl?: (baseUrl: string, w: number, h: number, resize: string) => string | null;
  currentState?: { getStateEvents: (type: string, key?: string) => AnyEvent[] | AnyEvent | null };
  getMyMembership?: () => string;
  isSpaceRoom?: () => boolean;
  getDMInviter?: () => string | null;
  getMember?: (userId: string) => { rawDisplayName?: string; name?: string; userId?: string; getMxcAvatarUrl?: () => string | null } | null;
  tags?: Record<string, unknown>;
  getMembers?: () => Array<{ userId: string }>;
  hasUserReadEvent?: (userId: string, eventId: string) => boolean;
  getJoinedMembers?: () => Array<{ userId: string }>;
};

type AnyClient = {
  getUserId(): string | null;
  getRoom(roomId: string): AnyRoom | null;
  getRooms(): AnyRoom[];
  getHomeserverUrl?: () => string;
  baseUrl?: string;
  mxcUrlToHttp?: (
    mxc: string | null | undefined,
    w?: number,
    h?: number,
    method?: string,
    allowDirect?: boolean,
    allowRedirect?: boolean
  ) => string | null;
};

function classifyRoom(client: AnyClient, room: AnyRoom): "dm" | "group" | "public" {
  // Public if a join_rule of "public" is set on the room.
  const jr = room.currentState?.getStateEvents("m.room.join_rules", "");
  const jrOne = Array.isArray(jr) ? jr[0] : jr;
  const joinRule = jrOne?.getContent<{ join_rule?: string }>()?.join_rule;
  if (joinRule === "public") return "public";

  // DM detection: m.direct on account data, or 2-member encrypted room.
  const me = client.getUserId();
  const cr = client as unknown as { getAccountData?: (t: string) => AnyEvent | null };
  const direct = cr.getAccountData?.("m.direct");
  if (direct) {
    const c = direct.getContent<Record<string, string[]>>();
    for (const [, ids] of Object.entries(c)) {
      if (Array.isArray(ids) && ids.includes(room.roomId)) return "dm";
    }
  }
  if (room.getDMInviter?.()) return "dm";
  const total = room.getInvitedAndJoinedMemberCount?.() ?? room.getJoinedMemberCount?.() ?? 0;
  if (total === 2 && me) return "dm";
  return "group";
}

function detectBridge(room: AnyRoom): "signal" | "whatsapp" | null {
  const members = room.getMembers?.() ?? [];
  for (const m of members) {
    if (/^@signal(_|bot)/.test(m.userId)) return "signal";
    if (/^@whatsapp(_|bot)/.test(m.userId)) return "whatsapp";
  }
  return null;
}

const BRIDGE_USER_RE = /^@(signal(bot|_)|whatsapp(bot|_))/;
const BRIDGE_FAIL_PREFIX_RE = /^\*\* (Unable to decrypt|Your message was not bridged)/;

export function isBridgeFailNotice(e: AnyEvent): boolean {
  const sender = e.getSender() ?? "";
  if (!BRIDGE_USER_RE.test(sender)) return false;
  if (e.getType() !== "m.room.message") return false;
  const body = e.getContent<{ body?: string }>().body ?? "";
  return BRIDGE_FAIL_PREFIX_RE.test(body);
}

function isEncrypted(room: AnyRoom): boolean {
  const ev = room.currentState?.getStateEvents("m.room.encryption", "");
  if (!ev) return false;
  if (Array.isArray(ev)) return ev.length > 0;
  return true;
}

function getRoomAvatarMxc(room: AnyRoom): string | null {
  // Explicit m.room.avatar state event wins.
  const ev = room.currentState?.getStateEvents("m.room.avatar", "");
  const one = Array.isArray(ev) ? ev[0] : ev;
  const explicit = one?.getContent<{ url?: string }>()?.url ?? null;
  if (explicit) return explicit;

  // For DMs and small rooms, fall back to the "other" member's avatar.
  const r = room as unknown as {
    getMxcAvatarUrl?: () => string | null;
    getAvatarFallbackMember?: () => { getMxcAvatarUrl?: () => string | null } | null;
  };
  const own = r.getMxcAvatarUrl?.();
  if (own) return own;
  const fb = r.getAvatarFallbackMember?.();
  return fb?.getMxcAvatarUrl?.() ?? null;
}

export function toRoomItem(client: AnyClient, room: AnyRoom): RoomItem {
  const events = room.getLiveTimeline().getEvents();
  const last = [...events]
    .reverse()
    .find(
      (e) =>
        ["m.room.message", "m.room.encrypted"].includes(e.getType()) &&
        !isBridgeFailNotice(e),
    );
  const ts = room.getLastActiveTimestamp?.() ?? last?.getTs() ?? 0;
  const unread = Math.max(0, room.getUnreadNotificationCount?.("total") ?? 0);

  let preview = "";
  let previewSelf = false;
  let sendState: "sending" | "sent" | "read" | "failed" | undefined;
  const myUserId = client.getUserId();
  if (last) {
    const content = last.getContent<{ body?: string; msgtype?: string }>();
    preview = previewFromEvent(last, content);
    previewSelf = last.getSender() === myUserId;
    if (previewSelf) {
      const status = last.getStatus?.() ?? null;
      if (status === "sending" || status === "encrypting" || status === "queued")
        sendState = "sending";
      else if (status === "not_sent" || status === "cancelled")
        sendState = "failed";
      else {
        const joined = room.getJoinedMembers?.() ?? [];
        const lastId = last.getId();
        const readByOther = lastId ? joined.some(
          (m) => m.userId !== myUserId && room.hasUserReadEvent?.(m.userId, lastId),
        ) : false;
        sendState = readByOther ? "read" : "sent";
      }
    }
  }

  const isDm = classifyRoom(client, room) === "dm";
  const members = room.getMembers?.() ?? [];
  const noteToSelf = isDm && members.filter((m) => m.userId !== myUserId).length === 0;

  return {
    id: room.roomId,
    name: room.name || room.roomId,
    preview: preview || "",
    previewSelf: previewSelf && !noteToSelf,
    timestamp: ts,
    unread,
    encrypted: isEncrypted(room),
    avatar: getRoomAvatarMxc(room) ?? undefined,
    kind: classifyRoom(client, room),
    archived: !!(room as { tags?: Record<string, unknown> }).tags?.["m.lowpriority"],
    bridge: detectBridge(room),
    sendState,
  };
}

function previewFromEvent(e: AnyEvent, content: { body?: string; msgtype?: string }): string {
  if (e.isRedacted?.()) return "message deleted";
  if (e.getType() === "m.room.encrypted") {
    if (e.isDecryptionFailure?.()) return "Unable to decrypt";
    return content.body ?? "Encrypted message";
  }
  if (content.msgtype === "m.image") return "📷 Image";
  if (content.msgtype === "m.file") return "📎 File";
  if (content.msgtype === "m.video") return "🎬 Video";
  if (content.msgtype === "m.audio") return "🎙️ Audio";
  return (content.body ?? "").slice(0, 140);
}

export type TimelineItem = BubbleProps & { isGroupStart: boolean; isGroupEnd: boolean };

export function buildTimeline(
  client: AnyClient,
  room: AnyRoom,
  ownDisplayNames: Map<string, string> = new Map()
): TimelineItem[] {
  const events = room
    .getLiveTimeline()
    .getEvents()
    .filter((e) => {
      const t = e.getType();
      if (t !== "m.room.message" && t !== "m.room.encrypted") return false;
      if (isBridgeFailNotice(e)) return false;
      return true;
    });

  const myUserId = client.getUserId();

  // Index relations for reactions and edits.
  type RAgg = {
    count: number;
    mine: boolean;
    myEventId?: string;
    senders: { userId: string; displayName: string }[];
    seenUsers: Set<string>;
  };
  const reactionsByTarget = new Map<string, Map<string, RAgg>>();
  const editsByTarget = new Map<string, { body: string; html?: string | null; ts: number }>();
  for (const e of room.getLiveTimeline().getEvents()) {
    const type = e.getType();
    const content = e.getContent<{
      "m.relates_to"?: { rel_type?: string; event_id?: string; key?: string };
      "m.new_content"?: { body?: string; formatted_body?: string; format?: string };
    }>();
    const rel = content["m.relates_to"];
    const isReaction =
      type === "m.reaction" ||
      (rel?.rel_type === "m.annotation" && !!rel.event_id && !!rel.key);
    if (isReaction && rel?.rel_type === "m.annotation" && rel.event_id && rel.key) {
      const target = reactionsByTarget.get(rel.event_id) ?? new Map<string, RAgg>();
      const entry: RAgg = target.get(rel.key) ?? { count: 0, mine: false, senders: [], seenUsers: new Set() };
      if (!e.isRedacted?.()) {
        const sender = e.getSender() ?? "";
        // Dedup: one user can only contribute one reaction per emoji (Matrix spec).
        if (!entry.seenUsers.has(sender)) {
          entry.seenUsers.add(sender);
          entry.count++;
          if (sender === myUserId) {
            entry.mine = true;
            entry.myEventId = e.getId() ?? undefined;
          }
          const mem = room.getMember?.(sender);
          const displayName =
            ownDisplayNames.get(sender) ||
            mem?.rawDisplayName ||
            mem?.name ||
            sender.replace(/^@/, "").replace(/:.*$/, "");
          entry.senders.push({ userId: sender, displayName });
          target.set(rel.key, entry);
          reactionsByTarget.set(rel.event_id, target);
        }
      }
    }
    if (type === "m.room.message" || type === "m.room.encrypted") {
      const content = e.getContent<{
        "m.new_content"?: { body?: string; formatted_body?: string; format?: string };
        "m.relates_to"?: { rel_type?: string; event_id?: string };
      }>();
      const rel = content["m.relates_to"];
      if (rel?.rel_type === "m.replace" && rel.event_id && content["m.new_content"]) {
        const prev = editsByTarget.get(rel.event_id);
        if (!prev || prev.ts < e.getTs()) {
          editsByTarget.set(rel.event_id, {
            body: content["m.new_content"].body ?? "",
            html:
              content["m.new_content"].format === "org.matrix.custom.html"
                ? sanitize(content["m.new_content"].formatted_body ?? "")
                : null,
            ts: e.getTs(),
          });
        }
      }
    }
  }

  const result: TimelineItem[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const id = e.getId();
    if (!id) continue;

    // skip edits / redaction placeholders — they're applied onto the original
    const content = e.getContent<{
      body?: string;
      msgtype?: string;
      formatted_body?: string;
      format?: string;
      "m.relates_to"?: { rel_type?: string; event_id?: string; "m.in_reply_to"?: { event_id?: string } };
    }>();
    if (content["m.relates_to"]?.rel_type === "m.replace") continue;

    const isEncryptedType = e.getType() === "m.room.encrypted";
    const decryptFailed = isEncryptedType && e.isDecryptionFailure?.();
    const edited = editsByTarget.has(id);
    const finalBody = edited ? editsByTarget.get(id)!.body : content.body ?? "";
    const finalHtml =
      edited && editsByTarget.get(id)!.html
        ? editsByTarget.get(id)!.html
        : content.format === "org.matrix.custom.html"
        ? sanitize(content.formatted_body ?? "")
        : null;

    const sender = e.getSender() ?? "@unknown";
    const own = sender === myUserId;
    const member = room.getMember?.(sender);
    const memberName = member?.rawDisplayName || member?.name;
    const senderName =
      ownDisplayNames.get(sender) ??
      memberName ??
      sender.replace(/^@/, "").replace(/:.*$/, "");
    const senderAvatar = member?.getMxcAvatarUrl?.() ?? null;

    const reactions: Reaction[] = [];
    const rmap = reactionsByTarget.get(id);
    if (rmap) {
      for (const [key, v] of rmap) {
        reactions.push({
          key,
          emoji: key,
          count: v.count,
          mine: v.mine,
          myEventId: v.myEventId,
          senders: v.senders,
        });
      }
    }

    const inReplyToId = content["m.relates_to"]?.["m.in_reply_to"]?.event_id;
    let replyTo: BubbleProps["replyTo"] = null;
    if (inReplyToId) {
      const target = room.getLiveTimeline().getEvents().find((x) => x.getId() === inReplyToId);
      if (target) {
        const c = target.getContent<{ body?: string }>();
        const tSender = target.getSender() ?? "";
        const tMemberName = room.getMember?.(tSender)?.rawDisplayName || room.getMember?.(tSender)?.name;
        replyTo = {
          senderName:
            ownDisplayNames.get(tSender) ??
            tMemberName ??
            tSender.replace(/^@/, "").replace(/:.*$/, ""),
          body: (c.body ?? "").replace(/^> .*\n\n?/gm, "").slice(0, 220),
        };
      }
    }

    const isRedacted = Boolean(e.isRedacted?.());
    const body = decryptFailed
      ? "🔒 Unable to decrypt — verify this device to see this message."
      : isRedacted
      ? "message deleted"
      : stripReplyFallback(finalBody);

    const attachment = isRedacted ? null : extractAttachment(content);

    const prev = result[result.length - 1];
    const grouped =
      prev &&
      prev.senderName === senderName &&
      prev.own === own &&
      e.getTs() - prev.timestamp < 5 * 60_000;
    if (grouped && prev) {
      prev.isGroupEnd = false;
      prev.showTail = false;
    }

    result.push({
      id,
      body,
      html: isRedacted ? null : finalHtml,
      timestamp: e.getTs(),
      own,
      senderName,
      senderAvatar,
      sendState: own
        ? ((): "sending" | "sent" | "read" | "failed" => {
            const status = e.getStatus?.() ?? null;
            if (status === "sending" || status === "encrypting" || status === "queued")
              return "sending";
            if (status === "not_sent" || status === "cancelled") return "failed";
            const myId = myUserId ?? "";
            const joined = room.getJoinedMembers?.() ?? [];
            const readByOther = joined.some(
              (m) => m.userId !== myId && room.hasUserReadEvent?.(m.userId, id),
            );
            return readByOther ? "read" : "sent";
          })()
        : "sent",
      isGroupStart: !grouped,
      isGroupEnd: true,
      showTail: true,
      showHeader: !grouped,
      encrypted: isEncryptedType,
      edited: edited && !isRedacted,
      redacted: isRedacted,
      attachment,
      reactions: reactions.length ? reactions : undefined,
      replyTo,
    });
  }
  return result;
}

function extractAttachment(content: {
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
  info?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
    thumbnail_url?: string;
    thumbnail_file?: {
      url?: string;
      key?: JsonWebKey;
      iv?: string;
      hashes?: { sha256?: string };
      v?: string;
    };
  };
}): import("@/components/timeline/Bubble").BubbleAttachment | null {
  const plainMxc = content.url;
  const encFile = content.file;
  const mxc = plainMxc ?? encFile?.url ?? null;
  if (!mxc || typeof mxc !== "string" || !mxc.startsWith("mxc://")) return null;
  const info = content.info ?? {};
  const encrypted =
    !plainMxc && encFile?.url && encFile.key && encFile.iv && encFile.hashes?.sha256
      ? {
          url: encFile.url,
          key: encFile.key as JsonWebKey,
          iv: encFile.iv,
          hashes: { sha256: encFile.hashes.sha256 },
          v: encFile.v,
        }
      : undefined;

  // Bridges sometimes omit msgtype on encrypted media — fall back to mimetype.
  const mt =
    content.msgtype ??
    (info.mimetype?.startsWith("image/")
      ? "m.image"
      : info.mimetype?.startsWith("video/")
      ? "m.video"
      : "m.file");

  switch (mt) {
    case "m.image":
      return {
        kind: "image",
        url: mxc,
        alt: content.body,
        width: info.w,
        height: info.h,
        encryptedFile: encrypted,
        mimeType: info.mimetype,
      };
    case "m.video":
      return {
        kind: "video",
        url: mxc,
        mime: info.mimetype,
        thumbnail: info.thumbnail_url ?? info.thumbnail_file?.url ?? null,
        encryptedFile: encrypted,
        mimeType: info.mimetype,
      };
    case "m.file":
    case "m.audio":
      return {
        kind: "file",
        url: mxc,
        name: content.body ?? "file",
        size: info.size,
        mime: info.mimetype,
        encryptedFile: encrypted,
        mimeType: info.mimetype,
      };
    default:
      return null;
  }
}

function stripReplyFallback(body: string): string {
  // Matrix reply fallback prepends "> <sender> text\n\nreply" — drop it.
  return body.replace(/^> <[^>]+>[^\n]*\n(>[^\n]*\n)*\n?/, "");
}
