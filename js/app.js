import { LEVELS, KNOWN_AREAS } from "./courses.js";
import { evaluate, STATUSES } from "./rules.js";
import { ALLOWED_EMAIL_DOMAINS } from "./config.js";
import { pool, buildPool, courseById, coursesIn, courseData, offeringText } from "./pool.js";
import * as store from "./store.js";
import { guideHTML } from "./guide.js";

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const dlg = $("#dlg");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const MAX_ROWS = 6;
const THICK_ROWS = 3;
const GRADES = ["3", "4", "5", "G", "VG"];

const ICONS = {
  lock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>`,
};

const state = {
  user: null,
  plan: store.emptyPlan(),
  mates: [],
  poolRows: { courseRows: [], folderRows: [] },
  grades: {},
  view: sessionGet("es-view") || "plan",
  year: Number(sessionGet("es-year")) || 4,
  scope: "all",
  picker: null,
  pickerQuery: "",
  mateFolder: "valbara",
  mateMode: "course",
  mateQuery: "",
  poolFolder: "programplanen",
  poolQuery: "",
  poolArea: "",
  poolLevel: "",
  poolSem: "",
  saveState: "",
};

function sessionGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionSet(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignorera */ } }
const editorName = () => state.plan.name?.trim() || state.user?.email || "Okänd";

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
    const [plan, mates, poolRows, grades] = await Promise.all([
      store.loadMyPlan(state.user), store.loadClassmates(state.user), store.loadPool(), store.loadGrades(state.user),
    ]);
    Object.assign(state, { plan, mates, poolRows, grades });
    buildPool(poolRows.courseRows, poolRows.folderRows);
  } catch (e) {
    return showError(e);
  }
  // Nya planer: år 1–3 fylls i med de obligatoriska kurserna som klara
  if (state.plan.isNew) {
    delete state.plan.isNew;
    for (const y of [1, 2, 3]) fillMandatory(y, "done", true);
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

let gradeTimer = null;
function gradesChanged() {
  clearTimeout(gradeTimer);
  gradeTimer = setTimeout(() => store.saveGrades(state.user, state.grades).catch((e) => alert("Kunde inte spara betyg: " + e.message)), 400);
}

// ---------- Hjälpfunktioner för planen ----------

const itemCourse = (it) => (it.code ? courseById(it.code) : null);
const itemName = (it) => itemCourse(it)?.name ?? it.custom?.name ?? it.code ?? "Okänd kurs";
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

function placementError(y, period, row, span, thick, ignoreId) {
  if (period + span - 1 > 4) return `Kursen går över ${span} perioder och får inte plats från period ${period}.`;
  const occ = occupied(y, ignoreId);
  const rows = thick ? [...Array(thickRowsOf(y)).keys()] : [row];
  for (const r of rows) for (let p = period; p < period + span; p++) {
    const other = occ.get(`${r}:${p}`);
    if (other) return `Platsen är upptagen av ${itemName(other)} (period ${p}).`;
  }
  return null;
}

const placedWhere = (id) => state.plan.items.find((it) => it.code === id);

function matesFor(id) {
  return state.mates.map((m) => ({ m, it: m.items.find((x) => x.code === id) })).filter((x) => x.it);
}

// ---------- Navigering ----------

function render() {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  app.onclick = null;
  if (state.view === "plan") renderPlan();
  else if (state.view === "pool") renderPool();
  else if (state.view === "grades") renderGrades();
  else if (state.view === "guide") renderGuide();
  else renderMates();
}

$("#tabs").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-view]");
  if (!b) return;
  state.view = b.dataset.view;
  sessionSet("es-view", state.view);
  render();
});

// ---------- Guide ----------

function renderGuide() {
  app.innerHTML = guideHTML();
  app.onclick = (ev) => {
    const a = ev.target.closest('a[href^="#g-"]');
    if (!a) return;
    ev.preventDefault();
    document.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

function showGuide() {
  state.view = "guide";
  sessionSet("es-view", "guide");
  render();
  scrollTo(0, 0);
}

const guideSeen = () => { try { return localStorage.getItem("es-guide-seen") === "1"; } catch { return true; } };
const markGuideSeen = () => { try { localStorage.setItem("es-guide-seen", "1"); } catch { /* ignorera */ } };

// ---------- Min plan ----------

function renderPlan() {
  const y = state.year;
  app.innerHTML = `
    ${guideSeen() ? "" : `
      <div class="welcome card">
        <div><strong>Ny här?</strong> Läs guiden om vad som krävs för examen och hur sidan fungerar. Det tar fem minuter.</div>
        <div class="toolbar"><button class="btn small primary" id="open-guide">Läs guiden</button><button class="btn small ghost" id="hide-welcome">Dölj</button></div>
      </div>`}
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
      cells += occ.has(`${r}:${p}`)
        ? `<div class="slot taken" style="grid-row:${r + 1};grid-column:${p}"></div>`
        : `<button class="slot" style="grid-row:${r + 1};grid-column:${p}" data-slot="${r}:${p}" aria-label="Lägg till kurs i period ${p}, rad ${r + 1}">${ICONS.plus}</button>`;
    }
    const lockedByThick = items.some((it) => it.thick) && r < THICK_ROWS && rows <= THICK_ROWS;
    cells += `<button class="row-del" style="grid-row:${r + 1};grid-column:5" data-del-row="${r}" ${rows <= 1 || lockedByThick ? "disabled" : ""} title="Ta bort rad" aria-label="Ta bort rad ${r + 1}">${ICONS.trash}</button>`;
  }

  const pills = items.map((it) => {
    const rowSpan = it.thick ? thickRowsOf(y) : 1;
    const icon = it.status === "done" ? ICONS.lock : it.status === "ongoing" ? ICONS.clock : "";
    const name = itemName(it);
    return `
      <button class="pill ${it.status} ${it.thick ? "thick" : ""}" data-item="${esc(it.id)}"
        style="grid-row:${(it.thick ? 0 : it.row) + 1} / span ${rowSpan};grid-column:${it.period} / span ${it.span}"
        title="${esc(name)} – ${STATUSES[it.status]}">
        ${icon}<span class="pill-name">${esc(name)}</span><span class="hp">${itemHp(it)} hp</span>
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
    if (t.closest("#open-guide")) { markGuideSeen(); return showGuide(); }
    if (t.closest("#hide-welcome")) { markGuideSeen(); return renderPlan(); }
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
    if (t.closest("#fill-year")) { fillMandatory(state.year, "planned"); return renderPlan(); }
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

function addItem(y, period, row, fields, status = "planned") {
  const it = { id: "i" + uid(), year: y, period, row: fields.thick ? 0 : row, status, ...fields };
  state.plan.items.push(it);
  changed();
  return it;
}

// Lägger in årets obligatoriska kurser (enligt studieplanen) på första lediga plats.
function fillMandatory(y, status, silent = false) {
  const groupsTaken = new Set(state.plan.items.map((it) => courseById(it.code)?.oneOf).filter(Boolean));
  const list = [];
  for (const c of pool.courses) {
    if (!c.inStudyPlan || c.type !== "obl" || c.year !== y || placedWhere(c.id) || !c.offerings.length) continue;
    if (c.oneOf) {
      if (groupsTaken.has(c.oneOf)) continue;
      groupsTaken.add(c.oneOf);
    }
    const off = c.offerings[0];
    list.push({ c, period: off.periods[0], span: off.periods.length });
  }
  list.sort((a, b) => (b.c.thick ? 1 : 0) - (a.c.thick ? 1 : 0) || a.period - b.period || b.span - a.span);

  const skipped = [];
  for (const { c, period, span } of list) {
    if (c.thick) {
      if (placementError(y, period, 0, span, true)) skipped.push(c.name);
      else addItem(y, period, 0, { code: c.id, span, thick: true }, status);
      continue;
    }
    let row = [...Array(rowsOf(y)).keys()].find((r) => !placementError(y, period, r, span, false));
    if (row === undefined) {
      if (rowsOf(y) >= MAX_ROWS) { skipped.push(c.name); continue; }
      state.plan.rows[y] = rowsOf(y) + 1;
      row = rowsOf(y) - 1;
    }
    addItem(y, period, row, { code: c.id, span, thick: false }, status);
  }
  if (skipped.length && !silent) alert(`Fick inte plats med: ${skipped.join(", ")}. Flytta eller ta bort kurser och försök igen.`);
}

// ---------- Kursväljare ----------

function openPicker(ctx) {
  state.picker = ctx;
  state.pickerQuery = "";
  renderPicker();
  if (!dlg.open) dlg.showModal();
  $("#pick-q")?.focus();
}

function courseTags(c) {
  return `
    <span>${esc(c.code || "")}${c.uni === "SLU" ? " · SLU" : ""}</span><span>${c.hp} hp</span>
    <span class="tag ${String(c.level).startsWith("A") ? "adv" : ""}">${esc(c.level)}</span>
    ${c.type === "obl" ? `<span class="tag obl">Obligatorisk</span>` : ""}
    ${c.type === "ts" ? `<span class="tag ts">Teknik och system</span>` : ""}`;
}

// Var kursen hamnar om man klickar på (år, period, rad). Kursen läggs alltid i de
// perioder den faktiskt ges; klickar man i period 2 på en P1–2-kurs hamnar den i P1–2.
// Är raden upptagen används första lediga rad.
function slotFor(c, ctx, ignoreId) {
  const o = c.offerings.find((x) => x.periods.includes(ctx.period));
  let start, span;
  if (o) { start = o.periods[0]; span = o.periods.length; }
  else if (c.anyPeriod || c.summer) { start = ctx.period; span = 1; }
  else return { err: `Ges inte i period ${ctx.period} (ges ${offeringText(c).join(", ")}).` };
  if (c.thick) return { start, span, row: 0, err: placementError(ctx.year, start, 0, span, true, ignoreId) };
  const rows = [ctx.row, ...[...Array(rowsOf(ctx.year)).keys()].filter((r) => r !== ctx.row)];
  const row = rows.find((r) => !placementError(ctx.year, start, r, span, false, ignoreId));
  if (row === undefined) return { err: placementError(ctx.year, start, ctx.row, span, false, ignoreId) + " Lägg till en rad eller ta bort en kurs." };
  return { start, span, row, err: null };
}

// Kurs i samma "en av"-grupp (t.ex. examensarbete UU/SLU) som redan finns i planen.
const groupItem = (c) => c.oneOf && state.plan.items.find((it) => it.code !== c.id && courseById(it.code)?.oneOf === c.oneOf);

function pickEntry(c, ctx) {
  const placed = placedWhere(c.id);
  const replaces = groupItem(c);
  const slot = slotFor(c, ctx, replaces?.year === ctx.year ? replaces.id : undefined);
  const err = placed ? `Redan inlagd i år ${placed.year}` : slot.err;
  const mates = matesFor(c.id).length;
  const where = slot.err ? "" : `Hamnar i period ${slot.start}${slot.span > 1 ? "–" + (slot.start + slot.span - 1) : ""}`;
  return `
    <button class="pick" data-pick="${esc(c.id)}" ${err ? "disabled" : ""}>
      <span class="pick-main">
        <span class="pick-name">${esc(c.name)}</span>
        <span class="course-meta">
          ${courseTags(c)}
          <span>Ges ${offeringText(c).join(", ")}</span>
          ${c.year ? `<span>Rek. år ${c.year}</span>` : ""}
          ${c.thick ? `<span class="tag">Tar alla tre rader</span>` : ""}
          ${mates ? `<span class="tag mates">${plural(mates, "klasskompis", "klasskompisar")}</span>` : ""}
        </span>
        ${err ? `<span class="pick-err">${esc(err)}</span>` : `<span class="pick-ok">${where}${replaces ? ` · ersätter ${esc(itemName(replaces))}` : ""}</span>`}
      </span>
    </button>`;
}

function renderPicker() {
  const ctx = state.picker;
  const q = state.pickerQuery.trim().toLowerCase();
  const runsHere = (c) => c.offerings.some((o) => o.periods.includes(ctx.period));
  let sections;

  if (q) {
    const hits = pool.courses.filter((c) => c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q));
    const ok = hits.filter((c) => runsHere(c) || c.anyPeriod || c.summer);
    sections = [["Sökresultat", ok], [`Ges inte i period ${ctx.period}`, hits.filter((c) => !ok.includes(c))]];
  } else {
    const shown = new Set();
    const take = (list) => list.filter((c) => !shown.has(c.id) && shown.add(c.id));
    const here = pool.courses.filter(runsHere);
    sections = [[`Rekommenderat år ${ctx.year}, ges i period ${ctx.period}`, take(here.filter((c) => c.year === ctx.year))]];
    for (const f of pool.folders) sections.push([`${f.name} – ges i period ${ctx.period}`, take(here.filter((c) => c.folders.includes(f.id)))]);
    sections.push([`Övriga kurser i period ${ctx.period}`, take(here)]);
    sections.push(["Valfri period och sommar", take(pool.courses.filter((c) => c.anyPeriod || c.summer))]);
  }

  const body = sections
    .filter(([, list]) => list.length)
    .map(([title, list]) => `<h3 class="pick-h">${esc(title)}</h3>${list.map((c) => pickEntry(c, ctx)).join("")}`)
    .join("") || `<p class="muted">Inga kurser matchar.</p>`;

  dlg.innerHTML = `
    <div class="dlg-head">
      <div>
        <h2>Välj kurs</h2>
        <p class="muted small">År ${ctx.year} · period ${ctx.period} · rad ${ctx.row + 1}</p>
      </div>
      <button class="icon-btn" data-close aria-label="Stäng">✕</button>
    </div>
    <input type="search" id="pick-q" placeholder="Sök bland alla kurser i kurspoolen" value="${esc(state.pickerQuery)}">
    <div class="pick-list">${body}</div>
    <details class="custom-box">
      <summary>Lägg till en privat kurs (syns bara i din plan)</summary>
      <p class="muted small">Vill du att andra ska kunna välja kursen? Lägg till den i Kurspoolen i stället.</p>
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

// Dialogen används av kursväljaren, kursdetaljer och kurspoolens formulär.
let dlgHandler = null;
dlg.addEventListener("click", (ev) => {
  if (ev.target === dlg || ev.target.closest("[data-close]")) return dlg.close();
  if (dlgHandler) return dlgHandler(ev);
  const pick = ev.target.closest("[data-pick]");
  if (pick && !pick.disabled && state.picker) {
    const c = courseById(pick.dataset.pick);
    const ctx = state.picker;
    const replaces = groupItem(c);
    const slot = slotFor(c, ctx, replaces?.year === ctx.year ? replaces.id : undefined);
    if (slot.err) { alert(slot.err); return; }
    if (replaces) state.plan.items = state.plan.items.filter((x) => x !== replaces);
    addItem(ctx.year, slot.start, slot.row, { code: c.id, span: slot.span, thick: !!c.thick });
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
  const sw = ev.target.closest("[data-swap]");
  if (sw) {
    const it = state.plan.items.find((x) => x.id === sw.dataset.id);
    it.code = sw.dataset.swap;
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
dlg.addEventListener("close", () => { state.picker = null; dlgHandler = null; });

function openDialog(html, handler = null) {
  dlgHandler = handler;
  dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
}

// ---------- Kursdetaljer i planen ----------

function openItem(id) {
  const it = state.plan.items.find((x) => x.id === id);
  if (!it) return;
  state.picker = null;
  const c = itemCourse(it);
  const x = it.custom || {};
  const mates = c ? matesFor(c.id) : [];
  const periods = Array.from({ length: it.span }, (_, i) => it.period + i).join("–");
  openDialog(`
    <div class="dlg-head">
      <div>
        <h2>${esc(itemName(it))}</h2>
        <p class="muted small">År ${it.year} · period ${periods}${it.thick ? " · tar alla tre rader" : ""}</p>
      </div>
      <button class="icon-btn" data-close aria-label="Stäng">✕</button>
    </div>
    <div class="course-meta">
      ${c ? `${courseTags(c)}${c.areas.map((a) => `<span class="tag">${esc(a)}</span>`).join("")}`
      : `${x.code ? `<span>${esc(x.code)}</span>` : ""}<span>${Number(x.hp) || 0} hp</span><span class="tag">${esc(x.level)}</span>${x.teknik ? `<span class="tag">Teknik</span>` : ""}<span class="tag">Privat kurs</span>`}
    </div>
    ${c?.prereq ? `<p class="small"><strong>Behörighet:</strong> ${esc(c.prereq)}</p>` : ""}
    ${c?.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
    <h3 class="pick-h">Status</h3>
    <div class="seg" role="group" aria-label="Status">
      ${Object.entries(STATUSES).reverse().map(([k, l]) => `<button data-set-status="${k}" data-id="${esc(it.id)}" class="${it.status === k ? "on" : ""}" aria-pressed="${it.status === k}">${l}</button>`).join("")}
    </div>
    ${c ? `<h3 class="pick-h">Klasskompisar som läser kursen</h3>
      ${mates.length ? `<div class="people">${mates.map(({ m, it: mi }) => personChip(m, mi.status)).join("")}</div>` : `<p class="muted small">Ingen ännu.</p>`}` : ""}
    ${c?.oneOf ? pool.courses.filter((x) => x.oneOf === c.oneOf && x.id !== c.id).map((alt) => `
      <h3 class="pick-h">Byt variant</h3>
      <button class="btn small" data-swap="${esc(alt.id)}" data-id="${esc(it.id)}">Byt till ${esc(alt.name)} (${esc(alt.code)})</button>`).join("") : ""}
    <div class="dlg-foot">
      <button class="btn danger" data-remove="${esc(it.id)}">Ta bort från planen</button>
      <button class="btn" data-close>Klar</button>
    </div>`);
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

// ---------- Kurspoolen ----------

const folderHp = (id) => coursesIn(id).reduce((s, c) => s + c.hp, 0);

function renderPool() {
  const fid = state.poolFolder;
  const folder = pool.folders.find((f) => f.id === fid);
  if (fid !== "all" && !folder) state.poolFolder = "programplanen";
  const q = state.poolQuery.trim().toLowerCase();
  let list = fid === "all" ? pool.courses : coursesIn(fid);
  list = list.filter((c) =>
    (!q || c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q) || c.prereq.toLowerCase().includes(q)) &&
    (!state.poolArea || c.areas.includes(state.poolArea)) &&
    (!state.poolLevel || String(c.level).startsWith(state.poolLevel)) &&
    (!state.poolSem || (state.poolSem === "any" ? c.anyPeriod || c.summer : c.offerings.some((o) => o.sem === state.poolSem))));
  list.sort((a, b) => (a.year ?? 9) - (b.year ?? 9) || (a.offerings[0]?.periods[0] ?? 9) - (b.offerings[0]?.periods[0] ?? 9) || a.name.localeCompare(b.name, "sv"));

  const areas = [...new Set(pool.courses.flatMap((c) => c.areas))].sort((a, b) => a.localeCompare(b, "sv"));

  app.innerHTML = `
    <div class="pool-layout">
      <aside class="folders">
        <button class="folder ${fid === "all" ? "active" : ""}" data-folder="all">${ICONS.grid}<span>Alla kurser</span><small>${pool.courses.length}</small></button>
        ${pool.folders.map((f) => `
          <button class="folder ${fid === f.id ? "active" : ""}" data-folder="${esc(f.id)}">${ICONS.folder}<span>${esc(f.name)}</span><small>${coursesIn(f.id).length}</small></button>`).join("")}
        <button class="btn small ghost" id="new-folder">${ICONS.plus} Ny mapp</button>
      </aside>
      <section class="stack">
        <div class="card folder-head">
          <div class="folder-title">
            <h1>${fid === "all" ? "Alla kurser" : esc(folder.name)}</h1>
            <span class="muted">${plural(list.length, "kurs", "kurser")}${fid !== "all" ? ` · totalt ${folderHp(fid)} hp` : ""}</span>
          </div>
          <p class="folder-desc">${fid === "all" ? "Alla kurser i kurspoolen, från alla mappar." : esc(folder.description) || `<span class="muted">Ingen beskrivning.</span>`}</p>
          <div class="toolbar">
            ${fid !== "all" ? `<button class="btn small" id="edit-folder">Ändra mapp</button>` : ""}
            <button class="btn small primary" id="new-course">${ICONS.plus} Ny kurs${fid !== "all" ? " i mappen" : ""}</button>
            ${folder?.updated_by ? `<span class="muted small">Senast ändrad av ${esc(folder.updated_by)}</span>` : ""}
          </div>
        </div>
        <div class="toolbar">
          <input type="search" id="pool-q" placeholder="Sök namn, kurskod eller behörighet" value="${esc(state.poolQuery)}">
          <select id="pool-area" aria-label="Huvudområde"><option value="">Alla huvudområden</option>${areas.map((a) => `<option ${a === state.poolArea ? "selected" : ""}>${esc(a)}</option>`).join("")}</select>
          <select id="pool-level" aria-label="Nivå"><option value="">Alla nivåer</option><option value="G" ${state.poolLevel === "G" ? "selected" : ""}>Grundnivå</option><option value="A" ${state.poolLevel === "A" ? "selected" : ""}>Avancerad nivå</option></select>
          <select id="pool-sem" aria-label="Termin"><option value="">HT och VT</option>${[["HT", "Höstterminen"], ["VT", "Vårterminen"], ["any", "Valfri period/sommar"]].map(([v, l]) => `<option value="${v}" ${state.poolSem === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        </div>
        <div class="pool-list">
          ${list.length ? list.map(poolCourseCard).join("") : `<div class="card empty">Inga kurser matchar.</div>`}
        </div>
      </section>
    </div>`;

  bindPool();
}

function poolCourseCard(c) {
  const mates = matesFor(c.id).length;
  const mine = placedWhere(c.id);
  const folders = pool.folders.filter((f) => c.folders.includes(f.id));
  return `
    <details class="card pool-course">
      <summary>
        <div class="pc-main">
          <div class="course-name">${esc(c.name)}</div>
          <div class="course-meta">
            ${courseTags(c)}
            ${c.areas.map((a) => `<span class="tag area">${esc(a)}</span>`).join("")}
          </div>
        </div>
        <div class="pc-side">
          ${offeringText(c).map((t) => `<span class="sem">${esc(t)}</span>`).join("")}
          ${mine ? `<span class="tag ts">I din plan</span>` : ""}
          ${mates ? `<span class="tag mates">${plural(mates, "klasskompis", "klasskompisar")}</span>` : ""}
        </div>
      </summary>
      <div class="pc-body">
        <div class="pc-prereq"><strong>Behörighet</strong><p>${c.prereq ? esc(c.prereq) : `<span class="muted">Inte ifyllt ännu. Klicka på Ändra och lägg till.</span>`}</p></div>
        ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
        <div class="course-meta">
          ${c.year ? `<span>Rekommenderat år ${c.year}</span>` : ""}
          ${folders.map((f) => `<span class="tag">${ICONS.folder} ${esc(f.name)}</span>`).join("")}
          ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">Kurssida ↗</a>` : ""}
          ${c.updated_by ? `<span>Ändrad av ${esc(c.updated_by)}</span>` : ""}
        </div>
        <div class="toolbar">
          <button class="btn small" data-edit-course="${esc(c.id)}">Ändra</button>
          <button class="btn small" data-course-folders="${esc(c.id)}">${ICONS.folder} Mappar</button>
          ${pool.overridden.has(c.id) ? `<button class="btn small ghost" data-reset-course="${esc(c.id)}">Återställ till studieplanen</button>` : ""}
          ${!pool.seedIds.has(c.id) ? `<button class="btn small ghost danger" data-delete-course="${esc(c.id)}">Ta bort kursen</button>` : ""}
        </div>
      </div>
    </details>`;
}

function bindPool() {
  const rerenderKeepFocus = (id) => {
    const el = $(id);
    const pos = el.selectionStart;
    renderPool();
    const n = $(id);
    n.focus();
    if (pos != null) n.setSelectionRange(pos, pos);
  };
  $("#pool-q").oninput = (e) => { state.poolQuery = e.target.value; rerenderKeepFocus("#pool-q"); };
  $("#pool-area").onchange = (e) => { state.poolArea = e.target.value; renderPool(); };
  $("#pool-level").onchange = (e) => { state.poolLevel = e.target.value; renderPool(); };
  $("#pool-sem").onchange = (e) => { state.poolSem = e.target.value; renderPool(); };

  app.onclick = async (ev) => {
    const t = ev.target;
    const f = t.closest("[data-folder]");
    if (f) { state.poolFolder = f.dataset.folder; return renderPool(); }
    if (t.closest("#new-folder")) return openFolderEditor(null);
    if (t.closest("#edit-folder")) return openFolderEditor(pool.folders.find((x) => x.id === state.poolFolder));
    if (t.closest("#new-course")) return openCourseEditor(null);
    const e1 = t.closest("[data-edit-course]");
    if (e1) return openCourseEditor(courseById(e1.dataset.editCourse));
    const e2 = t.closest("[data-course-folders]");
    if (e2) return openFolderPicker(courseById(e2.dataset.courseFolders));
    const e3 = t.closest("[data-reset-course]");
    if (e3 && confirm("Återställ kursen till uppgifterna från studieplanen? Ändringar och mappval försvinner.")) {
      await poolWrite(() => store.deletePoolCourse(e3.dataset.resetCourse), () => {
        state.poolRows.courseRows = state.poolRows.courseRows.filter((r) => r.id !== e3.dataset.resetCourse);
      });
    }
    const e4 = t.closest("[data-delete-course]");
    if (e4) {
      const c = courseById(e4.dataset.deleteCourse);
      if (!confirm(`Ta bort ${c.name} ur kurspoolen för alla?`)) return;
      await poolWrite(() => store.deletePoolCourse(c.id), () => {
        state.poolRows.courseRows = state.poolRows.courseRows.filter((r) => r.id !== c.id);
      });
    }
  };
}

// Kör en skrivning mot poolen, uppdatera lokalt och rita om.
async function poolWrite(save, applyLocal) {
  try {
    await save();
    applyLocal();
    buildPool(state.poolRows.courseRows, state.poolRows.folderRows);
    renderPool();
    return true;
  } catch (e) {
    alert("Kunde inte spara: " + e.message);
    return false;
  }
}

async function saveCourse(c) {
  const row = { id: c.id, data: courseData(c), updated_by: editorName(), updated_at: new Date().toISOString() };
  return poolWrite(() => store.savePoolCourse(row.id, row.data, row.updated_by), () => {
    state.poolRows.courseRows = [...state.poolRows.courseRows.filter((r) => r.id !== row.id), row];
  });
}

function openFolderEditor(folder) {
  const isNew = !folder;
  openDialog(`
    <form id="folder-form">
      <div class="dlg-head">
        <h2>${isNew ? "Ny mapp" : "Ändra mapp"}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Stäng">✕</button>
      </div>
      <div class="form-grid">
        <label class="field wide">Namn<input name="name" required maxlength="80" value="${esc(folder?.name)}"></label>
        <label class="field wide">Beskrivning<textarea name="description" rows="4" maxlength="1000">${esc(folder?.description)}</textarea></label>
      </div>
      <div class="dlg-foot">
        ${!isNew && !folder.builtin ? `<button type="button" class="btn danger" id="delete-folder">Ta bort mappen</button>` : "<span></span>"}
        <button class="btn primary" type="submit">Spara</button>
      </div>
    </form>`, async (ev) => {
    if (ev.target.closest("#delete-folder")) {
      if (!confirm(`Ta bort mappen ${folder.name}? Kurserna finns kvar i kurspoolen.`)) return;
      dlg.close();
      await poolWrite(() => store.deletePoolFolder(folder.id), () => {
        state.poolRows.folderRows = state.poolRows.folderRows.filter((r) => r.id !== folder.id);
        state.poolFolder = "programplanen";
      });
    }
  });
  $("#folder-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const f = { id: folder?.id || "m-" + uid(), name: fd.get("name").trim(), description: fd.get("description").trim(), sort: folder?.sort ?? 100 };
    const row = { ...f, updated_by: editorName(), updated_at: new Date().toISOString() };
    dlg.close();
    await poolWrite(() => store.savePoolFolder(f, row.updated_by), () => {
      state.poolRows.folderRows = [...state.poolRows.folderRows.filter((r) => r.id !== f.id), row];
      state.poolFolder = f.id;
    });
  };
}

function openFolderPicker(c) {
  openDialog(`
    <form id="fp-form">
      <div class="dlg-head">
        <div><h2>Mappar</h2><p class="muted small">${esc(c.name)}</p></div>
        <button type="button" class="icon-btn" data-close aria-label="Stäng">✕</button>
      </div>
      <div class="checks">
        ${pool.folders.map((f) => `<label class="check"><input type="checkbox" name="f" value="${esc(f.id)}" ${c.folders.includes(f.id) ? "checked" : ""}> ${esc(f.name)}</label>`).join("")}
      </div>
      <div class="dlg-foot"><span></span><button class="btn primary" type="submit">Spara</button></div>
    </form>`);
  $("#fp-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const folders = new FormData(ev.target).getAll("f");
    dlg.close();
    await saveCourse({ ...c, folders });
  };
}

const PERIOD_OPTS = { HT: [["", "Ges inte"], ["1", "Period 1"], ["2", "Period 2"], ["1,2", "Period 1–2"], ["2,3", "Period 2–3 (över årsskiftet)"]], VT: [["", "Ges inte"], ["3", "Period 3"], ["4", "Period 4"], ["3,4", "Period 3–4"]] };

function openCourseEditor(c) {
  const isNew = !c;
  const cur = c || { name: "", code: "", hp: 5, level: "A1N", areas: ["Teknik"], prereq: "", url: "", note: "", offerings: [], anyPeriod: false, summer: false, year: null, folders: state.poolFolder !== "all" ? [state.poolFolder] : [] };
  const semVal = (sem) => cur.offerings.find((o) => o.sem === sem)?.periods.join(",") || "";
  const extraAreas = cur.areas.filter((a) => !KNOWN_AREAS.includes(a));
  openDialog(`
    <form id="course-form">
      <div class="dlg-head">
        <div><h2>${isNew ? "Ny kurs i kurspoolen" : "Ändra kurs"}</h2>${!isNew && c.inStudyPlan ? `<p class="muted small">Ändringen syns för alla. Du kan alltid återställa till studieplanen.</p>` : `<p class="muted small">Kursen blir synlig för alla i kurspoolen.</p>`}</div>
        <button type="button" class="icon-btn" data-close aria-label="Stäng">✕</button>
      </div>
      <div class="form-grid">
        <label class="field wide">Kursnamn<input name="name" required maxlength="120" value="${esc(cur.name)}"></label>
        <label class="field">Kurskod<input name="code" maxlength="20" value="${esc(cur.code)}" ${!isNew && c.inStudyPlan ? "readonly" : ""}></label>
        <label class="field">hp<input name="hp" type="number" min="0.5" step="0.5" required value="${esc(cur.hp)}"></label>
        <label class="field">Nivå<select name="level">${[...LEVELS, "GXX"].map((l) => `<option ${l === cur.level ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field">Rekommenderat år<select name="year"><option value="">Inget</option>${[1, 2, 3, 4, 5].map((y) => `<option ${y === cur.year ? "selected" : ""}>${y}</option>`).join("")}</select></label>
        <fieldset class="wide">
          <legend>När ges kursen?</legend>
          <div class="form-grid">
            <label class="field">Höstterminen (HT)<select name="HT">${PERIOD_OPTS.HT.map(([v, l]) => `<option value="${v}" ${v === semVal("HT") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="field">Vårterminen (VT)<select name="VT">${PERIOD_OPTS.VT.map(([v, l]) => `<option value="${v}" ${v === semVal("VT") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="check"><input type="checkbox" name="anyPeriod" ${cur.anyPeriod ? "checked" : ""}> Valfri period</label>
            <label class="check"><input type="checkbox" name="summer" ${cur.summer ? "checked" : ""}> Sommarkurs</label>
          </div>
        </fieldset>
        <fieldset class="wide">
          <legend>Huvudområden</legend>
          <div class="checks cols">
            ${KNOWN_AREAS.map((a) => `<label class="check"><input type="checkbox" name="areas" value="${esc(a)}" ${cur.areas.includes(a) ? "checked" : ""}> ${esc(a)}</label>`).join("")}
          </div>
          <label class="field">Annat huvudområde (kommaseparerat)<input name="otherAreas" value="${esc(extraAreas.join(", "))}"></label>
        </fieldset>
        <label class="field wide">Behörighet<textarea name="prereq" rows="4" maxlength="1500">${esc(cur.prereq)}</textarea></label>
        <label class="field wide">Länk till kurssidan<input name="url" type="url" value="${esc(cur.url)}" placeholder="https://www.uu.se/utbildning/kurs?query=…"></label>
        <label class="field wide">Anteckning<input name="note" maxlength="300" value="${esc(cur.note)}"></label>
        <fieldset class="wide">
          <legend>Mappar</legend>
          <div class="checks">${pool.folders.map((f) => `<label class="check"><input type="checkbox" name="folders" value="${esc(f.id)}" ${cur.folders.includes(f.id) ? "checked" : ""}> ${esc(f.name)}</label>`).join("")}</div>
        </fieldset>
        <p class="pick-err wide" id="course-err"></p>
      </div>
      <div class="dlg-foot"><button type="button" class="btn" data-close>Avbryt</button><button class="btn primary" type="submit">Spara</button></div>
    </form>`);

  $("#course-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const offerings = ["HT", "VT"].filter((s) => fd.get(s)).map((s) => ({ sem: s, periods: fd.get(s).split(",").map(Number) }));
    const areas = [...fd.getAll("areas"), ...fd.get("otherAreas").split(",").map((s) => s.trim()).filter(Boolean)];
    const code = fd.get("code").trim().toUpperCase();
    let id = c?.id;
    if (isNew) {
      id = code && !courseById(code) ? code : "u-" + uid();
    }
    const next = {
      ...cur, id, code, name: fd.get("name").trim(), hp: Number(fd.get("hp")), level: fd.get("level"),
      year: fd.get("year") ? Number(fd.get("year")) : null, offerings,
      anyPeriod: fd.get("anyPeriod") === "on", summer: fd.get("summer") === "on",
      areas: [...new Set(areas)], prereq: fd.get("prereq").trim(), url: fd.get("url").trim(), note: fd.get("note").trim(),
      folders: fd.getAll("folders"),
    };
    if (!offerings.length && !next.anyPeriod && !next.summer) {
      $("#course-err").textContent = "Välj minst en termin, valfri period eller sommar.";
      return;
    }
    dlg.close();
    await saveCourse(next);
  };
}

// ---------- Mina betyg ----------

const gradeKey = (it) => it.code || it.id;

function renderGrades() {
  const done = state.plan.items.filter((it) => it.status === "done").sort((a, b) => a.year - b.year || a.period - b.period || a.row - b.row);
  const seen = new Set();
  const rows = done.filter((it) => !seen.has(gradeKey(it)) && seen.add(gradeKey(it)));

  let hpNum = 0, sum = 0, unweightedSum = 0, nNum = 0, missing = 0;
  const dist = { 3: 0, 4: 0, 5: 0 };
  for (const it of rows) {
    const g = state.grades[gradeKey(it)];
    if (!g) { missing++; continue; }
    if (["3", "4", "5"].includes(g)) {
      const hp = itemHp(it);
      hpNum += hp; sum += hp * Number(g); unweightedSum += Number(g); nNum++;
      dist[g] += hp;
    }
  }
  const gpa = hpNum ? sum / hpNum : null;
  const maxDist = Math.max(1, ...Object.values(dist));

  const byYear = [1, 2, 3, 4, 5].map((y) => {
    const list = rows.filter((it) => it.year === y);
    if (!list.length) return "";
    return `
      <div class="card grade-year">
        <h2>År ${y}</h2>
        ${list.map((it) => {
          const g = state.grades[gradeKey(it)] || "";
          const c = itemCourse(it);
          return `
            <div class="grade-row">
              <div>
                <div class="course-name">${esc(itemName(it))}</div>
                <div class="course-meta"><span>${esc(c?.code || it.custom?.code || "")}</span><span>${itemHp(it)} hp</span></div>
              </div>
              <div class="seg grade-seg" role="group" aria-label="Betyg för ${esc(itemName(it))}">
                ${GRADES.map((v) => `<button data-grade="${esc(gradeKey(it))}" data-value="${v}" class="${g === v ? "on" : ""}" aria-pressed="${g === v}">${v}</button>`).join("")}
              </div>
            </div>`;
        }).join("")}
      </div>`;
  }).join("");

  app.innerHTML = `
    <div class="stack">
      <div>
        <h1>Mina betyg</h1>
        <p class="muted" style="margin:0">Fyll i betyg för kurser som är markerade som klara i din plan. Betygen sparas bara för dig och visas aldrig för klasskompisar.</p>
      </div>
      <div class="stats">
        <div class="card stat main"><span class="stat-label">Viktat snitt</span><span class="stat-value">${gpa ? gpa.toFixed(2) : "–"}</span><span class="muted small">viktat med hp, betyg 3–5</span></div>
        <div class="card stat"><span class="stat-label">Oviktat snitt</span><span class="stat-value">${nNum ? (unweightedSum / nNum).toFixed(2) : "–"}</span><span class="muted small">${plural(nNum, "kurs", "kurser")}</span></div>
        <div class="card stat"><span class="stat-label">hp med sifferbetyg</span><span class="stat-value">${hpNum}</span><span class="muted small">${missing ? `${plural(missing, "kurs", "kurser")} utan betyg` : "Alla klara kurser har betyg"}</span></div>
        <div class="card stat dist">
          <span class="stat-label">Fördelning (hp)</span>
          ${["5", "4", "3"].map((g) => `<div class="dist-row"><span>${g}</span><div class="dist-bar"><i style="width:${(dist[g] / maxDist) * 100}%"></i></div><span class="muted">${dist[g]}</span></div>`).join("")}
        </div>
      </div>
      ${byYear || `<div class="card empty">Inga kurser är markerade som klara ännu. Markera kurser som klara under Min plan.</div>`}
      <p class="muted small">G och VG räknas inte in i snittet. Klicka på ett valt betyg igen för att ta bort det.</p>
    </div>`;

  app.onclick = (ev) => {
    const b = ev.target.closest("[data-grade]");
    if (!b) return;
    const k = b.dataset.grade;
    if (state.grades[k] === b.dataset.value) delete state.grades[k];
    else state.grades[k] = b.dataset.value;
    gradesChanged();
    renderGrades();
  };
}

// ---------- Klasskompisar ----------

function personChip(m, status, me = false) {
  return `<span class="person ${me ? "me" : ""}" title="${esc(STATUSES[status] || "")}">
    <span class="avatar">${esc(me ? "Du" : initials(m.name))}</span>${esc(me ? "Du" : m.name)}<span class="dot ${status}"></span></span>`;
}

function renderMates() {
  const me = { name: state.plan.name || "Du", items: state.plan.items };
  const everyone = [...state.mates.map((m) => ({ m, me: false })), { m: me, me: true }];
  const f = state.mateFolder;
  const q = state.mateQuery.toLowerCase();

  const courseList = f === "valbara"
    ? pool.courses.filter((c) => !(c.inStudyPlan && c.type === "obl" && (c.year ?? 9) <= 3))
    : f === "custom" ? [] : coursesIn(f);

  const items = [];
  for (const c of courseList) {
    const takers = everyone.map((e) => ({ ...e, it: e.m.items.find((x) => x.code === c.id) })).filter((e) => e.it);
    if (!takers.some((t) => !t.me)) continue;
    items.push({ name: c.name, meta: `${c.code || ""} · ${c.hp} hp · ${c.level} · ${offeringText(c).join(", ")}`, takers: takers.map((t) => ({ ...t, status: t.it.status })) });
  }
  if (f === "custom" || f === "valbara") {
    const map = new Map();
    for (const { m, me: isMe } of everyone) {
      for (const it of m.items.filter((x) => x.custom)) {
        const x = it.custom;
        const key = (x.code || x.name).trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: x.name, meta: `${x.code ? x.code + " · " : ""}${x.hp} hp · ${x.level} · privat kurs`, takers: [] });
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
        .filter((it) => it.custom || (courseById(it.code) && !(courseById(it.code).type === "obl" && (courseById(it.code).year ?? 9) <= 3)))
        .sort((a, b) => a.year - b.year || a.period - b.period)
        .map((it) => ({ name: itemName(it), meta: `År ${it.year} · P${it.period}${it.span > 1 ? "–" + (it.period + it.span - 1) : ""}`, status: it.status }));
      return `
        <div class="card person-card">
          <h3><span class="avatar">${esc(initials(m.name))}</span>${esc(m.name)}</h3>
          <div class="muted small">${m.start_year ? `Började ${m.start_year}` : ""}</div>
          ${list.length ? `<ul>${list.map((x) => `<li><span class="dot ${x.status}" title="${STATUSES[x.status]}"></span>${esc(x.name)}<span class="muted">${esc(x.meta)}</span></li>`).join("")}</ul>` : `<p class="muted small">Inga valbara kurser inlagda.</p>`}
        </div>`;
    }).join("");

  const opts = [["valbara", "Alla utom obligatoriska åk 1–3"], ...pool.folders.map((x) => [x.id, x.name]), ["custom", "Privata kurser"]];

  app.innerHTML = `
    <div class="stack">
      <div>
        <h1>Klasskompisar</h1>
        <p class="muted" style="margin:0">Se vilka kurser andra läser eller planerar. ${plural(state.mates.length, "klasskompis", "klasskompisar")} delar sina kurser.</p>
      </div>
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Visa">
          <button data-mode="course" class="${state.mateMode === "course" ? "on" : ""}">Per kurs</button>
          <button data-mode="person" class="${state.mateMode === "person" ? "on" : ""}">Per person</button>
        </div>
        ${state.mateMode === "course" ? `<select id="mate-folder" aria-label="Urval">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === f ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : ""}
        <input type="search" id="mate-q" placeholder="Sök kurs eller namn" value="${esc(state.mateQuery)}">
      </div>
      <div class="legend"><span><span class="dot done"></span> Klar</span><span><span class="dot ongoing"></span> Läser nu</span><span><span class="dot planned"></span> Planerar</span></div>
      ${state.mateMode === "course" ? byCourse : people ? `<div class="people-grid">${people}</div>` : `<div class="card empty">Ingen matchar sökningen.</div>`}
    </div>`;

  app.onclick = (ev) => {
    const b = ev.target.closest("[data-mode]");
    if (b) { state.mateMode = b.dataset.mode; renderMates(); }
  };
  const sel = $("#mate-folder");
  if (sel) sel.onchange = () => { state.mateFolder = sel.value; renderMates(); };
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

start();
