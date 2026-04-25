"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatTime } from "@/lib/utils/time";
import { detectNeedsTranslation } from "@/lib/utils/language-detect";
import { Avatar } from "@/components/common/Avatar";
import { useMedia } from "@/hooks/useMedia";

import { type SendState } from "./ReadReceipt";
import { ReactionRow, type Reaction } from "@/components/reactions/ReactionRow";
import { BubbleActions } from "./BubbleActions";
import {
  File as FileIcon,
  Languages,
  Loader2,
  Pencil,
  ShieldCheck,
  Trash2,
  ZoomIn,
} from "lucide-react";
import { ImageViewer } from "./ImageViewer";

import type { EncryptedFileInfo } from "@/lib/matrix/media";

export type BubbleAttachment =
  | {
      kind: "image";
      url: string;
      alt?: string;
      width?: number;
      height?: number;
      encryptedFile?: EncryptedFileInfo;
      mimeType?: string;
    }
  | {
      kind: "video";
      url: string;
      mime?: string;
      thumbnail?: string | null;
      encryptedFile?: EncryptedFileInfo;
      mimeType?: string;
    }
  | {
      kind: "file";
      url: string;
      name: string;
      size?: number;
      mime?: string;
      encryptedFile?: EncryptedFileInfo;
      mimeType?: string;
    };

export type BubbleProps = {
  id: string;
  body: string;
  html?: string | null;
  timestamp: number;
  own: boolean;
  senderName: string;
  senderAvatar?: string | null;
  sendState?: SendState;
  showTail?: boolean;
  showHeader?: boolean;
  isGroupStart?: boolean;
  isGroupEnd?: boolean;
  edited?: boolean;
  encrypted?: boolean;
  justSent?: boolean;
  redacted?: boolean;
  attachment?: BubbleAttachment | null;
  reactions?: Reaction[];
  uploadProgress?: number | null;
  replyTo?: { senderName: string; body: string } | null;
  isDm?: boolean;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onEdit?: (eventId: string, newBody: string) => void;
};

// Emoji-only messages render large (Telegram/iMessage-style).
// Returns emoji count when the trimmed text is only emoji + whitespace, 0 otherwise.
function emojiOnlyCount(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Strip whitespace, ZWJ, variation selectors — keep base pictographics
  const stripped = trimmed.replace(/[\s‍️]/gu, "");
  if (!stripped) return 0;
  if (!/^(?:\p{Extended_Pictographic}|\p{Emoji_Component})+$/u.test(stripped)) return 0;
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let n = 0;
    for (const g of seg.segment(trimmed)) {
      if (/\S/u.test(g.segment)) n++;
    }
    return n;
  } catch {
    return [...trimmed].filter((c) => /\S/u.test(c)).length;
  }
}

export function Bubble(props: BubbleProps) {
  const {
    body,
    html,
    timestamp,
    own,
    senderName,
    isDm,
    senderAvatar,
    sendState = "sent",
    showTail = true,
    showHeader = true,
    isGroupStart = true,
    isGroupEnd = true,
    edited,
    encrypted,
    justSent,
    redacted,
    attachment,
    reactions,
    replyTo,
    onReact,
    onReply,
    onCopy,
    onForward,
    onDelete,
    onEdit,
    uploadProgress,
  } = props;

  const reduce = useReducedMotion();
  const [sheen, setSheen] = useState(Boolean(justSent));
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  const GENERIC_MEDIA_NAME = /\.(png|jpe?g|gif|webp|heic|heif|mp4|mov|webm|avi|mkv)\s*$/i;
  const hasMediaAttachment =
    !!attachment &&
    (attachment.kind === "image" || attachment.kind === "video") &&
    !redacted;
  const hasFileAttachment =
    !!attachment && attachment.kind === "file" && !redacted;
  const bodyTrim = (body ?? "").trim();
  const effectiveBody =
    hasMediaAttachment && body && GENERIC_MEDIA_NAME.test(bodyTrim)
      ? ""
      : hasFileAttachment && body && bodyTrim === (attachment?.name ?? "").trim()
      ? ""
      : body;
  const mediaOnly =
    (hasMediaAttachment || hasFileAttachment) && !effectiveBody && !html && !replyTo;
  const imageMediaOnly =
    hasMediaAttachment && !effectiveBody && !html && !replyTo;

  const canTranslate = useMemo(
    () =>
      !own &&
      !redacted &&
      !hasMediaAttachment &&
      !hasFileAttachment &&
      detectNeedsTranslation(effectiveBody || ""),
    [own, redacted, effectiveBody, hasMediaAttachment, hasFileAttachment],
  );

  const handleTranslate = useCallback(async () => {
    if (translating || translation || !body) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { translation?: string };
      if (!data.translation) throw new Error("Empty response");
      setTranslation(data.translation);
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  }, [body, translating, translation]);

  useEffect(() => {
    if (!justSent || reduce) return;
    setSheen(true);
    const t = setTimeout(() => setSheen(false), 700);
    return () => clearTimeout(t);
  }, [justSent, reduce]);

  // Long-press → open reactions picker (mobile). 450ms hold; cancelled by
  // movement > 10px (scrolling) or release. Desktop (pointerType=mouse) ignored
  // because hover already exposes the rail.
  const [pickerPulse, setPickerPulse] = useState(0);
  const longPressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const startLongPress = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      setPickerPulse((n) => n + 1);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          /* ignore */
        }
      }
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressOrigin.current = null;
  };
  const maybeCancelOnMove = (e: React.PointerEvent) => {
    const o = pressOrigin.current;
    if (!o || !longPressTimer.current) return;
    if (Math.abs(e.clientX - o.x) > 10 || Math.abs(e.clientY - o.y) > 10) cancelLongPress();
  };

  const [editing, setEditing] = useState(false);
  const [draftBody, setDraftBody] = useState(body);
  const [editingMinWidth, setEditingMinWidth] = useState<number | null>(null);
  const editingRef = useRef(false);
  const editRef = useRef<HTMLTextAreaElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const editFocusedOnceRef = useRef(false);
  const openEdit = () => {
    if (!(own && !redacted && !attachment && onEdit)) return;
    setDraftBody(body);
    editingRef.current = true;
    editFocusedOnceRef.current = false;
    // Pin the current bubble width so the textarea (cols=20 intrinsic width)
    // doesn't collapse the bubble to a fraction of its original size.
    const w = bubbleRef.current?.offsetWidth;
    if (w) setEditingMinWidth(w);
    // Defer a frame so Radix menu close finishes before the textarea mounts;
    // otherwise its onCloseAutoFocus handoff can race-blur the new textarea
    // and silently dismiss edit mode.
    requestAnimationFrame(() => setEditing(true));
  };
  const autosizeEditor = () => {
    const el = editRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    editFocusedOnceRef.current = true;
    const end = el.value.length;
    try {
      el.setSelectionRange(end, end);
    } catch {
      /* noop */
    }
    autosizeEditor();
  }, [editing]);
  useLayoutEffect(() => {
    if (!editing) return;
    autosizeEditor();
  }, [editing, draftBody]);
  const submitEdit = () => {
    if (!editingRef.current) return;
    // Ignore blur that fires before the textarea has actually been focused —
    // that's the mount-time focus handoff, not a user commit.
    if (!editFocusedOnceRef.current) return;
    editingRef.current = false;
    setEditing(false);
    setEditingMinWidth(null);
    const next = draftBody.trim();
    const prev = (body ?? "").trim();
    if (!next || next === prev) return;
    onEdit?.(props.id, next);
  };
  const cancelEdit = () => {
    editingRef.current = false;
    setEditing(false);
    setEditingMinWidth(null);
    setDraftBody(body);
  };

  const radius = 18;
  const tailCorner = isGroupEnd && showTail ? 6 : radius;
  // Frameless mode: drop bubble background/shadow/border only when the
  // message is pure media (no caption, no reply quote, no html). A media
  // message with a caption keeps its chrome so the text sits inside a bubble.
  const frameless = hasMediaAttachment && !effectiveBody && !html && !replyTo;

  const bubbleStyle: React.CSSProperties = frameless
    ? {
        background: "transparent",
        color: own ? "var(--text)" : "var(--text)",
        boxShadow: "none",
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: radius,
      }
    : mediaOnly
    ? {
        background: "transparent",
        color: "var(--text)",
        boxShadow: "none",
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: own ? radius : tailCorner,
        borderBottomRightRadius: own ? tailCorner : radius,
      }
    : redacted
    ? {
        background: "transparent",
        color: "var(--text-faint)",
        border: "1px dashed var(--border)",
        boxShadow: "none",
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: own ? radius : tailCorner,
        borderBottomRightRadius: own ? tailCorner : radius,
      }
    : own
    ? {
        background: "var(--bubble-own-bg)",
        color: "var(--bubble-own-text)",
        boxShadow: "none",
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomLeftRadius: radius,
        borderBottomRightRadius: tailCorner,
      }
    : {
        background: "var(--bubble-other-bg)",
        color: "var(--bubble-other-text)",
        boxShadow: "none",
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
        borderBottomRightRadius: radius,
        borderBottomLeftRadius: tailCorner,
      };

  return (
    <div
      className={cn(
        "group relative flex w-full overflow-visible",
        own ? "justify-end pl-10" : "justify-start pr-10",
        isGroupStart ? "mt-2" : "mt-[2px]"
      )}
      style={{ maxWidth: "100%" }}
      data-own={own}
    >
      {/* Avatar rail — only on others' bubbles at group start */}
      {!own && (
        <div className="w-9 mr-2 flex-shrink-0 flex items-end pb-1">
          {showHeader && isGroupStart ? (
            <Avatar name={senderName} src={senderAvatar ?? undefined} size={32} />
          ) : null}
        </div>
      )}

      <div className={cn("relative flex min-w-0 max-w-[min(520px,70%)] flex-col", own ? "items-end" : "items-start")}>
        {/* Sender name — only on group start for others */}
        {!own && !isDm && showHeader && isGroupStart && (
          <div className="mb-1 ml-1 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>
            <span>{senderName}</span>
            {encrypted && <ShieldCheck size={12} strokeWidth={2} style={{ color: "var(--accent-success)" }} aria-label="encrypted" />}
          </div>
        )}

        <div className={cn("relative", reactions && reactions.length > 0 ? "mb-3" : undefined)}>
        <motion.div
          ref={bubbleRef}
          layout
          initial={justSent ? { scale: 0.92, opacity: 0, y: 6 } : false}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "relative overflow-hidden",
            !frameless && !mediaOnly && !redacted &&
              "transition-shadow duration-200 ease-out hover:shadow-[0_6px_18px_-4px_rgba(0,0,0,0.22)]"
          )}
          onPointerDown={startLongPress}
          onPointerMove={maybeCancelOnMove}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onPointerLeave={cancelLongPress}
          style={{
            ...bubbleStyle,
            minWidth: editing && editingMinWidth ? editingMinWidth : undefined,
            padding: frameless ? 0 : "12px 16px",
            minHeight: frameless ? undefined : 36,
            touchAction: "pan-y",
            WebkitTouchCallout: "none",
          }}
        >
          {replyTo && (
            <div
              className="px-3 py-2 text-[14px] leading-snug"
              style={{
                marginBottom: 8,
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 10,
              }}
            >
              <div className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>{replyTo.senderName}</div>
              <div className="truncate max-w-[420px]" style={{ color: "var(--text-muted)" }}>{replyTo.body}</div>
            </div>
          )}

          {attachment && !redacted && (
            <AttachmentRender attachment={attachment} own={own} standalone={mediaOnly} radius={radius} tailCorner={tailCorner} />
          )}

          {redacted ? (
            <div
              className="flex items-center gap-1.5 italic"
              style={{ fontSize: 13.5, lineHeight: 1.45 }}
            >
              <Trash2 size={12} strokeWidth={1.8} aria-hidden />
              {body || "message deleted"}
            </div>
          ) : editing ? (
            <>
              <textarea
                ref={editRef}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                onBlur={submitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelEdit();
                  } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submitEdit();
                  }
                }}
                rows={1}
                className="block w-full resize-none border-0 bg-transparent p-0 outline-none whitespace-pre-wrap break-words"
                style={{
                  fontSize: 14,
                  lineHeight: 1.45,
                  wordBreak: "break-word",
                  color: own ? "var(--bubble-own-text)" : "var(--text)",
                  font: "inherit",
                  margin: 0,
                  minHeight: 0,
                  boxShadow: "none",
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  marginTop: 2,
                  opacity: 0.7,
                  color: own ? "rgba(255,255,255,0.85)" : "var(--text-faint)",
                }}
              >
                Enter to save · Esc to cancel
              </div>
            </>
          ) : effectiveBody || html ? (() => {
            const emojiN = emojiOnlyCount(effectiveBody || "");
            const jumbo =
              emojiN === 0 ? 0 : emojiN === 1 ? 56 : emojiN <= 3 ? 44 : emojiN <= 6 ? 32 : 0;
            const fs = jumbo || 14;
            const lh = jumbo ? 1.15 : 1.45;
            return (
              <div
                className="whitespace-pre-wrap break-words"
                style={{
                  fontSize: fs,
                  lineHeight: lh,
                  wordBreak: "break-word",
                  color: frameless ? "var(--text)" : undefined,
                }}
                dangerouslySetInnerHTML={html ? { __html: html } : undefined}
              >
                {html ? undefined : effectiveBody}
              </div>
            );
          })() : null}

          {canTranslate && (
            <div className="mt-1.5 flex flex-col gap-1">
              {!translation && !translateError && (
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating}
                  aria-label="Translate to English"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors disabled:opacity-60"
                  style={{
                    background: own ? "rgba(255,255,255,0.16)" : "var(--surface-sunken)",
                    color: own ? "rgba(255,255,255,0.9)" : "var(--text-muted)",
                    border: own
                      ? "1px solid rgba(255,255,255,0.2)"
                      : "1px solid var(--border-subtle)",
                  }}
                >
                  {translating ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Languages size={11} />
                  )}
                </button>
              )}
              {translation && (
                <div
                  className="rounded-md border-l-2 px-2 py-1 text-[14px] leading-snug"
                  style={{
                    borderColor: own ? "rgba(255,255,255,0.55)" : "var(--accent-unread)",
                    background: own
                      ? "rgba(255,255,255,0.1)"
                      : "color-mix(in oklch, var(--accent-unread) 8%, transparent)",
                    color: own ? "rgba(255,255,255,0.95)" : "var(--text)",
                  }}
                >
                  <div
                    className="mb-0.5 text-[10px] uppercase tracking-wide"
                    style={{ opacity: 0.7 }}
                  >
                    English
                  </div>
                  <div className="whitespace-pre-wrap break-words">{translation}</div>
                </div>
              )}
              {translateError && (
                <div
                  className="flex items-center gap-2 text-[14px]"
                  style={{ color: own ? "rgba(255,255,255,0.85)" : "var(--accent-danger, #e33)" }}
                >
                  <span>{translateError}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTranslateError(null);
                      handleTranslate();
                    }}
                    className="rounded-full px-2 py-0.5"
                    style={{
                      background: own ? "rgba(255,255,255,0.2)" : "var(--surface-sunken)",
                      color: own ? "rgba(255,255,255,0.95)" : "var(--text)",
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Timestamp and status shown below bubble by MessageList */}

          {typeof uploadProgress === "number" && uploadProgress < 1 && (
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1 overflow-hidden"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.round(uploadProgress * 100)}%`,
                  background: own ? "rgba(255,255,255,0.85)" : "var(--accent-unread)",
                  transition: "width 120ms linear",
                }}
              />
            </div>
          )}

          
        </motion.div>

        {reactions && reactions.length > 0 && (
          <div
            className={cn("absolute z-10", own ? "-right-1" : "-left-1")}
            style={{ bottom: -10 }}
          >
            <ReactionRow reactions={reactions} own={own} onToggle={onReact} />
          </div>
        )}
        <BubbleActions
          own={own}
          editable={own && !redacted && !attachment && !!onEdit}
          onReact={(emoji: string) => onReact?.(emoji)}
          onReply={onReply}
          onCopy={onCopy}
          onForward={onForward}
          onEdit={openEdit}
          onDelete={onDelete}
          forcePickerOpen={pickerPulse > 0}
          onPickerOpenChange={(open) => {
            if (!open) setPickerPulse(0);
          }}
        />
        </div>
      </div>

    </div>
  );
}

function AttachmentRender({ attachment, own, standalone }: { attachment: BubbleAttachment; own: boolean; standalone?: boolean; radius?: number; tailCorner?: number }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const encOpts = attachment.encryptedFile
    ? { encryptedFile: attachment.encryptedFile, mimeType: attachment.mimeType }
    : undefined;
  const src = useMedia(
    attachment.url,
    attachment.kind === "image" ? 720 : 480,
    attachment.kind === "image" ? 720 : 480,
    encOpts
  );
  const poster = useMedia(
    attachment.kind === "video" ? attachment.thumbnail ?? null : null,
    640,
    360
  );

  if (attachment.kind === "image") {
    return (
      <>
        <div className={standalone ? "overflow-hidden" : "-mx-2 -mt-1 mb-1.5 overflow-hidden rounded-xl"} style={{ background: "var(--surface-sunken)" }}>
          {src ? (
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              aria-label="Open image"
              className="group/img relative block w-full"
              style={{ cursor: "zoom-in", padding: 0, border: 0, background: "transparent" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={attachment.alt ?? ""}
                loading="lazy"
                decoding="async"
                style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "cover" }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover/img:opacity-100"
                style={{
                  background: "rgba(0,0,0,0.45)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                }}
              >
                <ZoomIn size={16} strokeWidth={2} />
              </span>
            </button>
          ) : (
            <div style={{ height: 180, display: "grid", placeItems: "center", color: "var(--text-faint)", fontSize: 12 }}>
              loading image…
            </div>
          )}
        </div>
        <ImageViewer
          src={viewerOpen ? src : null}
          alt={attachment.alt}
          onClose={() => setViewerOpen(false)}
        />
      </>
    );
  }

  if (attachment.kind === "video") {
    return (
      <div className={standalone ? "overflow-hidden" : "-mx-2 -mt-1 mb-1.5 overflow-hidden rounded-xl"} style={{ background: "#000" }}>
        {src ? (
          <video
            controls
            preload="metadata"
            poster={poster ?? undefined}
            style={{ display: "block", width: "100%", maxHeight: 360, background: "#000" }}
          >
            <source src={src} type={attachment.mime ?? "video/mp4"} />
          </video>
        ) : (
          <div style={{ height: 180, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            loading video…
          </div>
        )}
      </div>
    );
  }

  // file
  return (
    <a
      href={src ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      onClick={(e) => {
        if (!src) e.preventDefault();
      }}
      className="mb-1.5 flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors"
      style={{
        background: own ? "rgba(255,255,255,0.14)" : "var(--surface-sunken)",
        border: own ? "1px solid rgba(255,255,255,0.18)" : "1px solid var(--border-subtle)",
        color: own ? "rgba(255,255,255,0.95)" : "var(--text)",
        textDecoration: "none",
      }}
    >
      <FileIcon size={20} strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{attachment.name}</div>
        {attachment.size && (
          <div className="text-[14px]" style={{ opacity: 0.75 }}>
            {formatSize(attachment.size)}
          </div>
        )}
      </div>
    </a>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
