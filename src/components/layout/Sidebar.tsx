"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Archive, ChevronDown, ChevronRight, PenSquare } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { IconButton } from "@/components/common/IconButton";
import { RoomSearch } from "@/components/rooms/RoomSearch";
import { RoomListItem, type RoomItem } from "@/components/rooms/RoomListItem";

type Props = {
  rooms: RoomItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onNewChat?: () => void;
  onOpenSettings?: () => void;
  onArchive?: (roomId: string) => void;
  onUnarchive?: (roomId: string) => void;
  onLeave?: (roomId: string) => void;
  userName?: string | null;
  userAvatar?: string | null;
};

const SEARCH_IDLE_MS = 30_000;

export function Sidebar({
  rooms,
  selectedId,
  onSelect,
  onNewChat,
  onOpenSettings,
  onArchive,
  onUnarchive,
  onLeave,
  userName,
  userAvatar,
}: Props) {
  const [query, setQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    if (!query) return;
    const t = window.setTimeout(() => setQuery(""), SEARCH_IDLE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const { active, archived } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (r: RoomItem) =>
      !q || r.name.toLowerCase().includes(q) || r.preview.toLowerCase().includes(q);
    if (q) {
      return { active: rooms.filter(matches), archived: [] as RoomItem[] };
    }
    const a: RoomItem[] = [];
    const z: RoomItem[] = [];
    for (const r of rooms) (r.archived ? z : a).push(r);
    return { active: a, archived: z };
  }, [rooms, query]);

  return (
    <aside
      className={cn(
        "flex h-full flex-col hairline-r",
        selectedId ? "hidden md:flex" : "flex",
        "w-full md:w-[var(--sidebar-w)] md:min-w-[300px]"
      )}
      style={{ background: "var(--sidebar-bg)" }}
    >
      <header className="flex items-center gap-3 px-4" style={{ height: 56 }}>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="shrink-0 rounded-full transition-transform hover:opacity-90 active:scale-95"
        >
          <Avatar name={userName ?? "You"} src={userAvatar ?? undefined} size={36} />
        </button>
        <h1 className="flex-1 truncate text-lg font-semibold tracking-tight">Chats</h1>
        <IconButton label="New chat" variant="ghost" size="md" onClick={onNewChat}>
          <PenSquare size={18} strokeWidth={1.75} />
        </IconButton>
      </header>

      <RoomSearch value={query} onChange={setQuery} />

      <div className="flex-1 overflow-y-auto pb-2">
        {active.length === 0 && archived.length === 0 ? (
          <div
            className="px-4 py-12 text-center"
            style={{ color: "var(--text-muted)", fontSize: 13 }}
          >
            {query ? (
              <>No conversations match &ldquo;{query}&rdquo;.</>
            ) : (
              <>
                No conversations yet.{" "}
                {onNewChat && (
                  <button
                    type="button"
                    onClick={onNewChat}
                    className="underline"
                    style={{ color: "var(--accent-unread)" }}
                  >
                    Start one
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          active.map((r) => (
            <RoomListItem
              key={r.id}
              {...r}
              selected={r.id === selectedId}
              onClick={() => onSelect(r.id)}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onLeave={onLeave}
            />
          ))
        )}

        {archived.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setArchiveOpen((v) => !v)}
              aria-expanded={archiveOpen}
              className="mt-1 flex w-full items-center gap-3.5 px-4 text-left hover:bg-[var(--surface-sunken)]"
              style={{ height: 48 }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: "var(--surface-sunken)", color: "var(--text-muted)" }}
              >
                <Archive size={16} strokeWidth={1.9} />
              </div>
              <div className="flex-1 flex items-center justify-between">
                <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>Archived Chats</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="font-tnum inline-flex items-center justify-center rounded-full px-2"
                    style={{
                      fontSize: 12,
                      background: "var(--surface-sunken)",
                      color: "var(--text-muted)",
                      height: 22,
                      fontWeight: 600,
                    }}
                  >
                    {archived.length}
                  </span>
                  {archiveOpen ? (
                    <ChevronDown size={14} strokeWidth={1.9} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronRight size={14} strokeWidth={1.9} style={{ color: "var(--text-muted)" }} />
                  )}
                </span>
              </div>
            </button>
            {archiveOpen &&
              archived.map((r) => (
                <RoomListItem
                  key={r.id}
                  {...r}
                  selected={r.id === selectedId}
                  onClick={() => onSelect(r.id)}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onLeave={onLeave}
                />
              ))}
          </>
        )}
      </div>
    </aside>
  );
}
