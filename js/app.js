import { COURSES, BY_CODE, TERM_LABELS, LEVELS, offeringsOf, yearOfTerm } from "./courses.js";
import { evaluate, STATUSES } from "./rules.js";
import { ALLOWED_EMAIL_DOMAINS } from "./config.js";
import * as store from "./store.js";

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const dlg = $("#dlg");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const uid = () => "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const MAX_ROWS = 6;
const THICK_ROWS = 3;

const ICONS = {
  lock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
};

const state = {
  user: null,
  plan: store.emptyPlan(),
  mates: [],
  view: "plan",
  year: Number(sessionGet("es-year")) || 1,
  scope: "all",
  picker: null,
  pickerQuery: "",
  mateTerm: "advanced",
  mateMode: "course",
  mateQuery: "",
  saveState: "",
};

function sessionGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignorera */ } }

// ---------- Start och inloggning ----------

async function start() {
  $("#demo-banner").hidden = !store.DEMO;
  try {
    state.user = await store.getUser();
  } catch (e) {
    return showError(e);
  }
  await store.onAuthChange(async (user) => {
    const changed = (user?.id || null) !== (state.user?.id || null);
    state.user = user;
    if (changed) await afterLogin();
  });
  await afterLogin();
}

async function afterLogin() {
  renderUser();
  if (!state.user) {
    $("#tabs").hidden = true;
    return renderLogin();
  }
  $("#tabs").hidden = false;
  try {
    [state.plan, state.mates] = await Promise.all([store.loadMyPlan(state.user), store.loadClassmates(state.user)]);
  } catch (e) {
    return showError(e);
  }
  render();
}

function showError(e) {
  console.error(e);
  app.innerHTML = `<div class="card msg err">Något gick fel: ${esc(e.message || e)}</div>`;
}

function renderUser() {
  const el = $("#user");
  if (!state.user || store.DEMO) { el.innerHTML = ""; return; }
  el.innerHTML = `<span class="muted hide-sm">${esc(state.user.email)}</span> <button class="btn small" id="logout">Logga ut</button>`;
  $("#logout").onclick = async () => { await store.signOut(); state.user = null; afterLogin(); };
}

function renderLogin(message = "") {
  app.innerHTML = `
    <div class="card login">
      <img src="assets/es-logo.png" alt="" class="login-logo">
      <h1>Logga in</h1>
      <p class="muted">Ange din studentadress så skickar vi en inloggningslänk. Du behöver inget lösenord.</p>
      <form id="login-form">
        <label class="field">E-post
          <input type="email" name="email" required autocomplete="email" placeholder="fornamn.efternamn.1234@student.uu.se">
        </label>
        <button class="btn primary" type="submit">Skicka inloggningslänk</button>
        ${message}
      </form>
    </div>`;
  $("#login-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const email = new FormData(ev.target).get("email").trim().toLowerCase();
    const domain = email.split("@")[1] || "";
    if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      return renderLogin(`<div class="msg err">Använd din studentadress (${ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(" eller ")}).</div>`);
    }
    try {
      await store.sendLoginLink(email);
      renderLogin(`<div class="msg ok">Kolla din mejl! Klicka på länken för att logga in.</div>`);
    } catch (e) {
      renderLogin(`<div class="msg err">${esc(e.message)}</div>`);
    }
  };
}

// ---------- Sparande ----------

let saveTimer = null;
function changed() {
  state.saveState = "Sparar…";
  updateSaveState();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await store.saveMyPlan(state.user, state.plan);
      state.saveState = store.DEMO ? "Sparat i webbläsaren" : "Sparat";
    } catch (e) {
      state.saveState = "Kunde inte spara: " + e.message;
    }
    updateSaveState();
  }, 600);
}
function updateSaveState() {
  const el = $("#save-state");
  if (el) el.textContent = state.saveState;
}

// ---------- Hjälpfunktioner för planen ----------

const itemCourse = (it) => (it.code ? BY_CODE[it.code] : null);
const itemName = (it) => itemCourse(it)?.name ?? it.custom?.name ?? "Okänd kurs";
const itemHp = (it) => itemCourse(it)?.hp ?? (Number(it.custom?.hp) || 0);
const rowsOf = (y) => state.plan.rows[y] ?? 3;
const yearItems = (y) => state.plan.items.filter((it) => it.year === y);
const yearHp = (y) => yearItems(y).reduce((s, it) => s + itemHp(it), 0);
const thickRowsOf = (y) => Math.min(THICK_ROWS, rowsOf(y));

function cellsOf(it) {
  const rows = it.thick ? [...Array(thickRowsOf(it.year)).keys()] : [it.row];
  const cells = [];
  for (const r of rows) for (let p = it.period; p < it.period + it.span; p++) cells.push(`${r}:${p}`);
  return cells;
}

function occupied(y, ignoreId) {
  const map = new Map();
  for (const it of yearItems(y)) if (it.id !== ignoreId) for (const c of cellsOf(it)) map.set(c, it);
  return map;
}

// Returnerar ett felmeddelande eller null om kursen får plats.
function placementError(y, period, row, span, thick) {
  if (period + span - 1 > 4) return `Kursen går över ${span} perioder och får inte plats från period ${period}.`;
  const occ = occupied(y);
  const rows = thick ? [...Array(thickRowsOf(y)).keys()] : [row];
  for (const r of rows) for (let p = period; p < period + span; p++) {
    const other = occ.get(`${r}:${p}`);
    if (other) return `Platsen är upptagen av ${itemName(other)} (period ${p}).`;
  }
  return null;
}

function placedWhere(code) {
  return state.plan.items.find((it) => it.code === code);
}

function matesFor(code) {
  return state.mates
    .map((m) => ({ m, it: m.items.find((x) => x.code === code) }))
    .filter((x) => x.it);
}

// ---------- Huvudrendering ----------

function render() {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  if (state.view === "plan") renderPlan();
  else renderMates();
}

$("#tabs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-view]");
  if (!b) return;
  state.view = b.dataset.view;
  render();
});

// ---------- Min plan ----------

function renderPlan() {
  const y = state.year;
  app.innerHTML = `
    <div class="plan-layout">
      <div class="stack">
        <div class="card profile">
          <label class="field">Namn (syns för klasskompisar)
            <input id="p-name" value="${esc(state.plan.name)}" maxlength="80" placeholder="För- och efternamn">
          </label>
          <label class="field">Startår
            <input id="p-year" type="number" min="2010" max="2040" value="${esc(state.plan.start_year ?? "")}" placeholder="t.ex. 2022">
          </label>
          <label class="check"><input id="p-visible" type="checkbox" ${state.plan.visible ? "checked" : ""}> Visa mina kurser för klasskompisar</label>
        </div>

        <nav class="year-tabs" aria-label="Välj år">
          ${[1, 2, 3, 4, 5].map((n) => `
            <button data-year="${n}" class="${n === y ? "active" : ""}" aria-current="${n === y}">
              <span>År ${n}</span><small>${yearHp(n)} hp</small>
            </button>`).join("")}
        </nav>

        <section class="card year-card" id="year-card">${yearCard(y)}</section>
      </div>
      <aside class="sidebar card" id="reqs"></aside>
    </div>`;

  renderReqs();
  bindPlan();
}

function yearCard(y) {
  const rows = rowsOf(y);
  const items = yearItems(y);
  const occ = occupied(y);
  const ht = 2 * y - 1, vt = 2 * y;

  let cells = "";
  for (let r = 0; r < rows; r++) {
    for (let p = 1; p <= 4; p++) {
      const taken = occ.has(`${r}:${p}`);
      cells += taken
        ? `<div class="slot taken" style="grid-row:${r + 1};grid-column:${p}"></div>`
        : `<button class="slot" style="grid-row:${r + 1};grid-column:${p}" data-slot="${r}:${p}" aria-label="Lägg till kurs i period ${p}, rad ${r + 1}">${ICONS.plus}</button>`;
    }
    const lockedByThick = items.some((it) => it.thick) && r < THICK_ROWS && rows <= THICK_ROWS;
    cells += `<button class="row-del" style="grid-row:${r + 1};grid-column:5" data-del-row="${r}" ${rows <= 1 || lockedByThick ? "disabled" : ""} title="Ta bort rad" aria-label="Ta bort rad ${r + 1}">${ICONS.trash}</button>`;
  }

  const pills = items.map((it) => {
    const c = itemCourse(it);
    const rowSpan = it.thick ? thickRowsOf(y) : 1;
    const icon = it.status === "done" ? ICONS.lock : it.status === "ongoing" ? ICONS.clock : "";
    const name = itemName(it);
    return `
      <button class="pill ${it.status} ${it.thick ? "thick" : ""}" data-item="${esc(it.id)}"
        style="grid-row:${(it.thick ? 0 : it.row) + 1} / span ${rowSpan};grid-column:${it.period} / span ${it.span}"
        title="${esc(name)} – ${STATUSES[it.status]}">
        ${icon}<span class="pill-name">${esc(name)}</span><span class="hp">${itemHp(it)} hp</span>
        ${!c ? `<span class="sr-only">(egen kurs)</span>` : ""}
      </button>`;
  }).join("");

  return `
    <header class="year-head">
      <h2>År ${y}</h2>
      <span class="year-hp">${yearHp(y)} hp</span>
    </header>
    <div class="grid-scroll">
      <div class="ygrid-wrap">
        <div class="terms">
          <span style="grid-column:1 / span 2">HT · termin ${ht}</span>
          <span style="grid-column:3 / span 2">VT · termin ${vt}</span>
        </div>
        <div class="periods">${[1, 2, 3, 4].map((p) => `<span>Period ${p}</span>`).join("")}</div>
        <div class="ygrid" style="grid-template-rows:repeat(${rows}, var(--row-h))">${cells}${pills}</div>
      </div>
    </div>
    <div class="year-actions">
      <button class="btn small" id="add-row" ${rows >= MAX_ROWS ? "disabled" : ""}>${ICONS.plus} Lägg till rad (utökad studietakt)</button>
      <span class="spacer"></span>
      <button class="btn small ghost" id="fill-year">Fyll i obligatoriska kurser</button>
      ${items.length ? `<button class="btn small ghost" id="done-year">Markera året som klart</button>
      <button class="btn small ghost danger" id="clear-year">Töm året</button>` : ""}
    </div>
    ${items.length ? "" : `<p class="muted small empty-hint">Klicka på en tom ruta för att välja kurs för den perioden.</p>`}`;
}

function bindPlan() {
  $("#p-name").oninput = (e) => { state.plan.name = e.target.value; changed(); };
  $("#p-year").oninput = (e) => { state.plan.start_year = e.target.value ? Number(e.target.value) : null; changed(); };
  $("#p-visible").onchange = (e) => { state.plan.visible = e.target.checked; changed(); };

  app.onclick = (ev) => {
    const t = ev.target;
    const yb = t.closest("[data-year]");
    if (yb) { state.year = Number(yb.dataset.year); sessionSet("es-year", state.year); return renderPlan(); }

    const slot = t.closest("[data-slot]");
    if (slot) {
      const [row, period] = slot.dataset.slot.split(":").map(Number);
      return openPicker({ year: state.year, period, row });
    }
    const pill = t.closest("[data-item]");
    if (pill) return openItem(pill.dataset.item);

    const del = t.closest("[data-del-row]");
    if (del && !del.disabled) return deleteRow(state.year, Number(del.dataset.delRow));

    if (t.closest("#add-row")) {
      state.plan.rows[state.year] = Math.min(MAX_ROWS, rowsOf(state.year) + 1);
      changed();
      return renderPlan();
    }
    if (t.closest("#fill-year")) { fillMandatory(state.year); return; }
    if (t.closest("#done-year")) {
      yearItems(state.year).forEach((it) => (it.status = "done"));
      changed();
      return renderPlan();
    }
    if (t.closest("#clear-year")) {
      if (!confirm(`Ta bort alla kurser i år ${state.year}?`)) return;
      state.plan.items = state.plan.items.filter((it) => it.year !== state.year);
      state.plan.rows[state.year] = 3;
      changed();
      return renderPlan();
    }
  };
}

function deleteRow(y, r) {
  const victims = yearItems(y).filter((it) => !it.thick && it.row === r);
  if (victims.length && !confirm(`Raden innehåller ${victims.map(itemName).join(", ")}. Ta bort raden och kurserna?`)) return;
  state.plan.items = state.plan.items.filter((it) => !victims.includes(it));
  for (const it of yearItems(y)) if (!it.thick && it.row > r) it.row--;
  state.plan.rows[y] = rowsOf(y) - 1;
  changed();
  renderPlan();
}

function addItem(y, period, row, fields) {
  const it = { id: uid(), year: y, period, row: fields.thick ? 0 : row, status: "planned", ...fields };
  state.plan.items.push(it);
  changed();
  return it;
}

// Lägger in årets obligatoriska kurser på första lediga plats.
function fillMandatory(y) {
  const groupsTaken = new Set(state.plan.items.map((it) => BY_CODE[it.code]?.oneOf).filter(Boolean));
  const list = [];
  for (const c of COURSES) {
    if (c.type !== "obl" || yearOfTerm(c.term) !== y || placedWhere(c.code)) continue;
    if (c.oneOf) {
      if (groupsTaken.has(c.oneOf)) continue;
      groupsTaken.add(c.oneOf);
    }
    const off = offeringsOf(c).find((o) => o.year === y);
    list.push({ c, period: off.periods[0], span: off.periods.length });
  }
  list.sort((a, b) => (b.c.thick ? 1 : 0) - (a.c.thick ? 1 : 0) || a.period - b.period || b.span - a.span);

  const skipped = [];
  for (const { c, period, span } of list) {
    if (c.thick) {
      if (placementError(y, period, 0, span, true)) skipped.push(c.name);
      else addItem(y, period, 0, { code: c.code, span, thick: true });
      continue;
    }
    let row = [...Array(rowsOf(y)).keys()].find((r) => !placementError(y, period, r, span, false));
    if (row === undefined) {
      if (rowsOf(y) >= MAX_ROWS) { skipped.push(c.name); continue; }
      state.plan.rows[y] = rowsOf(y) + 1;
      row = rowsOf(y) - 1;
    }
    addItem(y, period, row, { code: c.code, span, thick: false });
  }
  renderPlan();
  if (skipped.length) alert(`Fick inte plats med: ${skipped.join(", ")}. Flytta eller ta bort kurser och försök igen.`);
}

// ---------- Kursväljare ----------

function openPicker(ctx) {
  state.picker = ctx;
  state.pickerQuery = "";
  renderPicker();
  if (!dlg.open) dlg.showModal();
  $("#pick-q")?.focus();
}

function pickEntry(c, offering, ctx) {
  const placed = placedWhere(c.code);
  const groupTaken = c.oneOf && state.plan.items.find((it) => BY_CODE[it.code]?.oneOf === c.oneOf);
  const span = offering?.periods?.length ?? 1;
  const err = placed ? `Redan inlagd i år ${placed.year}` : groupTaken ? `Du har redan ${itemName(groupTaken)}` : placementError(ctx.year, ctx.period, ctx.row, span, !!c.thick);
  const mates = matesFor(c.code).length;
  const where = offering?.periods
    ? `${offering.year ? `År ${offering.year}` : "Tillval"}, period ${offering.periods.join("–")}`
    : c.term === "S" ? "Sommar" : "Valfri period";
  return `
    <button class="pick" data-pick="${esc(c.code)}" data-span="${span}" ${err ? "disabled" : ""}>
      <span class="pick-main">
        <span class="pick-name">${esc(c.name)}</span>
        <span class="course-meta">
          <span>${esc(c.code)}${c.uni === "SLU" ? " · SLU" : ""}</span><span>${c.hp} hp</span>
          <span class="tag ${c.level.startsWith("A") ? "adv" : ""}">${c.level}</span>
          ${c.type === "obl" ? `<span class="tag obl">Obligatorisk</span>` : ""}
          ${c.type === "ts" ? `<span class="tag ts">Teknik och system</span>` : ""}
          <span>${where}</span>
          ${c.thick ? `<span class="tag">Tar alla tre rader</span>` : ""}
          ${mates ? `<span class="tag mates">${mates} klasskompis${mates > 1 ? "ar" : ""}</span>` : ""}
        </span>
        ${err ? `<span class="pick-err">${esc(err)}</span>` : ""}
      </span>
    </button>`;
}

function renderPicker() {
  const ctx = state.picker;
  const q = state.pickerQuery.trim().toLowerCase();
  let sections;

  if (q) {
    const hits = COURSES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    sections = [["Sökresultat", hits.map((c) => {
      const offs = offeringsOf(c);
      return [c, offs.find((o) => o.year === ctx.year && o.periods?.[0] === ctx.period) || offs[0]];
    })]];
  } else {
    const thisYear = [], other = [], free = [];
    for (const c of COURSES) {
      for (const o of offeringsOf(c)) {
        if (!o.periods) { free.push([c, o]); break; }
        if (o.periods[0] !== ctx.period) continue;
        (o.year === ctx.year ? thisYear : other).push([c, o]);
        break;
      }
    }
    sections = [
      [`Studieplanen år ${ctx.year}, period ${ctx.period}`, thisYear],
      [`Andra kurser som börjar i period ${ctx.period}`, other],
      ["Valfri period och sommar", free],
    ];
  }

  const body = sections
    .filter(([, list]) => list.length)
    .map(([title, list]) => `<h3 class="pick-h">${esc(title)}</h3>${list.map(([c, o]) => pickEntry(c, o, ctx)).join("")}`)
    .join("") || `<p class="muted">Inga kurser matchar.</p>`;

  dlg.innerHTML = `
    <div class="dlg-head">
      <div>
        <h2>Välj kurs</h2>
        <p class="muted small">År ${ctx.year} · period ${ctx.period} · rad ${ctx.row + 1}</p>
      </div>
      <button class="icon-btn" data-close aria-label="Stäng">✕</button>
    </div>
    <input type="search" id="pick-q" placeholder="Sök bland alla kurser" value="${esc(state.pickerQuery)}">
    <div class="pick-list">${body}</div>
    <details class="custom-box">
      <summary>Lägg till egen kurs (utbyte, fristående kurs …)</summary>
      <form id="custom-form" class="custom-form">
        <label class="field wide">Kursnamn<input name="name" required></label>
        <label class="field">Kurskod<input name="code" placeholder="valfritt"></label>
        <label class="field">hp<input name="hp" type="number" min="0.5" step="0.5" required value="5"></label>
        <label class="field">Nivå<select name="level">${LEVELS.map((l) => `<option ${l === "A1N" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field">Perioder<select name="span">${[1, 2, 3, 4].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label>
        <label class="check"><input type="checkbox" name="teknik" checked> Huvudområde teknik</label>
        <label class="check"><input type="checkbox" name="thick"> Tjock (tar tre rader)</label>
        <p class="pick-err" id="custom-err"></p>
        <button class="btn primary" type="submit">Lägg till</button>
      </form>
    </details>`;

  const qi = $("#pick-q");
  qi.oninput = () => {
    state.pickerQuery = qi.value;
    const pos = qi.selectionStart;
    renderPicker();
    const n = $("#pick-q");
    n.focus();
    n.setSelectionRange(pos, pos);
  };

  $("#custom-form").onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const span = Number(f.get("span"));
    const thick = f.get("thick") === "on";
    const err = placementError(ctx.year, ctx.period, ctx.row, span, thick);
    if (err) { $("#custom-err").textContent = err; return; }
    addItem(ctx.year, ctx.period, ctx.row, {
      span, thick,
      custom: { name: f.get("name").trim(), code: f.get("code").trim(), hp: Number(f.get("hp")), level: f.get("level"), teknik: f.get("teknik") === "on" },
    });
    dlg.close();
    renderPlan();
  };
}

dlg.addEventListener("click", (ev) => {
  if (ev.target === dlg || ev.target.closest("[data-close]")) return dlg.close();
  const pick = ev.target.closest("[data-pick]");
  if (pick && !pick.disabled && state.picker) {
    const c = BY_CODE[pick.dataset.pick];
    const { year, period, row } = state.picker;
    addItem(year, period, row, { code: c.code, span: Number(pick.dataset.span), thick: !!c.thick });
    dlg.close();
    renderPlan();
    return;
  }
  const st = ev.target.closest("[data-set-status]");
  if (st) {
    const it = state.plan.items.find((x) => x.id === st.dataset.id);
    it.status = st.dataset.setStatus;
    changed();
    renderPlan();
    return openItem(it.id);
  }
  const rm = ev.target.closest("[data-remove]");
  if (rm) {
    state.plan.items = state.plan.items.filter((x) => x.id !== rm.dataset.remove);
    changed();
    dlg.close();
    renderPlan();
  }
});
dlg.addEventListener("close", () => { state.picker = null; });

// ---------- Kursdetaljer ----------

function openItem(id) {
  const it = state.plan.items.find((x) => x.id === id);
  if (!it) return;
  state.picker = null;
  const c = itemCourse(it);
  const x = it.custom || {};
  const mates = c ? matesFor(c.code) : [];
  const periods = Array.from({ length: it.span }, (_, i) => it.period + i).join("–");
  dlg.innerHTML = `
    <div class="dlg-head">
      <div>
        <h2>${esc(itemName(it))}</h2>
        <p class="muted small">År ${it.year} · period ${periods}${it.thick ? " · tar alla tre rader" : ""}</p>
      </div>
      <button class="icon-btn" data-close aria-label="Stäng">✕</button>
    </div>
    <div class="course-meta">
      ${c ? `<span>${esc(c.code)}${c.uni === "SLU" ? " · SLU" : ""}</span><span>${c.hp} hp</span><span class="tag ${c.level.startsWith("A") ? "adv" : ""}">${c.level}</span>
        ${c.teknik ? `<span class="tag">Teknik</span>` : ""}${c.type === "obl" ? `<span class="tag obl">Obligatorisk</span>` : ""}${c.type === "ts" ? `<span class="tag ts">Teknik och system</span>` : ""}`
      : `${x.code ? `<span>${esc(x.code)}</span>` : ""}<span>${Number(x.hp) || 0} hp</span><span class="tag">${esc(x.level)}</span>${x.teknik ? `<span class="tag">Teknik</span>` : ""}<span class="tag">Utanför studieplanen</span>`}
    </div>
    ${c?.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
    <h3 class="pick-h">Status</h3>
    <div class="seg" role="group" aria-label="Status">
      ${Object.entries(STATUSES).reverse().map(([k, l]) => `<button data-set-status="${k}" data-id="${esc(it.id)}" data-status="${k}" class="${it.status === k ? "on" : ""}" aria-pressed="${it.status === k}">${l}</button>`).join("")}
    </div>
    ${c ? `<h3 class="pick-h">Klasskompisar som läser kursen</h3>
      ${mates.length ? `<div class="people">${mates.map(({ m, it: mi }) => personChip(m, mi.status)).join("")}</div>` : `<p class="muted small">Ingen ännu.</p>`}` : ""}
    <div class="dlg-foot">
      <button class="btn danger" data-remove="${esc(it.id)}">Ta bort från planen</button>
      <button class="btn" data-close>Klar</button>
    </div>`;
  if (!dlg.open) dlg.showModal();
}

// ---------- Examenskrav ----------

function renderReqs() {
  const all = evaluate(state.plan, ["done", "ongoing", "planned"]);
  const done = evaluate(state.plan, ["done"]);
  const shown = state.scope === "done" ? done : all;
  const left = shown.checks.filter((c) => !c.ok).length;

  const rows = shown.checks.map((ch, i) => {
    const pctPlan = Math.min(100, (all.checks[i].value / ch.target) * 100);
    const pctDone = Math.min(100, (done.checks[i].value / ch.target) * 100);
    const value = ch.id === "mandatory" ? (ch.ok ? "Klart" : `${ch.missing.length} saknas`) : `${ch.value} / ${ch.target} ${ch.unit}`;
    return `
      <div class="req ${ch.ok ? "ok" : "bad"}">
        <div class="req-head">
          <span class="req-icon">${ch.ok ? "✓" : "✗"}</span>
          <span class="req-label">${esc(ch.label)}</span>
          <span class="req-value">${value}</span>
        </div>
        ${ch.id !== "mandatory" ? `<div class="bar"><i class="plan" style="width:${pctPlan}%"></i><i class="done" style="width:${pctDone}%"></i></div>` : ""}
        ${ch.detail && (!ch.ok || ch.id === "ts") ? `<div class="req-detail">${esc(ch.detail)}</div>` : ""}
      </div>`;
  }).join("");

  $("#reqs").innerHTML = `
    <h2>Examenskrav</h2>
    <div class="scope">
      <button class="btn small ${state.scope === "all" ? "primary" : ""}" data-scope="all">Hela planen</button>
      <button class="btn small ${state.scope === "done" ? "primary" : ""}" data-scope="done">Bara klara kurser</button>
    </div>
    <div class="verdict ${shown.allOk ? "ok" : "bad"}">
      <span class="big">${shown.allOk ? "✓" : left}</span>
      <div>
        <strong>${shown.allOk ? "Uppfyller examenskraven" : `${left} krav är inte uppfyllda`}</strong>
        <span>${shown.total} hp ${state.scope === "done" ? "klara" : "i planen"} · ${done.total} hp klara</span>
      </div>
    </div>
    ${rows}
    <div class="legend"><span><i style="background:var(--ok)"></i>Klart</span><span><i style="background:var(--accent);opacity:.35"></i>Läser/planerat</span></div>
    ${shown.warnings.length ? `<div class="warnings">${shown.warnings.map((w) => `<div>${esc(w)}</div>`).join("")}</div>` : ""}
    <p class="save-state" id="save-state">${esc(state.saveState)}</p>`;

  $("#reqs").querySelectorAll("[data-scope]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); state.scope = b.dataset.scope; renderReqs(); }));
}

// ---------- Klasskompisar ----------

const MATE_FILTERS = [
  ["advanced", "Åk 4–5 och tillval"],
  [7, "Termin 7"], [8, "Termin 8"], [9, "Termin 9"], [10, "Termin 10"], ["X", "Tillval"], ["custom", "Egna kurser"],
];

function personChip(m, status, me = false) {
  return `<span class="person ${me ? "me" : ""}" title="${esc(STATUSES[status] || "")}">
    <span class="avatar">${esc(me ? "Du" : initials(m.name))}</span>${esc(me ? "Du" : m.name)}<span class="dot ${status}"></span></span>`;
}

function renderMates() {
  const me = { name: state.plan.name || "Du", items: state.plan.items };
  const everyone = [...state.mates.map((m) => ({ m, me: false })), { m: me, me: true }];
  const f = state.mateTerm;
  const q = state.mateQuery.toLowerCase();

  const items = [];
  if (f !== "custom") {
    const terms = f === "advanced" ? [7, 8, 9, 10, "X", "S"] : [f];
    for (const c of COURSES.filter((x) => terms.includes(x.term) && (x.type !== "obl" || x.term >= 7))) {
      const takers = everyone.map((e) => ({ ...e, it: e.m.items.find((x) => x.code === c.code) })).filter((e) => e.it);
      if (!takers.some((t) => !t.me)) continue;
      items.push({ name: c.name, meta: `${c.code} · ${c.hp} hp · ${c.level} · ${TERM_LABELS[c.term]}, period ${c.period}`, takers: takers.map((t) => ({ ...t, status: t.it.status })) });
    }
  }
  if (f === "custom" || f === "advanced") {
    const map = new Map();
    for (const { m, me: isMe } of everyone) {
      for (const it of m.items.filter((x) => x.custom)) {
        const x = it.custom;
        const key = (x.code || x.name).trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: x.name, meta: `${x.code ? x.code + " · " : ""}${x.hp} hp · ${x.level} · utanför studieplanen`, takers: [] });
        map.get(key).takers.push({ m, me: isMe, status: it.status });
      }
    }
    for (const v of map.values()) if (v.takers.some((t) => !t.me)) items.push(v);
  }
  const filtered = items
    .filter((i) => !q || i.name.toLowerCase().includes(q) || i.meta.toLowerCase().includes(q) || i.takers.some((t) => t.m.name.toLowerCase().includes(q)))
    .sort((a, b) => b.takers.length - a.takers.length);

  const byCourse = filtered.length
    ? `<div class="card" style="padding:0">${filtered.map((i) => `
        <div class="mate-course">
          <div><div class="course-name">${esc(i.name)}</div><div class="course-meta">${esc(i.meta)}</div></div>
          <div class="people">${i.takers.sort((a, b) => a.me - b.me).map((t) => personChip(t.m, t.status, t.me)).join("")}</div>
        </div>`).join("")}</div>`
    : `<div class="card empty">${state.mates.length ? "Inga klasskompisar har valt kurser här ännu." : "Inga klasskompisar har lagt in sina kurser ännu. Dela länken till sidan!"}</div>`;

  const people = state.mates
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .map((m) => {
      const list = m.items
        .filter((it) => it.custom || (BY_CODE[it.code] && BY_CODE[it.code].type !== "obl"))
        .sort((a, b) => a.year - b.year || a.period - b.period)
        .map((it) => ({ name: itemNameOf(it), meta: `År ${it.year} · P${it.period}${it.span > 1 ? "–" + (it.period + it.span - 1) : ""}`, status: it.status }));
      return `
        <div class="card person-card">
          <h3><span class="avatar">${esc(initials(m.name))}</span>${esc(m.name)}</h3>
          <div class="muted small">${m.start_year ? `Började ${m.start_year}` : ""}</div>
          ${list.length ? `<ul>${list.map((x) => `<li><span class="dot ${x.status}" title="${STATUSES[x.status]}"></span>${esc(x.name)}<span class="muted">${esc(x.meta)}</span></li>`).join("")}</ul>` : `<p class="muted small">Inga valbara kurser inlagda.</p>`}
        </div>`;
    }).join("");

  app.innerHTML = `
    <div class="stack">
      <div>
        <h1>Klasskompisar</h1>
        <p class="muted" style="margin:0">Se vilka valbara kurser andra läser eller planerar. ${state.mates.length} klasskompis${state.mates.length === 1 ? "" : "ar"} delar sina kurser.</p>
      </div>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Visa">
          <button data-mode="course" data-status="" class="${state.mateMode === "course" ? "on" : ""}">Per kurs</button>
          <button data-mode="person" data-status="" class="${state.mateMode === "person" ? "on" : ""}">Per person</button>
        </div>
        ${state.mateMode === "course" ? `<select id="mate-term" aria-label="Termin">${MATE_FILTERS.map(([v, l]) => `<option value="${v}" ${String(v) === String(f) ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
        <input type="search" id="mate-q" placeholder="Sök kurs eller namn" value="${esc(state.mateQuery)}">
      </div>
      <div class="legend"><span><span class="dot done"></span> Klar</span><span><span class="dot ongoing"></span> Läser nu</span><span><span class="dot planned"></span> Planerar</span></div>
      ${state.mateMode === "course" ? byCourse : people ? `<div class="people-grid">${people}</div>` : `<div class="card empty">Ingen matchar sökningen.</div>`}
    </div>`;

  app.onclick = (ev) => {
    const b = ev.target.closest("[data-mode]");
    if (b) { state.mateMode = b.dataset.mode; renderMates(); }
  };
  const sel = $("#mate-term");
  if (sel) sel.onchange = () => { state.mateTerm = isNaN(sel.value) ? sel.value : Number(sel.value); renderMates(); };
  const mq = $("#mate-q");
  mq.oninput = () => {
    state.mateQuery = mq.value;
    const pos = mq.selectionStart;
    renderMates();
    const n = $("#mate-q");
    n.focus();
    n.setSelectionRange(pos, pos);
  };
}

function itemNameOf(it) {
  return it.code ? BY_CODE[it.code]?.name ?? it.code : it.custom?.name ?? "";
}

start();
