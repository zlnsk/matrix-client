"use client";

import { useState } from "react";
import { Bubble } from "@/components/timeline/Bubble";
import { DaySeparator } from "@/components/timeline/DaySeparator";
import { UnreadMarker } from "@/components/timeline/UnreadMarker";
import { TypingIndicator } from "@/components/timeline/TypingIndicator";
import { ReactionRow } from "@/components/reactions/ReactionRow";
import { RoomListItem } from "@/components/rooms/RoomListItem";
import { Composer } from "@/components/composer/Composer";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="my-10">
      <h2 className="mb-3 text-sm font-semibold tracking-wider" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {title}
      </h2>
      <div
        className="rounded-2xl p-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

const now = Date.now();

export default function Playground() {
  const [lastSent, setLastSent] = useState<string>("");

  return (
    <main className="mx-auto max-w-[960px] px-6 pb-24 pt-6" style={{ background: "var(--bg)", minHeight: "100dvh" }}>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Matrix · Playground</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Every state that matters, in both themes. Use the toggle on the right.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Bubbles · own · send states">
        <div className="space-y-3">
          <Bubble
            id="p-sending"
            body="Sending this one — should show the clock."
            timestamp={now - 30_000}
            own
            senderName="You"
            sendState="sending"
            justSent
          />
          <Bubble
            id="p-sent"
            body="Sent. Single tick, low contrast."
            timestamp={now - 120_000}
            own
            senderName="You"
            sendState="sent"
          />
          <Bubble
            id="p-sent2"
            body="Sent. Single tick."
            timestamp={now - 180_000}
            own
            senderName="You"
            sendState="sent"
          />
          <Bubble
            id="p-read"
            body="Read. Double tick punches a little harder."
            timestamp={now - 240_000}
            own
            senderName="You"
            sendState="read"
          />
          <Bubble
            id="p-failed"
            body="Failed to send — should surface the alert icon."
            timestamp={now - 300_000}
            own
            senderName="You"
            sendState="failed"
          />
        </div>
      </Section>

      <Section title="Bubbles · others · grouping">
        <div className="space-y-0">
          <Bubble
            id="p-o1"
            body="First of a run — has avatar, name, no tail yet."
            timestamp={now - 600_000}
            own={false}
            senderName="Alma Winters"
            isGroupStart
            isGroupEnd={false}
            showTail={false}
            encrypted
          />
          <Bubble
            id="p-o2"
            body="Middle of a run — no avatar, no name, 2px gap above."
            timestamp={now - 540_000}
            own={false}
            senderName="Alma Winters"
            isGroupStart={false}
            isGroupEnd={false}
            showTail={false}
            showHeader={false}
            encrypted
          />
          <Bubble
            id="p-o3"
            body="Last of the run — gets the tail and the 6px radius."
            timestamp={now - 480_000}
            own={false}
            senderName="Alma Winters"
            isGroupStart={false}
            isGroupEnd
            showTail
            showHeader={false}
            encrypted
          />
        </div>
      </Section>

      <Section title="Reactions">
        <div className="space-y-4">
          <Bubble
            id="p-react-own"
            body="Shipping the reaction row anchored to bubble bottom."
            timestamp={now - 60_000}
            own
            senderName="You"
            sendState="read"
            reactions={[
              { key: "🔥", emoji: "🔥", count: 4, mine: true },
              { key: "🎉", emoji: "🎉", count: 2, mine: false },
              { key: "❤️", emoji: "❤️", count: 1, mine: false },
            ]}
          />
          <Bubble
            id="p-react-other"
            body="Each chip glassmorphic, own-reaction gets a ring."
            timestamp={now - 30_000}
            own={false}
            senderName="Alma Winters"
            encrypted
            reactions={[
              { key: "👀", emoji: "👀", count: 3, mine: true },
              { key: "💯", emoji: "💯", count: 1, mine: false },
            ]}
          />
          <div>
            <h3 className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>Isolated row</h3>
            <ReactionRow
              reactions={[
                { key: "🔥", emoji: "🔥", count: 99, mine: true },
                { key: "🧪", emoji: "🧪", count: 1, mine: false },
              ]}
              own
            />
          </div>
        </div>
      </Section>

      <Section title="Replies / edits">
        <div className="space-y-0">
          <Bubble
            id="p-reply"
            body="You're reading the quoted reply above."
            timestamp={now - 120_000}
            own
            senderName="You"
            sendState="read"
            replyTo={{ senderName: "Alma Winters", body: "Timestamps tabular nums, right?" }}
          />
          <Bubble
            id="p-edit"
            body="I just fixed a typo — the pencil shows up next to the clock."
            timestamp={now - 90_000}
            own
            senderName="You"
            sendState="sent"
            edited
          />
        </div>
      </Section>

      <Section title="Day separator · unread marker">
        <DaySeparator timestamp={now - 86_400_000} />
        <DaySeparator timestamp={now} />
        <UnreadMarker count={4} />
      </Section>

      <Section title="Typing indicator">
        <TypingIndicator names={["Alma Winters"]} />
        <div className="h-3" />
        <TypingIndicator names={["Alma", "Jun"]} />
      </Section>

      <Section title="Room list items">
        <div style={{ background: "var(--surface)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
          <RoomListItem
            id="p-r1"
            name="Alma Winters"
            preview="Of course — I'll send it over tonight ✨"
            timestamp={now - 60_000}
            unread={3}
            encrypted
          />
          <RoomListItem
            id="p-r2"
            name="Design Crit"
            preview="Ilya: the gradient looks better on dark"
            timestamp={now - 20 * 60_000}
            unread={12}
            encrypted
          />
          <RoomListItem
            id="p-r3"
            name="Family"
            preview="You: pictures inbound"
            previewSelf
            timestamp={now - 4 * 3_600_000}
            unread={0}
            muted
          />
          <RoomListItem
            id="p-r4"
            name="#matrix-lab"
            preview="erik: federation is cooking tonight"
            timestamp={now - 6 * 3_600_000}
            unread={0}
            selected
          />
        </div>
      </Section>

      <Section title="Composer">
        <Composer onSend={(t) => setLastSent(t)} placeholder="Say something nice" />
        {lastSent && (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Last sent: <span style={{ color: "var(--text)" }}>{lastSent}</span>
          </p>
        )}
      </Section>
    </main>
  );
}
