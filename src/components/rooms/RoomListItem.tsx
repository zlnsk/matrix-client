"use client";

import { cn } from "@/lib/utils/cn";
import { formatSidebarTime } from "@/lib/utils/time";
import { Avatar } from "@/components/common/Avatar";
import { Archive, ArchiveRestore, Check, CheckCheck, Globe, LogOut, MoreHorizontal, ShieldCheck, Users } from "lucide-react";
import { BridgeIcon } from "@/components/common/BridgeIcon";
import { motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";

export type RoomKind = "dm" | "group" | "public";

export type RoomItem = {
  id: string;
  name: string;
  avatar?: string | null;
  preview: string;
  previewSelf?: boolean;
  timestamp: number;
  unread: number;
  encrypted?: boolean;
  muted?: boolean;
  selected?: boolean;
  kind?: RoomKind;
  archived?: boolean;
  bridge?: "signal" | "whatsapp" | null;
  sendState?: "sending" | "sent" | "read" | "failed";
};

type Props = RoomItem & {
  onClick?: () => void;
  onArchive?: (roomId: string) => void;
  onUnarchive?: (roomId: string) => void;
  onLeave?: (roomId: string) => void;
};

function ReadReceipt({ state }: { state?: "sending" | "sent" | "read" | "failed" }) {
  if (!state) return null;
  if (state === "failed") {
    return <span className="text-[10px] font-medium" style={{ color: "var(--accent-danger)" }}>!</span>;
  }
  if (state === "sending") {
    return <Check size={12} strokeWidth={1.5} style={{ color: "var(--text-faint)" }} />;
  }
  if (state === "read") {
    return <CheckCheck size={12} strokeWidth={1.5} style={{ color: "var(--accent-unread)" }} />;
  }
  return <CheckCheck size={12} strokeWidth={1.5} style={{ color: "var(--text-faint)" }} />;
}

export function RoomListItem({
  id,
  name,
  avatar,
  preview,
  previewSelf,
  timestamp,
  unread,
  encrypted,
  muted,
  selected,
  kind,
  archived,
  bridge,
  sendState,
  onClick,
  onArchive,
  onUnarchive,
  onLeave,
}: Props) {
  const KindIcon = kind === "public" ? Globe : kind === "group" ? Users : null;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className={cn(
        "group relative mx-2 flex items-center gap-3.5 rounded-xl px-3 text-left transition-all duration-200 ease-out",
        selected
          ? "bg-[var(--surface-sunken)] shadow-sm"
          : "hover:bg-[var(--surface-sunken)] hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.18)] hover:-translate-y-[1px]",
        menuOpen && "bg-[var(--surface-sunken)] shadow-sm"
      )}
      style={{ height: 68 }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={selected ? "true" : undefined}
        className="absolute inset-0"
        aria-label={`Open chat with ${name}`}
      />
      <div className="relative pointer-events-none transition-transform duration-200 ease-out group-hover:scale-[1.04]">
        <Avatar name={name} src={avatar ?? undefined} size={48} unread={unread > 0} />
      </div>
      <div className="relative flex-1 min-w-0 pointer-events-none">
        <div className="flex items-center gap-1">
          {KindIcon && (
            <KindIcon
              size={13}
              strokeWidth={2}
              style={{ color: "var(--text-faint)", flexShrink: 0 }}
              aria-label={kind === "public" ? "public room" : "group"}
            />
          )}
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
            {name}
          </span>
          {bridge ? (
            <BridgeIcon type={bridge} size={13} />
          ) : encrypted ? (
            <ShieldCheck size={13} strokeWidth={2} style={{ color: "var(--accent-success)", flexShrink: 0 }} aria-label="encrypted" />
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className="truncate"
            style={{
              fontSize: 14,
              color: unread > 0 ? "var(--text)" : "var(--text-muted)",
              flex: 1,
              minWidth: 0,
            }}
          >
            {previewSelf ? <span style={{ color: "var(--text-faint)" }}>You: </span> : null}
            {preview}
          </span>
          {muted ? (
            <span aria-label="muted" style={{ fontSize: 12 }}>
              🔕
            </span>
          ) : null}
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              className="inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-white font-tnum"
              style={{
                background: "var(--accent-unread)",
                fontSize: 12,
                height: 20,
                fontWeight: 600,
              }}
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </div>
      </div>
      <div className="relative flex flex-col items-end justify-center" style={{ minWidth: 28, height: 48 }}>
        {/* Timestamp + read receipt — hidden on hover */}
        <div
          className={cn(
            "flex flex-col items-end gap-0.5 transition-opacity",
            "group-hover:opacity-0",
            menuOpen && "opacity-0"
          )}
        >
          <span
            className="font-tnum"
            style={{ fontSize: 12, color: unread > 0 ? "var(--accent-unread)" : "var(--text-faint)", flexShrink: 0 }}
          >
            {formatSidebarTime(timestamp)}
          </span>
          <ReadReceipt state={sendState} />
        </div>
        {/* Menu button — visible on hover */}
        {(onArchive || onUnarchive || onLeave) && (
          <div className="absolute inset-0 flex items-center justify-end">
            <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="More room actions"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    "opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100",
                    "hover:bg-[color-mix(in_oklch,var(--text-muted)_12%,transparent)]",
                    menuOpen && "opacity-100 scale-100"
                  )}
                  style={{ color: "var(--text-muted)" }}
                >
                  <MoreHorizontal size={18} strokeWidth={1.9} />
                </button>
              </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="z-50 min-w-[180px] rounded-xl p-1"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                {archived ? (
                  onUnarchive && (
                    <DropdownMenu.Item
                      onSelect={() => onUnarchive(id)}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
                      style={{ color: "var(--text)" }}
                    >
                      <ArchiveRestore size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
                      <span>Unarchive</span>
                    </DropdownMenu.Item>
                  )
                ) : (
                  onArchive && (
                    <DropdownMenu.Item
                      onSelect={() => onArchive(id)}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
                      style={{ color: "var(--text)" }}
                    >
                      <Archive size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
                      <span>Archive</span>
                    </DropdownMenu.Item>
                  )
                )}
                {onLeave && (
                  <DropdownMenu.Item
                    onSelect={() => onLeave(id)}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
                    style={{ color: "var(--accent-danger)" }}
                  >
                    <LogOut size={14} strokeWidth={1.75} />
                    <span>Leave room</span>
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          </div>
        )}
      </div>
    </div>
  );
}
