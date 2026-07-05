/* ═══════════════════════════════════════════════════════════════════
   artifact-shell v3 · js (Offprint)
   Master copy: shell/artifact-shell.js — embedded per-file by
   tools/inject-shell.mjs. Runs from <head>: settings apply before
   first paint; DOM work waits for DOMContentLoaded.
   ═══════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const VERSION = 3;
  /* file manifest — substituted at inject time from shell/manifest.json */
  const ARTIFACTS = /*@manifest*/[];

  const PALETTES = ["claude", "newsprint", "paperback", "swiss", "terminal",
    "brutalist", "glass", "synthwave", "pastel", "notebook", "solarized"];
  const TYPES = {
    editorial:  ["Palatino · system", 'Palatino, "Palatino Linotype", P052, "URW Palladio L", Georgia, ui-serif, serif'],
    paperback:  ["Baskerville · Charter", 'Baskerville, "URW Bookman", "Noto Serif", serif'],
    grotesk:    ["Helvetica · tight", '"Helvetica Neue", Helvetica, "Nimbus Sans", "Liberation Sans", Arial, sans-serif'],
    geometric:  ["Futura · airy", 'Futura, Avenir, "Century Gothic", "URW Gothic", Ubuntu, sans-serif'],
    humanist:   ["Optima · Ubuntu", 'Optima, Candara, Seravek, Ubuntu, "Noto Sans", sans-serif'],
    slab:       ["Rockwell · system", 'Rockwell, "Roboto Slab", "DejaVu Serif", "Nimbus Roman", serif'],
    typewriter: ["Typewriter mono", '"American Typewriter", "Courier Prime", "Nimbus Mono PS", "Courier New", monospace'],
    terminal:   ["Coding mono", 'ui-monospace, "Cascadia Code", "DejaVu Sans Mono", "Liberation Mono", monospace'],
    casual:     ["Handwritten-ish", '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Comic Neue", cursive'],
  };
  const FINISHES = ["soft", "sharp", "pill", "brutal", "hairline", "glow", "sketch"];
  const PRESETS = {
    studio:    { palette: "swiss",     type: "grotesk",    finish: "hairline" },
    claude:    { palette: "claude",    type: "editorial",  finish: "soft"     },
    newsprint: { palette: "newsprint", type: "paperback",  finish: "hairline" },
    paperback: { palette: "paperback", type: "paperback",  finish: "soft"     },
    swiss:     { palette: "swiss",     type: "grotesk",    finish: "sharp"    },
    terminal:  { palette: "terminal",  type: "terminal",   finish: "hairline" },
    brutalist: { palette: "brutalist", type: "grotesk",    finish: "brutal"   },
    glass:     { palette: "glass",     type: "humanist",   finish: "pill"     },
    synthwave: { palette: "synthwave", type: "typewriter", finish: "glow"     },
    pastel:    { palette: "pastel",    type: "casual",     finish: "pill"     },
    notebook:  { palette: "notebook",  type: "casual",     finish: "sketch"   },
    solarized: { palette: "solarized", type: "humanist",   finish: "soft"     },
  };
  const DEFAULTS = { v: 3, palette: "swiss", type: "grotesk", finish: "hairline",
    recipe: "studio", accent: null, mode: "light", density: "cozy", textSize: "m",
    nav: "drawer", customPalette: null };
  const NAVS = ["none", "dock", "topbar", "sidebar", "tabs", "drawer", "dots"];
  const CP_TOKENS = ["bg", "surface", "surface-2", "ink", "ink-muted",
    "accent", "accent-contrast", "line"];

  const root = document.documentElement;
  const slug = root.dataset.artifact ||
    (location.pathname.split("/").pop() || "artifact").replace(/\.html?$/, "");
  const KEY = { settings: "html2:settings", recipes: "html2:recipes",
    hints: "html2:hints", edits: `html2:${slug}:edits`,
    state: `html2:${slug}:state`, blocks: `html2:${slug}:blocks`,
    backup: `html2:${slug}:backup` };

  /* guarded storage with in-memory shadow (locked-down file:// configs) */
  const mem = new Map();
  const store = {
    read(k, fb) {
      try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch {}
      return mem.has(k) ? mem.get(k) : fb;
    },
    write(k, v) { mem.set(k, v); try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    remove(k) { mem.delete(k); try { localStorage.removeItem(k); } catch {} },
  };
  const noMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── settings (applied pre-paint) ── */
  function migrateSettings(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.v === 3) return Object.assign({}, DEFAULTS, raw);
    if (raw.v === 2) {
      const s = Object.assign({}, DEFAULTS, raw, { v: 3, nav: "drawer", customPalette: null });
      /* untouched v2 default → new studio default; deliberate mixes preserved */
      if (raw.palette === "swiss" && raw.type === "grotesk" && raw.finish === "sharp" &&
          !raw.accent && raw.recipe === "swiss") {
        s.finish = "hairline"; s.recipe = "studio";
      }
      return s;
    }
    if (raw.theme) {
      const mix = PRESETS[raw.theme] || PRESETS[DEFAULTS.recipe];
      return Object.assign({}, DEFAULTS, mix, {
        recipe: PRESETS[raw.theme] ? raw.theme : DEFAULTS.recipe,
        mode: raw.mode === "dark" || raw.mode === "light" ? raw.mode : DEFAULTS.mode,
        density: raw.density === "compact" ? "compact" : "cozy",
      });
    }
    return null;
  }
  let settings = migrateSettings(store.read(KEY.settings, null)) || Object.assign({}, DEFAULTS);
  let recipes = store.read(KEY.recipes, {});

  /* settings travel with navigation: on file:// Firefox every page is a
     unique origin, so localStorage never crosses pages — the #o= hash does */
  (function adoptHash() {
    const m = location.hash.match(/^#o=([A-Za-z0-9_-]+)$/);
    if (!m) return;
    try {
      const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, "+").replace(/_/g, "/"))));
      const doc = JSON.parse(json);
      const mig = migrateSettings(doc.s || doc);
      if (mig) { settings = mig; store.write(KEY.settings, settings); }
      if (doc.r && typeof doc.r === "object") {
        recipes = Object.assign({}, recipes, doc.r);
        store.write(KEY.recipes, recipes);
      }
      history.replaceState(null, "", location.pathname + location.search);
    } catch {}
  })();
  function settingsHash() {
    let json = JSON.stringify(Object.keys(recipes).length ? { s: settings, r: recipes } : { s: settings });
    if (json.length > 2048) json = JSON.stringify({ s: settings });
    return "#o=" + btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function carryLinks(node) {
    node.addEventListener("click", e => {
      const a = e.composedPath ? e.composedPath().find(x => x.tagName === "A" && x.href) : e.target.closest?.("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!/\.html?(#.*)?$/.test(href) || /^(https?:|mailto:)/.test(href)) return;
      a.href = href.split("#")[0] + settingsHash();
    }, true);
  }
  carryLinks(document);

  function setAttr(name, value) {
    if (value) root.setAttribute(name, value); else root.removeAttribute(name);
  }
  function applySettings(animate) {
    const run = () => {
      if (settings.customPalette && settings.customPalette.colors) {
        setAttr("data-palette", "custom");
        for (const t of CP_TOKENS)
          root.style.setProperty("--" + t, settings.customPalette.colors[t] || "");
      } else {
        for (const t of CP_TOKENS) root.style.removeProperty("--" + t);
        setAttr("data-palette", settings.palette !== "claude" && settings.palette);
      }
      setAttr("data-nav", settings.nav !== "drawer" && settings.nav);
      setAttr("data-type", settings.type !== "editorial" && settings.type);
      setAttr("data-finish", settings.finish !== "soft" && settings.finish);
      setAttr("data-mode", settings.mode !== "system" && settings.mode);
      setAttr("data-density", settings.density === "compact" && "compact");
      setAttr("data-textsize", settings.textSize !== "m" && settings.textSize);
      root.removeAttribute("data-theme"); /* stale v1 attr */
      if (settings.accent) {
        root.style.setProperty("--user-accent", settings.accent);
        root.setAttribute("data-custom-accent", "");
      } else {
        root.style.removeProperty("--user-accent");
        root.removeAttribute("data-custom-accent");
      }
    };
    if (animate && document.startViewTransition && !noMotion()) {
      const vt = document.startViewTransition(run);
      vt.finished?.catch(() => {});   /* rapid switches skip transitions — not an error */
      vt.ready?.catch(() => {});
    } else run();
  }
  applySettings(false);

  function matchRecipe() {
    const cpSeed = settings.customPalette?.seed || null;
    const same = m => m.palette === settings.palette && m.type === settings.type &&
      m.finish === settings.finish && (m.accent || null) === (settings.accent || null) &&
      (m.customPalette?.seed || null) === cpSeed;
    for (const [n, m] of Object.entries(PRESETS))
      if (!settings.accent && !cpSeed && same(Object.assign({ accent: null }, m))) return n;
    for (const [n, m] of Object.entries(recipes)) if (same(m)) return n;
    return null;
  }
  function setSettings(patch, animate = true) {
    if ("palette" in patch && !("customPalette" in patch)) patch.customPalette = null;
    Object.assign(settings, patch);
    if (!("recipe" in patch) && ("palette" in patch || "type" in patch || "finish" in patch ||
        "accent" in patch || "customPalette" in patch))
      settings.recipe = matchRecipe();
    store.write(KEY.settings, settings);
    applySettings(animate);
    syncPanel();
    renderNav();
  }
  function applyRecipe(name) {
    const mix = PRESETS[name] || recipes[name];
    if (!mix) return;
    setSettings({ palette: mix.palette, type: mix.type, finish: mix.finish,
      accent: mix.accent || null, customPalette: mix.customPalette || null, recipe: name });
  }
  function saveRecipe(name) {
    recipes[name] = { palette: settings.palette, type: settings.type,
      finish: settings.finish, accent: settings.accent || null,
      customPalette: settings.customPalette || null };
    store.write(KEY.recipes, recipes);
    setSettings({ recipe: name });
    renderRecipes();
    toast(`Saved recipe “${name}”`);
  }
  function deleteRecipe(name) {
    const old = recipes[name];
    delete recipes[name];
    store.write(KEY.recipes, recipes);
    renderRecipes();
    toast(`Deleted “${name}”`, { label: "Undo", action() {
      recipes[name] = old; store.write(KEY.recipes, recipes); renderRecipes();
    } });
  }

  /* ── cross-file/tab resync (storage event + focus fallback) ── */
  function resync() {
    const next = migrateSettings(store.read(KEY.settings, null));
    if (next && JSON.stringify(next) !== JSON.stringify(settings)) {
      settings = next; applySettings(false); syncPanel(); renderNav();
    }
    const r = store.read(KEY.recipes, {});
    if (JSON.stringify(r) !== JSON.stringify(recipes)) { recipes = r; renderRecipes(); }
  }
  addEventListener("storage", e => {
    if (!e.key || e.key === KEY.settings || e.key === KEY.recipes) resync();
  });
  addEventListener("focus", resync);
  addEventListener("pageshow", resync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resync(); });

  /* ── toast ── */
  let toastEl, toastTimer, toastAction;
  function toast(msg, opts = {}) {
    if (!toastEl) return;
    toastEl.firstChild.textContent = msg;
    const btn = toastEl.querySelector("button");
    toastAction = opts.action || null;
    btn.hidden = !toastAction;
    btn.textContent = opts.label || "Undo";
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, opts.sticky ? 8000 : 3500);
  }

  /* ── inline editing ── */
  const originals = new Map();
  let edits = store.read(KEY.edits, {});
  function captureOriginals() {
    document.querySelectorAll("[data-edit]").forEach(el => {
      if (!originals.has(el.dataset.edit)) originals.set(el.dataset.edit, el.innerHTML);
    });
  }
  function applyEdits(map) {
    document.querySelectorAll("[data-edit]").forEach(el => {
      const v = map[el.dataset.edit];
      if (v != null) el.textContent = v;
    });
  }
  function persistEdit(el) {
    edits[el.dataset.edit] = el.textContent;
    store.write(KEY.edits, edits);
  }
  function setEditing(on) {
    root.toggleAttribute("data-editing", on);
    document.querySelectorAll("[data-edit]").forEach(el => {
      if (on) {
        el.setAttribute("contenteditable", "plaintext-only");
        if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
      } else el.removeAttribute("contenteditable");
    });
    if (pill) pill.hidden = !on;
    renderHandles(on);
    syncPanel();
    document.dispatchEvent(new CustomEvent("a2:editmode", { detail: { editing: on } }));
  }
  const isEditing = () => root.hasAttribute("data-editing");

  /* E toggles edit mode; one-time hint toast on first hover */
  addEventListener("keydown", e => {
    if (e.key !== "e" && e.key !== "E") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    setEditing(!isEditing());
  });
  function initEditHint() {
    const hints = store.read(KEY.hints, {});
    if (hints.edit) return;
    const fn = e => {
      if (!e.target.closest || !e.target.closest("[data-edit]")) return;
      document.removeEventListener("mouseover", fn);
      hints.edit = true; store.write(KEY.hints, hints);
      toast("This text is editable — press E or use the gear");
    };
    document.addEventListener("mouseover", fn);
  }

  /* ── structural state ── */
  const restoreFns = [];
  const state = {
    get: () => store.read(KEY.state, null),
    set: v => store.write(KEY.state, v),
    clear: () => store.remove(KEY.state),
    onRestore: fn => { restoreFns.push(fn); const v = store.read(KEY.state, null); if (v != null) fn(v); },
  };
  function fireRestore() {
    const v = store.read(KEY.state, null);
    if (v != null) restoreFns.forEach(fn => fn(v));
  }

  /* ── block reorder (data-block, edit mode) ── */
  let blockGroups = [];        // arrays of parents' block elements
  let originalOrder = [];
  const blockOrder = () => [...document.querySelectorAll("[data-block]")].map(el => el.dataset.block);
  function initBlocks() {
    const parents = new Set();
    document.querySelectorAll("[data-block]").forEach(el => parents.add(el.parentElement));
    blockGroups = [...parents]
      .map(p => [...p.children].filter(c => c.matches?.("[data-block]")))
      .filter(g => g.length > 1);
    originalOrder = blockOrder();
    applyBlockOrder(store.read(KEY.blocks, null));
  }
  function applyBlockOrder(order) {
    if (!Array.isArray(order) || !order.length) return;
    blockGroups.forEach(group => {
      const parent = group[0].parentElement;
      const anchor = group[group.length - 1].nextSibling;
      const sorted = [...group].sort((a, b) => {
        const ia = order.indexOf(a.dataset.block), ib = order.indexOf(b.dataset.block);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      });
      sorted.forEach(el => parent.insertBefore(el, anchor));
      group.length = 0; group.push(...sorted);
    });
  }
  function persistBlocks() {
    store.write(KEY.blocks, blockOrder());
    document.dispatchEvent(new CustomEvent("a2:blocks", { detail: { order: blockOrder() } }));
  }
  function moveBlock(el, dir) {
    const sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    if (!sib || !sib.matches("[data-block]")) return;
    flipBlocks(el.parentElement, () => {
      if (dir < 0) el.parentElement.insertBefore(el, sib);
      else el.parentElement.insertBefore(sib, el);
    });
    persistBlocks();
  }
  function flipBlocks(parent, mutate) {
    if (!window.Motion || noMotion()) { mutate(); return; }
    const els = [...parent.children].filter(c => c.matches?.("[data-block]"));
    const before = new Map(els.map(el => [el, el.getBoundingClientRect().top]));
    mutate();
    els.forEach(el => {
      const dy = before.get(el) - el.getBoundingClientRect().top;
      if (dy) window.Motion.animate(el,
        { transform: [`translateY(${dy}px)`, "translateY(0px)"] },
        { type: window.Motion.spring, bounce: 0.22, visualDuration: 0.55 });
    });
  }
  let dragBlock = null;
  function renderHandles(on) {
    document.querySelectorAll(".a2-handle").forEach(h => h.remove());
    document.querySelectorAll("[data-block].a2-blockhost").forEach(el => el.classList.remove("a2-blockhost"));
    if (!on) return;
    blockGroups.forEach(group => group.forEach(el => {
      el.classList.add("a2-blockhost");
      const h = document.createElement("offprint-handle");
      h.className = "a2-handle";
      h.textContent = "⠿";
      h.tabIndex = 0;
      h.setAttribute("role", "button");
      h.draggable = true;
      h.setAttribute("aria-label", `Reorder section ${el.dataset.block} (arrow keys)`);
      h.addEventListener("keydown", e => {
        if (e.key === "ArrowUp") { e.preventDefault(); moveBlock(el, -1); h.focus(); }
        if (e.key === "ArrowDown") { e.preventDefault(); moveBlock(el, 1); h.focus(); }
      });
      h.addEventListener("dragstart", e => {
        dragBlock = el;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", el.dataset.block);
      });
      h.addEventListener("dragend", () => {
        dragBlock = null;
        document.querySelectorAll(".a2-dragover").forEach(x => x.classList.remove("a2-dragover"));
      });
      el.prepend(h);
      el.addEventListener("dragover", blockDragOver);
      el.addEventListener("dragleave", blockDragLeave);
      el.addEventListener("drop", blockDrop);
    }));
  }
  function blockDragOver(e) {
    if (!dragBlock || dragBlock === this || dragBlock.parentElement !== this.parentElement) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    this.classList.add("a2-dragover");
  }
  function blockDragLeave() { this.classList.remove("a2-dragover"); }
  function blockDrop(e) {
    this.classList.remove("a2-dragover");
    if (!dragBlock || dragBlock === this || dragBlock.parentElement !== this.parentElement) return;
    e.preventDefault();
    const target = this, src = dragBlock;
    flipBlocks(target.parentElement, () => {
      const after = [...target.parentElement.children].indexOf(src) <
        [...target.parentElement.children].indexOf(target);
      target.parentElement.insertBefore(src, after ? target.nextSibling : target);
    });
    persistBlocks();
  }

  /* ── export / import ── */
  function exportJSON() {
    const doc = { format: "html2-artifact", version: VERSION, artifact: slug,
      exportedAt: new Date().toISOString(), settings, recipes,
      edits, state: store.read(KEY.state, undefined), blocks: blockOrder() };
    if (doc.state === undefined) delete doc.state;
    if (!Object.keys(recipes).length) delete doc.recipes;
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"),
      { href: URL.createObjectURL(blob), download: `${slug}.edits.json` });
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Exported " + a.download);
  }
  function importJSON(input) {
    const apply = doc => {
      if (!doc || doc.format !== "html2-artifact") return toast("Not an html2 edits file");
      if (doc.version > VERSION) return toast("Edits file is from a newer shell version");
      if (doc.artifact !== slug &&
        !confirm(`This file was exported from “${doc.artifact}”, not “${slug}”. Apply anyway?`)) return;
      store.write(KEY.backup, { edits, state: store.read(KEY.state, null), blocks: blockOrder() });
      edits = doc.edits || {};
      store.write(KEY.edits, edits);
      originals.forEach((html, k) => {
        if (!(k in edits)) {
          const el = document.querySelector(`[data-edit="${CSS.escape(k)}"]`);
          if (el) el.innerHTML = html;
        }
      });
      applyEdits(edits);
      if (doc.state != null) { store.write(KEY.state, doc.state); fireRestore(); }
      if (Array.isArray(doc.blocks)) { applyBlockOrder(doc.blocks); persistBlocks(); }
      if (doc.recipes) { Object.assign(recipes, doc.recipes); store.write(KEY.recipes, recipes); renderRecipes(); }
      if (doc.settings) {
        const m = migrateSettings(doc.settings);
        if (m) setSettings(m);
      }
      toast(doc.artifact !== slug ? `Imported (from ${doc.artifact})` : "Edits imported",
        { label: "Undo", sticky: true, action: undoImport });
    };
    if (typeof input === "object" && !(input instanceof Blob)) return apply(input);
    input.text().then(t => { try { apply(JSON.parse(t)); } catch { toast("Could not parse JSON"); } });
  }
  function undoImport() {
    const b = store.read(KEY.backup, null);
    if (!b) return;
    edits = b.edits || {};
    store.write(KEY.edits, edits);
    originals.forEach((html, k) => {
      const el = document.querySelector(`[data-edit="${CSS.escape(k)}"]`);
      if (el) el.innerHTML = html;
    });
    applyEdits(edits);
    if (b.state != null) { store.write(KEY.state, b.state); fireRestore(); } else state.clear();
    if (Array.isArray(b.blocks)) { applyBlockOrder(b.blocks); persistBlocks(); }
    toast("Import undone");
  }
  function resetAll() {
    edits = {};
    store.remove(KEY.edits);
    state.clear();
    store.remove(KEY.blocks);
    originals.forEach((html, k) => {
      const el = document.querySelector(`[data-edit="${CSS.escape(k)}"]`);
      if (el) el.innerHTML = html;
    });
    applyBlockOrder(originalOrder);
    document.dispatchEvent(new CustomEvent("a2:reset"));
    toast("Edits, layout and state reset (recipe kept)");
  }

  /* ── flatten: bake the current look, edits, layout & state into a
     static, shell-free copy. The proof that the shell is deletable. ── */
  const FLAT_TOKENS = ["bg", "surface", "surface-2", "ink", "ink-muted", "ink-subtle",
    "accent", "accent-strong", "accent-contrast", "tint", "line", "line-strong", "focus",
    "positive", "warning", "negative", "shadow-color", "shadow-1", "shadow-2",
    "font-display", "font-body", "font-mono", "display-weight", "display-track", "lh-body",
    "radius-s", "radius-m", "radius-l", "radius-full", "border-w", "line-style", "space",
    "dur-1", "dur-2", "dur-3", "ease-out", "ease-spring"];
  function flatten() {
    const cs = getComputedStyle(root);
    const mode = cs.colorScheme.includes("dark") && !cs.colorScheme.includes("light")
      ? "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches && settings.mode === "system" ? "dark" : settings.mode === "dark" ? "dark" : "light";
    const vars = FLAT_TOKENS
      .map(t => [t, cs.getPropertyValue("--" + t).trim()])
      .filter(([, v]) => v)
      .map(([t, v]) => `  --${t}: ${v};`).join("\n");
    const staticCss = [
      '<style id="offprint-static">',
      `:root {\n  color-scheme: ${mode};\n${vars}\n}`,
      ":where(body) { background: var(--bg); color: var(--ink); font-family: var(--font-body); line-height: var(--lh-body); }",
      ":where(h1,h2,h3,h4) { font-family: var(--font-display); font-weight: var(--display-weight); letter-spacing: var(--display-track); }",
      ":focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }",
      "@media print { * { box-shadow: none !important; } }",
      "@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }",
      "</style>",
    ].join("\n");
    const st = store.read(KEY.state, null);
    const stub = `<script id="offprint-stub">
const __S = ${JSON.stringify(st)};
window.ArtifactShell = Object.freeze({ version: ${VERSION}, flat: true, slug: ${JSON.stringify(slug)},
  state: { get: () => __S, set: () => {}, clear: () => {}, onRestore: f => { if (__S != null) try { f(__S) } catch (e) {} } },
  toast: () => {}, isEditing: () => false, setEditing: () => {},
  applySettings: () => {}, applyTheme: () => {}, applyRecipe: () => {}, saveRecipe: () => {},
  setAccent: () => {}, randomPalette: () => null, generatePalette: () => null,
  exportJSON: () => {}, importJSON: () => {}, resetAll: () => {},
  readSettings: () => (${JSON.stringify(settings)}),
  recipes: { list: () => ({}), save: () => {}, remove: () => {} },
  blocks: { order: () => [], set: () => {}, reset: () => {} },
  get motion() { return window.Motion ?? null; } });
<\/script>`;

    const doc = root.cloneNode(true);
    doc.querySelectorAll("offprint-ui,offprint-handle,.a2-gear,.a2-panel,.a2-toast,.a2-veil," +
      ".a2-editpill,.a2-handle,.a3-nav,.a3-burger,#artifact-shell-css,#artifact-shell").forEach(el => el.remove());
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
    const dead = [];
    while (walker.nextNode())
      if (/═══ \/?artifact-shell/.test(walker.currentNode.data)) dead.push(walker.currentNode);
    dead.forEach(n => n.remove());
    ["data-palette", "data-type", "data-finish", "data-mode", "data-density", "data-textsize",
      "data-nav", "data-custom-accent", "data-editing", "style"].forEach(a => doc.removeAttribute(a));
    doc.querySelectorAll("[data-edit],[data-block],[data-reveal]").forEach(el => {
      el.removeAttribute("data-edit"); el.removeAttribute("data-block");
      el.removeAttribute("data-reveal"); el.removeAttribute("contenteditable");
      el.style?.removeProperty("--reveal-i");
      if (el.getAttribute("style") === "") el.removeAttribute("style");
    });
    doc.querySelector("body")?.classList.remove("a3-with-sidebar", "a3-with-topbar", "a3-with-tabs");
    doc.querySelector("head")?.insertAdjacentHTML("afterbegin",
      "\n" + staticCss + "\n" + stub + "\n");
    const html = "<!doctype html>\n" + doc.outerHTML;
    const blob = new Blob([html], { type: "text/html" });
    const a = Object.assign(document.createElement("a"),
      { href: URL.createObjectURL(blob), download: `${slug}.flat.html` });
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Flattened → ${a.download} (static, shell-free)`);
  }

  /* ── reveal stagger ── */
  function initReveal() {
    let i = 0;
    document.querySelectorAll("[data-reveal]").forEach(el => {
      el.style.setProperty("--reveal-i", Math.min(i++, 10));
    });
  }

  /* ── random palette (constrained oklch, WCAG-repaired, seed-stable) ── */
  function oklchToLinearSrgb(L, C, H) {
    const hr = H * Math.PI / 180;
    const a = C * Math.cos(hr), b = C * Math.sin(hr);
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    ];
  }
  const inGamut = s => oklchToLinearSrgb(...s).every(c => c >= -0.0005 && c <= 1.0005);
  const relLum = s => {
    const [r, g, b] = oklchToLinearSrgb(...s).map(c => Math.min(1, Math.max(0, c)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const wcag = (a, b) => {
    const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  function mulberry(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function generatePalette(seedNum) {
    const rand = mulberry(seedNum);
    const H = rand() * 360;
    const w = rand();
    let N = H, Cn = 0;
    if (w < 0.30) Cn = 0;
    else if (w < 0.65) { N = H; Cn = 0.008 + rand() * 0.018; }
    else if (w < 0.80) { N = (H + 180) % 360; Cn = 0.006 + rand() * 0.012; }
    else { N = (H + (rand() < 0.5 ? -30 : 30) + 360) % 360; Cn = 0.008 + rand() * 0.018; }

    const bgL = 0.965 + rand() * 0.02, bgC = Cn * (0.5 + 0.5 * rand());
    const bgDL = 0.16 + rand() * 0.05;
    const t = {
      bg: [[bgL, bgC, N], [bgDL, bgC, N]],
      surface: [[Math.min(0.995, bgL + 0.005 + rand() * 0.015), bgC * 0.8, N], [bgDL + 0.035, bgC, N]],
      "surface-2": [[bgL - 0.035 - rand() * 0.01, Math.min(bgC * 1.3, 0.05), N], [bgDL + 0.075, bgC, N]],
      ink: [[0.15 + rand() * 0.09, Math.min(Cn * 1.5, 0.03), N], [0.92 + rand() * 0.03, Math.min(Cn, 0.02), N]],
      "ink-muted": [[0.46 + rand() * 0.08, Math.min(Cn * 2, 0.04), N], [0.62 + rand() * 0.06, Math.min(Cn * 2, 0.05), N]],
      line: [[0.84 + rand() * 0.05, Math.min(Cn, 0.03), N], [0.30 + rand() * 0.04, Math.min(Cn * 1.5, 0.04), N]],
      accent: [[0.48 + rand() * 0.14, 0.13 + rand() * 0.10, H],
               [Math.min(0.9, 0.62 + rand() * 0.14), 0.11 + rand() * 0.10, H]],
    };
    const clip = s => { while (s[1] > 0 && !inGamut(s)) s[1] = Math.max(0, s[1] - 0.01); return s; };
    Object.values(t).forEach(pair => pair.forEach(clip));

    /* deterministic WCAG repair — nudge L, never re-draw */
    for (const m of [0, 1]) {
      const dir = m ? +0.02 : -0.02;   /* dark mode pushes ink lighter, light darker */
      const sub = () => [t.ink[m][0] * 0.82 + t.bg[m][0] * 0.18, t.ink[m][1], N];
      let n = 0;
      while (n++ < 25) {
        let ok = true;
        const push = (tok, d) => {
          t[tok][m][0] = Math.min(0.98, Math.max(0.05, t[tok][m][0] + d));
          clip(t[tok][m]); ok = false;
        };
        if (wcag(t.ink[m], t.bg[m]) < 4.5 || wcag(t.ink[m], t.surface[m]) < 4.5) push("ink", dir);
        if (wcag(sub(), t.bg[m]) < 4.5) push("ink", dir);
        if (wcag(t["ink-muted"][m], t.surface[m]) < 3) push("ink-muted", dir);
        if (wcag(t.accent[m], t.bg[m]) < 3) push("accent", m ? +0.02 : -0.02);
        if (ok) break;
      }
    }
    /* accent text color: lightness cliff, then repair */
    t["accent-contrast"] = [
      t.accent[0][0] < 0.60 ? [...t.bg[0]] : [...t.ink[0]],
      t.accent[1][0] < 0.60 ? [...t.ink[1]] : [...t.bg[1]],
    ];
    for (const m of [0, 1]) {
      let n = 0;
      while (wcag(t["accent-contrast"][m], t.accent[m]) < 3 && n++ < 25) {
        t.accent[m][0] += t["accent-contrast"][m][0] > t.accent[m][0] ? -0.02 : 0.02;
        clip(t.accent[m]);
      }
    }
    const fmt = s => `oklch(${(s[0] * 100).toFixed(1)}% ${s[1].toFixed(3)} ${s[2].toFixed(1)})`;
    const colors = {};
    for (const [k, [lt, dk]] of Object.entries(t)) colors[k] = `light-dark(${fmt(lt)}, ${fmt(dk)})`;
    const ADJ = ["quiet", "late", "paper", "raw", "cold", "warm", "soft", "wild", "dim", "clear", "dry", "deep"];
    const NOUN = ["copper", "harbor", "moss", "plum", "ash", "denim", "clay", "fern", "tide", "ochre", "slate", "rose"];
    const name = ADJ[Math.floor(rand() * ADJ.length)] + " " + NOUN[Math.floor(rand() * NOUN.length)];
    return { name, seed: (seedNum >>> 0).toString(36), colors };
  }
  function randomPalette(seed) {
    const seedNum = seed != null ? parseInt(String(seed), 36) : (Math.random() * 2 ** 31) | 0;
    const cp = generatePalette(seedNum);
    setSettings({ customPalette: cp });
    toast(`Palette “${cp.name}” (#${cp.seed}) — save the mix to keep it`);
    return cp;
  }

  /* ── nav shells ── */
  let navRoot = null, spy = null, lastNav = null;
  function discoverSections() {
    let els = [...document.querySelectorAll("[data-block]")];
    if (!els.length)
      els = [...document.querySelectorAll("h2")].map(h => h.closest("section") || h)
        .filter((el, i, a) => a.indexOf(el) === i);
    return els.map((el, i) => {
      if (!el.id) el.id = "a3-s" + i;
      const h = el.matches("h1,h2,h3") ? el : el.querySelector("h1,h2,h3");
      let label = (h?.textContent || el.dataset.block || "Section " + (i + 1))
        .trim().replace(/\s+/g, " ");
      if (label.length > 40) label = label.slice(0, 37) + "…";
      return { id: el.id, label, el };
    });
  }
  const selfIndex = () => ARTIFACTS.findIndex(a =>
    a.path.split("/").pop() === slug + ".html");
  const homeHref = () => (location.pathname.includes("/unknowns/") ? "../" : "") + "index.html";
  const secLink = s => `<a href="#${s.id}" data-sec="${s.id}">${s.label}</a>`;
  function switcherHTML(cls) {
    const cats = [...new Set(ARTIFACTS.map(a => a.category))];
    const cur = selfIndex();
    return `<select class="${cls}" aria-label="Open another artifact">
      ${cur < 0 ? `<option selected disabled>${document.title.split("—")[0].trim()}</option>` : ""}
      ${cats.map(c => `<optgroup label="${c}">` +
        ARTIFACTS.filter(a => a.category === c).map(a =>
          `<option value="${a.path}"${ARTIFACTS.indexOf(a) === cur ? " selected" : ""}>${a.title}</option>`).join("") +
        `</optgroup>`).join("")}</select>`;
  }
  function setupSpy(map) {
    spy?.disconnect();
    spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      navRoot?.querySelectorAll("[aria-current]").forEach(x => x.removeAttribute("aria-current"));
      map.get(e.target)?.setAttribute("aria-current", "true");
    }), { rootMargin: "-20% 0px -70%" });
    map.forEach((_, el) => spy.observe(el));
  }
  function renderNav(force) {
    if (!document.body || !shadow || (!force && settings.nav === lastNav)) return;
    lastNav = settings.nav;
    spy?.disconnect(); spy = null;
    navRoot?.remove(); navRoot = null;
    shadow.querySelector(".a3-burger")?.remove();
    document.body.classList.remove("a3-with-sidebar", "a3-with-topbar", "a3-with-tabs");
    if (gear) { gear.classList.remove("a2-in-dock"); shadow.append(gear); }
    const kind = settings.nav || "dock";
    if (kind === "none") return;
    const sections = discoverSections();
    const idx = selfIndex();
    const prev = idx > 0 ? ARTIFACTS[idx - 1] : null;
    const next = idx >= 0 && idx < ARTIFACTS.length - 1 ? ARTIFACTS[idx + 1] : null;
    navRoot = document.createElement("nav");
    navRoot.id = "a3-nav";
    navRoot.className = "a3-nav a3-" + kind;
    navRoot.setAttribute("aria-label", "Page navigation");

    if (kind === "dock") {
      navRoot.innerHTML = `
        <a class="a3-ic" href="${homeHref()}" title="Gallery" aria-label="Gallery">⌂</a>
        ${prev ? `<a class="a3-ic" href="${prev.path}" title="${prev.title}" aria-label="Previous: ${prev.title}">‹</a>`
               : `<span class="a3-ic" aria-hidden="true" data-dim>‹</span>`}
        <button class="a3-ic" data-pop aria-expanded="false" aria-label="Sections"${sections.length < 2 ? " data-dim disabled" : ""}>¶</button>
        <div class="a3-pop">${sections.map(secLink).join("")}</div>
        ${next ? `<a class="a3-ic" href="${next.path}" title="${next.title}" aria-label="Next: ${next.title}">›</a>`
               : `<span class="a3-ic" aria-hidden="true" data-dim>›</span>`}`;
      shadow.append(navRoot);
      if (gear) { gear.classList.add("a2-in-dock"); navRoot.append(gear); }
      const pop = navRoot.querySelector(".a3-pop");
      const popBtn = navRoot.querySelector("[data-pop]");
      if (popBtn) {
        popBtn.addEventListener("click", () => {
          const on = !pop.classList.contains("is-open");
          pop.classList.toggle("is-open", on);
          popBtn.setAttribute("aria-expanded", on);
        });
        document.addEventListener("pointerdown", e => {
          if (!e.composedPath().includes(navRoot)) pop?.classList.remove("is-open");
        });
        pop.addEventListener("click", () => pop.classList.remove("is-open"));
      }
    } else if (kind === "topbar") {
      navRoot.innerHTML = `
        <a href="${homeHref()}">Gallery</a><span class="a3-sep">›</span>
        ${switcherHTML("a3-switch")}
        <span class="a3-flex"></span>
        <span class="a3-seclinks">${sections.map(secLink).join("")}</span>`;
      shadow.append(navRoot);
      document.body.classList.add("a3-with-topbar");
    } else if (kind === "sidebar") {
      navRoot.innerHTML = `
        <a class="a3-side-home" href="${homeHref()}">⌂ Gallery</a>
        ${switcherHTML("a3-switch")}
        <div class="a3-side-secs">${sections.map(secLink).join("")}</div>`;
      shadow.append(navRoot);
      document.body.classList.add("a3-with-sidebar");
    } else if (kind === "tabs") {
      navRoot.innerHTML = sections.map(secLink).join("");
      shadow.append(navRoot);
      document.body.classList.add("a3-with-tabs");
    } else if (kind === "drawer") {
      const burger = document.createElement("button");
      burger.className = "a3-burger";
      burger.setAttribute("aria-label", "Menu");
      burger.setAttribute("aria-expanded", "false");
      burger.innerHTML = "☰";
      navRoot.innerHTML = `
        <h3>On this page</h3>
        <div class="a3-drawer-secs">${sections.map(secLink).join("")}</div>
        <h3>All artifacts</h3>
        <div class="a3-drawer-arts">${[...new Set(ARTIFACTS.map(a => a.category))].map(c =>
          `<h4>${c}</h4>` + ARTIFACTS.filter(a => a.category === c).map(a =>
            `<a href="${a.path}"${ARTIFACTS.indexOf(a) === idx ? ' aria-current="true"' : ""}>${a.title}</a>`).join("")
        ).join("")}`;
      shadow.append(burger, navRoot);
      const setOpen = on => {
        navRoot.classList.toggle("is-open", on);
        burger.setAttribute("aria-expanded", on);
        if (on) navRoot.querySelector("a")?.focus();
      };
      burger.addEventListener("click", () => setOpen(!navRoot.classList.contains("is-open")));
      addEventListener("keydown", e => {
        if (e.key === "Escape" && navRoot?.classList.contains("is-open")) { setOpen(false); burger.focus(); }
      });
      document.addEventListener("pointerdown", e => {
        const path = e.composedPath();
        if (navRoot?.classList.contains("is-open") &&
            !path.includes(navRoot) && !path.includes(burger)) setOpen(false);
      });
      navRoot.querySelectorAll(".a3-drawer-secs a").forEach(a =>
        a.addEventListener("click", () => setOpen(false)));
    } else if (kind === "dots") {
      navRoot.innerHTML = sections.map(s =>
        `<a href="#${s.id}" data-sec="${s.id}" aria-label="${s.label}"><i></i><b>${s.label}</b></a>`).join("");
      shadow.append(navRoot);
      if (sections.length < 3) navRoot.hidden = true;
    }

    navRoot.querySelectorAll(".a3-switch").forEach(sel =>
      sel.addEventListener("change", () => { if (sel.value) location.href = sel.value + settingsHash(); }));

    if (["sidebar", "tabs", "dots"].includes(kind)) {
      const map = new Map(sections.map(s =>
        [s.el, navRoot.querySelector(`[data-sec="${s.id}"]`)]).filter(([, l]) => l));
      setupSpy(map);
    }
  }
  document.addEventListener("a2:blocks", () => renderNav(true));

  /* ── settings panel & chrome host ── */
  /* All chrome lives in a shadow root on <offprint-ui>: page CSS (bare
     nav{}/button{}/*-resets) can never restyle it, while design tokens
     still inherit through the host. */
  let ui, shadow, panel, gear, pill, veil;
  const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03z"/></svg>`;
  const hasPopover = "popover" in HTMLElement.prototype;

  function setPanelOpen(on) {
    if (!panel) return;
    panel.classList.toggle("is-open", on);
    if (hasPopover) {
      try { on ? panel.showPopover() : panel.hidePopover(); } catch {}
    }
  }
  const panelOpen = () => panel && panel.classList.contains("is-open");

  function seg(name, values, current) {
    return `<div class="a2-seg" role="radiogroup" aria-label="${name}">` +
      values.map(v => `<label><input type="radio" name="a2-${name}" value="${v}"${v === current ? " checked" : ""}>${v[0].toUpperCase() + v.slice(1)}</label>`).join("") + `</div>`;
  }

  function buildPanel() {
    gear = document.createElement("button");
    gear.className = "a2-gear";
    gear.setAttribute("aria-label", "Style & settings");
    gear.setAttribute("aria-expanded", "false");
    gear.innerHTML = GEAR_SVG;

    panel = document.createElement("div");
    panel.className = "a2-panel";
    panel.id = "a2-panel";
    if (hasPopover) panel.setAttribute("popover", "manual");
    panel.innerHTML = `
      <div class="a2-seg a2-tabs" role="tablist" aria-label="Settings sections">
        ${["recipes", "mix", "options"].map((t, i) =>
          `<label role="presentation"><input type="radio" name="a2-tab" value="${t}"${i === 0 ? " checked" : ""}>${t[0].toUpperCase() + t.slice(1)}</label>`).join("")}
      </div>

      <div class="a2-tabpanel" data-tab="recipes">
        <h3>Presets</h3>
        <div class="a2-tiles" data-tiles="presets" role="radiogroup" aria-label="Preset recipes"></div>
        <h3 data-saved-h hidden>Saved</h3>
        <div class="a2-tiles" data-tiles="saved" role="radiogroup" aria-label="Saved recipes"></div>
        <div class="a2-btnrow">
          <input class="a2-namefield" data-recipe-name placeholder="Name this mix…" hidden>
          <button class="a2-btn" data-act="save-recipe">＋ Save current mix</button>
        </div>
      </div>

      <div class="a2-tabpanel" data-tab="mix" hidden>
        <h3>Palette</h3>
        <div class="a2-swatches" role="radiogroup" aria-label="Color palette">
          ${PALETTES.map(p => `<button class="a2-swatch" role="radio" data-palette="${p}" data-pick-palette="${p}" aria-checked="false" aria-label="${p}" title="${p}"></button>`).join("")}
          <button class="a2-swatch a2-swatch-random" role="radio" data-act="random-palette" aria-checked="false" aria-label="Random palette" title="Random palette — always readable, new roll each click">?</button>
        </div>
        <h3>Type</h3>
        <div class="a2-typerows" role="radiogroup" aria-label="Typography">
          ${Object.entries(TYPES).map(([k, [sub, stack]]) =>
            `<button class="a2-typerow" role="radio" data-pick-type="${k}" aria-checked="false" style="font-family:${stack.replace(/"/g, "&quot;")}">${k[0].toUpperCase() + k.slice(1)}<small>${sub}</small></button>`).join("")}
        </div>
        <h3>Finish</h3>
        <div class="a2-finchips" role="radiogroup" aria-label="Finish">
          ${FINISHES.map(f => `<button class="a2-finchip" role="radio" data-finish="${f}" data-pick-finish="${f}" aria-checked="false">${f}</button>`).join("")}
        </div>
        <h3>Accent</h3>
        <div class="a2-accentrow">
          <input type="color" data-accent aria-label="Custom accent color">
          <button class="a2-btn" data-act="accent-reset">↺ palette accent</button>
        </div>
      </div>

      <div class="a2-tabpanel" data-tab="options" hidden>
        <h3>Navigation</h3>
        <div class="a2-finchips" role="radiogroup" aria-label="Navigation">
          ${NAVS.map(n => `<button class="a2-finchip" role="radio" data-pick-nav="${n}" aria-checked="false">${n}</button>`).join("")}
        </div>
        <h3>Mode</h3>
        ${seg("mode", ["system", "light", "dark"], settings.mode)}
        <h3>Text size</h3>
        ${seg("textsize", ["s", "m", "l", "xl"], settings.textSize)}
        <div class="a2-row">
          <label for="a2-density">Compact density</label>
          <input class="a2-switch" type="checkbox" id="a2-density" role="switch">
        </div>
        <div class="a2-row">
          <label for="a2-edit">Edit mode <small style="color:var(--ink-muted)">(E)</small></label>
          <input class="a2-switch" type="checkbox" id="a2-edit" role="switch">
        </div>
        <div class="a2-btnrow">
          <button class="a2-btn" data-act="export">Export JSON</button>
          <button class="a2-btn" data-act="import">Import</button>
          <button class="a2-btn" data-act="reset">Reset</button>
          <button class="a2-btn" data-act="flatten" title="Download a static copy with the current look, edits and layout baked in — no shell, no settings">⤓ Flatten</button>
        </div>
        <input type="file" accept=".json,application/json" hidden>
        ${location.protocol === "file:" && navigator.userAgent.includes("Firefox")
          ? `<p class="a2-note">Firefox can’t store settings for file:// pages — your choices follow
             the links you click instead. Run <code>tools/serve.sh</code> for full persistence.</p>` : ""}
      </div>`;

    pill = document.createElement("div");
    pill.className = "a2-editpill";
    pill.hidden = true;
    pill.textContent = "editing";

    toastEl = document.createElement("div");
    toastEl.className = "a2-toast";
    toastEl.hidden = true;
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    toastEl.append(document.createTextNode(""), Object.assign(document.createElement("button"), { hidden: true }));
    toastEl.querySelector("button").addEventListener("click", () => {
      toastEl.hidden = true;
      if (toastAction) toastAction();
    });

    veil = document.createElement("div");
    veil.className = "a2-veil";
    veil.hidden = true;
    veil.textContent = "Drop .edits.json to import";

    ui = document.createElement("offprint-ui");
    shadow = ui.attachShadow({ mode: "open" });
    const chromeStyle = document.createElement("style");
    chromeStyle.textContent = document.getElementById("artifact-shell-css")?.textContent || "";
    shadow.append(chromeStyle, gear, panel, pill, toastEl, veil);
    document.body.append(ui);
    carryLinks(shadow);

    /* open/close: one class-driven path; popover only adds top layer */
    gear.addEventListener("click", () => {
      const on = !panelOpen();
      setPanelOpen(on);
      gear.setAttribute("aria-expanded", on);
    });
    addEventListener("keydown", e => {
      if (e.key === "Escape" && panelOpen()) { setPanelOpen(false); gear.focus(); }
    });
    document.addEventListener("pointerdown", e => {
      const path = e.composedPath();
      if (panelOpen() && !path.includes(panel) && !path.includes(gear)) setPanelOpen(false);
    });

    /* tabs */
    panel.querySelectorAll("input[name=a2-tab]").forEach(r =>
      r.addEventListener("change", () => {
        panel.querySelectorAll(".a2-tabpanel").forEach(p =>
          p.hidden = p.dataset.tab !== r.value);
      }));

    /* actions */
    panel.addEventListener("click", e => {
      const pal = e.target.closest("[data-pick-palette]");
      if (pal) return setSettings({ palette: pal.dataset.pickPalette });
      const typ = e.target.closest("[data-pick-type]");
      if (typ) return setSettings({ type: typ.dataset.pickType });
      const fin = e.target.closest("[data-pick-finish]");
      if (fin) return setSettings({ finish: fin.dataset.pickFinish });
      const nv = e.target.closest("[data-pick-nav]");
      if (nv) return setSettings({ nav: nv.dataset.pickNav }, false);
      const del = e.target.closest("[data-del-recipe]");
      if (del) { e.stopPropagation(); return deleteRecipe(del.dataset.delRecipe); }
      const tile = e.target.closest("[data-recipe]");
      if (tile) return applyRecipe(tile.dataset.recipe);
      const act = e.target.closest("[data-act]");
      if (!act) return;
      if (act.dataset.act === "export") exportJSON();
      if (act.dataset.act === "import") panel.querySelector("input[type=file]").click();
      if (act.dataset.act === "reset") resetAll();
      if (act.dataset.act === "accent-reset") setSettings({ accent: null });
      if (act.dataset.act === "random-palette") randomPalette();
      if (act.dataset.act === "flatten") flatten();
      if (act.dataset.act === "save-recipe") {
        const field = panel.querySelector("[data-recipe-name]");
        if (field.hidden) { field.hidden = false; field.focus(); return; }
        const name = field.value.trim();
        if (name) { saveRecipe(name); field.value = ""; field.hidden = true; }
        else field.focus();
      }
    });
    panel.querySelector("[data-recipe-name]").addEventListener("keydown", e => {
      if (e.key === "Enter") panel.querySelector("[data-act=save-recipe]").click();
    });
    panel.querySelector("input[type=file]").addEventListener("change", e => {
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = "";
    });
    panel.querySelectorAll("input[name=a2-mode]").forEach(r =>
      r.addEventListener("change", () => setSettings({ mode: r.value })));
    panel.querySelectorAll("input[name=a2-textsize]").forEach(r =>
      r.addEventListener("change", () => setSettings({ textSize: r.value }, false)));
    panel.querySelector("#a2-density").addEventListener("change", e =>
      setSettings({ density: e.target.checked ? "compact" : "cozy" }, false));
    panel.querySelector("#a2-edit").addEventListener("change", e => setEditing(e.target.checked));
    panel.querySelector("[data-accent]").addEventListener("input", e =>
      setSettings({ accent: e.target.value }, false));

    /* roving tabindex in every radiogroup */
    panel.querySelectorAll("[role=radiogroup]").forEach(group => {
      group.addEventListener("keydown", e => {
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!dir) return;
        const items = [...group.querySelectorAll("[role=radio]")];
        if (!items.length) return;
        e.preventDefault();
        const cur = items.indexOf(document.activeElement);
        const next = items[(cur + dir + items.length) % items.length];
        items.forEach(s => s.tabIndex = -1);
        next.tabIndex = 0;
        next.focus();
        next.click();
      });
    });

    /* edit persistence */
    document.addEventListener("focusout", e => {
      if (isEditing() && e.target.matches?.("[data-edit]")) persistEdit(e.target);
    });

    /* drag-drop import */
    let dragDepth = 0;
    addEventListener("dragenter", e => {
      if (dragBlock) return;   /* internal block drag, not a file */
      if (e.target.closest?.("[data-k-drop]")) return;   /* kit dropzones own their drags */
      if ([...e.dataTransfer?.items || []].some(i => i.kind === "file")) {
        dragDepth++;
        veil.hidden = false;
      }
    });
    addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; veil.hidden = true; } });
    addEventListener("dragover", e => { if (!dragBlock) e.preventDefault(); });
    addEventListener("drop", e => {
      dragDepth = 0;
      veil.hidden = true;
      if (dragBlock) return;
      const f = e.dataTransfer?.files?.[0];
      if (f && /\.json$/i.test(f.name)) { e.preventDefault(); importJSON(f); }
    });

    renderRecipes();
    syncPanel();
  }

  function tileHTML(name, mix, deletable) {
    const stack = (TYPES[mix.type] || TYPES.editorial)[1].replace(/"/g, "&quot;");
    return `<button class="a2-tile" role="radio" aria-checked="false"
      data-recipe="${name}" data-palette="${mix.palette}"
      ${mix.accent ? `style="--accent:${mix.accent}"` : ""}>
      ${deletable ? `<span class="a2-del" data-del-recipe="${name}" role="button" tabindex="0" aria-label="Delete ${name}">×</span>` : ""}
      <span class="a2-tile-name" style="font-family:${stack}">${name}</span>
    </button>`;
  }
  function renderRecipes() {
    if (!panel) return;
    panel.querySelector("[data-tiles=presets]").innerHTML =
      Object.entries(PRESETS).map(([n, m]) => tileHTML(n, m, false)).join("");
    const saved = Object.entries(recipes);
    panel.querySelector("[data-saved-h]").hidden = !saved.length;
    panel.querySelector("[data-tiles=saved]").innerHTML =
      saved.map(([n, m]) => tileHTML(n, m, true)).join("");
    syncPanel();
  }
  function syncPanel() {
    if (!panel) return;
    panel.querySelectorAll("[data-recipe]").forEach(t =>
      t.setAttribute("aria-checked", t.dataset.recipe === settings.recipe));
    panel.querySelectorAll("[data-pick-palette]").forEach(s =>
      s.setAttribute("aria-checked", !settings.customPalette && s.dataset.pickPalette === settings.palette));
    panel.querySelector(".a2-swatch-random")?.setAttribute("aria-checked", !!settings.customPalette);
    panel.querySelectorAll("[data-pick-type]").forEach(s =>
      s.setAttribute("aria-checked", s.dataset.pickType === settings.type));
    panel.querySelectorAll("[data-pick-finish]").forEach(s =>
      s.setAttribute("aria-checked", s.dataset.pickFinish === settings.finish));
    panel.querySelectorAll("[data-pick-nav]").forEach(s =>
      s.setAttribute("aria-checked", s.dataset.pickNav === settings.nav));
    panel.querySelectorAll("input[name=a2-mode]").forEach(r => r.checked = r.value === settings.mode);
    panel.querySelectorAll("input[name=a2-textsize]").forEach(r => r.checked = r.value === settings.textSize);
    panel.querySelector("#a2-density").checked = settings.density === "compact";
    panel.querySelector("#a2-edit").checked = isEditing();
    if (settings.accent) panel.querySelector("[data-accent]").value = settings.accent;
    /* roving tabindex baseline */
    panel.querySelectorAll("[role=radiogroup]").forEach(group => {
      const items = [...group.querySelectorAll("[role=radio]")];
      if (!items.length) return;
      const active = items.find(i => i.getAttribute("aria-checked") === "true") || items[0];
      items.forEach(i => i.tabIndex = i === active ? 0 : -1);
    });
  }

  /* ── boot ── */
  document.addEventListener("DOMContentLoaded", () => {
    captureOriginals();
    applyEdits(edits);
    initBlocks();
    initReveal();
    buildPanel();
    renderNav(true);
    initEditHint();
  });

  window.ArtifactShell = {
    version: VERSION, slug, state, toast,
    exportJSON, importJSON, resetAll, flatten,
    applyRecipe, saveRecipe,
    recipes: { list: () => Object.assign({}, recipes), save: saveRecipe, remove: deleteRecipe },
    blocks: { order: blockOrder, set: o => { applyBlockOrder(o); persistBlocks(); },
      reset: () => { applyBlockOrder(originalOrder); store.remove(KEY.blocks); } },
    setAccent: hex => setSettings({ accent: hex || null }),
    randomPalette, generatePalette,
    applySettings: setSettings,
    /* deprecated v1 alias — routes {theme} through the preset table */
    applyTheme: (patch, animate) => {
      if (patch && patch.theme) applyRecipe(patch.theme);
      const rest = Object.assign({}, patch);
      delete rest.theme;
      if (Object.keys(rest).length) setSettings(rest, animate);
    },
    readSettings: () => Object.assign({}, settings),
    panelOpen: () => panelOpen(),
    setEditing, isEditing,
    get motion() { return window.Motion ?? null; },
  };
})();
