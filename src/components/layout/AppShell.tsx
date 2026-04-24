"use client";

import { useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "@/components/timeline/MessageList";
import { Composer } from "@/components/composer/Composer";
import { ChatEmptyState } from "./ChatEmptyState";
import { mockRooms, mockTimeline } from "@/lib/mock/data";
import type { BubbleProps } from "@/components/timeline/Bubble";
import type { RoomItem } from "@/components/rooms/RoomListItem";

type Msg = BubbleProps & { isGroupStart: boolean; isGroupEnd: boolean };

export default function AppShell() {
  const [rooms, setRooms] = useState<RoomItem[]>(mockRooms);
  const [selectedId, setSelectedId] = useState<string | null>(mockRooms[0]!.id);
  const [messages, setMessages] = useState<Msg[]>(mockTimeline);
  const [typing, setTyping] = useState<string[]>([]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedId) ?? null,
    [rooms, selectedId]
  );

  async function handleSend(text: string) {
    const id = `local-${Date.now()}`;
    const ts = Date.now();
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      const continuing = last?.own === true && ts - last.timestamp < 5 * 60_000;
      if (continuing && last) {
        prev[prev.length - 1] = { ...last, isGroupEnd: false, showTail: false };
      }
      return [
        ...prev,
        {
          id,
          body: text,
          timestamp: ts,
          own: true,
          senderName: "You",
          sendState: "sending",
          isGroupStart: !continuing,
          isGroupEnd: true,
          showTail: true,
          showHeader: !continuing,
          justSent: true,
        },
      ];
    });
    // optimistic → sent → read (mock)
    const step = (state: BubbleProps["sendState"]) =>
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, sendState: state, justSent: false } : m)));
    setTimeout(() => step("sent"), 450);
    setTimeout(() => step("read"), 2400);

    // bump sidebar
    setRooms((prev) => {
      if (!selectedId) return prev;
      return prev
        .map((r) => (r.id === selectedId ? { ...r, preview: text, previewSelf: true, timestamp: ts, unread: 0 } : r))
        .sort((a, b) => b.timestamp - a.timestamp);
    });
  }

  const handleTyping = (active: boolean) => {
    // local-only echo — just a visual in the playground
    void active;
  };

  // demo: toggle typing bubble so it's visible in the mock
  const demoTypingToggle = () => {
    if (typing.length) setTyping([]);
    else setTyping(["Alma Winters"]);
  };

  return (
    <div className="flex h-dvh w-dvw overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar
        rooms={rooms}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
      />
      <section className="flex flex-1 min-w-0 flex-col">
        {selectedRoom ? (
          <>
            <ChatHeader
              name={selectedRoom.name}
              encrypted={selectedRoom.encrypted}
              
              onOpenInfo={demoTypingToggle}
            />
            <MessageList
              messages={messages}
              typingNames={typing}
              unreadAfter={null}
              onReact={(id, emoji) =>
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== id) return m;
                    const list = m.reactions ?? [];
                    const found = list.find((r) => r.emoji === emoji);
                    const next = found
                      ? list
                          .map((r) => (r.emoji === emoji ? { ...r, count: r.mine ? r.count - 1 : r.count + 1, mine: !r.mine } : r))
                          .filter((r) => r.count > 0)
                      : [...list, { key: emoji, emoji, count: 1, mine: true }];
                    return { ...m, reactions: next };
                  })
                )
              }
            />
            <Composer onSend={handleSend} onTyping={handleTyping} placeholder={`Message ${selectedRoom.name}`} />
          </>
        ) : (
          <ChatEmptyState />
        )}
      </section>
    </div>
  );
}
