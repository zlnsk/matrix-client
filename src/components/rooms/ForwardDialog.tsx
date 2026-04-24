"use client";

import { useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, SendHorizonal, Search } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import type { RoomItem } from "@/components/rooms/RoomListItem";

export type ForwardTarget = {
  roomId: string;
  name: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rooms: RoomItem[];
  onForward: (target: ForwardTarget) => void;
};

export function ForwardDialog({ open, onOpenChange, rooms, onForward }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, query]);

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
                className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100dvw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-0 overflow-hidden"
                style={{
                  background: "var(--surface)",
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--border-subtle)",
                  maxHeight: "min(520px,calc(100dvh-80px))",
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-3 p-5 pb-3">
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold tracking-tight">Forward to</Dialog.Title>
                      <Dialog.Description className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                        Choose a chat to forward this message.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button
                        type="button"
                        aria-label="Close"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <X size={16} strokeWidth={1.75} />
                      </button>
                    </Dialog.Close>
                  </div>

                  <div className="px-5 pb-2">
                    <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ background: "var(--surface-sunken)", borderColor: "var(--border-subtle)" }}>
                      <Search size={16} strokeWidth={1.8} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                      <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search chats"
                        className="flex-1 bg-transparent text-sm outline-none"
                        style={{ color: "var(--text)" }}
                      />
                      {query && (
                        <button onClick={() => setQuery("")} style={{ color: "var(--text-faint)" }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                    {filtered.length === 0 ? (
                      <div className="py-8 text-center text-sm" style={{ color: "var(--text-faint)" }}>
                        No chats found.
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {filtered.map((room) => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => {
                              onForward({ roomId: room.id, name: room.name });
                              setQuery("");
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-sunken)]"
                          >
                            <Avatar name={room.name} src={room.avatar ?? null} size={40} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                                {room.name}
                              </div>
                              <div className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                                {room.preview || "No messages yet"}
                              </div>
                            </div>
                            <SendHorizonal size={16} strokeWidth={1.8} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
