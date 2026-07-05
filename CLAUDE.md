# Offprint — artifact conventions

Offprint is a personal documentation/prototyping artifact system: a gallery of
standalone HTML pages you can restyle, edit, rearrange, and flatten. Every file
opens from `file://`, works offline, and carries everything it needs inline.

**Architecture rule — the shell must be deletable.** Pages and the artifact kit
talk to the shell ONLY via `window.ArtifactShell?.x`, `window.Motion ?? null`,
`data-*` attributes, and `a2:*` events. Never a direct function reference, never
shared module state, never reaching into shell DOM. Flatten is the proof. **No frameworks, no CDN links, no network
fonts, no build step.** Browser floor: evergreen 2024+ (oklch, `light-dark()`,
`@layer`, nesting, popover are used unguarded).

## File anatomy (in this order)

1. License comment, `<!doctype html>`, `<html lang="en" data-artifact="<filename-stem>">`
2. `<head>`: charset → viewport → **artifact shell block** → `<title>` → one `<style>` for the page
3. Body content, then one `<script>` for page logic at the end of body
4. Filename: `NN-kebab-name.html`, numbered sequentially; add a gallery card in `index.html`

## The artifact shell (v3)

Every artifact embeds the shell (fenced `artifact-shell v3` comment block). It
provides **style recipes** — 11 color palettes × 9 type sets × 7 finishes,
independently mixable via `data-palette` / `data-type` / `data-finish` on
`<html>` — plus light/dark modes, custom accent, **random palettes**
(`ArtifactShell.randomPalette(seed?)`, seeded constrained-oklch, WCAG-repaired,
applied as `data-palette="custom"` + inline token props), text size, user-saved
recipes, **nav shells** (`settings.nav` → `data-nav`: none/dock/topbar/sidebar/
tabs/drawer/dots; dock is default; manifest embedded at inject time drives
prev/next + artifact switcher — regenerate with `node tools/inject-shell.mjs
--manifest` whenever index cards change), the settings panel (tabs
Recipes/Mix/Options), inline edit mode (**E**), `data-block` reordering,
cross-tab resync, JSON export/import, **flatten** (Options → ⤓ Flatten bakes
resolved tokens + edits + layout + state into a static `.flat.html` with a
frozen `ArtifactShell` stub — see `shell/flat-static.html` for the manual/LLM
strip contract), reveal motion, print rules.

Defaults: **light mode, studio recipe** (swiss palette + grotesk type +
hairline finish), dock nav. CSS attribute-absent defaults are
claude/editorial/soft; JS supplies studio. Presets live in the shell JS
`PRESETS` table.

- Master copies: `shell/artifact-shell.css`, `shell/artifact-shell.js`
- Insert or update with `node tools/inject-shell.mjs [--motion] <file.html>` —
  never hand-edit inside the fence, never fork the shell per file
- Live reference + copyable block: `21-theme-lab.html` (the Recipe Lab)
- **Never write the fence comment text literally anywhere else in a file** (the
  injector would match it); build such strings dynamically if you must display them
- Interactive artifacts add `--motion` (embeds motion.dev mini as `window.Motion`,
  reachable via `ArtifactShell.motion`, always null-checked)

## The artifact kit (v1)

Component-heavy artifacts add `--kit` (second fence `artifact-kit v1`, masters
`shell/artifact-kit.css/js`): an owned component layer — `k-` classes,
`data-k-*` behaviors, `k:*` events — cards, buttons, badges, callouts,
progress/ring/meter, sortable tables, timelines, trees, accordions, the full
form set, tag input, dropzone, dialog, menu, wizard, `data-k-sortable` list
reorder, the kanban engine (`ArtifactKit.kanban`), tier rows and todos with
progress rollup. Kit styling is tokens-only (inherits every recipe); kit JS
boots with no shell and no Motion (all access null-checked). Living reference:
`32-kit-gallery.html`. Kit state persists namespaced as `{kit: {...}}` inside
the artifact state object. Flatten keeps the kit fence — components are content.

## Color & tokens

- Components use **semantic tokens only** — never raw hexes, never `rgba(...)`:
  `--bg --surface --surface-2 --ink --ink-muted --ink-subtle --accent
  --accent-strong --accent-contrast --tint --line --line-strong --focus
  --positive --warning --negative --shadow-1 --shadow-2`
  plus `--font-display --font-body --font-mono`, `--radius-s/m/l`, `--border-w`,
  `--line-style`, `--space`, `--dur-1/2/3`, `--ease-out`, `--ease-spring`
- Derive tints with `color-mix(in oklch, var(--accent) 12%, var(--surface))` —
  pick the percentage, never a literal color
- Inline SVG uses `fill="var(--token)"` / `currentColor` (works inline; also in
  `<stop stop-color>`)
- **Dark islands** (code panels, terminals): set `color-scheme: dark` on the
  container and use tokens normally — they resolve to dark variants in both modes
- Palettes displayed *as content* (design-system swatches, mock UI chrome) are
  exempt: namespace them `--demo-*` and keep them literal
- Legacy names (`--clay`, `--ivory`, `--g100`, `--gray-500`…) are bridged by the
  shell for compatibility but **must not appear in new or migrated code**
- Type/finish tokens the shell owns: `--display-weight --display-track --lh-body
  --radius-full` — pages may consume, never redefine. Never hardcode font
  shorthand that locks out `var(--font-display/body/mono)`
- **Firefox + file:// caveat:** every file:// page is a unique opaque origin —
  localStorage never crosses pages. The shell carries settings through internal
  links via the `#o=` hash instead; `tools/serve.sh` gives one origin and full
  persistence. Never style panel visibility via `:popover-open` or use anchor
  positioning — class-driven state only
- **Chrome isolation:** all shell chrome lives in a shadow root on
  `<offprint-ui>` (block handles are `<offprint-handle>`), so page CSS can
  never restyle it. Pages must not reach into shell DOM — the sanctioned
  check is `ArtifactShell?.panelOpen?.()`

## Editing & portability

- Put `data-edit="kebab-slug"` on headline/lead text: h1–h3, intro `p`, card
  titles, table cells with prose. Slugs unique per file, section-prefixed
  (`ms1-title`, `risk2-mit`). Only on elements whose children carry no listeners;
  edits apply as plain text
- Put `data-block="kebab-slug"` on top-level sibling sections that can be
  reordered (skip mastheads and JS-order-dependent containers); the shell adds
  drag handles + Arrow-key reordering in edit mode, persists to
  `html2:<slug>:blocks`, includes order in export
- Interactive artifacts persist structural state through
  `ArtifactShell.state.set(obj)` / `.onRestore(fn)` and listen for `a2:reset`
  and `a2:editmode` events. If dragging conflicts with editing, pause `draggable`
  while `a2:editmode` is on
- Export JSON schema: `{ format: "html2-artifact", version: 3, artifact, exportedAt,
  settings, recipes?, edits, state?, blocks }` — import replaces wholesale with
  one-shot Undo; v1 files still import (settings migrate)
- DOM built by JS re-applies its own state; never rely on the shell's edits map
  for regenerated nodes

## Modern CSS expectations

- **Always:** `@layer` (page CSS stays unlayered — it must win over the shell),
  nesting, oklch, `light-dark()` pairs for any new color, `clamp()` fluid type,
  logical properties, `:focus-visible`, `@starting-style` entrances,
  reduced-motion guards on every animation
- **When it earns its place:** container queries, `:has()`, popover + anchor
  positioning, scroll-driven animations (`animation-timeline: view()` behind
  `@supports`), view transitions, `field-sizing`, `interpolate-size`,
  `content-visibility`, subgrid
- **Never:** `!important` wars (use layers), `max-height` animation hacks,
  viewport media queries where a container query fits, comma `rgba()` syntax

## Motion

- Tier 1 (every file, CSS only): `data-reveal` on ~5 key elements
  (`data-reveal="scroll"` for below-the-fold sections), hover/active
  micro-interactions with `--ease-spring`, theme switches ride view transitions
- Tier 2 (interactive files, `--motion`): FLIP reorders, drag physics, stagger —
  via `Motion.animate` with spring options in the form
  `{ type: Motion.spring, bounce: .22, visualDuration: .55 }` (calling
  `Motion.spring({...})` THROWS in the mini bundle — never call it),
  always behind a `prefers-reduced-motion` check and a `window.Motion` null-check
- Durations 120–450ms; no infinite animation outside explicit demos

## Responsive (standard)

- No horizontal page scroll at 375px; wide content (tables, code, charts,
  boards, SVGs) scrolls inside its own `overflow-x: auto` container
- Breakpoints: **640px** single column, **900px** 2-col collapse / dots nav
  hidden, **1200px** sidebar tier. Grid/flex children that can overflow get
  `min-width: 0`
- Verify at 375 / 768 / 1280: `document.documentElement.scrollWidth <=
  innerWidth + 1`

## Print & accessibility

- Shell forces light claude tokens and hides chrome in print; per file add:
  `break-inside: avoid` on cards/sections, hide toolbars, force dark islands
  light, one slide/section per page where it applies
- ARIA roles on custom widgets (tablist, radiogroup, live regions for dynamic
  announcements); keyboard operability for anything mouse-driven; contrast ≥4.5:1
  body text / ≥3:1 UI in *every* theme — check against darkest and lightest

## Content

- All data fictional: "Acme" company, BIR-* tickets, invented names/metrics
- Voice: confident, concrete, lightly wry; eyebrow labels in mono uppercase;
  serif display headings with one italic `<em>` accent word

## Verification (before calling a file done)

- `grep -nE '#[0-9A-Fa-f]{3,8}\b' file.html` → hits only inside the shell fence
  or `--demo-*` blocks; no `var(--clay|--ivory|--gray-*|--g[0-9]*)` outside the fence
- Cycle several themes × light/dark; edit → reload → export → import round-trip;
  print preview; keyboard pass; console clean
