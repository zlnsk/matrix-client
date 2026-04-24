"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MessageSquarePlus, X } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (target: string) => Promise<{ roomId: string } | void>;
};

type Kind = "dm" | "alias" | "id" | "unknown";

function classify(input: string): Kind {
  const t = input.trim();
  if (/^@[^:@\s]+:[^:@\s]+$/.test(t)) return "dm";
  if (/^#[^:@\s]+:[^:@\s]+$/.test(t)) return "alias";
  if (/^![^:@\s]+:[^:@\s]+$/.test(t)) return "id";
  return "unknown";
}

export function NewChatDialog({ open, onOpenChange, onSubmit }: Props) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = classify(target);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "unknown") {
      setError("Enter a Matrix ID (@name:server), room alias (#room:server), or room ID (!id:server).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(target.trim());
      setTarget("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const hint =
    kind === "dm"
      ? "Start a direct message"
      : kind === "alias"
      ? "Join room by alias"
      : kind === "id"
      ? "Join room by ID"
      : "Starts with @ for a person, # for a room alias, ! for a room ID";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-50"
                style={{ background: "var(--overlay-backdrop)" }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100dvw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
                style={{
                  background: "var(--surface)",
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white flex-shrink-0"
                    style={{ background: "var(--accent-unread)" }}
                  >
                    <MessageSquarePlus size={20} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <Dialog.Title className="text-lg font-semibold tracking-tight">New conversation</Dialog.Title>
                    <Dialog.Description className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                      Message a person or join a room.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close"
                      className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <X size={16} strokeWidth={1.75} />
                    </button>
                  </Dialog.Close>
                </div>

                <form onSubmit={submit} className="mt-5 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Target
                    </label>
                    <input
                      autoFocus
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="@alice:server.tld"
                      className="w-full rounded-xl border px-3 py-2.5 outline-none transition-colors"
                      style={{
                        background: "var(--surface-sunken)",
                        borderColor: "var(--border-subtle)",
                        fontSize: 14,
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "color-mix(in oklch, var(--accent-unread) 50%, var(--border-subtle))";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                      }}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    <p className="mt-1.5 text-xs" style={{ color: kind === "unknown" ? "var(--text-faint)" : "var(--text-muted)" }}>
                      {hint}
                    </p>
                  </div>

                  {error && (
                    <div
                      className="rounded-xl px-3 py-2 text-sm"
                      style={{
                        background: "color-mix(in oklch, var(--accent-danger) 10%, transparent)",
                        color: "var(--accent-danger)",
                        border: "1px solid color-mix(in oklch, var(--accent-danger) 30%, transparent)",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        className="h-9 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      type="submit"
                      disabled={busy || kind === "unknown"}
                      className="relative inline-flex h-9 items-center justify-center rounded-xl px-3 text-sm font-semibold text-white transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60"
                      style={{ background: "var(--accent-unread)" }}
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : kind === "dm" ? "Start chat" : "Join"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
