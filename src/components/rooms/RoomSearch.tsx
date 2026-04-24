"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { forwardRef, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onFilter?: () => void;
  placeholder?: string;
};

export const RoomSearch = forwardRef<HTMLInputElement, Props>(function RoomSearch(
  { value, onChange, onFilter, placeholder = "Search" },
  ref
) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className="mx-3 my-2 flex items-center gap-2 rounded-xl px-3 py-2 transition-shadow"
      style={{
        background: "var(--surface-sunken)",
        border: "1px solid var(--border-subtle)",
        boxShadow: focused ? "inset 0 0 0 1px color-mix(in oklch, var(--accent-unread) 50%, transparent)" : "none",
      }}
    >
      <Search size={16} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label="Search rooms"
        className="flex-1 bg-transparent outline-none"
        style={{ fontSize: 13.5, color: "var(--text)" }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-[color-mix(in_oklch,var(--text-muted)_14%,transparent)]"
          style={{ color: "var(--text-muted)" }}
        >
          <X size={13} strokeWidth={2.1} />
        </button>
      )}
      {onFilter && (
        <button type="button" aria-label="Filter rooms" onClick={onFilter} className="text-[var(--text-muted)]">
          <SlidersHorizontal size={15} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
});
