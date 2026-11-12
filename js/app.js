import { LEVELS, KNOWN_AREAS } from "./courses.js";
import { evaluate, STATUSES } from "./rules.js";
import { pool, buildPool, courseById, coursesIn, courseData, offeringText, safeUrl, HP_KEYS, cleanReq } from "./pool.js";
import * as store from "./store.js";
import { guideHTML } from "./guide.js";
import { eligibility } from "./prereq.js";

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const dlg = $("#dlg");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const initials = (name) => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const MAX_ROWS = 6;
const { MIN_YEARS, MAX_YEARS } = store;
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
  summer: Number(sessionGet("es-summer")) || null, // vald sommar (sommaren efter år N) eller null
  scope: "all",
  picker: null,
  pickerQuery: "",
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
  // Länk för att återställa lösenordet: visa "välj nytt lösenord" innan något annat.
  state.recovery = store.RECOVERY_LINK && !!state.user;
  await store.onAuthChange(async (user, event) => {
    if (event === "PASSWORD_RECOVERY") { state.user = user; state.recovery = true; renderUser(); $("#tabs").hidden = true; return renderLogin("reset"); }
    const changed = (user?.id || null) !== (state.user?.id || null);
    state.user = user;
    if (changed) await afterLogin();
  });
  await afterLogin();
}

async function afterLogin() {
  renderUser();
  if (!state.user || state.recovery) {
    $("#tabs").hidden = true;
    return renderLogin(state.recovery ? "reset" : "login");
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
  if (state.summer && !state.plan.summers.includes(state.summer)) state.summer = null;
  if (state.year > state.plan.years) state.year = state.plan.years;
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
  $("#logout").onclick = async () => { await flushSaves(); await store.signOut(); state.user = null; afterLogin(); };
}

// Inloggning med e-post och lösenord. Lägen: login, signup, forgot, reset (nytt lösenord från mejllänk).
function renderLogin(mode = "login", message = "", email = "") {
  const msg = message ? `<div class="msg ${message.startsWith("!") ? "err" : "ok"}">${esc(message.replace(/^!/, ""))}</div>` : "";
  const remember = (() => { try { return localStorage.getItem("es-remember") !== "0"; } catch { return true; } })();
  const T = {
    login: ["Logga in", "Logga in med din e-post och ditt lösenord.", "Logga in"],
    signup: ["Skapa konto", "Du kan använda vilken e-postadress som helst. Vi skickar ett mejl så att du kan bekräfta adressen.", "Skapa konto"],
    forgot: ["Glömt lösenordet?", "Ange din e-post så skickar vi en länk där du kan välja ett nytt lösenord.", "Skicka länk"],
    reset: ["Välj nytt lösenord", "Skriv ditt nya lösenord två gånger.", "Spara lösenord"],
  }[mode];
  const pw = (name, label, auto) => `<label class="field">${label}<input type="password" name="${name}" required minlength="8" autocomplete="${auto}"></label>`;
  app.innerHTML = `
    <div class="card login">
      <img src="assets/es-logo.png" alt="" class="login-logo">
      <h1>${T[0]}</h1>
      <p class="muted">${T[1]}</p>
      <form id="login-form" novalidate>
        ${mode !== "reset" ? `<label class="field">E-post<input type="email" name="email" required autocomplete="email" value="${esc(email)}"></label>` : ""}
        ${mode === "login" ? pw("password", "Lösenord", "current-password") : ""}
        ${mode === "signup" || mode === "reset" ? pw("password", mode === "reset" ? "Nytt lösenord (minst 8 tecken)" : "Lösenord (minst 8 tecken)", "new-password") + pw("password2", "Upprepa lösenordet", "new-password") : ""}
        ${mode === "login" || mode === "signup" ? `<label class="check"><input type="checkbox" name="remember" ${remember ? "checked" : ""}> Kom ihåg mig på den här enheten</label>` : ""}
        ${msg}
        <button class="btn primary" type="submit">${T[2]}</button>
      </form>
      <div class="login-links">
        ${mode === "login" ? `<button class="linkish" data-mode="forgot">Glömt lösenordet?</button><button class="linkish" data-mode="signup">Skapa konto</button>` : ""}
        ${mode === "signup" || mode === "forgot" ? `<button class="linkish" data-mode="login">Tillbaka till inloggningen</button>` : ""}
      </div>
    </div>`;

  app.onclick = (ev) => {
    const b = ev.target.closest("[data-mode]");
    if (b) renderLogin(b.dataset.mode, "", $('#login-form [name="email"]')?.value || "");
  };
  const form = $("#login-form");
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    const em = String(fd.get("email") || "").trim().toLowerCase();
    const p1 = String(fd.get("password") || "");
    const p2 = String(fd.get("password2") || "");
    const keep = fd.get("remember") === "on";
    const fail = (m) => renderLogin(mode, "!" + m, em);
    if (mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return fail("Skriv en giltig e-postadress.");
    if ((mode === "signup" || mode === "reset") && p1.length < 8) return fail("Lösenordet måste vara minst 8 tecken.");
    if ((mode === "signup" || mode === "reset") && p1 !== p2) return fail("Lösenorden är inte likadana.");
    if (mode === "login" && !p1) return fail("Skriv ditt lösenord.");
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      if (mode === "login") {
        await store.signIn(em, p1, keep);
      } else if (mode === "signup") {
        const ready = await store.signUp(em, p1, keep);
        if (!ready) renderLogin("login", "Kolla din mejl och klicka på länken för att bekräfta adressen. Sedan kan du logga in.", em);
      } else if (mode === "forgot") {
        await store.sendPasswordReset(em);
        renderLogin("login", "Om det finns ett konto med den adressen har vi skickat en länk för att välja nytt lösenord.", em);
      } else if (mode === "reset") {
        await store.updatePassword(p1);
        state.recovery = false;
        history.replaceState(null, "", location.pathname);
        await afterLogin();
      }
    } catch (e) {
      fail(e.message);
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
    saveTimer = null;
    if (!state.user) return;
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

// Sparar direkt om något väntar (vid utloggning eller när sidan stängs).
async function flushSaves() {
  const tasks = [];
  if (saveTimer && state.user) { clearTimeout(saveTimer); saveTimer = null; tasks.push(store.saveMyPlan(state.user, state.plan)); }
  if (gradeTimer && state.user) { clearTimeout(gradeTimer); gradeTimer = null; tasks.push(store.saveGrades(state.user, state.grades)); }
  await Promise.allSettled(tasks);
}
addEventListener("pagehide", () => { flushSaves(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSaves(); });

let gradeTimer = null;
function gradesChanged() {
  clearTimeout(gradeTimer);
  gradeTimer = setTimeout(() => {
    gradeTimer = null;
    if (state.user) store.saveGrades(state.user, state.grades).catch((e) => alert("Kunde inte spara betyg: " + e.message));
  }, 400);
}

// ---------- Hjälpfunktioner för planen ----------

const itemCourse = (it) => (it.code ? courseById(it.code) : null);
const itemName = (it) => itemCourse(it)?.name ?? it.custom?.name ?? (it.snap?.name ? `${it.snap.name} (borttagen ur kurspoolen)` : "Borttagen kurs");
const itemHp = (it) => itemCourse(it)?.hp ?? (Number(it.custom?.hp ?? it.snap?.hp) || 0);
// Kopia av kursens grunddata, så att planen fungerar även om kursen tas bort ur poolen.
const snapOf = (c) => ({ name: c.name, hp: c.hp, level: c.level, teknik: c.teknik });
const rowsOf = (y) => state.plan.rows[y] ?? 3;
const yearItems = (y) => state.plan.items.filter((it) => it.year === y && !it.summer);
const summerItems = (y) => state.plan.items.filter((it) => it.summer && it.year === y).sort((a, b) => a.row - b.row);
const summerHp = (y) => summerItems(y).reduce((s, it) => s + itemHp(it), 0);
const nextSummerRow = (y) => Math.max(-1, ...summerItems(y).map((it) => it.row)) + 1;
const periodText = (it) => (it.summer ? "sommar" : `P${it.period}${it.span > 1 ? "–" + (it.period + it.span - 1) : ""}`);
const whenText = (it) => (it.summer ? `Sommaren efter år ${it.year}` : `År ${it.year} · ${periodText(it)}`);
const yearHp = (y) => yearItems(y).reduce((s, it) => s + itemHp(it), 0);
const thickRowsOf = (y) => Math.min(THICK_ROWS, rowsOf(y));
// Antal rader en kurs tar = studietakt. En rad är 5 hp per period (normal takt är 3 rader).
// Kurser under 10 hp tar alltid en rad. 3 rader = "tjock" kurs som fyller hela perioden.
function heightFor(c, span) {
  if (c.thick) return THICK_ROWS;
  const hp = Number(c.hp) || 0;
  if (hp < 10) return 1;
  return Math.max(1, Math.min(THICK_ROWS, Math.round(hp / (span * 5))));
}
// Fält för ett nytt objekt i planen utifrån kursens höjd
const sizeFields = (c, span) => {
  const h = heightFor(c, span);
  return h >= THICK_ROWS ? { thick: true } : { thick: false, ...(h > 1 ? { h } : {}) };
};
const itemH = (it) => (it.thick ? thickRowsOf(it.year) : it.h || 1);

function cellsOf(it) {
  const rows = it.thick ? [...Array(thickRowsOf(it.year)).keys()] : [...Array(it.h || 1).keys()].map((i) => it.row + i);
  const cells = [];
  for (const r of rows) for (let p = it.period; p < it.period + it.span; p++) cells.push(`${r}:${p}`);
  return cells;
}

function occupied(y, ignoreId) {
  const map = new Map();
  for (const it of yearItems(y)) if (it.id !== ignoreId) for (const c of cellsOf(it)) map.set(c, it);
  return map;
}

function placementError(y, period, row, span, thick, ignoreId, h = 1) {
  if (period + span - 1 > 4) return `Kursen går över ${span} perioder och får inte plats från period ${period}.`;
  if (!thick && row + h > rowsOf(y)) return `Kursen tar ${h} rader (högre studietakt) och får inte plats från rad ${row + 1}.`;
  const occ = occupied(y, ignoreId);
  const rows = thick ? [...Array(thickRowsOf(y)).keys()] : [...Array(h).keys()].map((i) => row + i);
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
          <label class="field">Namn (syns för andra ESare)
            <input id="p-name" value="${esc(state.plan.name)}" maxlength="80" placeholder="För- och efternamn">
          </label>
          <label class="field">Startår
            <input id="p-year" type="number" min="2010" max="2040" value="${esc(state.plan.start_year ?? "")}" placeholder="t.ex. 2022">
          </label>
          <label class="check" title="Kurserna du läser just nu syns alltid för andra ESare."><input id="p-hide-done" type="checkbox" ${state.plan.hide_done ? "checked" : ""}> Dölj min plan och avklarade kurser</label>
        </div>

        <nav class="year-tabs" aria-label="Välj år eller sommar">${yearTabs()}</nav>

        <section class="card year-card" id="year-card">${state.summer ? summerCard(state.summer) : yearCard(y)}</section>
      </div>
      <aside class="sidebar card" id="reqs"></aside>
    </div>`;

  renderReqs();
  bindPlan();
}

// Årsflikar med ett plus mellan åren för att lägga till en sommar.
function yearTabs() {
  const sel = state.summer;
  let html = "";
  const last = state.plan.years;
  for (let n = 1; n <= last; n++) {
    const on = !sel && n === state.year;
    html += `<button data-year="${n}" class="${on ? "active" : ""}" aria-current="${on}"><span>År ${n}</span><small>${yearHp(n)} hp</small></button>`;
    if (n === last) break;
    if (state.plan.summers.includes(n)) {
      const son = sel === n;
      html += `<button data-summer="${n}" class="sum-tab ${son ? "active" : ""}" aria-current="${son}" title="Sommaren mellan år ${n} och ${n + 1}"><span class="sum-full">Sommar</span><span class="sum-short" aria-hidden="true">☀</span><small>${summerHp(n)} hp</small></button>`;
    } else {
      html += `<button data-add-summer="${n}" class="add-summer" title="Lägg till sommar mellan år ${n} och ${n + 1}" aria-label="Lägg till sommar mellan år ${n} och ${n + 1}">${ICONS.plus}</button>`;
    }
  }
  if (last < MAX_YEARS) html += `<button data-add-year class="add-year" title="Lägg till ett år (paus eller deltidsstudier)" aria-label="Lägg till år ${last + 1}">${ICONS.plus}<span>År</span></button>`;
  return html;
}

function summerCard(y) {
  const items = summerItems(y);
  return `
    <header class="year-head">
      <h2>Sommar</h2>
      <span class="year-hp">mellan år ${y} och ${y + 1} · ${summerHp(y)} hp</span>
    </header>
    <p class="muted small" style="margin-top:0">Sommaren har bara en period. Här kan du bara lägga sommarkurser.</p>
    <div class="summer-list">
      ${items.map((it) => {
        const icon = it.status === "done" ? ICONS.lock : it.status === "ongoing" ? ICONS.clock : "";
        const e = eligOf(it);
        return `<button class="pill ${it.status}" data-item="${esc(it.id)}" title="${esc(itemName(it))} – ${STATUSES[it.status]}${offPeriod(it) ? ". " + esc(offNote(it)) : ""}${esc(eligTitle(e))}">${lamp(e)}${offPeriod(it) ? WARN : icon}<span class="pill-name">${esc(itemName(it))}</span><span class="hp">${itemHp(it)} hp</span></button>`;
      }).join("")}
      <button class="slot summer-add" id="add-summer-course">${ICONS.plus} Lägg till sommarkurs</button>
    </div>
    <div class="year-actions">
      <span class="spacer"></span>
      <button class="btn small ghost danger" id="remove-summer">Ta bort sommaren</button>
    </div>`;
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
    const lockedByThick = items.some((it) => it.thick) && r < THICK_ROWS;
    cells += `<button class="row-del" style="grid-row:${r + 1};grid-column:5" data-del-row="${r}" ${rows <= 1 || lockedByThick ? "disabled" : ""} title="Ta bort rad" aria-label="Ta bort rad ${r + 1}">${ICONS.trash}</button>`;
  }

  const pills = items.map((it) => {
    const rowSpan = itemH(it);
    const e = eligOf(it);
    const icon = it.status === "done" ? ICONS.lock : it.status === "ongoing" ? ICONS.clock : "";
    const name = itemName(it);
    return `
      <button class="pill ${it.status} ${it.thick ? "thick" : rowSpan > 1 ? "tall" : ""}" data-item="${esc(it.id)}"
        style="grid-row:${(it.thick ? 0 : it.row) + 1} / span ${rowSpan};grid-column:${it.period} / span ${it.span}"
        title="${esc(name)} – ${STATUSES[it.status]}${offPeriod(it) ? ". " + esc(offNote(it)) : ""}${esc(eligTitle(e))}">
        ${lamp(e)}${offPeriod(it) ? WARN : icon}<span class="pill-name">${esc(name)}</span><span class="hp">${itemHp(it)} hp</span>
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
      ${y === state.plan.years && y > MIN_YEARS ? `<button class="btn small ghost danger" id="remove-year">Ta bort år ${y}</button>` : ""}
    </div>
    ${items.length ? "" : `<p class="muted small empty-hint">Klicka på en tom ruta för att välja kurs för den perioden.</p>`}`;
}

function bindPlan() {
  $("#p-name").oninput = (e) => { state.plan.name = e.target.value; changed(); };
  $("#p-year").oninput = (e) => {
    const y = Number(e.target.value);
    state.plan.start_year = Number.isInteger(y) && y >= 2010 && y <= 2040 ? y : null;
    changed();
  };
  $("#p-hide-done").onchange = (e) => { state.plan.hide_done = e.target.checked; changed(); };

  app.onclick = (ev) => {
    const t = ev.target;
    if (t.closest("#open-guide")) { markGuideSeen(); return showGuide(); }
    if (t.closest("#hide-welcome")) { markGuideSeen(); return renderPlan(); }
    const yb = t.closest("[data-year]");
    if (yb) { state.year = Number(yb.dataset.year); selectSummer(null); return renderPlan(); }
    const sb = t.closest("[data-summer]");
    if (sb) { selectSummer(Number(sb.dataset.summer)); return renderPlan(); }
    const ab = t.closest("[data-add-summer]");
    if (ab) {
      const n = Number(ab.dataset.addSummer);
      state.plan.summers = [...new Set([...state.plan.summers, n])].sort();
      selectSummer(n);
      changed();
      return renderPlan();
    }
    if (t.closest("[data-add-year]")) {
      const n = state.plan.years + 1;
      if (n > MAX_YEARS) return;
      state.plan.years = n;
      state.plan.rows[n] = 3;
      state.year = n;
      selectSummer(null);
      changed();
      return renderPlan();
    }
    if (t.closest("#remove-year")) {
      const n = state.plan.years;
      if (n <= MIN_YEARS) return;
      // Året och sommaren före det försvinner
      const list = state.plan.items.filter((it) => it.year === n || (it.summer && it.year === n - 1));
      if (list.length && !confirm(`Ta bort år ${n} och ${plural(list.length, "kurs", "kurser")} (${list.map(itemName).join(", ")})?`)) return;
      state.plan.items = state.plan.items.filter((it) => !list.includes(it));
      state.plan.summers = state.plan.summers.filter((x) => x < n - 1);
      delete state.plan.rows[n];
      state.plan.years = n - 1;
      state.year = n - 1;
      selectSummer(null);
      changed();
      return renderPlan();
    }
    if (t.closest("#add-summer-course")) return openPicker({ year: state.summer, period: 1, row: nextSummerRow(state.summer), summer: true });
    if (t.closest("#remove-summer")) {
      const n = state.summer;
      const list = summerItems(n);
      if (list.length && !confirm(`Ta bort sommaren och ${plural(list.length, "kurs", "kurser")} (${list.map(itemName).join(", ")})?`)) return;
      state.plan.items = state.plan.items.filter((it) => !list.includes(it));
      state.plan.summers = state.plan.summers.filter((x) => x !== n);
      selectSummer(null);
      changed();
      return renderPlan();
    }

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
      state.plan.items = state.plan.items.filter((it) => it.year !== state.year || it.summer);
      state.plan.rows[state.year] = 3;
      changed();
      return renderPlan();
    }
  };
}

function selectSummer(n) {
  state.summer = n;
  sessionSet("es-summer", n || "");
  sessionSet("es-year", state.year);
}

function deleteRow(y, r) {
  const victims = yearItems(y).filter((it) => !it.thick && it.row <= r && r < it.row + (it.h || 1));
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
      else addItem(y, period, 0, { code: c.id, span, thick: true, snap: snapOf(c) }, status);
      continue;
    }
    let row = [...Array(rowsOf(y)).keys()].find((r) => !placementError(y, period, r, span, false));
    if (row === undefined) {
      if (rowsOf(y) >= MAX_ROWS) { skipped.push(c.name); continue; }
      state.plan.rows[y] = rowsOf(y) + 1;
      row = rowsOf(y) - 1;
    }
    addItem(y, period, row, { code: c.id, span, thick: false, snap: snapOf(c), ...sizeFields(c, span) }, status);
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
// force: lägg kursen där man klickade även om den inte ges då (offErr = bara perioden är fel).
function slotFor(c, ctx, ignoreId, force = false) {
  if (ctx.summer) {
    if (c.summer || force) return { start: 1, span: 1, row: nextSummerRow(ctx.year), err: null };
    return { err: `Ges inte på sommaren (ges ${offeringText(c).join(", ")}).`, offErr: true };
  }
  const o = c.offerings.find((x) => x.periods.includes(ctx.period));
  let start, span;
  if (o) { start = o.periods[0]; span = o.periods.length; }
  else if (c.anyPeriod) { start = ctx.period; span = 1; }
  else if (force) { start = ctx.period; span = Math.min(c.offerings[0]?.periods.length || 1, 5 - ctx.period); }
  else if (c.summer) return { err: "Sommarkurs. Ges bara på sommaren (plustecknet mellan två år).", offErr: true };
  else return { err: `Ges inte i period ${ctx.period} (ges ${offeringText(c).join(", ")}).`, offErr: true };
  const size = sizeFields(c, span);
  if (size.thick) return { start, span, row: 0, size, err: placementError(ctx.year, start, 0, span, true, ignoreId) };
  const h = size.h || 1;
  const rows = [ctx.row, ...[...Array(rowsOf(ctx.year)).keys()].filter((r) => r !== ctx.row)];
  const row = rows.find((r) => !placementError(ctx.year, start, r, span, false, ignoreId, h));
  if (row === undefined) return { err: placementError(ctx.year, start, Math.min(ctx.row, Math.max(0, rowsOf(ctx.year) - h)), span, false, ignoreId, h) + " Lägg till en rad eller ta bort en kurs." };
  return { start, span, row, size, err: null };
}

// Kurs i samma "en av"-grupp (t.ex. examensarbete UU/SLU) som redan finns i planen.
const groupItem = (c) => c.oneOf && state.plan.items.find((it) => it.code !== c.id && courseById(it.code)?.oneOf === c.oneOf);

function pickEntry(c, ctx) {
  const placed = placedWhere(c.id);
  const replaces = groupItem(c);
  const slot = slotFor(c, ctx, replaces?.year === ctx.year ? replaces.id : undefined);
  const off = !placed && slot.offErr;
  const err = placed ? `Redan inlagd (${whenText(placed).toLowerCase()})` : off ? null : slot.err;
  const mates = matesFor(c.id).length;
  const probe = !err && !off && !slot.err ? eligibility(state.plan, { id: "probe", code: c.id, year: ctx.year, period: slot.start, span: slot.span, summer: !!ctx.summer, status: "planned" }) : null;
  const eligNote = probe && probe.state !== "ok"
    ? `<span class="pick-elig ${probe.state}">${lamp(probe, true)}${ELIG_TEXT[probe.state]}: ${esc(probe.items.filter((i) => i.state !== "ok").map((i) => i.text).join(", "))}</span>` : "";
  const where = slot.err ? "" : ctx.summer ? "Hamnar på sommaren" : `Hamnar i period ${Number(slot.start)}${slot.span > 1 ? "–" + (Number(slot.start) + Number(slot.span) - 1) : ""}`;
  return `
    <button class="pick ${off ? "off" : ""}" data-pick="${esc(c.id)}" ${off ? 'data-off="1"' : ""} ${err ? "disabled" : ""}>
      <span class="pick-main">
        <span class="pick-name">${esc(c.name)}</span>
        <span class="course-meta">
          ${courseTags(c)}
          <span>Ges ${esc(offeringText(c).join(", "))}</span>
          ${c.year ? `<span>Rek. år ${esc(c.year)}</span>` : ""}
          ${!ctx.summer && !slot.err && slot.size?.thick ? `<span class="tag">Tar alla tre rader</span>` : !ctx.summer && !slot.err && slot.size?.h > 1 ? `<span class="tag">Tar ${slot.size.h} rader</span>` : ""}
          ${mates ? `<span class="tag mates">${plural(mates, "ESare", "ESare")}</span>` : ""}
        </span>
        ${err ? `<span class="pick-err">${esc(err)}</span>`
          : off ? `<span class="pick-warn">${esc(slot.err)} Klicka för att lägga till ändå.</span>`
          : `<span class="pick-ok">${where}${replaces ? ` · ersätter ${esc(itemName(replaces))}` : ""}</span>${eligNote}`}
      </span>
    </button>`;
}

function renderPicker() {
  const ctx = state.picker;
  const q = state.pickerQuery.trim().toLowerCase();
  const runsHere = (c) => (ctx.summer ? c.summer : c.offerings.some((o) => o.periods.includes(ctx.period)));
  let sections;

  if (q) {
    const hits = pool.courses.filter((c) => c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q));
    const ok = hits.filter((c) => runsHere(c) || (!ctx.summer && c.anyPeriod));
    sections = [["Sökresultat", ok], [ctx.summer ? "Ges inte på sommaren" : `Ges inte i period ${ctx.period}`, hits.filter((c) => !ok.includes(c))]];
  } else if (ctx.summer) {
    const here = pool.courses.filter(runsHere);
    sections = [["Sommarkurser", here]];
  } else {
    const shown = new Set();
    const take = (list) => list.filter((c) => !shown.has(c.id) && shown.add(c.id));
    const here = pool.courses.filter(runsHere);
    sections = [[`Rekommenderat år ${ctx.year}, ges i period ${ctx.period}`, take(here.filter((c) => c.year === ctx.year))]];
    for (const f of pool.folders) sections.push([`${f.name} – ges i period ${ctx.period}`, take(here.filter((c) => c.folders.includes(f.id)))]);
    sections.push([`Övriga kurser i period ${ctx.period}`, take(here)]);
    sections.push(["Valfri period", take(pool.courses.filter((c) => c.anyPeriod))]);
  }

  const body = sections
    .filter(([, list]) => list.length)
    .map(([title, list]) => `<h3 class="pick-h">${esc(title)}</h3>${list.map((c) => pickEntry(c, ctx)).join("")}`)
    .join("") || `<p class="muted">Inga kurser matchar.</p>`;

  dlg.innerHTML = `
    <div class="dlg-head">
      <div>
        <h2>Välj kurs</h2>
        <p class="muted small">${ctx.summer ? `Sommaren mellan år ${ctx.year} och ${ctx.year + 1}` : `År ${ctx.year} · period ${ctx.period} · rad ${ctx.row + 1}`}</p>
      </div>
      <div class="dlg-head-actions">
        <button type="button" class="btn small" data-open-custom>${ICONS.plus} Privat kurs</button>
        <button class="icon-btn" data-close aria-label="Stäng">✕</button>
      </div>
    </div>
    <input type="search" id="pick-q" placeholder="Sök bland alla kurser i kurspoolen" value="${esc(state.pickerQuery)}">
    ${state.pickerQuery ? "" : `<p class="muted small" style="margin:6px 0 0">Här visas kurser som ges ${ctx.summer ? "på sommaren" : `i period ${ctx.period}`}. Sök efter en kurs för att lägga till den ändå, till exempel om du tentar den i en annan period.</p>`}
    <div class="pick-list">${body}</div>
    <details class="custom-box" id="custom-box">
      <summary>Lägg till en privat kurs (syns bara i din plan)</summary>
      <p class="muted small">Vill du att andra ska kunna välja kursen? Lägg till den i Kurspoolen i stället.</p>
      <form id="custom-form" class="custom-form">
        <label class="field wide">Kursnamn<input name="name" required></label>
        <label class="field">Kurskod<input name="code" placeholder="valfritt"></label>
        <label class="field">hp<input name="hp" type="number" min="0.5" step="0.5" required value="5"></label>
        <label class="field">Nivå<select name="level">${LEVELS.map((l) => `<option ${l === "A1N" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        ${ctx.summer ? "" : `<label class="field">Perioder<select name="span">${[1, 2, 3, 4].map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label>`}
        <label class="check"><input type="checkbox" name="teknik" checked> Huvudområde teknik</label>
        ${ctx.summer ? "" : `<label class="field">Rader (studietakt)<select name="h"><option value="1">1 rad</option><option value="2">2 rader</option><option value="3">3 rader (heltid)</option></select></label>`}
        <p class="pick-err" id="custom-err"></p>
        <button class="btn primary" type="submit">Lägg till</button>
      </form>
    </details>`;

  const qi = $("#pick-q");
  qi.oninput = () => {
    if (!state.picker) return;
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
    const span = ctx.summer ? 1 : Number(f.get("span"));
    const h = ctx.summer ? 1 : Number(f.get("h")) || 1;
    const thick = h >= THICK_ROWS;
    const err = ctx.summer ? null : placementError(ctx.year, ctx.period, thick ? 0 : ctx.row, span, thick, undefined, h);
    if (err) { $("#custom-err").textContent = err; return; }
    if (!String(f.get("name")).trim()) { $("#custom-err").textContent = "Kursen behöver ett namn."; return; }
    addItem(ctx.year, ctx.summer ? 1 : ctx.period, ctx.summer ? nextSummerRow(ctx.year) : ctx.row, {
      span, thick, ...(h === 2 ? { h } : {}), ...(ctx.summer ? { summer: true } : {}),
      custom: { name: f.get("name").trim(), code: f.get("code").trim(), hp: Number(f.get("hp")), level: f.get("level"), teknik: f.get("teknik") === "on" },
    });
    dlg.close();
    renderPlan();
  };
}

// Varning innan en kurs läggs i en period där den inte ges.
function renderForce(c, ctx) {
  const replaces = groupItem(c);
  const why = slotFor(c, ctx, replaces?.year === ctx.year ? replaces.id : undefined);
  const slot = slotFor(c, ctx, replaces?.year === ctx.year ? replaces.id : undefined, true);
  const where = ctx.summer ? "på sommaren" : `i period ${slot.start}${slot.span > 1 ? "–" + (slot.start + slot.span - 1) : ""}`;
  dlg.innerHTML = `
    <div class="dlg-head">
      <div>
        <h2>Lägga till ändå?</h2>
        <p class="muted small">${ctx.summer ? `Sommaren mellan år ${ctx.year} och ${ctx.year + 1}` : `År ${ctx.year} · period ${ctx.period}`}</p>
      </div>
      <button class="icon-btn" data-close aria-label="Stäng">✕</button>
    </div>
    <div class="warn-box"><strong>${esc(c.name)}</strong> ${esc(why.err || "")}</div>
    <p>Det kan stämma ändå, till exempel om du är registrerad på kursen men läser den på egen hand och skriver tentan i en annan period eller på sommaren, eller om kursen har bytt perioder.</p>
    ${slot.err ? `<p class="pick-err">${esc(slot.err)}</p>` : `<p class="muted small">Kursen hamnar ${where} och markeras med en varning i planen.${replaces ? ` Den ersätter ${esc(itemName(replaces))}.` : ""}</p>`}
    <div class="dlg-foot">
      <button class="btn" data-back>Tillbaka</button>
      <button class="btn primary" data-force="${esc(c.id)}" ${slot.err ? "disabled" : ""}>Lägg till ändå</button>
    </div>`;
}

// Ligger en planerad kurs utanför de perioder den ges? Räknas ut varje gång, så att varningen
// också visas om kursens perioder ändras i kurspoolen. Läser man kursen eller har klarat den
// visas ingen varning.
function offPeriod(it) {
  const c = itemCourse(it);
  if (!c || it.status !== "planned") return false;
  if (it.summer) return !c.summer;
  if (c.anyPeriod) return false;
  return !c.offerings.some((o) => o.periods[0] === it.period && o.periods.length === it.span);
}
const offNote = (it) => `Ligger utanför kursens ordinarie perioder (ges ${offeringText(itemCourse(it)).join(", ")}).`;
const WARN = `<span class="pill-warn" aria-hidden="true">!</span>`;

// Behörighet visas bara för planerade kurser. Röd lampa = inte behörig, gul = behörig
// först när planerade/pågående kurser blir klara.
function eligOf(it) {
  if (it.status !== "planned" || it.eligOk) return null;
  const e = eligibility(state.plan, it);
  return e && e.state !== "ok" ? e : null;
}
const ELIG_TEXT = { missing: "Du är inte behörig enligt planen", pending: "Du blir behörig när planerade kurser är klara" };
// Lampa med texten "Behörighet" i kursens hörn, eller bara en prick (dot = true) i listor.
const lamp = (e, dot = false) => (!e ? "" : dot
  ? `<span class="lamp ${e.state}" aria-hidden="true"></span>`
  : `<span class="lamp-tag ${e.state}" aria-label="${ELIG_TEXT[e.state]}"><i></i>Behörighet</span>`);
const eligTitle = (e) => (e ? `. ${ELIG_TEXT[e.state]}: ${e.items.filter((i) => i.state !== "ok").map((i) => i.text).join(", ")}` : "");

// Dialogen används av kursväljaren, kursdetaljer och kurspoolens formulär.
let dlgHandler = null;

// Osparade ändringar: formulär i kurspoolen registrerar sig med guardForm().
// Försöker man stänga med ändringar kvar får man välja att spara, slänga eller fortsätta.
let dlgDirty = null;
const formSnapshot = (form) => JSON.stringify([...new FormData(form)]);
function guardForm(form) {
  const start = formSnapshot(form);
  dlgDirty = () => form.isConnected && formSnapshot(form) !== start;
}
function requestClose() {
  if (!dlgDirty?.()) return dlg.close();
  if (dlg.querySelector(".unsaved")) return;
  dlg.insertAdjacentHTML("beforeend", `
    <div class="unsaved" role="alertdialog" aria-labelledby="unsaved-h">
      <div class="unsaved-box">
        <h3 id="unsaved-h">Du har osparade ändringar</h3>
        <p class="muted">Vill du spara ändringarna innan du stänger?</p>
        <div class="unsaved-actions">
          <button type="button" class="btn ghost" data-unsaved="keep">Fortsätt ändra</button>
          <button type="button" class="btn danger" data-unsaved="discard">Släng ändringar</button>
          <button type="button" class="btn primary" data-unsaved="save">Spara</button>
        </div>
      </div>
    </div>`);
  dlg.querySelector('[data-unsaved="save"]').focus();
}
dlg.addEventListener("cancel", (ev) => {
  if (dlg.querySelector(".unsaved")) { ev.preventDefault(); dlg.querySelector(".unsaved").remove(); return; }
  if (dlgDirty?.()) { ev.preventDefault(); requestClose(); }
});
addEventListener("beforeunload", (ev) => {
  if (dlg.open && dlgDirty?.()) { ev.preventDefault(); ev.returnValue = ""; }
});

// Klick utanför själva dialogrutan (på bakgrunden)
const onBackdrop = (ev) => {
  if (ev.target !== dlg) return false;
  const r = dlg.getBoundingClientRect();
  return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
};

dlg.addEventListener("click", (ev) => {
  const un = ev.target.closest("[data-unsaved]");
  if (un) {
    const choice = un.dataset.unsaved;
    dlg.querySelector(".unsaved")?.remove();
    if (choice === "discard") { dlgDirty = null; dlg.close(); }
    if (choice === "save") dlg.querySelector("form")?.requestSubmit();
    return;
  }
  if (dlg.querySelector(".unsaved")) return;
  if (onBackdrop(ev) || ev.target.closest("[data-close]")) return requestClose();
  const person = ev.target.closest("[data-person]");
  if (person) return openPerson(Number(person.dataset.person));
  if (dlgHandler) return dlgHandler(ev);
  if (ev.target.closest("[data-back]") && state.picker) return renderPicker();
  if (ev.target.closest("[data-open-custom]")) {
    const box = $("#custom-box");
    box.open = true;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    box.querySelector('[name="name"]').focus({ preventScroll: true });
    return;
  }
  const forced = ev.target.closest("[data-force]");
  const pick = forced || ev.target.closest("[data-pick]");
  if (pick && !pick.disabled && state.picker) {
    const c = courseById(forced ? forced.dataset.force : pick.dataset.pick);
    const ctx = state.picker;
    if (pick.dataset.off) return renderForce(c, ctx);
    const replaces = groupItem(c);
    const slot = slotFor(c, ctx, replaces?.year === ctx.year ? replaces.id : undefined, !!forced);
    if (slot.err) { alert(slot.err); return; }
    if (replaces) state.plan.items = state.plan.items.filter((x) => x !== replaces);
    addItem(ctx.year, slot.start, slot.row, { code: c.id, span: slot.span, snap: snapOf(c), ...(ctx.summer ? { summer: true, thick: false } : slot.size) }, replaces?.status || "planned");
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
  const eo = ev.target.closest("[data-elig-ok]");
  if (eo) {
    const it = state.plan.items.find((x) => x.id === eo.dataset.eligOk);
    if (eo.checked) it.eligOk = true; else delete it.eligOk;
    changed();
    renderPlan();
    return openItem(it.id);
  }
  const sw = ev.target.closest("[data-swap]");
  if (sw) {
    const it = state.plan.items.find((x) => x.id === sw.dataset.id);
    const alt = courseById(sw.dataset.swap);
    const altOff = alt?.offerings.find((o) => o.periods[0] === it.period && o.periods.length === it.span);
    const fits = it.summer ? alt?.summer : (altOff || alt?.anyPeriod) && heightFor(alt, it.span) === heightFor(itemCourse(it) || {}, it.span);
    if (!alt || placedWhere(alt.id) || !fits) {
      alert("Varianten går inte att byta till på samma plats. Ta bort kursen och välj den andra varianten i kursväljaren.");
      return;
    }
    it.code = alt.id;
    it.snap = snapOf(alt);
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
dlg.addEventListener("close", () => { state.picker = null; dlgHandler = null; dlgDirty = null; });

function openDialog(html, handler = null) {
  dlgHandler = handler;
  dlgDirty = null;
  dlg.innerHTML = html;
  if (!dlg.open) dlg.showModal();
}

// ---------- Kursdetaljer i planen ----------

function openItem(id) {
  const it = state.plan.items.find((x) => x.id === id);
  if (!it) return;
  state.picker = null;
  const c = itemCourse(it);
  const x = it.custom || it.snap || {};
  const mates = c ? matesFor(c.id) : [];
  openDialog(`
    <div class="dlg-head">
      <div>
        <h2>${esc(itemName(it))}</h2>
        <p class="muted small">${esc(whenText(it))}${it.thick ? " · tar alla tre rader" : it.h > 1 ? ` · tar ${it.h} rader` : ""}</p>
      </div>
      <button class="icon-btn" data-close aria-label="Stäng">✕</button>
    </div>
    <div class="course-meta">
      ${c ? `${courseTags(c)}${c.areas.map((a) => `<span class="tag">${esc(a)}</span>`).join("")}`
      : `${x.code ? `<span>${esc(x.code)}</span>` : ""}<span>${Number(x.hp) || 0} hp</span><span class="tag">${esc(x.level)}</span>${x.teknik ? `<span class="tag">Teknik</span>` : ""}<span class="tag">${it.custom ? "Privat kurs" : "Borttagen ur kurspoolen"}</span>`}
    </div>
    ${offPeriod(it) ? `<div class="warn-box small">${esc(offNote(it))}</div>` : ""}
    ${c?.prereq ? `<p class="small"><strong>Behörighet:</strong> ${esc(c.prereq)}</p>` : ""}
    ${eligBlock(it)}
    ${c?.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
    <h3 class="pick-h">Status</h3>
    <div class="seg" role="group" aria-label="Status">
      ${Object.entries(STATUSES).reverse().map(([k, l]) => `<button data-set-status="${k}" data-id="${esc(it.id)}" class="${it.status === k ? "on" : ""}" aria-pressed="${it.status === k}">${l}</button>`).join("")}
    </div>
    ${c ? `<h3 class="pick-h">ESare som läser kursen</h3>
      ${mates.length ? `<div class="people">${mates.map(({ m, it: mi }) => personChip(m, mi.status)).join("")}</div>` : `<p class="muted small">Ingen ännu.</p>`}` : ""}
    ${c?.oneOf ? pool.courses.filter((x) => x.oneOf === c.oneOf && x.id !== c.id).map((alt) => `
      <h3 class="pick-h">Byt variant</h3>
      <button class="btn small" data-swap="${esc(alt.id)}" data-id="${esc(it.id)}">Byt till ${esc(alt.name)} (${esc(alt.code)})</button>`).join("") : ""}
    <div class="dlg-foot">
      <button class="btn danger" data-remove="${esc(it.id)}">Ta bort från planen</button>
      <button class="btn" data-close>Klar</button>
    </div>`);
}

function eligBlock(it) {
  if (it.status !== "planned") return "";
  const e = eligibility(state.plan, it);
  if (!e) return "";
  const icon = { ok: "✓", pending: "…", missing: "✗" };
  const head = it.eligOk ? "Du har markerat att du är behörig." : e.state === "ok" ? "Du är behörig." : ELIG_TEXT[e.state] + ".";
  return `
    <div class="elig-box ${it.eligOk ? "ok" : e.state}">
      <strong>${it.eligOk ? "" : lamp(e.state === "ok" ? null : e, true)} ${esc(head)}</strong>
      <ul>${e.items.map((i) => `<li class="${i.state}"><span>${icon[i.state]}</span>${esc(i.text)}${i.detail && i.state !== "ok" ? ` <span class="muted">(${esc(i.detail)})</span>` : ""}</li>`).join("")}</ul>
      <p class="muted small">Kontrollen räknar bara hp och kurser i din plan som slutar före kursen. Krav som gymnasiekurser och Engelska 6 kontrolleras inte.</p>
      <label class="check small"><input type="checkbox" data-elig-ok="${esc(it.id)}" ${it.eligOk ? "checked" : ""}> Jag är behörig ändå (till exempel tillgodoräknat eller dispens)</label>
    </div>`;
}

// ---------- Examenskrav ----------

// hp per huvudområde, klart och i hela planen (varje kurs räknas en gång)
function areaTotals() {
  const seen = new Set();
  const out = new Map();
  const add = (area, hp, done) => {
    if (!out.has(area)) out.set(area, { done: 0, all: 0 });
    const o = out.get(area);
    o.all += hp;
    if (done) o.done += hp;
  };
  for (const it of state.plan.items) {
    const key = it.code || it.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = itemCourse(it);
    const x = c || it.custom || it.snap || {};
    const hp = itemHp(it);
    const areas = c ? c.areas : x.teknik ? ["Teknik"] : [];
    for (const a of areas) add(a, hp, it.status === "done");
    if (String(x.level || "").startsWith("A")) add("Avancerad nivå", hp, it.status === "done");
  }
  return out;
}

function areaPanel() {
  const t = areaTotals();
  const main = ["Teknik", "Matematik", "Fysik"];
  const rest = [...t.keys()].filter((a) => !main.includes(a) && a !== "Avancerad nivå").sort((a, b) => t.get(b).all - t.get(a).all);
  const row = (a, cls = "") => {
    const v = t.get(a) || { done: 0, all: 0 };
    return `<tr class="${cls}"><td>${esc(a)}</td><td>${v.done}</td><td>${v.all}</td></tr>`;
  };
  let open = false;
  try { open = sessionStorage.getItem("es-areas-open") === "1"; } catch { /* ignorera */ }
  return `
    <details class="area-panel" id="area-panel" ${open ? "open" : ""}>
      <summary>Hp per huvudområde</summary>
      <table>
        <thead><tr><th>Huvudområde</th><th>Klart</th><th>I planen</th></tr></thead>
        <tbody>
          ${main.map((a) => row(a, "main")).join("")}
          ${row("Avancerad nivå", "adv")}
          ${rest.map((a) => row(a)).join("")}
        </tbody>
      </table>
      <p class="muted small">En kurs kan ha flera huvudområden och räknas då till alla.</p>
    </details>`;
}

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
    ${areaPanel()}
    ${rows}
    <div class="legend"><span><i style="background:var(--ok)"></i>Klart</span><span><i style="background:var(--accent);opacity:.35"></i>Läser/planerat</span></div>
    ${shown.warnings.length ? `<div class="warnings">${shown.warnings.map((w) => `<div>${esc(w)}</div>`).join("")}</div>` : ""}
    <p class="save-state" id="save-state">${esc(state.saveState)}</p>`;

  $("#area-panel").addEventListener("toggle", (e) => { try { sessionStorage.setItem("es-areas-open", e.target.open ? "1" : ""); } catch { /* ignorera */ } });
  $("#reqs").querySelectorAll("[data-scope]").forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); state.scope = b.dataset.scope; renderReqs(); }));
}

// ---------- Kurspoolen ----------

const folderHp = (id) => coursesIn(id).reduce((s, c) => s + c.hp, 0);

function renderPool() {
  if (state.poolFolder !== "all" && !pool.folders.some((f) => f.id === state.poolFolder)) state.poolFolder = "programplanen";
  const fid = state.poolFolder;
  const folder = pool.folders.find((f) => f.id === fid);
  const q = state.poolQuery.trim().toLowerCase();
  let list = fid === "all" ? pool.courses : coursesIn(fid);
  list = list.filter((c) =>
    (!q || c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q)) &&
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
          <input type="search" id="pool-q" placeholder="Sök kursnamn eller kurskod" value="${esc(state.poolQuery)}">
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
          ${mates ? `<span class="tag mates">${plural(mates, "ESare", "ESare")}</span>` : ""}
        </div>
      </summary>
      <div class="pc-body">
        <div class="pc-prereq"><strong>Behörighet</strong><p>${c.prereq ? esc(c.prereq) : `<span class="muted">Inte ifyllt ännu. Klicka på Ändra och lägg till.</span>`}</p></div>
        ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
        <div class="course-meta">
          ${c.year ? `<span>Rekommenderat år ${esc(c.year)}</span>` : ""}
          ${folders.map((f) => `<span class="tag">${ICONS.folder} ${esc(f.name)}</span>`).join("")}
          ${safeUrl(c.url) ? `<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">Kurssida ↗</a>` : ""}
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
      const users = matesFor(c.id).length + (placedWhere(c.id) ? 1 : 0);
      const warn = users ? `\n\n${users} student${users > 1 ? "er" : ""} har kursen i sin plan. Den finns kvar där men går inte längre att välja.` : "";
      if (!confirm(`Ta bort ${c.name} ur kurspoolen för alla?${warn}`)) return;
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
  guardForm($("#folder-form"));
  $("#folder-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const name = fd.get("name").trim();
    if (!name) { alert("Mappen behöver ett namn."); return; }
    const f = { id: folder?.id || "m-" + uid(), name, description: fd.get("description").trim(), sort: folder?.sort ?? 100 };
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
  guardForm($("#fp-form"));
  $("#fp-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const folders = new FormData(ev.target).getAll("f");
    dlg.close();
    await saveCourse({ ...c, folders });
  };
}

const HP_FIELD = {
  total: "hp totalt", tn: "hp teknik/naturvet.", adv: "hp avancerad nivå",
  Teknik: "hp teknik", Matematik: "hp matematik", Fysik: "hp fysik", Kemi: "hp kemi", Biologi: "hp biologi",
};

// Redigerare för "kurser som krävs". Varje rad är ett krav; flera kurser på samma rad
// betyder "någon av dem". "~" framför en kurskod = får läsas parallellt.
function bindReqCourses(box, hidden, selfId) {
  const opts = pool.courses.filter((c) => c.id !== selfId).sort((a, b) => a.name.localeCompare(b.name, "sv"))
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.code ? ` (${esc(c.code)})` : ""}</option>`).join("");
  const nameOf = (t) => courseById(t.replace("~", ""))?.name || t.replace("~", "");
  const read = () => { try { return JSON.parse(hidden.value) || []; } catch { return []; } };
  const write = (rows) => { hidden.value = JSON.stringify(rows.filter((r) => r.length)); draw(); };
  function draw() {
    const rows = read();
    box.innerHTML = `
      ${rows.map((alts, ri) => {
        const par = alts.filter((t) => t.startsWith("~")).length;
        return `
        <div class="req-crow">
          <div class="req-alts">${alts.map((t, ai) => `<span class="chip-c">${esc(nameOf(t))}${par && par < alts.length && t.startsWith("~") ? " (parallellt)" : ""}<button type="button" data-rm-alt="${ri}:${ai}" aria-label="Ta bort ${esc(nameOf(t))}">✕</button></span>`).join(`<span class="muted small">eller</span>`)}</div>
          <div class="req-tools">
            <select data-add-alt="${ri}" aria-label="Lägg till alternativ"><option value="">+ eller …</option>${opts}</select>
            <label class="check small"><input type="checkbox" data-par="${ri}" ${par === alts.length ? "checked" : ""} ${par && par < alts.length ? "data-mixed" : ""}> Får läsas parallellt</label>
            <button type="button" class="icon-btn" data-rm-row="${ri}" aria-label="Ta bort kravet">✕</button>
          </div>
        </div>`;
      }).join("") || `<p class="muted small" style="margin:0 0 6px">Inga kurser krävs.</p>`}
      <select data-add-row aria-label="Lägg till kurs som krävs"><option value="">+ Lägg till kurs som krävs …</option>${opts}</select>`;
    box.querySelectorAll("[data-mixed]").forEach((x) => (x.indeterminate = true));
  }
  box.addEventListener("change", (ev) => {
    const t = ev.target;
    const rows = read();
    if (t.matches("[data-add-row]") && t.value) { rows.push([t.value]); return write(rows); }
    if (t.matches("[data-add-alt]") && t.value) {
      const r = rows[Number(t.dataset.addAlt)];
      const par = r.every((x) => x.startsWith("~"));
      if (!r.some((x) => x.replace("~", "") === t.value)) r.push((par ? "~" : "") + t.value);
      return write(rows);
    }
    if (t.matches("[data-par]")) {
      const ri = Number(t.dataset.par);
      rows[ri] = rows[ri].map((x) => (t.checked ? "~" : "") + x.replace("~", ""));
      return write(rows);
    }
  });
  box.addEventListener("click", (ev) => {
    const rows = read();
    const ra = ev.target.closest("[data-rm-alt]");
    if (ra) { const [ri, ai] = ra.dataset.rmAlt.split(":").map(Number); rows[ri].splice(ai, 1); return write(rows); }
    const rr = ev.target.closest("[data-rm-row]");
    if (rr) { rows.splice(Number(rr.dataset.rmRow), 1); return write(rows); }
  });
  draw();
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
        <label class="field wide">Behörighet (text från kurssidan)<textarea name="prereq" rows="4" maxlength="1500">${esc(cur.prereq)}</textarea></label>
        <fieldset class="wide req-edit">
          <legend>Behörighet som kontrolleras</legend>
          <p class="muted small">Behörighetslampan i planen räknas ut från de här fälten, inte från texten ovan. Hoppa över krav som gymnasiekurser och Engelska 6.</p>
          <div class="hp-grid">
            ${HP_KEYS.map((k) => `<label class="field">${HP_FIELD[k]}<input type="number" name="req-${k}" min="0" max="400" step="0.5" placeholder="0" value="${esc(cur.req?.hp?.[k] ?? "")}"></label>`).join("")}
          </div>
          <div class="field">Kurser som krävs</div>
          <div id="req-courses"></div>
          <input type="hidden" name="reqc" value="${esc(JSON.stringify((cur.req?.c || []).map((g) => g.split("|"))))}">
        </fieldset>
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

  bindReqCourses($("#req-courses"), $('#course-form [name="reqc"]'), cur.id);
  guardForm($("#course-form"));
  $("#course-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const offerings = ["HT", "VT"].filter((s) => fd.get(s)).map((s) => ({ sem: s, periods: fd.get(s).split(",").map(Number) }));
    const areas = [...fd.getAll("areas"), ...fd.get("otherAreas").split(",").map((s) => s.trim()).filter(Boolean)];
    const code = fd.get("code").trim().toUpperCase();
    if (!fd.get("name").trim()) { $("#course-err").textContent = "Kursen behöver ett namn."; return; }
    let id = c?.id;
    if (isNew) {
      id = code && !courseById(code) ? code : "u-" + uid();
    }
    const next = {
      ...cur, id, code, name: fd.get("name").trim(), hp: Number(fd.get("hp")), level: fd.get("level"),
      year: fd.get("year") ? Number(fd.get("year")) : null, offerings,
      anyPeriod: fd.get("anyPeriod") === "on", summer: fd.get("summer") === "on",
      areas: [...new Set(areas)], prereq: fd.get("prereq").trim(), url: safeUrl(fd.get("url").trim()), note: fd.get("note").trim(),
      folders: fd.getAll("folders"),
      req: cleanReq({
        hp: Object.fromEntries(HP_KEYS.map((k) => [k, fd.get("req-" + k)])),
        c: JSON.parse(fd.get("reqc") || "[]").map((alts) => alts.join("|")),
      }),
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
const NUM_GRADES = ["3", "4", "5"];

// Terminen då kursen avslutas: 0 = HT, 1 = VT, 2 = sommar. Index räknas från år 1 HT.
const endTermIndex = (it) => (it.year - 1) * 3 + (it.summer ? 2 : it.period + it.span - 1 <= 2 ? 0 : 1);

function termName(idx) {
  const y = Math.floor(idx / 3) + 1;
  const t = idx % 3;
  const sy = state.plan.start_year;
  if (sy) return t === 0 ? `HT ${String(sy + y - 1).slice(2)}` : t === 1 ? `VT ${String(sy + y).slice(2)}` : `Sommar ${String(sy + y).slice(2)}`;
  return `År ${y} ${["HT", "VT", "sommar"][t]}`;
}

// Viktat snitt efter varje termin där minst ett sifferbetyg tillkom.
function gpaSeries(rows) {
  const byTerm = new Map();
  for (const it of rows) {
    const g = state.grades[gradeKey(it)];
    if (!NUM_GRADES.includes(g)) continue;
    const k = endTermIndex(it);
    if (!byTerm.has(k)) byTerm.set(k, []);
    byTerm.get(k).push({ hp: itemHp(it), g: Number(g) });
  }
  let hp = 0, sum = 0;
  return [...byTerm.keys()].sort((a, b) => a - b).map((k) => {
    const list = byTerm.get(k);
    const termHp = list.reduce((s, x) => s + x.hp, 0);
    hp += termHp;
    sum += list.reduce((s, x) => s + x.hp * x.g, 0);
    return { label: termName(k), gpa: hp ? sum / hp : null, termHp, courses: list.length };
  }).filter((p) => p.gpa !== null);
}

function gpaChart(series) {
  if (series.length < 2) {
    return `<p class="muted small">Kurvan visas när du har betyg från minst två terminer.</p>`;
  }
  const W = 960, H = 240, L = 40, R = 16, T = 14, B = 34;
  const lo = 3, hi = 5;
  const x = (i) => L + (series.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (series.length - 1));
  const y = (v) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const grid = [3, 3.5, 4, 4.5, 5].map((v) => `
    <line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="gpa-grid"/>
    <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="gpa-axis">${v.toFixed(1)}</text>`).join("");
  const every = Math.ceil(series.length / 8);
  const labels = series.map((p, i) => (i % every === 0 || i === series.length - 1)
    ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="gpa-axis">${esc(p.label)}</text>` : "").join("");
  const path = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.gpa).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  const dots = series.map((p, i) => `
    <g class="gpa-pt" data-i="${i}">
      <circle cx="${x(i)}" cy="${y(p.gpa)}" r="14" class="gpa-hit"/>
      <circle cx="${x(i)}" cy="${y(p.gpa)}" r="4.5" class="gpa-dot"/>
    </g>`).join("");
  return `
    <div class="gpa-chart" id="gpa-chart">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Viktat snitt över tid, från ${series[0].gpa.toFixed(2)} till ${last.gpa.toFixed(2)}">
        ${grid}${labels}
        <path d="${path}" class="gpa-line"/>
        <text x="${x(series.length - 1) - 8}" y="${y(last.gpa) - 10}" text-anchor="end" class="gpa-last">${last.gpa.toFixed(2)}</text>
        ${dots}
      </svg>
      <div class="gpa-tip" id="gpa-tip" hidden></div>
    </div>
    <details class="gpa-table">
      <summary>Visa som tabell</summary>
      <table>
        <thead><tr><th>Termin</th><th>Nya hp</th><th>Viktat snitt</th></tr></thead>
        <tbody>${series.map((p) => `<tr><td>${esc(p.label)}</td><td>${p.termHp}</td><td>${p.gpa.toFixed(2)}</td></tr>`).join("")}</tbody>
      </table>
    </details>`;
}

function bindGpaChart(series) {
  const box = $("#gpa-chart");
  if (!box) return;
  const tip = $("#gpa-tip");
  const show = (g) => {
    const p = series[Number(g.dataset.i)];
    const dot = g.querySelector(".gpa-dot").getBoundingClientRect();
    const r = box.getBoundingClientRect();
    tip.innerHTML = `<strong>${esc(p.label)}</strong><span>Viktat snitt ${p.gpa.toFixed(2)}</span><span class="muted">${plural(p.courses, "kurs", "kurser")} · ${p.termHp} hp den terminen</span>`;
    tip.hidden = false;
    const left = Math.min(Math.max(dot.left - r.left + dot.width / 2, 70), r.width - 70);
    tip.style.left = `${left}px`;
    tip.style.top = `${dot.top - r.top}px`;
    box.querySelectorAll(".gpa-pt").forEach((x) => x.classList.toggle("on", x === g));
  };
  box.querySelectorAll(".gpa-pt").forEach((g) => {
    g.addEventListener("mouseenter", () => show(g));
    g.addEventListener("click", () => show(g));
  });
  box.addEventListener("mouseleave", () => { tip.hidden = true; box.querySelectorAll(".gpa-pt").forEach((x) => x.classList.remove("on")); });
}

function renderGrades() {
  const order = (it) => it.year * 10 + (it.summer ? 5 : it.period);
  const done = state.plan.items.filter((it) => it.status === "done").sort((a, b) => order(a) - order(b) || a.row - b.row);
  const seen = new Set();
  const rows = done.filter((it) => !seen.has(gradeKey(it)) && seen.add(gradeKey(it)));

  let hpNum = 0, sum = 0, missing = 0;
  const dist = { 3: 0, 4: 0, 5: 0 };
  for (const it of rows) {
    const g = state.grades[gradeKey(it)];
    if (!g) { missing++; continue; }
    if (NUM_GRADES.includes(g)) {
      const hp = itemHp(it);
      hpNum += hp; sum += hp * Number(g);
      dist[g] += hp;
    }
  }
  const gpa = hpNum ? sum / hpNum : null;
  const maxDist = Math.max(1, ...Object.values(dist));
  const series = gpaSeries(rows);

  const byYear = Array.from({ length: state.plan.years }, (_, i) => i + 1).map((y) => {
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
                <div class="course-meta"><span>${esc(c?.code || it.custom?.code || "")}</span><span>${itemHp(it)} hp</span>${it.summer ? `<span class="tag">Sommar</span>` : ""}</div>
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
        <p class="muted" style="margin:0">Fyll i betyg för kurser som är markerade som klara i din plan. Betygen sparas bara för dig och visas aldrig för andra ESare.</p>
      </div>
      <div class="stats">
        <div class="card stat main"><span class="stat-label">Viktat snitt</span><span class="stat-value">${gpa ? gpa.toFixed(2) : "–"}</span><span class="muted small">viktat med hp, betyg 3–5</span></div>
        <div class="card stat"><span class="stat-label">hp med sifferbetyg</span><span class="stat-value">${hpNum}</span><span class="muted small">${missing ? `${plural(missing, "kurs", "kurser")} utan betyg` : "Alla klara kurser har betyg"}</span></div>
        <div class="card stat dist">
          <span class="stat-label">Fördelning (hp)</span>
          ${["5", "4", "3"].map((g) => `<div class="dist-row"><span>${g}</span><div class="dist-bar"><i style="width:${(dist[g] / maxDist) * 100}%"></i></div><span class="muted">${dist[g]}</span></div>`).join("")}
        </div>
      </div>
      ${rows.length ? `<div class="card">
        <h2 style="margin-top:0">Viktat snitt över tid</h2>
        <p class="muted small" style="margin-top:-6px">Ditt sammanlagda viktade snitt efter varje termin. Kurser räknas till terminen då de slutar.${state.plan.start_year ? "" : " Fyll i startår under Min plan för att se årtal."}</p>
        ${gpaChart(series)}
      </div>` : ""}
      ${byYear || `<div class="card empty">Inga kurser är markerade som klara ännu. Markera kurser som klara under Min plan.</div>`}
      <p class="muted small">G och VG räknas inte in i snittet. Klicka på ett valt betyg igen för att ta bort det.</p>
    </div>`;

  bindGpaChart(series);
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

// ---------- ESare ----------

const okStatus = (s) => (STATUSES[s] ? s : "planned");
const itemKey = (it) => (it.code ? "c:" + it.code : "p:" + (it.custom?.code || it.custom?.name || "").trim().toLowerCase());

// Kursens plats i tiden, i "periodsteg": varje läsår har period 1–4 och sommaren som steg 5.
// Med startår jämförs riktiga läsår, annars bara årskurs och period.
function timeSpan(plan, it, useCalendar) {
  const base = ((useCalendar ? plan.start_year - 1 : 0) + it.year) * 5;
  return it.summer ? [base + 5, base + 5] : [base + it.period, base + it.period + it.span - 1];
}

function sameTime(planA, a, planB, b) {
  const cal = !!(planA.start_year && planB.start_year);
  const [a1, a2] = timeSpan(planA, a, cal);
  const [b1, b2] = timeSpan(planB, b, cal);
  return a1 <= b2 && b1 <= a2;
}

function calendarText(plan, it) {
  const sy = plan.start_year;
  if (!sy) return "";
  if (it.summer) return `Sommaren ${sy + it.year}`;
  const ht = it.period <= 2, vtEnd = it.period + it.span - 1 >= 3;
  if (ht && vtEnd) return `HT ${sy + it.year - 1}–VT ${sy + it.year}`;
  return ht ? `HT ${sy + it.year - 1}` : `VT ${sy + it.year}`;
}

function personChip(m, status, me = false) {
  const st = okStatus(status);
  if (me) {
    return `<span class="person me" title="${esc(STATUSES[st])}"><span class="avatar">${esc(initials(state.plan.name || "Du"))}</span>Du<span class="dot ${st}"></span></span>`;
  }
  const i = state.mates.indexOf(m);
  return `<button class="person" data-person="${i}" title="${esc(m.name)} · ${esc(STATUSES[st])} – visa hela planen">
    <span class="avatar">${esc(initials(m.name))}</span>${esc(m.name)}<span class="dot ${st}"></span></button>`;
}

function renderMates() {
  const me = state.plan;
  const q = state.mateQuery.trim().toLowerCase();

  // 1. Mina pågående och planerade kurser, och vem som läser dem samtidigt
  const order = (it) => it.year * 10 + (it.summer ? 5 : it.period);
  const mine = me.items.filter((it) => it.status !== "done").sort((a, b) => order(a) - order(b) || a.row - b.row);
  const mineHtml = mine.map((it) => {
    const key = itemKey(it);
    const same = [], other = [];
    for (const m of state.mates) {
      const mi = m.items.find((x) => itemKey(x) === key);
      if (!mi) continue;
      (sameTime(me, it, m, mi) ? same : other).push({ m, mi });
    }
    const cal = calendarText(me, it);
    return `
      <div class="mate-course">
        <div>
          <div class="course-name"><span class="dot ${okStatus(it.status)}" title="${esc(STATUSES[okStatus(it.status)])}"></span> ${esc(itemName(it))}</div>
          <div class="course-meta"><span>${esc(whenText(it))}</span>${cal ? `<span>${esc(cal)}</span>` : ""}<span>${itemHp(it)} hp</span></div>
        </div>
        <div>
          ${same.length ? `<div class="people">${same.map(({ m, mi }) => personChip(m, mi.status)).join("")}</div>`
            : `<span class="muted small">Ingen annan ESare läser den samtidigt.</span>`}
          ${other.length ? `<div class="other-time"><span class="muted small">Vid annan tid:</span> <div class="people">${other.map(({ m, mi }) => personChip(m, mi.status)).join("")}</div></div>` : ""}
        </div>
      </div>`;
  }).join("");

  // 2. Sök ESare eller kurs
  let searchHtml = `<p class="muted small" style="margin:0">Sök på ett namn för att se en ESares hela plan, eller på en kurs för att se vilka som läser den.</p>`;
  if (q) {
    const people = state.mates.filter((m) => m.name.toLowerCase().includes(q));
    const courses = new Map();
    for (const m of state.mates) {
      for (const it of m.items) {
        const c = itemCourse(it);
        const name = itemName(it);
        const code = c?.code || it.custom?.code || "";
        if (!name.toLowerCase().includes(q) && !code.toLowerCase().includes(q)) continue;
        if (c && c.inStudyPlan && c.type === "obl" && (c.year ?? 9) <= 3) continue;
        const key = itemKey(it);
        if (!courses.has(key)) courses.set(key, { name, code, hp: itemHp(it), takers: [] });
        courses.get(key).takers.push({ m, it });
      }
    }
    const list = [...courses.values()].sort((a, b) => b.takers.length - a.takers.length).slice(0, 30);
    searchHtml = `
      ${people.length ? `<h3 class="pick-h">ESare</h3><div class="people">${people.map((m) => personChip(m, "planned").replace(/<span class="dot[^>]*><\/span>/, "")).join("")}</div>` : ""}
      ${list.length ? `<h3 class="pick-h">Kurser</h3>${list.map((x) => `
        <div class="mate-course compact">
          <div><div class="course-name">${esc(x.name)}</div><div class="course-meta">${x.code ? `<span>${esc(x.code)}</span>` : ""}<span>${x.hp} hp</span></div></div>
          <div class="people">${x.takers.map(({ m, it }) => personChip(m, it.status)).join("")}</div>
        </div>`).join("")}` : ""}
      ${!people.length && !list.length ? `<p class="muted small" style="margin:0">Ingen annan ESare eller kurs matchar "${esc(state.mateQuery.trim())}".</p>` : ""}`;
  }

  app.innerHTML = `
    <div class="stack">
      <div>
        <h1>ESare</h1>
        <p class="muted" style="margin:0">Sidan är öppen för alla ESare. Se vilka som läser samma kurser som du, samtidigt, och klicka på en person för att se hela hens plan. ${plural(state.mates.length, "ESare", "ESare")} har lagt in sina kurser.</p>
      </div>
      <div class="legend"><span><span class="dot done"></span> Klar</span><span><span class="dot ongoing"></span> Läser nu</span><span><span class="dot planned"></span> Planerar</span></div>

      <section class="card" style="padding:0">
        <h2 class="card-title">Mina pågående och planerade kurser</h2>
        ${mineHtml || `<p class="muted empty-pad">Du har inga pågående eller planerade kurser. Lägg till kurser under Min plan.</p>`}
      </section>

      <section class="card">
        <h2 style="margin:0 0 10px">Sök</h2>
        <input type="search" id="mate-q" placeholder="Sök ESare eller kurs" value="${esc(state.mateQuery)}" style="width:100%">
        <div id="mate-results" style="margin-top:10px">${searchHtml}</div>
      </section>
    </div>`;

  app.onclick = (ev) => {
    const b = ev.target.closest("[data-person]");
    if (b) openPerson(Number(b.dataset.person));
  };
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

// Hela planen för en annan ESare
function openPerson(i) {
  const m = state.mates[i];
  if (!m) return;
  state.picker = null;
  const myKeys = new Set(state.plan.items.map(itemKey));
  const total = m.items.reduce((s, it) => s + itemHp(it), 0);
  const blocks = [];
  for (let y = 1; y <= m.years; y++) {
    const list = m.items.filter((it) => it.year === y && !it.summer).sort((a, b) => a.period - b.period || a.row - b.row);
    blocks.push({ title: `År ${y}`, sub: m.start_year ? `${m.start_year + y - 1}/${String(m.start_year + y).slice(2)}` : "", list });
    const sum = m.items.filter((it) => it.year === y && it.summer);
    if (sum.length) blocks.push({ title: "Sommar", sub: m.start_year ? String(m.start_year + y) : `efter år ${y}`, list: sum });
  }
  const rowHtml = (it) => `
    <li class="${myKeys.has(itemKey(it)) ? "shared" : ""}">
      <span class="dot ${okStatus(it.status)}" title="${esc(STATUSES[okStatus(it.status)])}"></span>
      <span class="pp-name">${esc(itemName(it))}${myKeys.has(itemKey(it)) ? ` <span class="tag mates">Du också</span>` : ""}</span>
      <span class="muted">${esc(periodText(it))} · ${itemHp(it)} hp</span>
    </li>`;
  openDialog(`
    <div class="dlg-head">
      <div>
        <h2><span class="avatar big">${esc(initials(m.name))}</span> ${esc(m.name)}</h2>
        <p class="muted small">${m.start_year ? `Började ${m.start_year} · ` : ""}${total} hp i planen${m.hide_done ? " · visar bara kurserna som pågår" : ""}</p>
      </div>
      <button class="icon-btn" data-close aria-label="Stäng">✕</button>
    </div>
    <div class="legend" style="margin-top:0"><span><span class="dot done"></span> Klar</span><span><span class="dot ongoing"></span> Läser nu</span><span><span class="dot planned"></span> Planerar</span></div>
    <div class="person-plan">
      ${blocks.filter((b) => b.list.length).map((b) => `
        <h3 class="pick-h">${esc(b.title)}${b.sub ? ` <span class="muted">${esc(b.sub)}</span>` : ""} <span class="muted">· ${b.list.reduce((s, it) => s + itemHp(it), 0)} hp</span></h3>
        <ul>${b.list.map(rowHtml).join("")}</ul>`).join("") || `<p class="muted">Inga kurser att visa.</p>`}
    </div>
    <div class="dlg-foot"><span></span><button class="btn" data-close>Stäng</button></div>`);
}

start();
