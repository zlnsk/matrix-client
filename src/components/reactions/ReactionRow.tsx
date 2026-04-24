"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type ReactionSender = { userId: string; displayName: string };
export type Reaction = {
  key: string;
  emoji: string;
  count: number;
  mine: boolean;
  myEventId?: string;
  senders?: ReactionSender[];
};

type Props = {
  reactions: Reaction[];
  own: boolean;
  onToggle?: (emoji: string) => void;
};

export function ReactionRow({ reactions, own, onToggle }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1",
        own ? "justify-end" : "justify-start"
      )}
      style={{ pointerEvents: "auto" }}
    >
      {reactions.map((r) => (
        <motion.button
          key={r.key}
          type="button"
          layout
          whileTap={{ scale: 0.92 }}
          onClick={() => onToggle?.(r.emoji)}
          className="inline-flex items-center gap-1 rounded-full font-tnum"
          style={{
            height: 26,
            padding: "0 10px",
            fontSize: 12,
            color: r.mine ? "var(--accent-unread)" : "var(--text-muted)",
            border: r.mine
              ? "1px solid color-mix(in oklch, var(--accent-unread) 30%, transparent)"
              : "1px solid var(--border-subtle)",
            background: r.mine
              ? "color-mix(in oklch, var(--accent-unread) 8%, var(--surface-raised))"
              : "var(--surface-raised)",
            lineHeight: 1,
          }}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}`}
          title={
            r.senders && r.senders.length
              ? r.senders.map((s) => s.displayName).join(", ") + ` reacted with ${r.emoji}`
              : `${r.emoji} ${r.count}`
          }
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>{r.emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 500 }}>
            {r.count}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
