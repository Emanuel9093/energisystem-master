// Kurspoolen: kurserna från studieplanen (courses.js) plus mappar och kurser som
// studenterna själva lagt till eller ändrat (sparas i databasen).
//
// En kurs i poolen:
//   id, code, name, hp, level, areas[], teknik, prereq, url, note
//   offerings: [{ sem: "HT" | "VT", periods: [1, 2] }]   perioder 1–4 inom läsåret
//   anyPeriod: true om kursen kan läsas valfri period, summer: true för sommarkurs
//   year: rekommenderat år (1–5) eller null
//   folders: [mapp-id]
//   type, oneOf, thick, techNat: används av examenskontrollen (bara studieplanens kurser)
//   inStudyPlan: true för kurser i studieplanen

import { COURSES, AREAS, periodsOf, yearOfTerm } from "./courses.js";
import { INFO } from "./course-info.js";
import { SEED_FOLDERS, SEED_EXTRA_COURSES } from "./folders.js";

export const pool = { courses: [], byId: {}, folders: [], seedIds: new Set(), overridden: new Set() };

const semOf = (periods) => (periods[0] <= 2 ? "HT" : "VT");

function fromStudyPlan(c) {
  const offerings = [];
  const add = (periods) => {
    if (!periods) return;
    const o = { sem: semOf(periods), periods };
    if (!offerings.some((x) => x.sem === o.sem && x.periods.join() === o.periods.join())) offerings.push(o);
  };
  add(periodsOf(c));
  for (const [, periods] of c.extra || []) add(periods);
  const areas = AREAS[c.code] || (c.teknik ? ["Teknik"] : []);
  const info = INFO[c.code] || {};
  return {
    id: c.code, code: c.code, name: c.name, hp: c.hp, level: c.level, areas, teknik: areas.includes("Teknik"),
    prereq: info.prereq || "", url: info.url || "", note: c.note || "",
    offerings, anyPeriod: !periodsOf(c) && c.term !== "S", summer: c.term === "S",
    year: yearOfTerm(c.term), folders: ["programplanen"],
    type: c.type, oneOf: c.oneOf, thick: !!c.thick, techNat: c.techNat !== false, uni: c.uni, inStudyPlan: true,
  };
}

function normalizeCourse(c) {
  const areas = Array.isArray(c.areas) ? c.areas : [];
  return {
    offerings: [], anyPeriod: false, summer: false, year: null, folders: [], prereq: "", url: "", note: "",
    type: "extern", techNat: true, thick: false, inStudyPlan: false, ...c,
    hp: Number(c.hp) || 0, areas, teknik: areas.includes("Teknik"),
  };
}

const SEED = () => {
  const list = [...COURSES.map(fromStudyPlan), ...SEED_EXTRA_COURSES.map(normalizeCourse)];
  // Kurser som finns i flera mappar från början
  for (const f of SEED_FOLDERS) for (const id of f.courseIds || []) {
    const c = list.find((x) => x.id === id);
    if (c && !c.folders.includes(f.id)) c.folders.push(f.id);
  }
  return list;
};

// rows: [{ id, data, updated_by, updated_at }], folderRows: [{ id, name, description, sort, updated_by }]
export function buildPool(courseRows = [], folderRows = []) {
  const seed = SEED();
  pool.seedIds = new Set(seed.map((c) => c.id));
  const byId = Object.fromEntries(seed.map((c) => [c.id, c]));
  pool.overridden = new Set();
  for (const r of courseRows) {
    const base = byId[r.id] || {};
    if (byId[r.id]) pool.overridden.add(r.id);
    byId[r.id] = normalizeCourse({ ...base, ...r.data, id: r.id, updated_by: r.updated_by, updated_at: r.updated_at });
  }
  pool.byId = byId;
  pool.courses = Object.values(byId);

  const folders = SEED_FOLDERS.map((f) => ({ ...f, builtin: true }));
  for (const r of folderRows) {
    const i = folders.findIndex((f) => f.id === r.id);
    const f = { ...(i >= 0 ? folders[i] : { builtin: false }), ...r };
    if (i >= 0) folders[i] = f; else folders.push(f);
  }
  pool.folders = folders.sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100) || a.name.localeCompare(b.name, "sv"));
  return pool;
}

export const courseById = (id) => pool.byId[id];
export const coursesIn = (folderId) => pool.courses.filter((c) => c.folders.includes(folderId));

// Vad som sparas i databasen för en kurs (utan härledda fält).
export function courseData(c) {
  const { id, teknik, updated_by, updated_at, ...rest } = c;
  return rest;
}

export function offeringLabel(o) {
  return `${o.sem} P${o.periods[0]}${o.periods.length > 1 ? "–" + o.periods[o.periods.length - 1] : ""}`;
}

export function offeringText(c) {
  const parts = c.offerings.map(offeringLabel);
  if (c.anyPeriod) parts.push("Valfri period");
  if (c.summer) parts.push("Sommar");
  return parts.length ? parts : ["Ej angivet"];
}
