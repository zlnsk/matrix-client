"use client";

import { useState, useMemo } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
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
                transition={{ duration: 0.12 }}
                className="fixed inset-0 z-50"
                style={{ background: "transparent" }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 4 }}
                transition={{ type: "spring", stiffness: 520, damping: 34 }}
                className="fixed left-1/2 top-1/2 z-50 flex flex-col w-[min(340px,calc(100dvw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-xl overflow-hidden"
                style={{
                  background: "var(--surface)",
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--border-subtle)",
                  maxHeight: "75dvh",
                }}
              >
                <Dialog.Title className="sr-only">Forward to</Dialog.Title>
                  <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-sunken)" }}>
                    <Search size={14} strokeWidth={1.8} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Forward to…"
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: "var(--text)" }}
                    />
                    {query ? (
                      <button onClick={() => setQuery("")} aria-label="Clear" style={{ color: "var(--text-faint)" }}>
                        <X size={13} />
                      </button>
                    ) : (
                      <Dialog.Close asChild>
                        <button type="button" aria-label="Close" style={{ color: "var(--text-faint)" }}>
                          <X size={13} />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                      <div className="py-6 text-center text-xs" style={{ color: "var(--text-faint)" }}>
                        No chats found.
                      </div>
                    ) : (
                      filtered.map((room) => (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => {
                            onForward({ roomId: room.id, name: room.name });
                            setQuery("");
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--surface-sunken)]"
                        >
                          <Avatar name={room.name} src={room.avatar ?? null} size={28} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm" style={{ color: "var(--text)" }}>
                              {room.name}
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
