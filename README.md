# aura 🔮

**Farm aura, not brainrot.** A gamified glow-up (habit) tracker built for Gen Z.

Check off tiny daily wins ("touch grass", "no doomscrolling"), earn **aura points**,
level up from **NPC 🗿** to **Limitless 🌌**, keep a streak alive, and download a
Spotify-Wrapped-style **weekly recap card** (1080×1920) to post on your story —
that share card is the built-in growth loop.

## Features

- ⚡ **Today** — one-tap quest check-ins, aura counter, level progress, streak flame, perfect-day bonus
- 📊 **Stats** — lifetime aura, streak, 7-day bar chart, theme picker
- 🔮 **Recap** — weekly summary + downloadable story-sized PNG share card (canvas-rendered, watermarked on free tier)
- 💜 **Aura+** — the freemium tier ($2.49/mo) via Stripe Checkout: unlimited quests (free caps at 5), exclusive themes, no watermark
- App data is local-first (`localStorage`, no login); the only backend is a tiny
  Express API (`server/index.mjs`) that creates and verifies Stripe Checkout sessions

## Run it

```sh
npm install
cp ../SavePals/packages/backend/.env .env   # or create .env (see keys below)
npm run dev                                  # starts the API (:4242) + Vite (:5173)
```

`.env` needs two Stripe keys (same account):

```sh
STRIPE_SECRET_KEY=sk_test_…            # server (Checkout/portal/cancel)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…  # client (embedded Checkout in the modal)
```

`npm run dev` runs both processes via concurrently; `dev:web` / `dev:api` run them
separately. Vite proxies `/api/*` to the Express server.

Test the upgrade with Stripe's test card `4242 4242 4242 4242` (any future expiry,
any CVC/ZIP). Dev shortcut: `?pro=1` unlocks Aura+, `?pro=0` relocks.

### Payment flow (in-modal, no redirect)

Both subscribing and cancelling happen inside a modal — clicking the backdrop
drops the user straight back into the app, no full-page Stripe redirect.

1. `POST /api/checkout` creates an **embedded** subscription Checkout Session
   ($2.49/mo, product created inline — no dashboard setup needed) and returns a
   `clientSecret` + `sessionId`.
2. The Aura+ modal mounts Stripe's embedded Checkout inline (`@stripe/stripe-js`
   with `VITE_STRIPE_PUBLISHABLE_KEY`, `redirect_on_completion: 'never'`).
3. On completion Stripe fires `onComplete` (no redirect); the app calls
   `GET /api/checkout/verify` and only flips `pro` on a **paid** session
   (verified server-side). The buyer's email is stored locally for
   re-sync/restore.

> The legacy `?session_id=…` / `?upgrade=cancelled` redirect handling is kept in
> `App.tsx` for backwards-compat but is no longer part of the happy path.

### Entitlement (Stripe is the source of truth)

No database — Aura+ status is always answered by Stripe via `GET
/api/subscription-status?email=…` (returns `{ pro }` if that email has an
active/trialing subscription):

- **On load**, if an email is stored, the app re-syncs `pro` from Stripe —
  automatically picking up **renewals and cancellations** (a cancelled user is
  downgraded on next load; no webhook needed).
- **Restore purchase**: the Aura+ modal has an "already have Aura+? restore"
  field so a subscriber can unlock on a **fresh browser or new device** by
  entering the email they paid with.
- **Cancel (in-modal)**: the Stats screen shows a "cancel subscription" button
  (pro only) that opens a confirmation modal → `POST /api/cancel` sets
  `cancel_at_period_end` on the active subscription (no Billing Portal redirect).
  Access continues until the paid period is up; the modal shows that date. Once
  the sub is no longer active, load-time re-sync downgrades them to free.
- **Update card / invoices**: a smaller link under the cancel button still opens
  the Stripe-hosted Billing Portal via `POST /api/portal` (there's no embedded
  portal, so card edits and invoice history stay on Stripe's page).

**One-time Stripe setup for launch:** the Billing Portal must be activated once
per account at Settings → Billing → Customer portal (still used by the
"update card / invoices" link; the sandbox already had a default config, the
live account needs it saved before go-live).

Known tradeoff: restore trusts the submitted email (anyone who knows a
subscriber's email could unlock). Fine for a $2.49 cosmetic upgrade; the hardening
step is an emailed magic-link before unlocking. A webhook only becomes useful once
there's a datastore to persist to — until then, load-time re-sync covers grant &
revoke.

## Deployment (Vercel)

Deployed as Vercel project **aura** (team `max-mezalons-projects`). The frontend is
the static Vite build; the Stripe routes live as serverless functions in `api/`
(mirrors of `server/index.mjs`, which remains for local dev). Redirect URLs are
derived from the request host, so preview and production domains both work.

- `STRIPE_SECRET_KEY` is set (encrypted) in Production/Preview/Development.
  **Currently the sandbox test key** — to go live:
  `npx vercel env rm STRIPE_SECRET_KEY production` then
  `npx vercel env add STRIPE_SECRET_KEY production` and paste the live key
  (from SavePal - Web Services, not the sandbox), then `npx vercel deploy --prod`.
- `VITE_STRIPE_PUBLISHABLE_KEY` must also be set in Vercel (build-time env for the
  client bundle) — the matching `pk_test_…` / `pk_live_…` for the secret key above.
  The embedded Checkout modal won't render without it.
- Redeploy: `npx vercel deploy --prod --yes`.

## Income playbook

1. **Go live**: swap the sandbox key for the live key (see Deployment above) and
   flip off Vercel Deployment Protection so the site + Twitter card are public.
2. **Optional hardening** (see Entitlement above): emailed magic-link before
   restore; add a datastore + `checkout.session.completed` /
   `customer.subscription.deleted` webhook if you want instant server-side
   revocation or receipts.
3. **Distribution** — the recap card is the marketing: post your own weekly recaps on
   TikTok/IG with glow-up content; every free user's watermarked card advertises the app.

## Stack

React 19 + TypeScript + Vite frontend, hand-rolled CSS (no UI framework). App state
in `localStorage` (`src/store.ts`); themes are CSS-variable palettes (`src/data.ts`).
Express + Stripe SDK backend (`server/index.mjs`), test key shared with SavePals.
