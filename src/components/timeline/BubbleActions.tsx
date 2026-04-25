"use client";

import { useEffect, useState } from "react";
import { Smile, Reply, MoreHorizontal, Pencil, Trash2, Forward } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils/cn";

type Props = {
  own: boolean;
  editable?: boolean;
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  forcePickerOpen?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
};

const REACTION_EMOJI = [
  "👍", "❤️", "😂", "🥹", "😮", "😢", "🙏", "🔥",
  "🎉", "👏", "💯", "👀", "✅", "❌", "🤔", "😎",
];

export function BubbleActions({ own, editable, onReact, onReply, onCopy, onEdit, onForward, onDelete, forcePickerOpen, onPickerOpenChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (forcePickerOpen) setPickerOpen(true);
  }, [forcePickerOpen]);
  const setPickerOpenBoth = (v: boolean) => {
    setPickerOpen(v);
    onPickerOpenChange?.(v);
  };
  const popupOpen = pickerOpen || menuOpen;
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-full p-1",
        "opacity-0 transition-opacity duration-150",
        "group-hover:pointer-events-auto group-hover:opacity-100",
        popupOpen && "pointer-events-auto opacity-100",
        own ? "right-full mr-2" : "left-full ml-2"
      )}
      style={{
        background: "var(--surface-raised)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <Popover.Root open={pickerOpen} onOpenChange={setPickerOpenBoth}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Add reaction"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
            style={{ color: "var(--text-muted)" }}
          >
            <Smile size={16} strokeWidth={1.75} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align={own ? "end" : "start"}
            sideOffset={6}
            className="z-50 rounded-2xl p-1.5"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="grid grid-cols-8 gap-0.5">
              {REACTION_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    onReact?.(e);
                    setPickerOpenBoth(false);
                  }}
                  aria-label={`React with ${e}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[20px] hover:bg-[var(--surface-sunken)]"
                >
                  {e}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button
        type="button"
        aria-label="Reply"
        onClick={onReply}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
        style={{ color: "var(--text-muted)" }}
      >
        <Reply size={16} strokeWidth={1.75} />
      </button>
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
            style={{ color: "var(--text-muted)" }}
          >
            <MoreHorizontal size={16} strokeWidth={1.75} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align={own ? "end" : "start"}
            sideOffset={4}
            side="top"
            className="z-50 min-w-[180px] rounded-xl p-1"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
            }}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {editable && onEdit && (
              <DropdownMenu.Item
                onSelect={() => onEdit()}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
                style={{ color: "var(--text)" }}
              >
                <Pencil size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
                <span>Edit</span>
              </DropdownMenu.Item>
            )}
            {onForward && (
              <DropdownMenu.Item
                onSelect={onForward}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
                style={{ color: "var(--text)" }}
              >
                <Forward size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
                <span>Forward</span>
              </DropdownMenu.Item>
            )}
            {own && onDelete && (
              <>
                <DropdownMenu.Separator className="mx-2 my-1 h-px" style={{ background: "var(--border-subtle)" }} />
                <DropdownMenu.Item
                  onSelect={onDelete}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-[var(--surface-sunken)]"
                  style={{ color: "var(--accent-danger)" }}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                  <span>Delete</span>
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
