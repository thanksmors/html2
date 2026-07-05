# Offprint

*Self-contained HTML pages you can restyle, edit, and rearrange.*

A personal documentation & prototyping system: every file is a single `.html`
that opens from `file://`, works offline, and embeds its own theme engine (the
**artifact shell**), inline editing, section reordering, JSON export of your
changes, and a one-click **flatten** that strips a finished page back to plain
static HTML. Grown out of a fork of Anthropic's
[html-examples](https://github.com/anthropics/html-examples) — that repo
remains the inspiration credit.

Open [`index.html`](index.html) for the full, categorized index, or open any
numbered file directly in a browser.

## The artifact shell

Every artifact embeds the same fenced shell block (master copies in
[`shell/`](shell/), injected by [`tools/inject-shell.mjs`](tools/inject-shell.mjs)):

- **Style recipes** — gear button: mix any of 11 color palettes with 9
  typography sets and 7 finishes, roll a **random palette** (seeded, always
  readable — share the seed), pick a custom accent and text size, and save
  your own named recipes. Default is **studio** (light swiss/grotesk/hairline).
  Choices follow you across files (instantly on one origin, on tab-focus for
  `file://`).
- **Nav shells** — pick how pages connect: floating dock (default), topbar
  with an artifact switcher, sidebar TOC, tabs, drawer, or minimap dots —
  every file knows the whole gallery via an embedded manifest.
- **Artifact kit** — an owned component layer (`--kit`): kanban, tier rows,
  todos with rollup, sortable lists/tables, forms, dialogs, wizards, progress
  meters… all themed by the token system. Live reference:
  [`32-kit-gallery.html`](32-kit-gallery.html).
- **Flatten** — when a page is exactly right, Options → ⤓ Flatten downloads a
  static copy with the look, edits, layout, and state baked in and every trace
  of the shell removed.
  [`21-theme-lab.html`](21-theme-lab.html) — the Recipe Lab — is the live mixer
  and reference with a WCAG contrast grid and a copyable shell block.

  > Firefox + double-clicked files: `file://` storage is partitioned per
  > folder, so `unknowns/` can't follow the main folder's recipe. Run
  > `tools/serve.sh` (then open `http://localhost:8907`) for full sync.
- **Inline editing & reordering** — press **E** (or flip Edit mode in the gear):
  headline text becomes editable in place, and sections grow drag handles so
  you can reorder the page; interactive artifacts (boards, editors, matrices)
  persist their structural state too. No regenerating a whole page to fix one
  line.
- **Portable edits** — Export downloads a small `<file>.edits.json` (edits +
  state + theme). Send it alongside the HTML file; the recipient imports it via
  the panel or by dragging it onto the page.
- **Motion** — native CSS motion everywhere (`@starting-style` entrances,
  scroll-driven reveals, view-transition theme switches); interactive artifacts
  additionally inline a small [motion.dev](https://motion.dev) bundle (MIT) for
  spring physics and FLIP reorders. All of it respects `prefers-reduced-motion`.

Conventions for generating new artifacts in this style live in
[`CLAUDE.md`](CLAUDE.md).

## Contents

| Category | Examples |
|---|---|
| Exploration & planning | code approaches, visual designs, implementation plan, decision matrix, roadmap |
| Code | review, understanding, design systems, component variants |
| Prototyping | animation, interaction |
| Communication | slide deck, status report, incident report, postmortem timeline, PR write-up |
| Data & dashboards | metrics dashboard, benchmark comparison, data table explorer, log/trace explorer |
| Diagrams & research | flowchart, feature/concept explainers |
| Custom editing UIs | triage board, feature flags, prompt tuner |
| Reference | Theme Lab (shell + theme system) |

## Running

Nothing to install or build. Clone and open `index.html` (or any file) in an
evergreen browser — the shell uses 2024-baseline CSS (`oklch`, `light-dark()`,
`@layer`, nesting, popover), so a current Chrome, Edge, Firefox, or Safari is
assumed.

## A note on sample data

All product names, data, and scenarios are fictional. The placeholder brand
"Acme" and any figures shown are not real.

## License

Released under the [Apache License 2.0](LICENSE). Original examples
© Anthropic PBC; per §4(b), files in this fork carry modifications
(theme/editing/export shell and related changes) not present upstream.
