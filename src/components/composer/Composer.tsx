"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Popover from "@radix-ui/react-popover";
import {
  Check,
  ChevronLeft,
  Languages,
  Loader2,
  Mic,
  MicVocal,
  Paperclip,
  Reply as ReplyIcon,
  SendHorizonal,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { detectLanguage } from "@/lib/utils/language-detect";

type Props = {
  onSend: (text: string) => void | Promise<void>;
  onSendFile?: (file: File, caption?: string) => void | Promise<void>;
  onTyping?: (active: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  replyTo?: { id: string; senderName: string; body: string } | null;
  onCancelReply?: () => void;
  focusSignal?: string | null;
};

const MAX_LINES = 8;

const QUICK_EMOJI = [
  "😀", "😂", "🥹", "🥰", "😎", "🤔", "😴", "😢",
  "👍", "👎", "🙏", "👏", "🙌", "👀", "💪", "🔥",
  "❤️", "💔", "✨", "🎉", "✅", "❌", "💯", "🤝",
];

const TARGET_LANGS = [
  "English", "Polish", "Spanish", "Romanian",
  "French", "German", "Italian", "Portuguese",
];

export function Composer({
  onSend,
  onSendFile,
  onTyping,
  placeholder = "Message",
  disabled,
  className,
  replyTo,
  onCancelReply,
  focusSignal,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreview, setStagedPreview] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateTarget, setTranslateTarget] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("matrix.translate.target");
  });
  const [livePreview, setLivePreview] = useState("");
  const [livePending, setLivePending] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const translateGenRef = useRef(0);
  const translateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingRef = useRef<{ active: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    active: false,
    timer: null,
  });

  const [dictating, setDictating] = useState(false);
  const [dictLang, setDictLang] = useState<"en-US" | "pl-PL">(() => {
    if (typeof window === "undefined") return "en-US";
    return (window.localStorage.getItem("matrix.dictate.lang") as "en-US" | "pl-PL") || "en-US";
  });
  const [interimText, setInterimText] = useState("");
  const [cleaningUp, setCleaningUp] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const dictValueRef = useRef<string>("");

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordStartRef = useRef<number>(0);
  const recordTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordCancelRef = useRef<boolean>(false);

  const autosize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const lineH = 22;
    const max = lineH * MAX_LINES + 20;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, []);

  useEffect(() => {
    return () => {
      if (stagedPreview) URL.revokeObjectURL(stagedPreview);
    };
  }, [stagedPreview]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordTickRef.current) clearInterval(recordTickRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!onSendFile || recording) return;
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not available in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      recordCancelRef.current = false;
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(recordChunksRef.current, { type });
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (recordTickRef.current) {
          clearInterval(recordTickRef.current);
          recordTickRef.current = null;
        }
        setRecording(false);
        setRecordSeconds(0);
        if (recordCancelRef.current || blob.size === 0) return;
        const ext = type.includes("mp4")
          ? "m4a"
          : type.includes("ogg")
            ? "ogg"
            : "webm";
        const fname = `voice-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
        const file = new File([blob], fname, { type });
        try {
          await onSendFile(file);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to send voice message");
        }
      };
      recordStartRef.current = Date.now();
      setRecordSeconds(0);
      mr.start();
      setRecording(true);
      recordTickRef.current = setInterval(() => {
        setRecordSeconds(Math.floor((Date.now() - recordStartRef.current) / 1000));
      }, 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission denied");
    }
  }, [onSendFile, recording]);

  const stopRecording = useCallback((cancel: boolean) => {
    recordCancelRef.current = cancel;
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    } else {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordStreamRef.current = null;
      if (recordTickRef.current) {
        clearInterval(recordTickRef.current);
        recordTickRef.current = null;
      }
      setRecording(false);
      setRecordSeconds(0);
    }
  }, []);

  const startDictation = useCallback(() => {
    const SR = typeof window !== "undefined"
      ? (window.SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => SpeechRecognition) | undefined
      : undefined;
    if (!SR) { setError("Speech recognition is not supported in this browser"); return; }
    try {
      const rec = new SR();
      rec.lang = dictLang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      dictValueRef.current = value;
      rec.onresult = (e: SpeechRecognitionEvent) => {
        let finalChunk = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalChunk += t;
          else interim += t;
        }
        if (finalChunk) {
          dictValueRef.current = dictValueRef.current + finalChunk;
          setValue(dictValueRef.current);
        }
        setInterimText(interim);
      };
      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error !== "aborted") setError(`Dictation error: ${e.error}`);
        setDictating(false);
        setInterimText("");
      };
      rec.onend = () => {
        const raw = dictValueRef.current;
        setDictating(false);
        setInterimText("");
        void cleanupDictation(raw);
      };
      recognitionRef.current = rec;
      rec.start();
      setDictating(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start dictation");
    }
  }, [dictLang, value]);

  const cleanupDictation = useCallback(async (raw: string) => {
    if (!raw.trim()) return;
    setCleaningUp(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/dictate-cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw }),
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const cleaned = (data as { cleaned?: string }).cleaned;
      if (cleaned) {
        dictValueRef.current = cleaned;
        setValue(cleaned);
        requestAnimationFrame(autosize);
      }
    } catch {
      /* ignore — keep raw text */
    } finally {
      setCleaningUp(false);
    }
  }, [autosize]);

  const stopDictation = useCallback(() => {
    const raw = dictValueRef.current;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setDictating(false);
    setInterimText("");
    void cleanupDictation(raw);
  }, [cleanupDictation]);

  const toggleDictLang = useCallback(() => {
    if (dictating) stopDictation();
    const next = dictLang === "en-US" ? "pl-PL" : "en-US";
    setDictLang(next);
    if (typeof window !== "undefined") window.localStorage.setItem("matrix.dictate.lang", next);
  }, [dictLang, dictating, stopDictation]);

  useEffect(autosize, [value, autosize]);

  useEffect(() => {
    if (replyTo) ref.current?.focus();
  }, [replyTo?.id]);

  useEffect(() => {
    if (focusSignal == null) return;
    // Defer to next tick so the textarea is mounted when switching rooms.
    const id = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [focusSignal]);

  const submit = useCallback(
    (override?: string) => {
      const caption = (override ?? value).trim();
      const preview = livePreview.trim();
      const toSend = translateTarget && preview ? preview : caption;

      if (stagedFile) {
        // Ship the staged file with optional caption.
        if (!onSendFile) return;
        setUploading(true);
        setError(null);
        (async () => {
          try {
            await onSendFile(stagedFile, toSend || undefined);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed.");
          } finally {
            setUploading(false);
            if (stagedPreview) URL.revokeObjectURL(stagedPreview);
            setStagedFile(null);
            setStagedPreview(null);
            setValue("");
            setLivePreview("");
            requestAnimationFrame(autosize);
          }
        })();
        return;
      }

      if (!toSend) return;
      onSend(toSend);
      setValue("");
      setLivePreview("");
      requestAnimationFrame(autosize);
    },
    [
      value,
      onSend,
      onSendFile,
      autosize,
      translateTarget,
      livePreview,
      stagedFile,
      stagedPreview,
    ]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape" && replyTo) {
        e.preventDefault();
        onCancelReply?.();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        submit();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    },
    [submit, replyTo, onCancelReply]
  );

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (!onTyping) return;
    const t = typingRef.current;
    if (!t.active) {
      t.active = true;
      onTyping(true);
    }
    if (t.timer) clearTimeout(t.timer);
    t.timer = setTimeout(() => {
      t.active = false;
      onTyping(false);
    }, 3500);
  };

  const sendFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!onSendFile) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      // Stage the first file to let the user add a caption; if there are
      // additional files, send them straight through as usual.
      const [first, ...rest] = list;
      if (first) {
        if (stagedPreview) URL.revokeObjectURL(stagedPreview);
        setStagedFile(first);
        setStagedPreview(
          first.type.startsWith("image/") ? URL.createObjectURL(first) : null,
        );
        ref.current?.focus();
      }
      if (rest.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        for (const f of rest) {
          await onSendFile(f);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [onSendFile, stagedPreview]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!onSendFile) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void sendFiles(files);
      }
    },
    [onSendFile, sendFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDraggingOver(false);
      if (!onSendFile) return;
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) void sendFiles(files);
    },
    [onSendFile, sendFiles]
  );

  const insertAtCursor = useCallback(
    (chunk: string) => {
      const el = ref.current;
      if (!el) {
        setValue((v) => v + chunk);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const next = value.slice(0, start) + chunk + value.slice(end);
      setValue(next);
      requestAnimationFrame(() => {
        const pos = start + chunk.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [value]
  );

  const detected = useMemo(() => detectLanguage(value), [value]);

  // Persist liveTarget across reloads.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (translateTarget) window.localStorage.setItem("matrix.translate.target", translateTarget);
    else window.localStorage.removeItem("matrix.translate.target");
  }, [translateTarget]);

  // Live translate as user types. Debounced 400ms.
  // Generation counter instead of AbortController: Firefox always logs
  // NetworkError to console for aborted fetches even when the error is caught.
  useEffect(() => {
    if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
    setTranslateError(null);
    const trimmed = value.trim();
    if (!translateTarget || !trimmed) {
      setLivePreview("");
      setLivePending(false);
      return;
    }
    translateTimerRef.current = setTimeout(() => {
      const gen = ++translateGenRef.current;
      setLivePending(true);
      (async () => {
        try {
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
          const res = await fetch(`${basePath}/api/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: trimmed, target: translateTarget }),
          });
          if (translateGenRef.current !== gen) return;
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error((d as { error?: string }).error || `HTTP ${res.status}`);
          }
          const d = (await res.json()) as { translation?: string };
          if (translateGenRef.current !== gen) return;
          setLivePreview(d.translation || "");
        } catch {
          if (translateGenRef.current !== gen) return;
          setTranslateError("Translation failed");
          setLivePreview("");
        } finally {
          if (translateGenRef.current === gen) setLivePending(false);
        }
      })();
    }, 400);
    return () => {
      if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
    };
  }, [value, translateTarget]);

  const hasContent = value.trim().length > 0 || !!stagedFile;

  return (
    <div
      className={cn("px-3 py-3 sm:px-4", className)}
      style={{ borderTop: "1px solid var(--hairline)" }}
      onDragEnter={(e) => {
        if (!onSendFile) return;
        if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
        e.preventDefault();
        setDraggingOver(true);
      }}
      onDragOver={(e) => {
        if (!onSendFile) return;
        if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDraggingOver(false);
      }}
      onDrop={onDrop}
    >
      <div className="w-full" style={{ position: "relative" }}>
        {draggingOver && (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl text-sm font-semibold"
            style={{
              background: "color-mix(in oklch, var(--accent-unread) 14%, transparent)",
              border: "2px dashed var(--accent-unread)",
              color: "var(--accent-unread)",
            }}
          >
            Drop to send
          </div>
        )}
        {error && (
          <div
            className="mb-2 rounded-xl px-3 py-2 text-xs"
            style={{
              background: "color-mix(in oklch, var(--accent-danger) 10%, transparent)",
              color: "var(--accent-danger)",
              border: "1px solid color-mix(in oklch, var(--accent-danger) 30%, transparent)",
            }}
          >
            {error}
          </div>
        )}
        <AnimatePresence initial={false}>
          {replyTo && (
            <motion.div
              key={replyTo.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.14 }}
              className="mb-2 flex items-start gap-2 rounded-xl px-3 py-2"
              style={{
                background: "var(--surface-sunken)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <ReplyIcon size={14} strokeWidth={1.9} className="mt-0.5" style={{ color: "var(--accent-unread)" }} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold" style={{ color: "var(--accent-unread)" }}>
                  Replying to {replyTo.senderName}
                </div>
                <div className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {replyTo.body || "…"}
                </div>
              </div>
              <button
                type="button"
                aria-label="Cancel reply"
                onClick={onCancelReply}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--surface)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={14} strokeWidth={1.9} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {stagedFile && (
          <div
            className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2"
            style={{
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {stagedPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stagedPreview}
                alt={stagedFile.name}
                className="h-12 w-12 rounded-md object-cover"
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-md"
                style={{ background: "var(--surface)", color: "var(--text-muted)" }}
              >
                <Paperclip size={18} strokeWidth={1.8} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                {stagedFile.name}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {(stagedFile.size / 1024).toFixed(1)} KB · add a caption or press send
              </div>
            </div>
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => {
                if (stagedPreview) URL.revokeObjectURL(stagedPreview);
                setStagedFile(null);
                setStagedPreview(null);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface)]"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} strokeWidth={1.9} />
            </button>
          </div>
        )}

        {(dictating && interimText) || cleaningUp ? (
          <div
            className="mb-2 rounded-xl px-3 py-2 text-sm italic"
            style={{
              background: "color-mix(in oklch, var(--accent-unread) 6%, transparent)",
              border: "1px solid color-mix(in oklch, var(--accent-unread) 20%, transparent)",
              color: "var(--text-muted)",
            }}
          >
            {cleaningUp ? "Cleaning up…" : interimText}
          </div>
        ) : null}

        {translateTarget && (value.trim() || translateError) && (
          <div
            className="mb-2 rounded-xl px-3 py-2 text-[18px]"
            style={{
              background: translateError
                ? "color-mix(in oklch, var(--accent-danger) 8%, transparent)"
                : "color-mix(in oklch, var(--accent-unread) 7%, transparent)",
              border: `1px solid ${
                translateError
                  ? "color-mix(in oklch, var(--accent-danger) 28%, transparent)"
                  : "color-mix(in oklch, var(--accent-unread) 24%, transparent)"
              }`,
              color: translateError ? "var(--accent-danger)" : "var(--text)",
            }}
          >
            <div className="mb-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              <Languages size={12} strokeWidth={1.8} />
              <span role="status" aria-live="polite">{translateError ? "Translate error" : `Will send in ${translateTarget}`}</span>
              {livePending && !translateError && (
                <Loader2 size={11} className="animate-spin" style={{ color: "var(--accent-unread)" }} />
              )}
            </div>
            <div className="whitespace-pre-wrap" style={{ minHeight: 18 }}>
              {translateError ? translateError : (livePreview || (livePending ? "…" : ""))}
            </div>
          </div>
        )}

        <div
          className={cn("flex items-end gap-1.5")}
          style={{
            background: "var(--surface)",
            borderRadius: 28,
            border: "none",
            padding: "8px 10px 8px 10px",
            boxShadow: "0 1px 2px rgba(60, 64, 67, 0.08), 0 8px 24px -4px rgba(60, 64, 67, 0.12)",
          }}
        >
          <Popover.Root open={emojiOpen} onOpenChange={setEmojiOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label="Emoji"
                title="Emoji"
                disabled={disabled}
                className="mb-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface)] disabled:opacity-40"
                style={{ color: "var(--text-muted)" }}
              >
                <Smile size={18} strokeWidth={1.8} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                align="start"
                sideOffset={8}
                className="z-50 rounded-2xl p-2"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <div className="grid grid-cols-8 gap-1">
                  {QUICK_EMOJI.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        insertAtCursor(e);
                        setEmojiOpen(false);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[18px] hover:bg-[var(--surface-sunken)]"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          {recording ? (
            <div
              className="flex flex-1 items-center gap-2 px-3"
              style={{ minHeight: 38 }}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 animate-pulse rounded-full"
                style={{ background: "var(--accent-danger)" }}
              />
              <span
                className="text-[14.5px] font-medium tabular-nums"
                style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
              >
                {formatDuration(recordSeconds)}
              </span>
              <span
                className="text-[18px]"
                style={{ color: "var(--text-muted)" }}
              >
                Recording…
              </span>
            </div>
          ) : (
            <textarea
              ref={ref}
              value={value}
              onChange={onChange}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              rows={1}
              disabled={disabled}
              placeholder={stagedFile ? "Add a caption…" : placeholder}
              aria-label="Message"
              className="flex-1 resize-none bg-transparent outline-none placeholder:truncate"
              style={{
                fontSize: 15,
                lineHeight: "22px",
                color: "var(--text)",
                padding: "6px 8px",
                maxHeight: 22 * MAX_LINES + 20,
                whiteSpace: value.includes("\n") ? "pre-wrap" : "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            />
          )}

          {onSendFile && (
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const fs = e.target.files;
                if (fs && fs.length > 0) void sendFiles(fs);
                e.target.value = "";
              }}
            />
          )}

          <Popover.Root
            open={moreOpen}
            onOpenChange={(v) => {
              setMoreOpen(v);
              if (!v) setTranslateOpen(false);
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label="More options"
                disabled={disabled}
                className="mb-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface)] disabled:opacity-40"
                style={{ color: "var(--text-muted)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                </svg>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                side="top"
                align="end"
                sideOffset={8}
                className="z-50 w-[220px] rounded-2xl p-2"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                {translateOpen ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setTranslateOpen(false)}
                      className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <ChevronLeft size={14} strokeWidth={1.75} />
                      <span>Translate to{detected ? ` · from ${detected}` : ""}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTranslateTarget(null); setMoreOpen(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)]"
                      style={{
                        color: translateTarget === null ? "var(--accent-unread)" : "var(--text)",
                        fontWeight: translateTarget === null ? 600 : 400,
                      }}
                    >
                      <span className="w-[14px]" />
                      <span>Off</span>
                      {translateTarget === null && <Check size={14} strokeWidth={1.75} className="ml-auto" />}
                    </button>
                    <div className="my-1 h-px" style={{ background: "var(--border-subtle)" }} />
                    {TARGET_LANGS.map((l) => {
                      const active = l === translateTarget;
                      return (
                        <button
                          key={l}
                          type="button"
                          onClick={() => { setTranslateTarget(l); setMoreOpen(false); }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)]"
                          style={{
                            color: active ? "var(--accent-unread)" : "var(--text)",
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          <span className="w-[14px]" />
                          <span>{l}</span>
                          {active && <Check size={14} strokeWidth={1.75} className="ml-auto" />}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {onSendFile && (
                      <>
                        <button
                          type="button"
                          onClick={() => { fileRef.current?.click(); setMoreOpen(false); }}
                          disabled={uploading || disabled}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                          style={{ color: "var(--text)" }}
                        >
                          <Paperclip size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
                          <span>Attach file</span>
                          {uploading && <Loader2 size={14} className="ml-auto animate-spin" style={{ color: "var(--text-muted)" }} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => { recording ? stopRecording(true) : void startRecording(); setMoreOpen(false); }}
                          disabled={disabled || uploading}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
                          style={{ color: recording ? "var(--accent-danger)" : "var(--text)" }}
                        >
                          {recording ? <Trash2 size={14} strokeWidth={1.75} style={{ color: "var(--accent-danger)" }} /> : <Mic size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />}
                          <span>{recording ? "Cancel recording" : "Voice message"}</span>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => { dictating ? stopDictation() : startDictation(); setMoreOpen(false); }}
                      onContextMenu={(e) => { e.preventDefault(); toggleDictLang(); }}
                      disabled={disabled || recording}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40"
                      style={{ color: dictating ? "var(--accent-unread)" : "var(--text)" }}
                    >
                      <MicVocal size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
                      <span>{dictating ? "Stop dictation" : `Dictate (${dictLang === "en-US" ? "EN" : "PL"})`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTranslateOpen(true)}
                      disabled={disabled}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40"
                      style={{ color: translateTarget ? "var(--accent-unread)" : "var(--text)" }}
                    >
                      <Languages size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
                      <span>{translateTarget ? `Translate: ${translateTarget}` : "Translate"}</span>
                    </button>
                  </>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <motion.button
            key="send"
            type="button"
            aria-label={recording ? "Stop and send" : "Send"}
            onClick={() => (recording ? stopRecording(false) : submit())}
            disabled={!recording && !hasContent}
            initial={false}
            animate={{
              scale: recording || hasContent ? 1 : 0.85,
              opacity: recording || hasContent ? 1 : 0.45,
            }}
            whileTap={recording || hasContent ? { scale: 0.95 } : undefined}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="relative mb-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-white"
            style={{ background: "var(--accent-unread)", boxShadow: "var(--shadow-sm)" }}
          >
            <SendHorizonal size={18} strokeWidth={1.9} />
          </motion.button>
</div>
      </div>
    </div>
  );
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
