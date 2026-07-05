/* ═══════════════════════════════════════════════════════════════
   artifact-kit v1 · js (Offprint) — behaviors for the k- layer.
   Delegated events; works with window.ArtifactShell and
   window.Motion both undefined. Master: shell/artifact-kit.js,
   embedded by tools/inject-shell.mjs --kit.
   ═══════════════════════════════════════════════════════════════ */
(() => {
"use strict";
const $ = (s, r = document) => [...r.querySelectorAll(s)];
const fire = (el, n, d) => el.dispatchEvent(new CustomEvent(n, { detail: d, bubbles: true }));
const noMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const closest = (t, s) => t && t.closest ? t.closest(s) : null;
const boards = new WeakMap(), sorters = new WeakMap();

/* FLIP spring — Motion optional, always null-checked */
function flip(scope, mutate, sel = "[data-k-item]") {
  const M = window.Motion;
  if (!M || noMotion()) { mutate(); return; }
  const els = $(sel, scope);
  const pos = new Map(els.map(el => [el, el.getBoundingClientRect()]));
  mutate();
  els.forEach(el => {
    const b = pos.get(el);
    if (!b || !el.isConnected) return;
    const a = el.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
    if (dx || dy) M.animate(el,
      { transform: [`translate(${dx}px,${dy}px)`, "translate(0px,0px)"] },
      { type: M.spring, bounce: .22, visualDuration: .55 });
  });
}

/* ── drag engine (sortable lists, tier rows, kanban columns) ── */
const zone = el => closest(el, "[data-k-sortable],.k-tier-body,.k-col-body");
const groupOf = z => z.closest(".k-board,.k-tiers") || z;
let drag = null;
const clearMarks = () => $(".k-drop-before,.k-over").forEach(x => x.classList.remove("k-drop-before", "k-over"));
function placeRef(z, x, y) {
  const items = [...z.children].filter(it =>
    it.hasAttribute("data-k-item") && !(drag && it === drag.it));
  /* horizontal (wrapping) layout if the first two items share a row */
  const horiz = items.length > 1 &&
    Math.abs(items[0].getBoundingClientRect().top - items[1].getBoundingClientRect().top) < 1;
  for (const it of items) {
    const r = it.getBoundingClientRect();
    if (horiz ? (y < r.top || (y < r.bottom && x < r.left + r.width / 2))
              : y < r.top + r.height / 2) return it;
  }
  return null;
}
function persist(id, order) {
  const s = window.ArtifactShell;
  if (!s || !id) return;
  const st = Object.assign({}, s.state.get());
  st["kit.sortable." + id] = order;
  s.state.set(st);
}
function settle(z) {
  if (z.hasAttribute("data-k-sortable")) {
    const order = $(":scope>[data-k-item]", z).map(x => x.dataset.kItem);
    persist(z.dataset.kId, order);
    const o = sorters.get(z);
    if (o && o.onChange) o.onChange(order);
    fire(z, "k:sort", { order });
  } else if (z.matches(".k-tier-body")) {
    const t = z.closest(".k-tiers"), map = {};
    $(".k-tier", t).forEach(r => { map[r.dataset.kTier] = $("[data-k-item]", r).map(x => x.dataset.kItem); });
    const o = sorters.get(t);
    if (o && o.onChange) o.onChange(map);
    fire(t, "k:tiers", { tiers: map });
  } else if (z.matches(".k-col-body")) kupdate(z.closest(".k-board"));
}
function moveTo(z, ref) {
  flip(groupOf(z), () => z.insertBefore(drag.it, ref));
  settle(z);
}
function prepItem(it) {
  it.draggable = true;
  if (it.tabIndex < 0) it.tabIndex = 0;
}
function sortable(c, opts) {
  sorters.set(c, opts || {});
  const s = window.ArtifactShell;
  const saved = s && c.dataset.kId && (s.state.get() || {})["kit.sortable." + c.dataset.kId];
  if (Array.isArray(saved)) saved.forEach(k => {
    const el = $(":scope>[data-k-item]", c).find(x => x.dataset.kItem === k);
    if (el) c.append(el);
  });
  $(":scope>[data-k-item]", c).forEach(prepItem);
}

const colRef = (b, x) => $(".k-col", b).find(c => c !== drag.col &&
  x < c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2) || null;
document.addEventListener("dragstart", e => {
  const it = closest(e.target, "[data-k-item]"), z = it && zone(it);
  if (!z) {
    const h = closest(e.target, ".k-col-head"), col = h && h.closest(".k-col");
    const b = col && col.closest(".k-board");
    if (!b || !h.draggable) return;
    drag = { col, g: b };
    col.classList.add("k-dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", col.dataset.kCol || "");
    return;
  }
  drag = { it, g: groupOf(z) };
  it.classList.add("k-dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", it.dataset.kItem || "");
});
document.addEventListener("dragend", () => {
  if (drag) (drag.it || drag.col).classList.remove("k-dragging");
  drag = null;
  clearMarks();
});
document.addEventListener("dragover", e => {
  const dz = closest(e.target, "[data-k-drop]");
  if (dz && !drag) { e.preventDefault(); dz.classList.add("is-over"); return; }
  if (drag && drag.col) {
    const b = closest(e.target, ".k-board");
    if (b !== drag.g) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearMarks();
    const ref = colRef(b, e.clientX);
    if (ref) ref.classList.add("k-drop-before");
    return;
  }
  const z = zone(e.target);
  if (!drag || !z || groupOf(z) !== drag.g) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  clearMarks();
  const ref = placeRef(z, e.clientX, e.clientY);
  if (ref) ref.classList.add("k-drop-before"); else z.classList.add("k-over");
});
document.addEventListener("dragleave", e => {
  const dz = closest(e.target, "[data-k-drop]");
  if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove("is-over");
});
document.addEventListener("drop", e => {
  const dz = closest(e.target, "[data-k-drop]");
  if (dz && !drag) {
    e.preventDefault();
    dz.classList.remove("is-over");
    const f = e.dataTransfer && e.dataTransfer.files;
    if (f && f.length) fire(dz, "k:files", { files: f });
    return;
  }
  if (drag && drag.col) {
    const b = closest(e.target, ".k-board");
    if (b !== drag.g) return;
    e.preventDefault();
    const ref = colRef(b, e.clientX), col = drag.col;
    flip(b, () => b.insertBefore(col, ref || b.querySelector(".k-colghost")), ".k-col");
    kupdate(b);
    clearMarks();
    return;
  }
  const z = zone(e.target);
  if (!drag || !z || groupOf(z) !== drag.g) return;
  e.preventDefault();
  moveTo(z, placeRef(z, e.clientX, e.clientY));
  clearMarks();
});

/* ── kanban ── */
function byCol(b) {
  const o = {};
  $(".k-col", b).forEach(c => { o[c.dataset.kCol] = $(".k-kcard", c).map(k => k.dataset.kItem); });
  return o;
}
function kdata(b) {
  const defs = {};
  $(".k-col", b).forEach(c => {
    const l = c.querySelector(".k-col-label");
    defs[c.dataset.kCol] = (l ? l.textContent : c.dataset.kCol || "").trim();
  });
  return { cols: byCol(b), order: $(".k-col", b).map(c => c.dataset.kCol), defs };
}
function kupdate(b) {
  if (!b) return;
  $(".k-col", b).forEach(c => {
    const n = $(".k-kcard", c).length, wip = +c.dataset.kWip || Infinity;
    c.classList.toggle("over-wip", n > wip);
    const cnt = c.querySelector(".k-col-count");
    if (cnt) cnt.textContent = n;
  });
  const o = boards.get(b);
  if (o && o.onChange) o.onChange(kdata(b));
}
function ensureDel(card) {
  if (card.querySelector(".k-kdel")) return;
  const x = document.createElement("button");
  x.className = "k-kdel";
  x.textContent = "×";
  x.setAttribute("aria-label", "Delete card");
  card.append(x);
}
function prepCol(col) {
  const h = col.querySelector(".k-col-head");
  if (!h) return;
  if (!h.querySelector(".k-col-label")) {
    const tn = [...h.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    const l = document.createElement("span");
    l.className = "k-col-label";
    if (tn) { l.textContent = tn.textContent.trim(); tn.replaceWith(l); }
    else { l.textContent = col.dataset.kCol || ""; h.prepend(l); }
  }
  if (!h.querySelector(".k-cdel")) {
    const x = document.createElement("button");
    x.type = "button";
    x.className = "k-cdel";
    x.textContent = "×";
    x.setAttribute("aria-label", "Delete column");
    h.append(x);
  }
  h.draggable = true;
  if (h.tabIndex < 0) h.tabIndex = 0;
}
function prepGhost(b) {
  if (b.querySelector(":scope>.k-colghost")) return;
  const g = document.createElement("div");
  g.className = "k-colghost";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "＋ Add column";
  g.append(btn);
  b.append(g);
}
function colKey(b, name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "col";
  let key = base, i = 2;
  while ($(".k-col", b).some(c => c.dataset.kCol === key)) key = base + "-" + i++;
  return key;
}
function addColumn(b, name, before) {
  const col = document.createElement("div");
  col.className = "k-col";
  col.dataset.kCol = colKey(b, name);
  const h = document.createElement("div");
  h.className = "k-col-head";
  const l = document.createElement("span");
  l.className = "k-col-label";
  l.textContent = name;
  const cnt = document.createElement("span");
  cnt.className = "k-col-count";
  cnt.textContent = "0";
  h.append(l, " ", cnt);
  const body = document.createElement("div");
  body.className = "k-col-body";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "k-col-add";
  add.textContent = "＋ Add card";
  col.append(h, body, add);
  b.insertBefore(col, before || null);
  prepCol(col);
  kupdate(b);
  return col;
}
function ghostInput(g) {
  const btn = g.querySelector("button");
  if (g.querySelector("input")) return;
  const inp = document.createElement("input");
  inp.className = "k-input";
  inp.placeholder = "Column name…";
  btn.hidden = true;
  g.append(inp);
  inp.focus();
  let done = false;
  const close = ok => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    inp.remove();
    btn.hidden = false;
    if (ok && v) addColumn(g.closest(".k-board"), v, g);
  };
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") close(true);
    if (e.key === "Escape") close(false);
  });
  inp.addEventListener("blur", () => close(true));
}
function delColumn(col) {
  const b = col.closest(".k-board");
  const cols = $(".k-col", b), idx = cols.indexOf(col);
  const rest = cols.filter(c => c !== col);
  if (!rest.length) return;
  const cards = $(".k-kcard", col);
  const label = (col.querySelector(".k-col-label") || col).textContent.trim();
  rest[0].querySelector(".k-col-body").append(...cards);
  col.remove();
  kupdate(b);
  const s = window.ArtifactShell;
  if (s && s.toast) s.toast("Deleted column “" + label + "” — cards moved", {
    label: "Undo",
    action() {
      if (!b.isConnected || col.isConnected) return;
      b.insertBefore(col, $(".k-col", b)[idx] || b.querySelector(".k-colghost"));
      col.querySelector(".k-col-body").append(...cards.filter(c => c.isConnected));
      kupdate(b);
    },
  });
}
function renameCol(l) {
  if (l.isContentEditable) return;
  const h = l.closest(".k-col-head"), old = l.textContent;
  if (h) h.draggable = false;
  l.setAttribute("contenteditable", "plaintext-only");
  l.focus();
  try { getSelection().selectAllChildren(l); } catch {}
  const kd = e => {
    if (e.key === "Enter") { e.preventDefault(); l.blur(); }
    if (e.key === "Escape") { e.stopPropagation(); l.textContent = old; l.blur(); }
  };
  l.addEventListener("keydown", kd);
  l.addEventListener("blur", () => {
    l.removeEventListener("keydown", kd);
    l.removeAttribute("contenteditable");
    if (h) h.draggable = true;
    if (!l.textContent.trim()) l.textContent = old;
    kupdate(l.closest(".k-board"));
  }, { once: true });
}
function kanban(b, opts) {
  boards.set(b, opts || {});
  $(".k-kcard", b).forEach(c => { ensureDel(c); prepItem(c); });
  $(".k-col", b).forEach(prepCol);
  prepGhost(b);
  kupdate(b);
  return { update: () => kupdate(b), cards: () => byCol(b), data: () => kdata(b) };
}
function addCard(btn) {
  const col = btn.closest(".k-col"), b = btn.closest(".k-board");
  const inp = document.createElement("input");
  inp.className = "k-input";
  inp.placeholder = "Card title…";
  btn.hidden = true;
  btn.after(inp);
  inp.focus();
  let done = false;
  const close = ok => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    if (ok && v) {
      const c = document.createElement("div");
      c.className = "k-kcard";
      c.dataset.kItem = "c" + Date.now().toString(36);
      c.textContent = v;
      ensureDel(c);
      prepItem(c);
      col.querySelector(".k-col-body").append(c);
      kupdate(b);
    }
    inp.remove();
    btn.hidden = false;
  };
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") close(true);
    if (e.key === "Escape") close(false);
  });
  inp.addEventListener("blur", () => close(true));
}

/* ── widgets ── */
function sortTable(th) {
  const tb = th.closest("table"), col = [...th.parentElement.children].indexOf(th);
  const dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
  $("th[data-k-sort]", tb).forEach(x => x.removeAttribute("aria-sort"));
  th.setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
  const num = th.dataset.type === "num", body = tb.tBodies[0];
  const key = tr => tr.children[col] ? tr.children[col].textContent.trim() : "";
  [...body.rows].sort((a, b) => dir * (num
    ? (parseFloat(key(a).replace(/[^\d.-]/g, "")) || 0) - (parseFloat(key(b).replace(/[^\d.-]/g, "")) || 0)
    : key(a).localeCompare(key(b)))).forEach(tr => body.append(tr));
}
function paintStars(r) {
  const v = +r.dataset.value || 0;
  $("button", r).forEach((s, i) => {
    if (!s.textContent) s.textContent = "★";
    if (!s.getAttribute("aria-label")) s.setAttribute("aria-label", (i + 1) + " stars");
    s.classList.toggle("on", i < v);
    s.setAttribute("aria-pressed", i < v);
  });
}
function syncRange(r) {
  r.style.setProperty("--value", r.value);
  r.style.setProperty("--min", r.min || 0);
  r.style.setProperty("--max", r.max || 100);
}
function wgo(w, i) {
  const steps = $(".k-wiz-steps button", w), panels = $(".k-wiz-panel", w);
  i = Math.max(0, Math.min(steps.length - 1, i));
  steps.forEach((s, j) => {
    s.classList.toggle("done", j < i);
    if (j === i) s.setAttribute("aria-current", "step");
    else s.removeAttribute("aria-current");
  });
  panels.forEach((p, j) => { p.hidden = j !== i; });
  const pv = w.querySelector("[data-k-prev]"), nx = w.querySelector("[data-k-next]");
  if (pv) pv.disabled = i === 0;
  if (nx) nx.disabled = i === steps.length - 1;
  fire(w, "k:step", { step: i });
}
const wcur = w => Math.max(0, $(".k-wiz-steps button", w).findIndex(s => s.getAttribute("aria-current") === "step"));
function roll(list) {
  const items = $(":scope>li", list);
  const done = items.filter(li => li.classList.contains("done")).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const host = list.closest(".k-panel") || list.parentElement;
  const p = host && host.querySelector(".k-progress");
  if (p) { p.style.setProperty("--value", pct); p.setAttribute("aria-valuenow", pct); }
  fire(list, "k:todo", { done, total: items.length, pct });
}
const tagVals = w => $(".k-chip", w).map(c => c.firstChild.textContent.trim());
const emitTags = w => fire(w, "k:tags", { tags: tagVals(w) });
function mkChip(v) {
  const c = document.createElement("span");
  c.className = "k-chip";
  c.append(v);
  const x = document.createElement("button");
  x.className = "k-x";
  x.textContent = "×";
  x.setAttribute("aria-label", "Remove " + v);
  c.append(x);
  return c;
}
function mkTodo(v) {
  const li = document.createElement("li");
  li.innerHTML = '<input type="checkbox" class="k-check"><span class="k-todo-text"></span><button class="k-todo-del" aria-label="Remove">×</button>';
  li.querySelector(".k-todo-text").textContent = v;
  return li;
}

/* ── delegated interactions ── */
document.addEventListener("click", e => {
  const t = e.target;
  const mb = closest(t, "[data-k-menu-for]");
  const open = $(".k-menu.is-open");
  if (mb) {
    const m = document.getElementById(mb.dataset.kMenuFor);
    if (m) {
      const on = !m.classList.contains("is-open");
      open.forEach(x => x.classList.remove("is-open"));
      $("[data-k-menu-for]").forEach(x => x.setAttribute("aria-expanded", "false"));
      m.classList.toggle("is-open", on);
      mb.setAttribute("aria-expanded", on);
    }
    return;
  }
  if (open.length && !closest(t, ".k-menu")) {
    open.forEach(x => x.classList.remove("is-open"));
    $("[data-k-menu-for]").forEach(x => x.setAttribute("aria-expanded", "false"));
  }
  const dOpen = closest(t, "[data-k-dialog-open]");
  if (dOpen) {
    const d = document.getElementById(dOpen.dataset.kDialogOpen);
    if (d && d.showModal) d.showModal();
    return;
  }
  const dClose = closest(t, "[data-k-dialog-close]");
  if (dClose) {
    const d = dClose.closest("dialog");
    if (d) d.close();
    return;
  }
  const del = closest(t, ".k-kdel");
  if (del) {
    const b = del.closest(".k-board");
    del.closest(".k-kcard").remove();
    kupdate(b);
    return;
  }
  const cdel = closest(t, ".k-cdel");
  if (cdel) { delColumn(cdel.closest(".k-col")); return; }
  const gh = closest(t, ".k-colghost");
  if (gh && t.closest("button")) { ghostInput(gh); return; }
  const add = closest(t, ".k-col-add");
  if (add) { addCard(add); return; }
  const star = closest(t, ".k-rating button");
  if (star) {
    const r = star.closest(".k-rating"), i = $("button", r).indexOf(star) + 1;
    r.dataset.value = +r.dataset.value === i ? 0 : i;
    paintStars(r);
    fire(r, "k:rating", { value: +r.dataset.value });
    return;
  }
  const sb = closest(t, ".k-stepper button");
  if (sb) {
    const st = sb.closest(".k-stepper"), inp = st.querySelector("input");
    if (!inp) return;
    const d = sb === $("button", st)[0] ? -1 : 1;
    const step = +inp.step || 1;
    const lo = inp.min === "" ? -Infinity : +inp.min, hi = inp.max === "" ? Infinity : +inp.max;
    inp.value = Math.min(hi, Math.max(lo, (+inp.value || 0) + d * step));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  const x = closest(t, "[data-k-tags] .k-x");
  if (x) {
    const w = x.closest("[data-k-tags]");
    x.closest(".k-chip").remove();
    emitTags(w);
    return;
  }
  const tw = closest(t, "[data-k-tags]");
  if (tw) {
    const i = tw.querySelector("input");
    if (i) i.focus();
  }
  const td = closest(t, ".k-todo-del");
  if (td) {
    const l = td.closest("[data-k-todo]");
    td.closest("li").remove();
    roll(l);
    return;
  }
  const cb = closest(t, "[data-k-collapse]");
  if (cb) {
    const tgt = document.getElementById(cb.dataset.kCollapse);
    if (tgt) {
      tgt.hidden = !tgt.hidden;
      cb.setAttribute("aria-expanded", String(!tgt.hidden));
    }
    return;
  }
  const ws = closest(t, ".k-wiz-steps button");
  if (ws) {
    wgo(ws.closest("[data-k-wizard]"), [...ws.parentElement.children].indexOf(ws));
    return;
  }
  const pv = closest(t, "[data-k-prev]");
  if (pv) {
    const w = pv.closest("[data-k-wizard]");
    if (w) { wgo(w, wcur(w) - 1); return; }
  }
  const nx = closest(t, "[data-k-next]");
  if (nx) {
    const w = nx.closest("[data-k-wizard]");
    if (w) { wgo(w, wcur(w) + 1); return; }
  }
  const th = closest(t, "th[data-k-sort]");
  if (th) sortTable(th);
});

document.addEventListener("change", e => {
  const list = closest(e.target, "[data-k-todo]");
  if (list && e.target.matches("input[type=checkbox]")) {
    e.target.closest("li").classList.toggle("done", e.target.checked);
    roll(list);
  }
});
document.addEventListener("input", e => {
  if (e.target.matches && e.target.matches(".k-range")) syncRange(e.target);
});

document.addEventListener("dblclick", e => {
  const l = closest(e.target, ".k-board .k-col-label");
  if (l) renameCol(l);
});
document.addEventListener("a2:editmode", e => {
  const on = !!(e.detail && e.detail.editing);
  $(".k-board .k-col-label").forEach(l => {
    if (on) l.setAttribute("contenteditable", "plaintext-only");
    else l.removeAttribute("contenteditable");
  });
  $(".k-board .k-col-head").forEach(h => { h.draggable = !on; });
});
document.addEventListener("focusout", e => {
  const t = e.target;
  if (t && t.matches && t.matches(".k-board .k-col-label[contenteditable]"))
    kupdate(closest(t, ".k-board"));
});
document.addEventListener("keydown", e => {
  const t = e.target;
  if (e.key === "Escape") {
    $(".k-menu.is-open").forEach(m => m.classList.remove("is-open"));
    $("[data-k-menu-for]").forEach(x => x.setAttribute("aria-expanded", "false"));
  }
  if (!t || !t.matches) return;
  if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && t.matches(".k-col-head")) {
    const col = t.closest(".k-col"), b = col && col.closest(".k-board");
    if (!b) return;
    e.preventDefault();
    const cols = $(".k-col", b), i = cols.indexOf(col);
    const j = e.key === "ArrowLeft" ? i - 1 : i + 1;
    if (j < 0 || j >= cols.length) return;
    flip(b, () => b.insertBefore(col,
      e.key === "ArrowLeft" ? cols[j] : cols[j].nextSibling), ".k-col");
    kupdate(b);
    t.focus();
    return;
  }
  if ((e.key === "ArrowUp" || e.key === "ArrowDown") && t.matches("[data-k-item]")) {
    const z = zone(t);
    if (!z) return;
    e.preventDefault();
    const sibs = $(":scope>[data-k-item]", z), i = sibs.indexOf(t);
    const j = e.key === "ArrowUp" ? i - 1 : i + 1;
    if (j < 0 || j >= sibs.length) return;
    drag = { it: t, g: groupOf(z) };
    moveTo(z, e.key === "ArrowUp" ? sibs[j] : sibs[j].nextSibling);
    drag = null;
    t.focus();
    return;
  }
  const tw = closest(t, "[data-k-tags]");
  if (tw && t.matches("input")) {
    const v = t.value.trim();
    if ((e.key === "Enter" || e.key === ",") && v) {
      e.preventDefault();
      if (!tagVals(tw).includes(v)) { t.before(mkChip(v)); emitTags(tw); }
      t.value = "";
    } else if (e.key === "Backspace" && !t.value) {
      const last = $(".k-chip", tw).pop();
      if (last) { last.remove(); emitTags(tw); }
    }
    return;
  }
  if (t.matches(".k-todo-add") && e.key === "Enter" && t.value.trim()) {
    const host = t.closest(".k-panel") || t.parentElement;
    const list = host && host.querySelector("[data-k-todo]");
    if (list) { list.append(mkTodo(t.value.trim())); t.value = ""; roll(list); }
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && t.matches("th[data-k-sort]")) {
    e.preventDefault();
    sortTable(t);
  }
});

/* ── tour: spotlight cutout + coach card ── */
function tour(steps, opts) {
  steps = (steps || []).filter(Boolean);
  const api = { end: () => end(true) };
  if (!steps.length) return api;
  const spot = document.createElement("div");
  spot.className = "k-spot";
  const card = document.createElement("div");
  card.className = "k-coach";
  card.tabIndex = -1;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Tour");
  const mk = (tag, cls) => { const el = document.createElement(tag); el.className = cls; return el; };
  const ttl = mk("div", "k-coach-title"), bdy = mk("div", "k-coach-body");
  const dots = mk("div", "k-dots"), nav = mk("div", "k-coach-nav");
  steps.forEach(() => dots.append(document.createElement("i")));
  const btn = (cls, txt) => {
    const b = mk("button", "k-btn sm" + (cls ? " " + cls : ""));
    b.type = "button";
    b.textContent = txt;
    return b;
  };
  const skip = btn("ghost", "Skip"), back = btn("", "Back"), next = btn("primary", "Next");
  const gap = mk("span", "k-gap");
  nav.append(skip, gap, back, next);
  card.append(ttl, bdy, dots, nav);
  document.body.append(spot, card);
  const prev = document.activeElement;
  let i = -1, target = null, live = true;
  const el4 = st => typeof st.target === "string" ? document.querySelector(st.target) : st.target;
  function place() {
    if (!live || !target || !target.isConnected) return;
    const r = target.getBoundingClientRect(), pad = 6;
    spot.style.left = r.left - pad + "px";
    spot.style.top = r.top - pad + "px";
    spot.style.width = r.width + pad * 2 + "px";
    spot.style.height = r.height + pad * 2 + "px";
    const ch = card.offsetHeight, cw = card.offsetWidth;
    const below = r.bottom + pad + 12, above = r.top - pad - 12 - ch;
    const want = (steps[i] || {}).placement;
    let top = want === "top" && above >= 8 ? above : below;
    if (want !== "top" && below + ch > innerHeight - 8 && above >= 8) top = above;
    card.style.top = Math.max(8, Math.min(innerHeight - ch - 8, top)) + "px";
    card.style.left = Math.max(8, Math.min(innerWidth - cw - 8, r.left)) + "px";
  }
  function show(n) {
    while (n < steps.length && !el4(steps[n])) n++;
    if (n >= steps.length) return end(true);
    i = n;
    target = el4(steps[i]);
    const st = steps[i];
    ttl.textContent = st.title || "";
    bdy.textContent = st.body || "";
    [...dots.children].forEach((d, j) => d.classList.toggle("on", j === i));
    back.disabled = i === 0;
    next.textContent = i === steps.length - 1 ? "Done" : "Next";
    try { target.scrollIntoView({ block: "center", behavior: noMotion() ? "auto" : "smooth" }); } catch {}
    place();
    card.focus({ preventScroll: true });
    fire(document, "k:tour", { step: i });
  }
  function end(skipped) {
    if (!live) return;
    live = false;
    removeEventListener("resize", place);
    removeEventListener("scroll", place, true);
    document.removeEventListener("keydown", onKey, true);
    spot.remove();
    card.remove();
    const d = { step: Math.max(0, i) };
    d[skipped ? "skipped" : "done"] = true;
    fire(document, "k:tour", d);
    if (prev && prev.focus) try { prev.focus(); } catch {}
    if (opts && opts.onEnd) opts.onEnd(d);
  }
  const fwd = () => { if (i >= steps.length - 1) end(false); else show(i + 1); };
  const bck = () => { if (i > 0) { const j = i - 1; i = -1; show(j); } };
  skip.addEventListener("click", () => end(true));
  back.addEventListener("click", bck);
  next.addEventListener("click", fwd);
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); end(true); }
    else if (e.key === "ArrowRight") { e.preventDefault(); fwd(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); bck(); }
  }
  document.addEventListener("keydown", onKey, true);
  addEventListener("resize", place);
  addEventListener("scroll", place, true);
  show(0);
  return api;
}

/* ── onboard: one-time welcome dialog, dismissal in shell state ── */
function onboard(cfg) {
  cfg = cfg || {};
  const steps = cfg.steps || [];
  if (!steps.length) return null;
  const s = window.ArtifactShell, key = "kit.onboard." + (cfg.id || "default");
  if (s && (s.state.get() || {})[key]) return null;
  const d = document.createElement("dialog");
  d.className = "k-dialog k-onboard";
  const art = document.createElement("div");
  art.className = "k-onboard-art";
  const body = document.createElement("div");
  body.className = "k-dialog-body";
  const h = document.createElement("h3");
  const p = document.createElement("p");
  const dots = document.createElement("div");
  dots.className = "k-dots";
  steps.forEach(() => dots.append(document.createElement("i")));
  body.append(h, p, dots);
  const foot = document.createElement("div");
  foot.className = "k-dialog-foot k-onboard-foot";
  const row = document.createElement("label");
  row.className = "k-checkrow";
  const chk = document.createElement("input");
  chk.type = "checkbox";
  chk.className = "k-check";
  row.append(chk, "Don’t show again");
  const gap = document.createElement("span");
  gap.className = "k-gap";
  const btn = (cls, txt) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "k-btn sm" + (cls ? " " + cls : "");
    b.textContent = txt;
    return b;
  };
  const skip = btn("ghost", "Skip"), back = btn("", "Back"), next = btn("primary", "Next");
  foot.append(row, gap, skip, back, next);
  d.append(art, body, foot);
  document.body.append(d);
  let i = 0, fin = false;
  const paint = () => {
    const st = steps[i] || {};
    art.textContent = st.art || "";
    art.hidden = !st.art;
    h.textContent = st.title || "";
    p.textContent = st.body || "";
    [...dots.children].forEach((el, j) => el.classList.toggle("on", j === i));
    back.disabled = i === 0;
    next.textContent = i === steps.length - 1 ? "Done" : "Next";
  };
  skip.addEventListener("click", () => d.close());
  back.addEventListener("click", () => { i = Math.max(0, i - 1); paint(); });
  next.addEventListener("click", () => {
    if (i >= steps.length - 1) { fin = true; d.close(); }
    else { i++; paint(); }
  });
  d.addEventListener("close", () => {
    if (s && (fin || chk.checked)) {
      const st = Object.assign({}, s.state.get());
      st[key] = true;
      s.state.set(st);
    }
    d.remove();
    if (fin && cfg.onDone) cfg.onDone();
  });
  paint();
  d.showModal();
  return d;
}

/* ── refresh: (re)prime everything; delegation keeps it idempotent ── */
function refresh(root = document) {
  $("[data-k-sortable]", root).forEach(c => { if (!sorters.has(c)) sortable(c); });
  $(".k-tiers", root).forEach(tr => {
    if (!sorters.has(tr)) sorters.set(tr, {});
    $("[data-k-item]", tr).forEach(prepItem);
  });
  $(".k-board", root).forEach(b => {
    $(".k-kcard", b).forEach(c => { ensureDel(c); prepItem(c); });
    $(".k-col", b).forEach(prepCol);
    prepGhost(b);
    kupdate(b);
  });
  $(".k-rating", root).forEach(paintStars);
  $(".k-range", root).forEach(syncRange);
  $("[data-k-wizard]", root).forEach(w => wgo(w, wcur(w)));
  $("[data-k-todo]", root).forEach(roll);
  $("th[data-k-sort]", root).forEach(th => { if (th.tabIndex < 0) th.tabIndex = 0; });
  $("[data-k-drop]", root).forEach(z => { if (z.tabIndex < 0) z.tabIndex = 0; });
  $("[data-k-collapse]", root).forEach(b => {
    const tgt = document.getElementById(b.dataset.kCollapse);
    if (!tgt) return;
    tgt.classList.add("k-clps");
    b.setAttribute("aria-expanded", String(!tgt.hidden));
    b.setAttribute("aria-controls", tgt.id);
  });
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", () => refresh());
else refresh();

window.ArtifactKit = { version: 1, kanban, refresh, sortable, tour, onboard };
})();
