"use client";

import { MessageCircle } from "lucide-react";

export function ChatEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3 max-w-sm px-6">
        <div
          className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl text-white"
          style={{ background: "var(--accent-unread)" }}
        >
          <MessageCircle size={28} strokeWidth={1.6} />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">Pick up where you left off</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 }}>
          Select a conversation from the sidebar — or start a new one.
        </p>
      </div>
    </div>
  );
}
