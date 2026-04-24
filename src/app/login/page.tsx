"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  discoverHomeserver,
  loginWithPassword,
  startClientFromSession,
} from "@/lib/matrix/client";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [homeserver, setHomeserver] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const base = await discoverHomeserver(homeserver);
      const session = await loginWithPassword({ baseUrl: base, user: username, password });
      await startClientFromSession(session);
      router.replace("/");
    } catch (err) {
      setError(messageOf(err));
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[420px] rounded-2xl p-7"
        style={{
          background: "var(--surface)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
            style={{ background: "var(--accent-unread)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight">Sign in to Matrix</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Your keys stay on this device.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Homeserver">
            <input
              type="text"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="matrix.example.org"
              className="input"
              spellCheck={false}
              autoComplete="url"
              required
            />
          </Field>
          <Field label="Username or Matrix ID">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname or @you:server"
              className="input"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2 text-sm"
              style={{
                background: "color-mix(in oklch, var(--accent-danger) 10%, transparent)",
                color: "var(--accent-danger)",
                border: "1px solid color-mix(in oklch, var(--accent-danger) 30%, transparent)",
              }}
              role="alert"
            >
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="relative mt-2 flex h-11 w-full items-center justify-center rounded-xl font-semibold text-white transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60"
            style={{ background: "var(--accent-unread)" }}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : "Sign in"}
          </button>
        </form>
      </motion.div>

      <style jsx>{`
        .input {
          width: 100%;
          background: var(--surface-sunken);
          color: var(--text);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          transition: box-shadow 160ms var(--ease-out);
        }
        .input:focus {
          box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent-unread) 40%, transparent);
          border-color: color-mix(in oklch, var(--accent-unread) 60%, var(--border));
        }
        .input::placeholder {
          color: var(--text-faint);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[14.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong. Try again.";
}
