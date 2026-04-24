"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/common/Avatar";

type Props = {
  roomId?: string;
  name: string;
  avatar?: string | null;
  subtitle?: string;
  encrypted?: boolean;
  onOpenInfo?: () => void;
  onBack?: () => void;
};

export function ChatHeader({ name, avatar, subtitle, encrypted, onOpenInfo, onBack }: Props) {
  return (
    <header
      className="flex items-center gap-2 px-4 sm:gap-3 sm:px-5"
      style={{ height: 56, background: "var(--surface)" }}
    >
      {onBack && (
        <button
          type="button"
          aria-label="Back to chats"
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)] md:hidden"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={20} strokeWidth={1.9} />
        </button>
      )}
      {onOpenInfo ? (
        <button
          type="button"
          onClick={onOpenInfo}
          className="flex items-center gap-3 min-w-0 rounded-full pr-2 -ml-1 py-1 hover:bg-[var(--surface-sunken)]"
          aria-label="Open room info"
        >
          <RoomIdentity name={name} avatar={avatar} subtitle={subtitle} encrypted={encrypted} />
        </button>
      ) : (
        <div className="flex items-center gap-3 min-w-0 -ml-1 py-1">
          <RoomIdentity name={name} avatar={avatar} subtitle={subtitle} encrypted={encrypted} />
        </div>
      )}
    </header>
  );
}

function RoomIdentity({
  name,
  avatar,
  subtitle,
  encrypted,
}: {
  name: string;
  avatar?: string | null;
  subtitle?: string;
  encrypted?: boolean;
}) {
  return (
    <>
      <Avatar name={name} src={avatar ?? undefined} size={36} />
      <div className="min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate" style={{ fontSize: 16, fontWeight: 500 }}>
            {name}
          </span>
          {encrypted && (
            <ShieldCheck size={13} strokeWidth={2} style={{ color: "var(--accent-success)" }} aria-label="encrypted" />
          )}
        </div>
        {subtitle && (
          <div className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {subtitle}
          </div>
        )}
      </div>
    </>
  );
}
