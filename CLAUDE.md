# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Orbi (package name `prumo`, some strings still say "prumo") is a ride-hailing platform in one Next.js app: marketing site, passenger app, driver app and admin panel sharing one database. UI text, comments and docs are in Brazilian Portuguese; keep that. See `README.md` for product decisions and the pre-launch checklist.

## Next.js version warning

`AGENTS.md` says this Next.js (16.x) differs from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before touching Next APIs. Notably, `src/proxy.ts` is the middleware (renamed): it sets a per-request CSP nonce, so inline scripts must go through Next's nonce handling.

## Commands

```bash
npm run dev                 # http://localhost:3000 (embedded PGlite DB in .data/, created automatically)
npm run typecheck           # tsc --noEmit (there is no lint script)
npm test                    # vitest: pure rules in tests/**/*.test.ts
npx vitest run tests/pix.test.ts            # one test file
npx vitest run -t "name fragment"           # one test by name
npx next build && npm run test:e2e          # Playwright, real browser, throwaway DB
npx playwright test e2e/rules.spec.ts       # one e2e file (still needs a prior `next build`)
npm run admin:create -- "Name" email@x.com admin   # prints the password once
npm run db:generate         # drizzle-kit migration from src/db/schema.ts
npm run celular             # Cloudflare tunnel + QR code to test on a phone (real https, so GPS works)
npm run model:build         # regenerate the compressed 3D car (scripts/build-car-model.ts)
```

## Running gotchas

- **Embedded DB takes one process.** Stop the dev/prod server before `admin:create`. Do not run `next build` while `next dev` is running (they share `.next`).
- **`next start` refuses the embedded DB.** Without `DATABASE_URL`, production mode throws and the public APIs (`/api/public/*`) return 500, which silently empties city lists and pulse. To run production mode locally: `PRUMO_ALLOW_EMBEDDED_DB=true AUTH_SECRET="$(cat .data/secret)" npx next start -p 3000`. A 200 on `/` proves nothing; check `/api/public/pulse` too.
- **E2E uses port 3100** and `.data-e2e/` (wiped each run, started by `scripts/e2e-server.ts` with a fake OIDC server). It never touches `.data/`. `workers: 1`; tests share state.
- Port 3000 may already be taken by an unrelated local program (a Remotion Studio showed up once). Check what answers before assuming it is Orbi.
- `.data/` (DB, uploads, `secret`) and `.env*` are gitignored; keep it that way.

## Architecture

Layering, from pure to impure:

- `src/domain/`: pure rules with no I/O (pricing/commission, dispatch scoring, ride state transitions, permissions, Pix, CPF/CNH/CNPJ/plate validation). Everything unit-tested in `tests/`. Business logic belongs here, not in route handlers.
- `src/server/`: the impure engine. `rides.ts` runs the ride lifecycle on top of `domain/transitions` and `domain/dispatch`; `auth.ts` (sessions via `jose`, login rate limit), `bus.ts` (real-time events to clients over SSE at `/api/events`), `payments.ts`, `geo.ts` (OSRM/Photon/OpenFreeMap calls), `verify.ts` (email DNS, ViaCEP), `guard.ts`/`security.ts`, `admin-resources.ts` (generic CRUD config behind `/api/admin/r/[resource]`).
- `src/db/`: Drizzle schema, SQL migrations (generated, do not hand-edit), `seed.ts`. `src/db/index.ts` chooses PostgreSQL (`DATABASE_URL`) or embedded PGlite. The seed creates only cities, modalities, categories and tariffs; never invent drivers, rides or payments.
- `src/app/api/`: REST routes, thin wrappers over `src/server`. Catch-all segments (`[...path]`, `[[...action]]`) are used heavily, so grep for the route file rather than guessing paths.
- UI: `src/app/(site)/` marketing pages, `(auth)/` single entry (phone decides login vs signup), `passageiro/`, `motorista/`, `admin/` apps, `v/[token]` shared-trip page. Shared pieces in `src/components/` (`components/site/` for the marketing site, `components/app/` for the apps).

Business rules that span files (do not hardcode elsewhere):
- Commission is never fixed in code: it lives on each tariff (city + category) and an active plan can override it. Commission applies to gross only; coupons are paid by Orbi and do not reduce the driver's net; the service fee is paid by the passenger. Cash rides put Orbi's share as a debit on the driver's balance (it can go negative).
- Dispatch scores each criterion 0..1 with weights editable in `/admin/configuracoes`; new drivers get neutral values.
- A ride needs a driver whose documents, vehicle and registration are approved in `/admin/motoristas`. "Test mode" (manual map location) exists only outside production.
- `bus.ts` and the login rate limit are in-memory: single-instance only until moved to Redis.

Visual identity: `src/lib/identities.ts` + CSS variables in `src/app/globals.css` define four brand identities (A is the shipped Orbi one: electric blue, Inter, cyan→blue gradient `--grad`). Dark sections use `.on-deep`/`bg-deep`.

Maps are MapLibre loaded lazily (`components/LazyMap.tsx`, `MapView.tsx`). The 3D car (`components/site/Car3D.tsx`, `CarStage.tsx`) is lazy, WebGL-gated, pauses off-screen and falls back to a flat illustration. The hero background is a single canvas (`components/site/OrbitField.tsx`) that must stay cheap: DPR capped, pauses when hidden or off-screen, static under reduced motion.

## Licensing constraint

The 3D car model (CC BY 4.0) and OpenStreetMap data require attribution. It lives on `/creditos` (linked from the footer); do not remove it without replacing the model or the data source.
