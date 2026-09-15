# MEGA MANAGER

A Mega Man–style boss rush where the bosses are our engineering managers. Browser game, keyboard controls.

```bash
npm install
npm run dev        # http://localhost:5173
```

**Controls:** arrows move · Z / Space jump · X / C shoot · A / S switch weapon · Enter pause · M mute

**On phones** an on-screen controller appears (D-pad, A jump, B shoot, L / R switch weapon, START pause,
SELECT quit from pause). Add `?touch` to force it on in a desktop browser. "Add to Home Screen" runs it full screen.

**Controllers** (Xbox, PlayStation, Switch Pro, 8BitDo...) work too: D-pad or left stick move, A jump, B / X shoot,
LB / RB (or triggers) switch weapon, START pause, SELECT quit from pause. On-screen prompts follow whichever
device you used last. Browsers only reveal a controller after you press one of its buttons. On a phone, using a
controller hides the on-screen one; touch the screen to bring it back.

**Play it:** https://njgreb.github.io/seimgrman/ · every build: https://njgreb.github.io/seimgrman/builds/

Every push to `main` deploys via `.github/workflows/deploy.yml`: the latest build goes to the site root and a
copy is kept forever under `builds/<sha>/` on the `gh-pages` branch.

## Making it about *your* managers

Each boss is one file in `src/bosses/`. For each one:

1. **Name + jokes**: `name` ("DAVE MAN"), `manager`, `intro`, `defeatQuote`, `credit`. Lines are 6px/char
   on a 256px screen, so keep them under ~38 characters.
2. **Look**: the `look` block (skin, hair, hairStyle, facialHair, glasses, shirt/pants colors, accessories).
   Run `npx tsx tools/contact-sheet.ts` and check `art/contact-sheet.png`.
3. **Attacks**: `patterns` are async functions using the `Boss` helpers (`telegraph`, `fire`, `jumpTo`,
   `dashTo`, `teleport`, `say`, `wait`). Copy an existing pattern and change it.
4. **Weakness / reward**: weapon ids from `src/data/weapons.ts`. Keep the weakness chain a loop.

Add or remove bosses in `src/data/bosses.ts` (up to 8 fit the select screen). Each new boss needs a
`reward` weapon in `src/data/weapons.ts`.

**The final boss** (`src/bosses/cto.ts`, `FINAL_BOSS` in `src/data/bosses.ts`) waits at HQ until every boss above is
beaten: an emergency all-hands invite, then a two-phase fight. Phase 1 is THE REORG MACHINE (only its cockpit
takes damage, only while open; weak to TICKET SPLIT), phase 2 the escape pod (weak to CALENDAR BLOCK). Dying in
phase 2 retries at phase 2. Its attacks remix the four managers' patterns, so if you swap a manager, the remix
names in `cto.ts` are worth a look. Its portrait lives in `art/raw/cto/`.

AI portraits: see [art/README.md](art/README.md).

## Dev shortcuts

- `?boss=ticket` jumps straight into a fight (`?boss=cto&phase=2` starts the final fight at phase 2)
- `?weapons=all` gives every weapon
- `?debug` shows physics hitboxes
- `?results` jumps to the end-of-game score screen with sample stats
- `?initials` / `?scores` jump to name entry / the high score board (needs a leaderboard server, below)
- In dev, `window.game` is the Phaser game (e.g. `game.scene.getScene('Arena').boss.hp = 1`)

## Tuning

`src/config.ts` holds movement physics, damage and invulnerability timings. Useful knobs for an onsite
crowd: `CONTACT_DAMAGE`, `PLAYER_INVULN_MS`, `ENERGY_REGEN_MS`, and each boss's `hp`.

## Scoring

Shown once, on the PERFORMANCE REVIEW screen after the last boss. Stats add up across every fight in the run,
including lost attempts, so retries cost you:

| Part | Points (max) |
| --- | --- |
| Fight time (intros, menus and pause don't count) | 50 per second under 10:00 (30,000) |
| Accuracy: trigger pulls that touched the boss (a 3-way spread counts once) | 300 per % (30,000) |
| Hits taken | 1,000 per hit under 30 (30,000) |
| Clear bonus | 10,000 |

The weights live in `src/config.ts` (`SCORE_*`), the math in `src/score.ts`. The leaderboard server uses the
same file, so it scores every run itself and never trusts a submitted total.

## Leaderboard

After the review screen, players enter 3 initials and see the top 10. The title screen shows the board after
10 idle seconds. The game talks to `server/` (Node + Postgres on Railway) and only turns the leaderboard on when
the build sets `VITE_LEADERBOARD_URL`.

**Railway setup (once):**

1. New project → add **PostgreSQL**.
2. Add a service from this GitHub repo. Leave the root directory as the repo root: `railway.json` points the
   build at `server/Dockerfile` and only redeploys when `server/`, `src/score.ts` or `src/config.ts` change.
3. Service variables: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, `ADMIN_TOKEN` = a long random string.
   Optional: `SEASON` (default `1`; change it to start a fresh board), `ALLOWED_ORIGINS` (default
   `https://njgreb.github.io,http://localhost:5173`), `RATE_LIMIT_PER_MIN` (default 10 per IP).
4. Settings → Networking → **Generate Domain**, then point the game at it and redeploy the site:
   `gh variable set LEADERBOARD_URL --body https://<domain>` and `gh workflow run deploy.yml`.

**Removing a score:** `curl -X DELETE https://<domain>/scores/<id> -H "Authorization: Bearer $ADMIN_TOKEN"`
(ids are in the `GET /scores` response and the service logs).

**Local dev:** `npm install --prefix server && npm run dev --prefix server` (no `DATABASE_URL` = in-memory
database), then `VITE_LEADERBOARD_URL=http://localhost:8787 npm run dev`.

## Shipping it

```bash
npm run build      # → dist/
npx vite preview   # sanity-check the build
```

`dist/` is a static site with relative paths, so it can go on any static host (GitHub Pages, Netlify, an S3 bucket).
It must be served over http, not opened from `file://`.

## Layout

```
src/art/        palette, PixelCanvas, character rig (characters.ts), font, texture generation
src/bosses/     one file per boss: look, theme, attack patterns
src/data/       boss list, weapons, shared types
src/entities/   Player, Boss (AI helpers), Shot
src/scenes/     Boot → Title → BossSelect → BossIntro → Arena (+Pause) → WeaponGet → Ending
tools/          pixelize.ts (AI art → palette-locked sprites), contact-sheet.ts
art/raw/        drop AI-generated images here
```
