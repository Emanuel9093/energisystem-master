// Kurspoolen: kurserna från studieplanen (courses.js) plus mappar och kurser som
// studenterna själva lagt till eller ändrat (sparas i databasen).
//
// En kurs i poolen:
//   id, code, name, hp, level, areas[], teknik, prereq, url, note
//   offerings: [{ sem: "HT" | "VT", periods: [1, 2] }]   perioder 1–4 inom läsåret
//   anyPeriod: true om kursen kan läsas valfri period, summer: true för sommarkurs
//   year: rekommenderat år (1–5) eller null
//   folders: [mapp-id]
//   type, oneOf, thick, techNat, inStudyPlan: används av examenskontrollen och kommer
//   ALLTID från koden (studieplanen), aldrig från databasen.

import { COURSES, AREAS, LEVELS, periodsOf, yearOfTerm } from "./courses.js";
import { INFO } from "./course-info.js";
import { SEED_FOLDERS, SEED_EXTRA_COURSES } from "./folders.js";

export const pool = { courses: [], byId: {}, folders: [], seedIds: new Set(), overridden: new Set() };

// Fält som studenterna får ändra i kurspoolen. Allt annat tas från koden.
export const EDITABLE = ["name", "code", "hp", "level", "areas", "prereq", "url", "note", "offerings", "anyPeriod", "summer", "year", "folders"];
const RULE_FIELDS = ["type", "oneOf", "thick", "techNat", "inStudyPlan", "uni"];

const semOf = (periods) => (periods[0] <= 2 ? "HT" : "VT");

// Bara http(s)-länkar visas och sparas.
export function safeUrl(u) {
  try {
    const url = new URL(String(u || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

const str = (v, max = 2000) => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));

function cleanOfferings(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const o of list) {
    if (!o || !Array.isArray(o.periods)) continue;
    const periods = o.periods.map(Number).filter((p) => Number.isInteger(p) && p >= 1 && p <= 4).sort((a, b) => a - b);
    if (!periods.length) continue;
    out.push({ sem: o.sem === "VT" ? "VT" : o.sem === "HT" ? "HT" : semOf(periods), periods });
  }
  return out;
}

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

// Tvättar en kurs så att trasig eller elak data inte kan krascha sidan eller ändra reglerna.
function normalizeCourse(c, seed) {
  const areas = (Array.isArray(c.areas) ? c.areas : []).map((a) => str(a, 60)).filter(Boolean);
  const year = Number(c.year);
  const level = str(c.level, 4).toUpperCase();
  const course = {
    id: str(c.id, 40),
    code: str(c.code, 20),
    name: str(c.name, 160) || str(c.code, 20) || "Namnlös kurs",
    hp: Math.max(0, Math.min(60, Number(c.hp) || 0)),
    level: [...LEVELS, "GXX"].includes(level) ? level : "G1N",
    areas,
    teknik: areas.includes("Teknik"),
    prereq: str(c.prereq, 1500),
    url: safeUrl(c.url),
    note: str(c.note, 300),
    offerings: cleanOfferings(c.offerings),
    anyPeriod: !!c.anyPeriod,
    summer: !!c.summer,
    year: Number.isInteger(year) && year >= 1 && year <= 5 ? year : null,
    folders: (Array.isArray(c.folders) ? c.folders : []).map((f) => str(f, 40)).filter(Boolean),
    updated_by: str(c.updated_by, 120),
    updated_at: c.updated_at,
  };
  // Regelfält: från studieplanen för dess kurser, annars en extern kurs.
  if (seed) for (const k of RULE_FIELDS) course[k] = seed[k];
  else Object.assign(course, { type: "extern", oneOf: undefined, thick: !!c.thick, techNat: true, inStudyPlan: false, uni: str(c.uni, 4) });
  return course;
}

const SEED = () => {
  const list = [...COURSES.map(fromStudyPlan), ...SEED_EXTRA_COURSES.map((c) => normalizeCourse({ ...c }, null))];
  for (const c of list) {
    if (c.thick === undefined) c.thick = false;
    if (c.summer && !c.folders.includes("sommarkurser")) c.folders.push("sommarkurser");
  }
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
  const seedById = Object.fromEntries(seed.map((c) => [c.id, c]));
  pool.seedIds = new Set(seed.map((c) => c.id));
  const byId = { ...seedById };
  pool.overridden = new Set();
  for (const r of courseRows) {
    if (!r || typeof r.id !== "string") continue;
    const base = seedById[r.id];
    const data = r.data && typeof r.data === "object" ? r.data : {};
    const arrays = ["areas", "offerings", "folders"];
    const editable = Object.fromEntries(EDITABLE
      .filter((k) => k in data && data[k] != null && (!arrays.includes(k) || Array.isArray(data[k])))
      .map((k) => [k, data[k]]));
    if (base) pool.overridden.add(r.id);
    byId[r.id] = normalizeCourse({ ...(base || {}), ...editable, thick: base ? base.thick : data.thick, id: r.id, updated_by: r.updated_by, updated_at: r.updated_at }, base);
  }
  pool.byId = byId;
  pool.courses = Object.values(byId);

  const folders = SEED_FOLDERS.map((f) => ({ ...f, builtin: true }));
  for (const r of folderRows) {
    if (!r || typeof r.id !== "string") continue;
    const i = folders.findIndex((f) => f.id === r.id);
    const f = {
      ...(i >= 0 ? folders[i] : { builtin: false }),
      id: r.id, name: str(r.name, 80) || "Namnlös mapp", description: str(r.description, 1000),
      sort: Number(r.sort) || 100, updated_by: str(r.updated_by, 120),
    };
    if (i >= 0) folders[i] = f; else folders.push(f);
  }
  pool.folders = folders.sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100) || a.name.localeCompare(b.name, "sv"));
  return pool;
}

export const courseById = (id) => pool.byId[id];
export const coursesIn = (folderId) => pool.courses.filter((c) => c.folders.includes(folderId));

// Vad som sparas i databasen för en kurs: bara redigerbara fält, och för
// studieplanens kurser bara det som skiljer sig från studieplanen.
export function courseData(c) {
  const seed = pool.seedIds.has(c.id) ? SEED().find((x) => x.id === c.id) : null;
  const out = {};
  for (const k of EDITABLE) {
    if (seed && JSON.stringify(seed[k]) === JSON.stringify(c[k])) continue;
    out[k] = c[k];
  }
  if (!seed) out.thick = !!c.thick;
  return out;
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
