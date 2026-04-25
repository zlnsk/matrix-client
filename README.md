# matrix-client

> A Matrix client that doesn't look like it was designed in 2017 by a committee.

Built because every open-source Matrix client either (a) looks like a Jira plugin, (b) tries to simultaneously be Slack, Discord, Twitter, and your smart fridge, or (c) asks you to configure 11 settings before you can say hi to a friend.

This one does **one thing**: chat. Like the iMessage / Google Messages you already know how to use. **Tremendous** chat. The best chat. Nobody else has chat like this.

---

## What's inside

- **Next.js 15** App Router, React 19, Tailwind 4 — server components where they help, client components where they don't
- **`matrix-js-sdk` 41** for federation + `@matrix-org/matrix-sdk-crypto-wasm` for E2EE. The cryptography is done by people who actually understand it; I just glue. This is, philosophically, the only correct posture.
- **Radix UI** primitives (dropdown, dialog, popover, tooltip) because rewriting accessibility is how we got here
- **Framer Motion** for the micro-animations that make the product feel alive without making you seasick
- **Zustand** for state — no Redux boilerplate, no Context hell

## Why it exists

I tried Element. I tried Cinny. I tried four self-hosted forks. Every single one either needed a yak-shave to theme a bubble or came with 37 power-user panels I'll never open.

So I wrote this. With **tremendous** help from a large language model, to be honest — being upfront about AI-assisted code is more dignified than pretending the whole thing arrived by divine inspiration at 04:00. The LLM wrote the boilerplate; I picked the typefaces and argued about paddings.

## Design principles

1. **Flat is not lazy.** No shadows at rest. Surfaces differentiate with colour, not elevation. Shadows show up on hover, because that's when the user's attention is on the element.
2. **Hairlines over borders.** `color-mix(in oklch, currentColor 8%, transparent)` beats `#e5e7eb` every time. The border should whisper, not announce itself.
3. **Motion with purpose.** 220 ms `cubic-bezier(0.22, 1, 0.36, 1)` on entries, a tiny spring on new messages. Everything respects `prefers-reduced-motion: reduce`.
4. **The smallest type that stays legible.** 15 px body, 13 px metadata, 11 px eyebrows. Roboto with `cv02 cv03 cv04 cv11 ss01 ss03` stylistic alternates — the letterforms Google themselves switch on in Android.
5. **One colour carries meaning.** Own bubbles use the accent; everything else is a surface tint. When everything is highlighted, nothing is.

## Security

- **E2EE actually works.** Cross-signing, device verification, key backup — all via the official Rust-backed crypto WASM bindings. I don't re-implement anything here.
- **Zero client-side analytics.** No Sentry, no Mixpanel, no Clarity, no "anonymous" pings. Nobody is watching you type.
- **Minimal deps.** ~60 packages total. Less attack surface, faster installs, easier auditing.
- **CSP + Permissions-Policy** on every route. No inline eval, no geolocation, no camera/mic unless you ask for it.
- **`uuid` pinned to `^14`** via `overrides` because transitive-dep supply-chain issues keep shipping and you can't wait for upstream.

## Run it

```bash
git clone https://github.com/zlnsk/matrix-client
cd matrix-client
npm install
cp .env.example .env.local      # then edit per the table below
npm run dev
```

Log in with any Matrix account on any homeserver. That's it. There is no onboarding. There are no "tips of the day". There is no Discord.

## Configuration

| Env var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_DEFAULT_HOMESERVER` | recommended | Pre-fills the login form. Falls back to `https://matrix.org`. |
| `OPENROUTER_API_KEY` | optional | Powers `/api/dictate-cleanup` (voice transcript polishing) and `/api/translate` (per-message translation). Without it those routes 503 gracefully — the rest of the client is unaffected. |
| `OPENROUTER_MODEL` | optional | Override the default model for the AI routes. See suggestions below. |

## Suggestions

- **Cheap is fine for the AI routes.** Both calls are short, structured, low-stakes. `google/gemini-2.5-flash` or `anthropic/claude-haiku-4.5` cost a fraction of a cent per call. Don't reach for Opus or GPT-class models — you'll burn budget for no perceivable quality lift on a "fix this transcript" prompt.
- **Get an OpenRouter key** at https://openrouter.ai. Pay-as-you-go, $5 of credit lasts a long time at these tiers.
- **You don't need to self-host a homeserver** to try this client. Point it at any public Matrix server (matrix.org, your existing org's server, a friend's). Self-hosting is a separate yak.
- **Production deploy**: `npm run build && npm start` behind any reverse proxy. `NEXT_PUBLIC_*` vars must be set at build time, not just runtime — Next.js bakes them in.

---

> 🤖 **Full disclosure:** I didn't even write this README. An LLM did. I read it once, nodded, and pushed. If a sentence lands flat, blame the machine; the PR button is right up there.

---

## License

MIT. Fork it, improve it, don't sue me when you ship a bug.
