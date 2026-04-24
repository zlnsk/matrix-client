"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import type { BubbleProps } from "./Bubble";
import { Bubble } from "./Bubble";
import { DaySeparator } from "./DaySeparator";
import { UnreadMarker } from "./UnreadMarker";
import { TypingIndicator } from "./TypingIndicator";
import { formatTime } from "@/lib/utils/time";

type Message = BubbleProps;

type Props = {
  messages: Message[];
  unreadAfter?: number | null;
  typingNames?: string[];
  roomId?: string | null;
  encrypted?: boolean;
  roomName?: string;
  onReact?: (id: string, emoji: string) => void;
  onReply?: (id: string) => void;
  onCopy?: (id: string) => void;
  onForward?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newBody: string) => void;
  onPaginate?: () => Promise<boolean> | boolean | void;
};

function sameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

const PIN_THRESHOLD_PX = 80;
const PAGINATE_THRESHOLD_PX = 120;

function deliveryLabel(state?: string): string {
  switch (state) {
    case "read":
      return "Read";
    case "sent":
    case "sending":
      return "Sent";
    default:
      return "";
  }
}

export function MessageList({
  messages,
  unreadAfter,
  typingNames = [],
  roomId,
  encrypted,
  roomName,
  onReact,
  onReply,
  onCopy,
  onForward,
  onDelete,
  onEdit,
  onPaginate,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const unreadAnchorRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(() => messages, [messages]);
  const lastId = items[items.length - 1]?.id;

  const [pinnedToBottom, setPinnedToBottom] = useState(true);
  const [paginating, setPaginating] = useState(false);
  const exhaustedRef = useRef(false);
  const prevHeightRef = useRef<number>(0);
  const prevScrollTopRef = useRef<number>(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    exhaustedRef.current = false;
    setPinnedToBottom(true);
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [roomId]);

  useEffect(() => {
    const inner = ref.current?.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const ro = new ResizeObserver(() => {
      if (pinnedToBottom && ref.current) {
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [pinnedToBottom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (!pinnedToBottom) return;
      const snap = () => {
        bottomRef.current?.scrollIntoView({ block: "end" });
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
      };
      snap();
      requestAnimationFrame(snap);
      window.setTimeout(snap, 220);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, [pinnedToBottom]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prevHeight = prevHeightRef.current;
    const prevScrollTop = prevScrollTopRef.current;
    const latest = items[items.length - 1];
    const latestIsOwn = latest?.own === true;
    if (paginating && prevHeight > 0 && el.scrollHeight !== prevHeight) {
      el.scrollTop = prevScrollTop + (el.scrollHeight - prevHeight);
    } else if (pinnedToBottom || latestIsOwn) {
      const snap = () => {
        bottomRef.current?.scrollIntoView({ block: "end" });
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
      };
      snap();
      requestAnimationFrame(snap);
      const t1 = window.setTimeout(snap, 120);
      const t2 = window.setTimeout(snap, 360);
      if (latestIsOwn && !pinnedToBottom) setPinnedToBottom(true);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    prevHeightRef.current = el.scrollHeight;
    prevScrollTopRef.current = el.scrollTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, items.length, typingNames.length]);

  const tryPaginate = useCallback(async () => {
    if (!onPaginate || paginating || exhaustedRef.current) return;
    const el = ref.current;
    if (!el) return;
    setPaginating(true);
    prevHeightRef.current = el.scrollHeight;
    prevScrollTopRef.current = el.scrollTop;
    try {
      const more = await onPaginate();
      if (more === false) exhaustedRef.current = true;
    } catch {
      /* failed pagination */
    } finally {
      setPaginating(false);
    }
  }, [onPaginate, paginating]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    setPinnedToBottom(distFromBottom < PIN_THRESHOLD_PX);
    if (el.scrollTop < PAGINATE_THRESHOLD_PX) void tryPaginate();
  }, [tryPaginate]);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  const scrollToUnread = useCallback(() => {
    const node = unreadAnchorRef.current;
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const unreadCount = useMemo(() => {
    if (unreadAfter == null) return 0;
    let n = 0;
    for (const m of items) if (m.timestamp > unreadAfter) n++;
    return n;
  }, [items, unreadAfter]);

  const showUnreadJump = unreadCount > 0 && !pinnedToBottom;

  let renderedUnread = false;
  let renderedTrustBanner = false;

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      style={{ background: "var(--bg)" }}
    >
      {paginating && (
        <div
          className="sticky top-0 z-10 flex items-center justify-center py-2 text-[13px]"
          style={{ color: "var(--text-faint)" }}
        >
          <Loader2 size={14} className="mr-1.5 animate-spin" /> loading earlier messages…
        </div>
      )}
      <div
        className="flex flex-col pb-8 pt-2"
        style={{ paddingLeft: 32, paddingRight: 32 }}
      >
        {items.map((m, i) => {
          const prev = items[i - 1];
          const next = items[i + 1];
          const showDay = !prev || !sameDay(prev.timestamp, m.timestamp);
          const unread = !renderedUnread && unreadAfter != null && m.timestamp > unreadAfter;
          if (unread) renderedUnread = true;
          const visibleUnreadCount = unread
            ? items.slice(i).filter((x) => x.timestamp > (unreadAfter ?? 0)).length
            : 0;

          // Show trust banner after the first message from the other person
          const showTrust =
            encrypted &&
            !renderedTrustBanner &&
            !m.own &&
            roomName &&
            m.body &&
            m.body.trim().length > 0;
          if (showTrust) renderedTrustBanner = true;

          // Determine if this is the last message in a group from the same sender
          const isLastInGroup = !next || next.own !== m.own || !sameDay(m.timestamp, next.timestamp);

          return (
            <div key={m.id} ref={unread ? unreadAnchorRef : null}>
              {showDay && <DaySeparator timestamp={m.timestamp} />}
              {unread && <UnreadMarker count={visibleUnreadCount} />}
              {showTrust && <TrustBanner name={roomName} />}
              <Bubble
                {...m}
                onReact={(emoji) => onReact?.(m.id, emoji)}
                onReply={() => onReply?.(m.id)}
                onCopy={() => onCopy?.(m.id)}
                onForward={() => onForward?.(m.id)}
                onDelete={() => onDelete?.(m.id)}
                onEdit={onEdit}
              />
              {isLastInGroup && (
                <div
                  className="flex items-center gap-1.5"
                  style={{
                    justifyContent: m.own ? "flex-end" : "flex-start",
                    marginTop: 2,
                    marginBottom: m.own ? 8 : 4,
                    paddingLeft: m.own ? 0 : 48,
                    paddingRight: m.own ? 4 : 0,
                  }}
                >
                  <span
                    className="font-tnum"
                    style={{
                      fontSize: 11,
                      color: "var(--text-faint)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {formatTime(m.timestamp)}
                  </span>
                  {m.own && m.sendState && (
                    <>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>·</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: m.sendState === "read" ? "var(--accent-success)" : "var(--text-faint)",
                        }}
                      >
                        {deliveryLabel(m.sendState)}
                      </span>
                    </>
                  )}
                  {/* encryption implied */}
                </div>
              )}
            </div>
          );
        })}
        {typingNames.length > 0 && <TypingIndicator names={typingNames} />}
        <div ref={bottomRef} aria-hidden style={{ height: 1 }} />
      </div>

      {(!pinnedToBottom || showUnreadJump) && (
        <div className="pointer-events-none sticky bottom-4 z-20 flex w-full items-center justify-end gap-2 px-4">
          {showUnreadJump && (
            <button
              type="button"
              onClick={scrollToUnread}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3.5 text-white text-[13px] font-semibold shadow-md"
              style={{
                background: "var(--accent-unread)",
                boxShadow: "var(--shadow-md)",
                height: 32,
              }}
            >
              <ChevronDown size={14} strokeWidth={2.2} />
              {unreadCount > 99 ? "99+" : unreadCount} new
            </button>
          )}
          {!pinnedToBottom && (
            <button
              type="button"
              aria-label="Scroll to latest"
              onClick={scrollToBottom}
              className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text)",
                boxShadow: "var(--shadow-md)",
                border: "1px solid var(--border)",
              }}
            >
              <ChevronDown size={18} strokeWidth={1.9} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TrustBanner({ name }: { name: string }) {
  return (
    <div className="my-3 flex w-full items-center justify-center">
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1"
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          background: "var(--surface-sunken)",
          letterSpacing: "0.01em",
        }}
      >
        <ShieldCheck size={12} strokeWidth={2} style={{ color: "var(--accent-success)" }} />
        <span>Private chat with {name}.</span>
      </div>
    </div>
  );
}
