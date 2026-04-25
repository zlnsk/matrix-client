import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_CHARS = 2000;
const MODEL = process.env.TRANSLATE_MODEL || "google/gemini-2.5-flash-lite";

const BUCKET = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 40;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = BUCKET.get(ip);
  if (!entry || now > entry.resetAt) {
    BUCKET.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > LIMIT;
}

// fetch headers reject non-ByteString (>255). Drop anything that isn't printable ASCII.
function asciiSafe(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x20-\x7e]/g, "").trim() || "Matrix";
}

function normalizeTarget(raw: unknown): string {
  if (typeof raw !== "string") return "English";
  const t = raw.trim();
  if (!t) return "English";
  if (t.length > 40) return "English";
  if (!/^[\p{L}\p{M}\s\-()']+$/u.test(t)) return "English";
  return t;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Translation unavailable" }, { status: 503 });
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: { text?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: "Text too long" }, { status: 413 });
  }

  const target = normalizeTarget(body.target);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://matrix.example.com",
        "X-Title": asciiSafe(process.env.OPENROUTER_APP_NAME || "Matrix chat"),
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `You translate user-supplied chat messages to ${target}. Output ONLY the ${target} translation, no explanations, no quotes, no language labels, no markdown. Preserve emoji, line breaks, and punctuation. If the text is already ${target}, return it unchanged.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error("[translate] OpenRouter non-OK", res.status, msg.slice(0, 200));
      return NextResponse.json({ error: "Translation failed" }, { status: 502 });
    }

    const data = await res.json();
    const translation: string | undefined = data?.choices?.[0]?.message?.content
      ?.toString()
      .trim();
    if (!translation) {
      console.error("[translate] empty translation", JSON.stringify(data).slice(0, 300));
      return NextResponse.json({ error: "Empty translation" }, { status: 502 });
    }

    return NextResponse.json({ translation, target });
  } catch (err: unknown) {
    const aborted = (err as { name?: string })?.name === "AbortError";
    console.error("[translate] exception:", err);
    return NextResponse.json(
      { error: aborted ? "Translation timed out" : "Translation error" },
      { status: aborted ? 504 : 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
