// Programmen som sidan stödjer. Varje student väljer program när kontot skapas.
// Programmet styr vilka kurser som är obligatoriska, vilka år 1–3 som fylls i,
// examenskraven, färgerna och loggan.

import { COURSES as ES_COURSES, AREAS as ES_AREAS, EXCLUSIVE_PAIRS as ES_PAIRS } from "./courses.js";
import { I_COURSES, I_AREAS, I_PAIRS } from "./program-i.js";

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

// Programmet som gäller just nu (den inloggades)
let current = PROGRAMS.ES;
export const P = () => current;
export function setProgram(id) {
  current = programOf(id);
  return current;
}

// Mappar som räknas ut från programmen och inte kan ändras: den egna programplanen
// och en mapp per annat program.
export const PLAN_FOLDER = "programplanen";
export const progFolder = (id) => "prog-" + id;
export const isVirtualFolder = (id) => id === PLAN_FOLDER || /^prog-/.test(id);
