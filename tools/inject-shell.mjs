#!/usr/bin/env node
// Inject (or re-inject) the artifact shell into standalone HTML files.
//   node tools/inject-shell.mjs [--motion] [--kit] [--no-strip] file.html ...
//   node tools/inject-shell.mjs --manifest        (regenerate shell/manifest.json from index.html)
// Idempotent: existing fenced blocks (any version) are replaced by the
// current master copies in shell/. --motion embeds motion-mini; --kit embeds
// the artifact kit as a second fence. The shell's /*@manifest*/ placeholder is
// substituted with shell/manifest.json at inject time (paths ../-prefixed for
// files in subdirectories). --no-strip embeds readable masters verbatim.
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawCss = readFileSync(join(ROOT, "shell/artifact-shell.css"), "utf8").trim();
const rawJs = readFileSync(join(ROOT, "shell/artifact-shell.js"), "utf8").trim();
const motion = readFileSync(join(ROOT, "shell/motion-mini.min.js"), "utf8").trim();

const args = process.argv.slice(2);

// --manifest: parse index.html gallery cards → shell/manifest.json
if (args.includes("--manifest")) {
  const idx = readFileSync(join(ROOT, "index.html"), "utf8");
  const out = [];
  const secRe = /<section[^>]*data-block="category-[^"]*"[\s\S]*?(?=<section[^>]*data-block="category-|<\/main>|<\/body>)/g;
  for (const sec of idx.match(secRe) || []) {
    const cat = (sec.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || "Misc";
    const cardRe = /<a class="card"[^>]*href="([^"]+)"[\s\S]*?class="title"[^>]*>([\s\S]*?)<\/(?:div|span|h3)>/g;
    let m;
    while ((m = cardRe.exec(sec))) {
      const dec = t => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#?\w+;/g, x => ({"&lt;":"<","&gt;":">","&quot;":'"'}[x] || x)).replace(/\s+/g, " ").trim();
      out.push({ path: m[1], title: dec(m[2]), category: dec(cat) });
    }
  }
  writeFileSync(join(ROOT, "shell/manifest.json"), JSON.stringify(out, null, 1));
  console.log(`manifest: ${out.length} artifacts → shell/manifest.json`);
  process.exit(0);
}
let manifest = [];
try { manifest = JSON.parse(readFileSync(join(ROOT, "shell/manifest.json"), "utf8")); } catch {}
const withMotion = args.includes("--motion");
const withKit = args.includes("--kit");
let kitCss = "", kitJs = "";
if (withKit) {
  kitCss = readFileSync(join(ROOT, "shell/artifact-kit.css"), "utf8").trim();
  kitJs = readFileSync(join(ROOT, "shell/artifact-kit.js"), "utf8").trim();
}
const noStrip = args.includes("--no-strip");
const files = args.filter(a => !a.startsWith("--"));
if (!files.length) {
  console.error("usage: node tools/inject-shell.mjs [--motion] [--no-strip] file.html ...");
  process.exit(1);
}

// conservative strip: block comments + line comments on their own line +
// leading indentation + blank lines. Never touches string contents beyond
// that (shell sources keep comments out of string literals by convention).
function stripCss(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map(l => l.trim()).filter(Boolean).join("\n");
}
function stripJs(s) {
  return s.replace(/^\s*\/\*[\s\S]*?\*\//, "")            // header block comment
    .split("\n")
    .filter(l => !/^\s*\/\/(?!.*['"`])/.test(l) && !/^\s*\/\*.*\*\/\s*$/.test(l))
    .map(l => l.replace(/^\s+/, ""))
    .filter(Boolean).join("\n");
}
const css = noStrip ? rawCss : `/* artifact-shell v3 — stripped; source: shell/artifact-shell.css */\n` + stripCss(rawCss);
const js = noStrip ? rawJs : `/* artifact-shell v3 — stripped; source: shell/artifact-shell.js */\n` + stripJs(rawJs);

const FENCE_START = "<!-- ═══ artifact-shell v3 ═══ -->";
const KIT_START = "<!-- ═══ artifact-kit v1 ═══ -->";
const KIT_END = "<!-- ═══ /artifact-kit ═══ -->";
const KIT_RE = /<!-- ═══ artifact-kit v\d+ ═══ -->[\s\S]*?<!-- ═══ \/artifact-kit ═══ -->\n?/;
const FENCE_END = "<!-- ═══ /artifact-shell ═══ -->";
const FENCE_RE = /<!-- ═══ artifact-shell v\d+ ═══ -->[\s\S]*?<!-- ═══ \/artifact-shell ═══ -->\n?/;

for (const file of files) {
  let html = readFileSync(file, "utf8");
  const slug = basename(file).replace(/\.html?$/, "");

  // manifest, path-adjusted for subdirectory files (relative to repo root)
  const rel = file.replace(/\\/g, "/");
  const depth = (rel.includes("/") && !rel.startsWith("./") ? rel.split("/").length - 1 : 0);
  const inSubdir = /unknowns\//.test(rel);
  const localManifest = manifest.map(a => Object.assign({}, a,
    { path: (inSubdir ? "../" : "") + a.path }));
  const jsWithManifest = js.replace("/*@manifest*/[]",
    JSON.stringify(localManifest));

  html = html.replace(/<html\b([^>]*)>/, (m, attrs) =>
    /data-artifact=/.test(attrs) ? m : `<html${attrs} data-artifact="${slug}">`);

  const block = [
    FENCE_START,
    `<style id="artifact-shell-css">\n${css}\n</style>`,
    `<script id="artifact-shell">\n${jsWithManifest}\n</script>`,
    ...(withMotion
      ? [`<script id="a2-motion">/* motion.dev (motion mini bundle) · MIT · https://motion.dev */\n${motion}\n</script>`]
      : []),
    FENCE_END,
    "",
  ].join("\n");

  const kitBlock = withKit ? [
    KIT_START,
    `<style id="artifact-kit-css">\n${noStrip ? kitCss : stripCss(kitCss)}\n</style>`,
    `<script id="artifact-kit">\n${noStrip ? kitJs : stripJs(kitJs)}\n</script>`,
    KIT_END, "",
  ].join("\n") : null;

  if (FENCE_RE.test(html)) {
    html = html.replace(FENCE_RE, block);
  } else {
    const anchor = html.match(/<meta[^>]*name="viewport"[^>]*>\s*\n?/);
    if (!anchor) { console.error(`SKIP ${file}: no viewport meta found`); continue; }
    const at = anchor.index + anchor[0].length;
    html = html.slice(0, at) + block + html.slice(at);
  }

  if (kitBlock) {
    if (KIT_RE.test(html)) html = html.replace(KIT_RE, kitBlock);
    else html = html.replace(FENCE_RE, m => m + kitBlock);
  }

  writeFileSync(file, html);
  console.log(`injected v3 ${withMotion ? "(+motion) " : ""}${withKit ? "(+kit) " : ""}→ ${file}`);
}
