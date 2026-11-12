// Datalager. Använder Supabase om config.js är ifylld, annars demoläge med localStorage.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { BY_CODE, offeringsOf } from "./courses.js";

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// summers: år (1–4) som följs av en sommar med sommarkurser.
// hide_done: avklarade kurser syns inte för andra ESare (pågående och planerade syns alltid).
export const emptyPlan = () => ({ name: "", start_year: null, hide_done: false, rows: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 }, summers: [], items: [] });

const STATUS_OK = new Set(["planned", "ongoing", "done"]);
const int = (v, lo, hi, d) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
const txt = (v, max) => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));

// Validerar en plan (egen eller en annan ESare) så att trasig eller elak data inte
// kan krascha sidan eller smyga in HTML.
function cleanItem(it) {
  if (!it || typeof it !== "object") return null;
  const out = {
    id: txt(it.id, 40) || "i" + Math.random().toString(36).slice(2),
    year: int(it.year, 1, 5, 1), period: int(it.period, 1, 4, 1), row: int(it.row, 0, 5, 0),
    span: int(it.span, 1, 4, 1), thick: !!it.thick,
    status: STATUS_OK.has(it.status) ? it.status : "planned",
  };
  if (out.period + out.span - 1 > 4) out.span = 5 - out.period;
  // Sommarkurs: sommaren efter år `year`, en enda period, `row` är ordningen i listan.
  if (it.summer) Object.assign(out, { summer: true, year: int(it.year, 1, 4, 1), period: 1, span: 1, thick: false, row: int(it.row, 0, 99, 0) });
  if (it.code) out.code = txt(it.code, 40);
  if (it.eligOk) out.eligOk = true; // "Jag är behörig ändå"
  if (it.custom && typeof it.custom === "object") {
    const c = it.custom;
    out.custom = { name: txt(c.name, 160) || "Namnlös kurs", code: txt(c.code, 20), hp: Math.max(0, Math.min(60, Number(c.hp) || 0)), level: txt(c.level, 4), teknik: !!c.teknik };
  }
  if (it.snap && typeof it.snap === "object") {
    out.snap = { name: txt(it.snap.name, 160), hp: Math.max(0, Math.min(60, Number(it.snap.hp) || 0)), level: txt(it.snap.level, 4), teknik: !!it.snap.teknik };
  }
  return out.code || out.custom ? out : null;
}

const normalize = (p) => {
  const rows = { ...emptyPlan().rows };
  for (const y of [1, 2, 3, 4, 5]) rows[y] = int(p.rows?.[y], 1, 6, 3);
  const items = (Array.isArray(p.items) ? p.items : []).map(cleanItem).filter(Boolean);
  const summers = new Set((Array.isArray(p.summers) ? p.summers : []).map((y) => int(y, 1, 4, 0)).filter(Boolean));
  for (const it of items) if (it.summer) summers.add(it.year);
  return {
    ...emptyPlan(), ...p,
    name: txt(p.name, 80), start_year: int(p.start_year, 2010, 2040, null), hide_done: !!p.hide_done,
    rows, summers: [...summers].sort(), items,
  };
};

let sb = null;

async function client() {
  if (!sb) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return sb;
}

// ---------- Inloggning ----------

export async function getUser() {
  if (DEMO) return { id: "demo", email: "demo@student.uu.se" };
  const { data } = await (await client()).auth.getSession();
  return data.session?.user ?? null;
}

export async function onAuthChange(cb) {
  if (DEMO) return;
  // setTimeout: Supabase-anrop direkt i callbacken kan låsa sig (supabase-js v2)
  (await client()).auth.onAuthStateChange((_event, session) => setTimeout(() => cb(session?.user ?? null), 0));
}

export async function sendLoginLink(email) {
  const redirect = location.origin + location.pathname;
  const { error } = await (await client()).auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
  if (error) throw error;
}

export async function signOut() {
  if (DEMO) return;
  await (await client()).auth.signOut();
}

// ---------- Planer ----------

const fromRow = (r) => normalize({
  user_id: r.user_id, name: r.name, start_year: r.start_year, hide_done: r.hide_done,
  rows: r.plan?.rows, summers: r.plan?.summers, items: r.plan?.items, updated_at: r.updated_at,
});

export async function loadMyPlan(user) {
  if (DEMO) {
    try {
      const raw = localStorage.getItem("es-master-plan-v3");
      if (raw) return normalize(JSON.parse(raw));
    } catch { /* tomt */ }
    return { ...emptyPlan(), isNew: true };
  }
  const { data, error } = await (await client()).from("plans").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : { ...emptyPlan(), isNew: true };
}

export async function saveMyPlan(user, plan) {
  if (DEMO) {
    try { localStorage.setItem("es-master-plan-v3", JSON.stringify(plan)); } catch { /* ignorera */ }
    return;
  }
  const row = {
    user_id: user.id,
    name: plan.name.trim(),
    start_year: plan.start_year || null,
    hide_done: !!plan.hide_done,
    plan: { rows: plan.rows, summers: plan.summers, items: plan.items },
    updated_at: new Date().toISOString(),
  };
  const { error } = await (await client()).from("plans").upsert(row);
  if (error) throw error;
}

export async function loadClassmates(user) {
  // Databasfunktionen tar själv bort avklarade kurser för den som valt att dölja dem.
  if (DEMO) return DEMO_CLASSMATES.map((p) => (p.hide_done ? { ...p, items: p.items.filter((it) => it.status !== "done") } : p));
  const { data, error } = await (await client()).rpc("classmate_plans");
  if (error) throw error;
  return data.map(fromRow).filter((p) => p.name).sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

// ---------- Kurspoolen (delad mellan alla) ----------

const lsGet = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignorera */ } };

export async function loadPool() {
  if (DEMO) return { courseRows: Object.values(lsGet("es-pool-courses", {})), folderRows: Object.values(lsGet("es-pool-folders", {})) };
  const sb = await client();
  const [c, f] = await Promise.all([sb.from("pool_courses").select("*"), sb.from("pool_folders").select("*")]);
  if (c.error) throw c.error;
  if (f.error) throw f.error;
  return { courseRows: c.data, folderRows: f.data };
}

export async function savePoolCourse(id, data, by) {
  const row = { id, data, updated_by: by, updated_at: new Date().toISOString() };
  if (DEMO) { const all = lsGet("es-pool-courses", {}); all[id] = row; lsSet("es-pool-courses", all); return; }
  const { error } = await (await client()).from("pool_courses").upsert(row);
  if (error) throw error;
}

export async function deletePoolCourse(id) {
  if (DEMO) { const all = lsGet("es-pool-courses", {}); delete all[id]; lsSet("es-pool-courses", all); return; }
  const { error } = await (await client()).from("pool_courses").delete().eq("id", id);
  if (error) throw error;
}

export async function savePoolFolder(folder, by) {
  const row = { id: folder.id, name: folder.name, description: folder.description || "", sort: folder.sort ?? 100, updated_by: by, updated_at: new Date().toISOString() };
  if (DEMO) { const all = lsGet("es-pool-folders", {}); all[row.id] = row; lsSet("es-pool-folders", all); return; }
  const { error } = await (await client()).from("pool_folders").upsert(row);
  if (error) throw error;
}

export async function deletePoolFolder(id) {
  if (DEMO) { const all = lsGet("es-pool-folders", {}); delete all[id]; lsSet("es-pool-folders", all); return; }
  const { error } = await (await client()).from("pool_folders").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Betyg (privata, syns bara för en själv) ----------

export async function loadGrades(user) {
  if (DEMO) return lsGet("es-grades", {});
  const { data, error } = await (await client()).from("grades").select("grades").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data?.grades || {};
}

export async function saveGrades(user, grades) {
  if (DEMO) return lsSet("es-grades", grades);
  const { error } = await (await client()).from("grades").upsert({ user_id: user.id, grades, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ---------- Exempeldata för demoläget ----------

// Lägger kurser på deras ordinarie plats (rad 0) – räcker för ESare-vyn.
const demoItems = (list) => list.map(([code, status], i) => {
  const off = offeringsOf(BY_CODE[code])[0];
  return { id: "d" + i, code, status, year: off.year ?? 5, period: off.periods?.[0] ?? 1, row: 0, span: off.periods?.length ?? 1 };
});

const DEMO_CLASSMATES = [
  { name: "Alva Lindqvist", start_year: 2022, items: demoItems([["1TE029", "done"], ["1TE038", "done"], ["1TE028", "ongoing"], ["TN0347", "ongoing"], ["1KB274", "ongoing"], ["1FA392", "planned"]]) },
  { name: "Omar Haddad", start_year: 2022, items: [...demoItems([["1FA410", "done"], ["1TS309", "done"], ["1TE700", "ongoing"], ["1FA412", "done"], ["1FA594", "planned"], ["1FA392", "planned"]]), { id: "x1", year: 4, period: 1, row: 1, span: 2, status: "done", custom: { code: "", name: "Utbytesstudier DTU, Energy Systems", hp: 15, level: "A1N", teknik: true } }] },
  { name: "Elin Sjöberg", start_year: 2022, items: demoItems([["1TE035", "done"], ["TN0352", "done"], ["1TE028", "ongoing"], ["TN0350", "ongoing"], ["1RT890", "ongoing"], ["EX1032", "planned"]]) },
  { name: "Viktor Nyström", start_year: 2023, hide_done: true, items: [...demoItems([["1TE029", "ongoing"], ["1TE765", "ongoing"], ["1TE038", "planned"], ["1RT495", "planned"], ["1TE655", "done"]]), { id: "s1", year: 3, summer: true, row: 0, status: "planned", code: "1FA456" }] },
  { name: "Sara Bergman", start_year: 2023, items: demoItems([["1FA410", "ongoing"], ["1TS359", "planned"], ["1TS309", "planned"], ["1FA591", "planned"]]) },
].map(normalize);
