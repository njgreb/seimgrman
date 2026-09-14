# MEGA MANAGER

A Mega Man–style boss rush where the bosses are our engineering managers. Browser game, keyboard controls.

```bash
npm install
npm run dev        # http://localhost:5173
```

**Controls:** arrows move · Z / Space jump · X / C shoot · A / S switch weapon · Enter pause · M mute

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

AI portraits: see [art/README.md](art/README.md).

## Dev shortcuts

- `?boss=ticket` jumps straight into a fight
- `?weapons=all` gives every weapon
- `?debug` shows physics hitboxes
- In dev, `window.game` is the Phaser game (e.g. `game.scene.getScene('Arena').boss.hp = 1`)

## Tuning

`src/config.ts` holds movement physics, damage and invulnerability timings. Useful knobs for an onsite
crowd: `CONTACT_DAMAGE`, `PLAYER_INVULN_MS`, `ENERGY_REGEN_MS`, and each boss's `hp`.

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
