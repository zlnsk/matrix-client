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

function asciiSafe(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, "").trim() || "Matrix";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Cleanup unavailable" }, { status: 503 });
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: { text?: unknown };
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": asciiSafe(process.env.OPENROUTER_APP_NAME || "Matrix chat"),
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "Clean up speech-to-text transcription. Fix: false starts, repeated words, stutters, self-corrections, logical inconsistencies, and grammar errors. Preserve the original meaning, tone, and intent. Do NOT add explanations, labels, or markdown. Preserve emoji and line breaks. Output ONLY the cleaned text.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      console.error("[dictate-cleanup] OpenRouter non-OK", res.status, msg.slice(0, 200));
      return NextResponse.json({ error: "Cleanup failed" }, { status: 502 });
    }

    const data = await res.json();
    const cleaned: string | undefined = data?.choices?.[0]?.message?.content?.toString().trim();
    if (!cleaned) {
      console.error("[dictate-cleanup] empty response", JSON.stringify(data).slice(0, 300));
      return NextResponse.json({ error: "Empty cleanup" }, { status: 502 });
    }

    return NextResponse.json({ cleaned });
  } catch (err: unknown) {
    const aborted = (err as { name?: string })?.name === "AbortError";
    console.error("[dictate-cleanup] exception:", err);
    return NextResponse.json(
      { error: aborted ? "Cleanup timed out" : "Cleanup error" },
      { status: aborted ? 504 : 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
