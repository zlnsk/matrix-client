"use client";

import { formatDayLabel } from "@/lib/utils/time";

export function DaySeparator({ timestamp }: { timestamp: number }) {
  return (
    <div className="my-4 flex w-full items-center justify-center">
      <span
        className="font-tnum"
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          letterSpacing: "0.02em",
        }}
      >
        {formatDayLabel(timestamp)}
      </span>
    </div>
  );
}
