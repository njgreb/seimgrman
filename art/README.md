# Art workflow

The game already runs with **trait-drawn** characters: every boss is drawn from the `look` block
in `src/bosses/<id>.ts` (hair, glasses, beard, clothes, accessories). Imported art is optional and
replaces two things per boss:

| File you provide              | Becomes                                         | Used on                     |
| ----------------------------- | ----------------------------------------------- | --------------------------- |
| `art/raw/<id>/portrait.png`   | `public/assets/bosses/<id>/portrait.png` 48x48  | boss select, intro, credits |
| `art/raw/<id>/head.png`       | `public/assets/bosses/<id>/head.png` 16x16      | the in-game sprite's head   |

`.jpg` / `.webp` also work. `<id>` must match the boss `id` (`sync`, `ticket`, ...).

## Recommended split

- **Portraits → AI.** At 48x48 a likeness actually reads. This is the payoff moment.
- **Heads → traits first.** At 16x16 an AI head usually turns to mush. Tune the `look` traits until the
  contact sheet is recognizable; only import a `head.png` if you're willing to hand-clean it.

## Steps

1. Get each manager's OK to use their photo with an AI tool (or skip photos and use traits only).
2. Fill in the `look` block for each boss (5 min each). Run `npx tsx tools/contact-sheet.ts` and
   open `art/contact-sheet.png` to see the whole cast as the game draws it.
3. Generate a portrait per manager with the **same prompt** for everyone (below).
4. Save as `art/raw/<id>/portrait.png`, then run `npm run art`.
5. Open `art/contact-sheet.png`. If one portrait looks off next to the others, regenerate or
   touch it up in [Aseprite](https://www.aseprite.org/) / [Piskel](https://www.piskelapp.com/)
   (edit the *output* in `public/assets/bosses/<id>/`, and don't re-run `npm run art` for that boss afterwards).

## Portrait prompt template

Attach the reference photo, then:

> Retro 16-bit video game character portrait of the person in the photo, as a boss character.
> Head and shoulders, facing slightly right, friendly smug expression. Flat colors, bold dark outlines,
> simple shading, no gradients, no text. Keep their hairstyle, hair color, facial hair, glasses and
> skin tone accurate. Wearing: {clothing / signature item}.
> **Solid pure green (#00FF00) background, nothing else in the frame.** Square image.

Tips:
- The green background matters: `tools/pixelize.ts` removes it and trims the anti-aliased fringe.
  A transparent PNG works too. Busy backgrounds are left in place (you'll get a warning).
- Don't ask the model for "pixel art" at a specific size. It fakes the pixel grid. Ask for flat, bold
  art and let the script do the pixelizing, so every portrait gets identical treatment.
- If a result has green tint on the hair edges, regenerate with "no green on the character".

## Head prompt (optional)

> Same character, head only, side view facing right, flat colors, bold outline, solid pure green
> (#00FF00) background, square image.

## What the pipeline does

`tools/pixelize.ts`: flood-fill background removal → defringe → crop to subject → box-filter
downscale → snap to the shared palette (`src/art/palette.ts`) → cap colors (16 portrait / 8 head) →
dark outline → **asserts every pixel is a palette color** → writes `public/assets/manifest.json`.
The game loads whatever the manifest lists and falls back to trait-drawn art for the rest.
