import { COURSES, BY_CODE, TERM_LABELS, TERM_ORDER, LEVELS } from "./courses.js";
import { evaluate, STATUSES } from "./rules.js";
import { ALLOWED_EMAIL_DOMAINS } from "./config.js";
import * as store from "./store.js";

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

const state = {
  user: null,
  plan: store.emptyPlan(),
  mates: [],
  view: "plan",
  scope: "all", // "all" eller "done"
  openTerms: new Set([7, 8, 9, 10]),
  query: "",
  mateTerm: "advanced",
  mateMode: "course",
  mateQuery: "",
  saveState: "",
};

// ---------- Start ----------

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
  el.innerHTML = `<span class="muted">${esc(state.user.email)}</span> <button class="btn small" id="logout">Logga ut</button>`;
  $("#logout").onclick = async () => { await store.signOut(); state.user = null; afterLogin(); };
}

// ---------- Inloggning ----------

function renderLogin(message = "") {
  app.innerHTML = `
    <div class="card login">
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

function matesFor(code) {
  return state.mates.filter((m) => m.courses[code]);
}

function statusSeg(code, current, attr = "data-code") {
  const opts = [["", "–"], ["planned", "Planerad"], ["ongoing", "Läser"], ["done", "Klar"]];
  return `<div class="seg" role="group" aria-label="Status">${opts
    .map(([v, l]) => `<button type="button" ${attr}="${esc(code)}" data-status="${v}" class="${(current || "") === v ? "on" : ""}" aria-pressed="${(current || "") === v}">${l}</button>`)
    .join("")}</div>`;
}

function courseRow(c) {
  const status = state.plan.courses[c.code] || "";
  const mates = c.type === "obl" ? [] : matesFor(c.code);
  const tags = [
    `<span>${esc(c.code)}${c.uni === "SLU" ? " · SLU" : ""}</span>`,
    `<span>${c.hp} hp</span>`,
    `<span class="tag ${c.level.startsWith("A") ? "adv" : ""}">${c.level}</span>`,
    c.teknik ? `<span class="tag">Teknik</span>` : "",
    c.type === "obl" ? `<span class="tag obl">Obligatorisk</span>` : "",
    c.type === "ts" ? `<span class="tag ts">Teknik och system</span>` : "",
    c.techNat === false ? `<span class="tag">Ej teknisk/naturvet.</span>` : "",
    `<span>Period ${esc(c.period)}</span>`,
    mates.length ? `<span class="tag mates" title="${esc(mates.map((m) => m.name).join(", "))}">${mates.length} klasskompis${mates.length > 1 ? "ar" : ""}</span>` : "",
  ].join("");
  return `
    <div class="course">
      <div>
        <div class="course-name">${esc(c.name)}</div>
        <div class="course-meta">${tags}</div>
        ${c.note ? `<div class="course-meta">${esc(c.note)}</div>` : ""}
      </div>
      ${statusSeg(c.code, status)}
    </div>`;
}

function renderPlan() {
  const q = state.query.toLowerCase();
  const terms = TERM_ORDER.map((t) => {
    let list = COURSES.filter((c) => c.term === t);
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    if (!list.length) return "";
    const chosen = list.filter((c) => state.plan.courses[c.code]);
    const hp = chosen.reduce((s, c) => s + c.hp, 0);
    const open = q || state.openTerms.has(t);
    const hasObl = list.some((c) => c.type === "obl");
    return `
      <details class="term" data-term="${t}" ${open ? "open" : ""}>
        <summary><h3>${TERM_LABELS[t]}</h3><span class="term-meta">${chosen.length ? `${chosen.length} valda · ${hp} hp` : `${list.length} kurser`}</span></summary>
        ${list.map(courseRow).join("")}
        ${hasObl && typeof t === "number" && t <= 6 ? `<div class="term-actions"><button class="btn small" data-mark-term="${t}">Markera obligatoriska som klara</button></div>` : ""}
      </details>`;
  }).join("");

  const customRows = state.plan.custom.map((x) => `
    <div class="course">
      <div>
        <div class="course-name">${esc(x.name)}</div>
        <div class="course-meta">
          ${x.code ? `<span>${esc(x.code)}</span>` : ""}<span>${Number(x.hp) || 0} hp</span>
          <span class="tag ${String(x.level).startsWith("A") ? "adv" : ""}">${esc(x.level)}</span>
          ${x.teknik ? `<span class="tag">Teknik</span>` : ""}<span class="tag">Utanför studieplanen</span>
          <button class="btn link small" data-remove-custom="${esc(x.id)}">Ta bort</button>
        </div>
      </div>
      ${statusSeg(x.id, x.status, "data-custom")}
    </div>`).join("");

  app.innerHTML = `
    <div class="plan-layout">
      <div class="stack">
        <div>
          <h1>Min plan</h1>
          <p class="muted" style="margin:0">Markera kurser du har klarat, läser nu eller planerar att läsa. Kraven till höger uppdateras direkt.</p>
        </div>
        <div class="card profile">
          <label class="field">Namn (syns för klasskompisar)
            <input id="p-name" value="${esc(state.plan.name)}" maxlength="80" placeholder="För- och efternamn">
          </label>
          <label class="field">Startår på programmet
            <input id="p-year" type="number" min="2010" max="2040" value="${esc(state.plan.start_year ?? "")}" placeholder="t.ex. 2022">
          </label>
          <label class="check"><input id="p-visible" type="checkbox" ${state.plan.visible ? "checked" : ""}> Visa mina kurser för klasskompisar</label>
        </div>
        <div class="toolbar">
          <input type="search" id="q" placeholder="Sök kurs eller kurskod" value="${esc(state.query)}">
          <button class="btn" id="mark-all">Markera åk 1–3 som klara</button>
        </div>
        <div>${terms || `<div class="card empty">Inga kurser matchar sökningen.</div>`}</div>
        <details class="term" open>
          <summary><h3>Egna kurser utanför studieplanen</h3><span class="term-meta">t.ex. utbyte eller fristående kurser</span></summary>
          ${customRows}
          <form class="custom-form" id="custom-form">
            <label class="field">Kurskod<input name="code" placeholder="valfritt"></label>
            <label class="field wide">Kursnamn<input name="name" required placeholder="Kursens namn"></label>
            <label class="field">hp<input name="hp" type="number" min="0.5" step="0.5" required value="5"></label>
            <label class="field">Nivå<select name="level">${LEVELS.map((l) => `<option ${l === "A1N" ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="check"><input type="checkbox" name="teknik" checked> Teknik</label>
            <button class="btn" type="submit">Lägg till</button>
          </form>
        </details>
      </div>
      <aside class="sidebar card" id="reqs"></aside>
    </div>`;

  renderReqs();
  bindPlan();
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
    ${rows}
    <div class="legend"><span><i style="background:var(--ok)"></i>Klart</span><span><i style="background:var(--planned);opacity:.35"></i>Läser/planerat</span></div>
    ${shown.warnings.length ? `<div class="warnings">${shown.warnings.map((w) => `<div>${esc(w)}</div>`).join("")}</div>` : ""}
    <p class="save-state" id="save-state">${esc(state.saveState)}</p>`;

  $("#reqs").querySelectorAll("[data-scope]").forEach((b) => (b.onclick = () => { state.scope = b.dataset.scope; renderReqs(); }));
}

function bindPlan() {
  $("#p-name").oninput = (e) => { state.plan.name = e.target.value; changed(); };
  $("#p-year").oninput = (e) => { state.plan.start_year = e.target.value ? Number(e.target.value) : null; changed(); };
  $("#p-visible").onchange = (e) => { state.plan.visible = e.target.checked; changed(); };

  const q = $("#q");
  q.oninput = () => {
    state.query = q.value;
    const pos = q.selectionStart;
    renderPlan();
    const nq = $("#q");
    nq.focus();
    nq.setSelectionRange(pos, pos);
  };

  app.querySelectorAll("details.term[data-term]").forEach((d) => {
    d.addEventListener("toggle", () => {
      if (state.query) return;
      const t = isNaN(d.dataset.term) ? d.dataset.term : Number(d.dataset.term);
      d.open ? state.openTerms.add(t) : state.openTerms.delete(t);
    });
  });

  app.onclick = (ev) => {
    const seg = ev.target.closest("button[data-code]");
    if (seg) {
      const { code, status } = seg.dataset;
      setCourseStatus(code, status);
      return refreshPlanKeepScroll();
    }
    const cseg = ev.target.closest("button[data-custom]");
    if (cseg) {
      const item = state.plan.custom.find((x) => x.id === cseg.dataset.custom);
      if (cseg.dataset.status) item.status = cseg.dataset.status;
      else state.plan.custom = state.plan.custom.filter((x) => x !== item);
      changed();
      return refreshPlanKeepScroll();
    }
    const rm = ev.target.closest("[data-remove-custom]");
    if (rm) {
      state.plan.custom = state.plan.custom.filter((x) => x.id !== rm.dataset.removeCustom);
      changed();
      return refreshPlanKeepScroll();
    }
    const markTerm = ev.target.closest("[data-mark-term]");
    if (markTerm) {
      markMandatoryDone([Number(markTerm.dataset.markTerm)]);
      return refreshPlanKeepScroll();
    }
    if (ev.target.id === "mark-all") {
      markMandatoryDone([1, 2, 3, 4, 5, 6]);
      return refreshPlanKeepScroll();
    }
  };

  $("#custom-form").onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    state.plan.custom.push({
      id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      code: f.get("code").trim(), name: f.get("name").trim(), hp: Number(f.get("hp")),
      level: f.get("level"), teknik: f.get("teknik") === "on", status: "planned",
    });
    changed();
    refreshPlanKeepScroll();
  };
}

function setCourseStatus(code, status) {
  if (status) {
    // Bara en kurs i en "en av"-grupp (t.ex. examensarbete UU/SLU)
    const c = BY_CODE[code];
    if (c?.oneOf) COURSES.filter((x) => x.oneOf === c.oneOf && x.code !== code).forEach((x) => delete state.plan.courses[x.code]);
    state.plan.courses[code] = status;
  } else {
    delete state.plan.courses[code];
  }
  changed();
}

function markMandatoryDone(terms) {
  for (const c of COURSES.filter((x) => x.type === "obl" && terms.includes(x.term))) {
    if (c.oneOf && COURSES.some((x) => x.oneOf === c.oneOf && state.plan.courses[x.code])) {
      const chosen = COURSES.find((x) => x.oneOf === c.oneOf && state.plan.courses[x.code]);
      state.plan.courses[chosen.code] = "done";
      continue;
    }
    state.plan.courses[c.code] = "done";
  }
  changed();
}

function refreshPlanKeepScroll() {
  const y = window.scrollY;
  renderPlan();
  window.scrollTo(0, y);
}

// ---------- Klasskompisar ----------

const MATE_FILTERS = [
  ["advanced", "Åk 4–5 och tillval"],
  [7, "Termin 7"], [8, "Termin 8"], [9, "Termin 9"], [10, "Termin 10"], ["X", "Tillval"], ["custom", "Egna kurser"],
];

function personChip(m, status, me = false) {
  return `<span class="person ${me ? "me" : ""}" title="${esc(STATUSES[status] || "")}">
    <span class="avatar">${esc(initials(m.name))}</span>${esc(me ? "Du" : m.name)}<span class="dot ${status}"></span></span>`;
}

function renderMates() {
  const me = { name: state.plan.name || "Du", courses: state.plan.courses, custom: state.plan.custom };
  const everyone = [...state.mates.map((m) => ({ m, me: false })), { m: me, me: true }];
  const f = state.mateTerm;
  const q = state.mateQuery.toLowerCase();

  // Per kurs
  const items = [];
  if (f !== "custom") {
    const terms = f === "advanced" ? [7, 8, 9, 10, "X", "S"] : [f];
    for (const c of COURSES.filter((x) => terms.includes(x.term) && (x.type !== "obl" || x.term >= 7))) {
      const takers = everyone.filter(({ m }) => m.courses[c.code]);
      if (!takers.length || !takers.some((t) => !t.me)) continue;
      items.push({ name: c.name, meta: `${c.code} · ${c.hp} hp · ${c.level} · ${TERM_LABELS[c.term]}, period ${c.period}`, takers: takers.map((t) => ({ ...t, status: t.m.courses[c.code] })) });
    }
  }
  if (f === "custom" || f === "advanced") {
    const map = new Map();
    for (const { m, me: isMe } of everyone) {
      for (const x of m.custom || []) {
        const key = (x.code || x.name).trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: x.name, meta: `${x.code ? x.code + " · " : ""}${x.hp} hp · ${x.level} · utanför studieplanen`, takers: [] });
        map.get(key).takers.push({ m, me: isMe, status: x.status });
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

  // Per person
  const people = state.mates
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .map((m) => {
      const list = [
        ...Object.entries(m.courses).map(([code, status]) => ({ c: BY_CODE[code], status })).filter((x) => x.c && x.c.type !== "obl")
          .sort((a, b) => TERM_ORDER.indexOf(a.c.term) - TERM_ORDER.indexOf(b.c.term))
          .map((x) => ({ name: x.c.name, meta: x.c.term === "X" || x.c.term === "S" ? "Tillval" : `T${x.c.term}`, status: x.status })),
        ...(m.custom || []).map((x) => ({ name: x.name, meta: "Egen", status: x.status })),
      ];
      return `
        <div class="card person-card">
          <h3><span class="person" style="padding:0;background:none"><span class="avatar">${esc(initials(m.name))}</span></span>${esc(m.name)}</h3>
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

start();
