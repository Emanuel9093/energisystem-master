// Datalager. Använder Supabase om config.js är ifylld, annars demoläge med localStorage.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const emptyPlan = () => ({ name: "", start_year: null, visible: true, courses: {}, custom: [] });

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
  (await client()).auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
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

const fromRow = (r) => ({
  user_id: r.user_id, name: r.name, start_year: r.start_year, visible: r.visible,
  courses: r.plan?.courses || {}, custom: r.plan?.custom || [], updated_at: r.updated_at,
});

export async function loadMyPlan(user) {
  if (DEMO) {
    try {
      const raw = localStorage.getItem("es-master-plan");
      if (raw) return { ...emptyPlan(), ...JSON.parse(raw) };
    } catch { /* tomt */ }
    return { ...emptyPlan(), name: "Du (demo)" };
  }
  const { data, error } = await (await client()).from("plans").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data) : emptyPlan();
}

export async function saveMyPlan(user, plan) {
  if (DEMO) {
    try { localStorage.setItem("es-master-plan", JSON.stringify(plan)); } catch { /* ignorera */ }
    return;
  }
  const row = {
    user_id: user.id,
    name: plan.name.trim(),
    start_year: plan.start_year || null,
    visible: plan.visible,
    plan: { courses: plan.courses, custom: plan.custom },
    updated_at: new Date().toISOString(),
  };
  const { error } = await (await client()).from("plans").upsert(row);
  if (error) throw error;
}

export async function loadClassmates(user) {
  if (DEMO) return DEMO_CLASSMATES;
  const { data, error } = await (await client())
    .from("plans").select("*").eq("visible", true).neq("user_id", user.id).order("name");
  if (error) throw error;
  return data.map(fromRow).filter((p) => p.name);
}

// ---------- Exempeldata för demoläget ----------

const DEMO_CLASSMATES = [
  { name: "Alva Lindqvist", start_year: 2022, courses: { "1TE029": "done", "1TE038": "done", "1TE028": "ongoing", "TN0347": "ongoing", "1KB274": "ongoing", "1FA392": "planned" }, custom: [] },
  { name: "Omar Haddad", start_year: 2022, courses: { "1FA410": "done", "1TS309": "done", "1TE700": "ongoing", "1FA412": "done", "1FA594": "planned", "1FA392": "planned" }, custom: [{ id: "x1", code: "", name: "Utbytesstudier DTU, Energy Systems", hp: 15, level: "A1N", teknik: true, status: "done" }] },
  { name: "Elin Sjöberg", start_year: 2022, courses: { "1TE035": "done", "TN0352": "done", "1TE028": "ongoing", "TN0350": "ongoing", "1RT890": "ongoing", "EX1032": "planned" }, custom: [] },
  { name: "Viktor Nyström", start_year: 2023, courses: { "1TE029": "ongoing", "1TE765": "ongoing", "1TE038": "planned", "1RT495": "planned" }, custom: [] },
  { name: "Sara Bergman", start_year: 2023, courses: { "1FA410": "ongoing", "1TS359": "planned", "1TS309": "planned", "1FA591": "planned" }, custom: [] },
];
