// Programmen som sidan stödjer. Varje student väljer program när kontot skapas.
// Programmet styr vilka kurser som är obligatoriska, vilka år 1–3 som fylls i,
// examenskraven, färgerna och loggan.

import { COURSES as ES_COURSES, AREAS as ES_AREAS, EXCLUSIVE_PAIRS as ES_PAIRS } from "./courses.js";
import { I_COURSES, I_AREAS, I_PAIRS } from "./program-i.js";
import { periodsOf } from "./courses.js";
import { VERSIONS, OLD_COURSES, LATEST_VERSION, versionFor } from "./versions.js";

export const PROGRAMS = {
  ES: {
    id: "ES",
    short: "ES",
    name: "Energisystem",
    full: "Civilingenjörsprogrammet i energisystem",
    code: "TES2Y",
    people: "ESare",
    icon: "assets/es-icon.png",
    logo: "assets/es-logo.png",
    courses: ES_COURSES,
    areas: ES_AREAS,
    pairs: ES_PAIRS,
    freeMax: 30,
    studyPlanUrl: "https://www.uu.se/utbildning/studieplan?query=10067",
    eduPlanUrl: "https://www.uu.se/utbildning/utbildningsplan?query=8e0ca779-e57a-11f0-af1e-4773ce254d84",
    section: { name: "Föreningen Energisystem", url: "https://www.essektionen.se/" },
    planDesc: "Alla kurser i studieplanen för Civilingenjörsprogrammet i energisystem (TES2Y), giltig från HT 2026. Kurserna kan räknas in i examen utan särskilt beslut.",
  },
  I: {
    id: "I",
    short: "I",
    name: "Industriell ekonomi",
    full: "Civilingenjörsprogrammet i industriell ekonomi",
    code: "TIE2Y",
    people: "I-studenter",
    icon: "assets/i-logo.svg",
    logo: "assets/i-logo.svg",
    courses: I_COURSES,
    areas: I_AREAS,
    pairs: I_PAIRS,
    freeMax: 15,
    studyPlanUrl: "https://www.uu.se/utbildning/studieplan?query=aec2f35d-04f4-4a33-9a54-44d67d940e26",
    eduPlanUrl: "https://www.uu.se/utbildning/utbildningsplan?query=f56480d2-e589-11f0-af1e-4773ce254d84",
    section: { name: "I-sektionen", url: "https://www.isektionen-uu.se/" },
    planDesc: "Alla kurser i studieplanen för Civilingenjörsprogrammet i industriell ekonomi (TIE2Y), giltig från HT 2026, med båda profileringarna. Kurserna kan räknas in i examen utan särskilt beslut.",
  },
  none: {
    id: "none",
    short: "",
    name: "Eget upplägg",
    full: "Eget upplägg utan programplan",
    code: "",
    people: "Studenter",
    icon: "assets/es-icon.png",
    logo: "assets/es-logo.png",
    courses: [],
    areas: {},
    pairs: [],
    freeMax: Infinity,
    studyPlanUrl: "",
    eduPlanUrl: "",
    section: null,
    planDesc: "",
  },
};

// Program som går att välja i listan (i ordning)
export const PROGRAM_LIST = [PROGRAMS.ES, PROGRAMS.I];

export const programOf = (id) => PROGRAMS[id] || PROGRAMS.ES;

// Programmet och startåret som gäller just nu (den inloggades)
let current = PROGRAMS.ES;
let startYear = null;
export const P = () => current;
export const startYearOf = () => startYear;
export function setProgram(id, start = startYear) {
  current = programOf(id);
  startYear = Number(start) || null;
  return current;
}

// Kurser som bara finns i äldre studieplaner, som kataloguppgifter (samma form som i courses.js)
export const oldCourses = (prog) => (OLD_COURSES[prog.id] || []).map(([code, name, hp, level, areas]) => ({
  code, name, hp, level, areas, teknik: areas.includes("Teknik"), type: "val", term: null, period: "", uni: "UU", techNat: true,
}));

// De obligatoriska kurserna för den som började startYear: år 1 från studieplanen det
// läsåret, år 2 från nästa läsårs plan osv. Returnerar Map kurskod → { year, periods }.
// Saknar en äldre plan obligatoriska kurser för år 4–5 används den senaste planen.
export function obligatoryFor(prog, start) {
  const out = new Map();
  if (!prog.courses.length) return out;
  const latest = prog.courses.filter((c) => c.type === "obl" && typeof c.term === "number")
    .map((c) => [c.code, { [c.term]: (periodsOf(c) || []).join("") }]);
  for (let y = 1; y <= 5; y++) {
    const v = versionFor(start, y);
    let list = v >= LATEST_VERSION ? latest : VERSIONS[prog.id]?.[v] || latest;
    const terms = [2 * y - 1, 2 * y];
    const inYear = (l) => l.filter(([, t]) => terms.some((n) => t[n] != null));
    if (!inYear(list).length) list = latest;
    for (const [code, t] of inYear(list)) {
      if (out.has(code)) continue;
      const periods = [...new Set(terms.flatMap((n) => String(t[n] ?? "").split("").map(Number)))].filter(Boolean).sort();
      out.set(code, { year: y, periods, version: v });
    }
  }
  // Kurser som har flyttats till ett tidigare år i en nyare plan hamnar annars mellan två
  // planer (t.ex. Ekonomistyrning: år 4 i 2025 års plan men år 3 i 2026 års). Är kursen
  // fortfarande obligatorisk läses den det år som den senaste använda äldre planen anger.
  const stillObl = new Set(latest.map(([code]) => code));
  for (let y = 5; y >= 1; y--) {
    const v = versionFor(start, y);
    if (v >= LATEST_VERSION) continue;
    for (const [code, t] of VERSIONS[prog.id]?.[v] || []) {
      if (out.has(code) || !stillObl.has(code)) continue;
      const later = Object.keys(t).map(Number).filter((n) => n > 2 * y);
      if (!later.length) continue;
      const year = Math.ceil(Math.min(...later) / 2);
      const terms = [2 * year - 1, 2 * year];
      const periods = [...new Set(terms.flatMap((n) => String(t[n] ?? "").split("").map(Number)))].filter(Boolean).sort();
      out.set(code, { year, periods, version: v });
    }
  }
  return out;
}

// Vilken studieplan varje årskurs följer, för texten när man skapar sin plan
export const planYears = (start) => [1, 2, 3, 4, 5].map((y) => versionFor(start, y));

// Mappar som räknas ut från programmen och inte kan ändras: den egna programplanen
// och en mapp per annat program.
export const PLAN_FOLDER = "programplanen";
export const progFolder = (id) => "prog-" + id;
export const isVirtualFolder = (id) => id === PLAN_FOLDER || /^prog-/.test(id);
