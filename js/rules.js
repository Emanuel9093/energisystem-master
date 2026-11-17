// Kontrollerar en studieplan mot examenskraven för civilingenjörsexamen i det program
// studenten går. Kraven kommer från utbildningsplanerna (avsnitten "Preciserade krav").
// Gemensamt för alla civilingenjörsprogram vid UU: 300 hp, 90 hp avancerad nivå,
// 150 hp teknik varav 60 hp avancerad nivå, alla obligatoriska kurser och examensarbete 30 hp.

import { pool } from "./pool.js";
import { P } from "./programs.js";
import { PROFILES } from "./program-i.js";

export const STATUSES = {
  done: "Klar",
  ongoing: "Läser nu",
  planned: "Planerad",
};

const isAdvanced = (c) => c.level.startsWith("A");
const isThesis = (c) => c.level === "A2E";

// Bygger listan av kurser som räknas, med katalogkurser och egna kurser.
// plan.items: [{ id, year, period, row, span, code } eller { ..., custom: { name, code, hp, level, teknik } }]
export function resolveCourses(plan, statuses) {
  const list = [];
  const seen = new Set();
  for (const it of plan.items || []) {
    if (!statuses.includes(it.status)) continue;
    // Kurs utanför studieplanen som räknas till en profilering (godkänd av programansvarig)
    const asProfile = P().id === "I" ? it.profileAs : undefined;
    const pc = it.code && pool.byId[it.code];
    if (pc) {
      if (seen.has(it.code)) continue; // samma kurs inlagd två gånger räknas en gång
      seen.add(it.code);
      list.push({ ...pc, code: pc.code || pc.id, status: it.status, inPlan: pc.inStudyPlan || !!asProfile, profile: (!pc.inStudyPlan && asProfile) || pc.profile });
    } else if (it.custom || it.snap) {
      // Privat kurs, eller en kurs som tagits bort ur kurspoolen (räknas som kurs utanför studieplanen)
      const x = it.custom || it.snap;
      list.push({
        code: String(x.code || it.code || "").toUpperCase(), name: x.name, hp: Number(x.hp) || 0, level: String(x.level || "G1N"),
        teknik: !!x.teknik, type: "extern", status: it.status, inPlan: !!asProfile, techNat: true, profile: asProfile,
      });
    }
  }
  return list;
}

// Tar bort dubbletter där bara en kurs i en grupp får räknas. Returnerar konflikterna.
function dedupe(list) {
  const conflicts = [];
  const seenGroups = new Map();
  let kept = [];
  for (const c of list) {
    if (c.oneOf) {
      if (seenGroups.has(c.oneOf)) {
        conflicts.push([seenGroups.get(c.oneOf), c]);
        continue;
      }
      seenGroups.set(c.oneOf, c);
    }
    kept.push(c);
  }
  const codes = new Map(kept.map((c) => [c.id ?? c.code, c]));
  for (const [a, b] of P().pairs) {
    if (codes.has(a) && codes.has(b)) {
      conflicts.push([codes.get(a), codes.get(b)]);
      kept = kept.filter((c) => (c.id ?? c.code) !== b);
      codes.delete(b);
    }
  }
  return { kept, conflicts };
}

const sum = (arr) => arr.reduce((s, c) => s + c.hp, 0);

export function evaluate(plan, statuses = ["done", "ongoing", "planned"]) {
  const { kept, conflicts } = dedupe(resolveCourses(plan, statuses));
  const codes = new Set(kept.map((c) => c.id || c.code));

  const total = sum(kept);
  const advanced = sum(kept.filter(isAdvanced));
  const teknik = sum(kept.filter((c) => c.teknik));
  const teknikAdv = sum(kept.filter((c) => c.teknik && isAdvanced(c)));
  const a1fTeknik = sum(kept.filter((c) => c.teknik && c.level === "A1F"));

  const thesis = kept.find((c) => isThesis(c) && c.teknik && c.hp >= 30);

  // Obligatoriska kurser (grupper med oneOf kräver en av kurserna)
  const missing = [];
  const groupsDone = new Set();
  const studyPlan = pool.courses.filter((x) => x.inStudyPlan);
  // En kurs och dess ersättare (kurspar där bara en får räknas) uppfyller samma krav,
  // t.ex. Organisk kemi KE0068 (äldre plan) och KE0079 (ny plan).
  const has = (id) => codes.has(id) || P().pairs.some(([a, b]) => (a === id && codes.has(b)) || (b === id && codes.has(a)));
  for (const c of studyPlan.filter((x) => x.type === "obl")) {
    if (c.oneOf) {
      if (groupsDone.has(c.oneOf)) continue;
      groupsDone.add(c.oneOf);
      const alts = studyPlan.filter((x) => x.oneOf === c.oneOf);
      if (!alts.some((a) => has(a.id))) {
        const uuSlu = alts.every((a) => a.name.replace(" (SLU)", "") === c.name.replace(" (SLU)", ""));
        const name = uuSlu ? c.name.replace(" (SLU)", "") + " (UU eller SLU)" : `${c.name} (eller ${alts.filter((a) => a !== c).map((a) => a.name).join(", ")})`;
        missing.push({ ...c, name });
      }
    } else if (!has(c.id)) {
      missing.push(c);
    }
  }

  const prog = P();
  const outside = sum(kept.filter((c) => !c.inPlan));
  const common = {
    total: { id: "total", label: "Minst 300 hp totalt", value: total, target: 300, unit: "hp" },
    mandatory: {
      id: "mandatory", label: "Alla obligatoriska kurser", value: missing.length === 0 ? 1 : 0, target: 1,
      detail: missing.length
        ? `Saknas: ${missing.slice(0, 4).map((m) => m.name).join(", ")}${missing.length > 4 ? ` och ${missing.length - 4} till` : ""}`
        : "Alla obligatoriska kurser finns med.",
      missing,
    },
    thesis: { id: "thesis", label: "Examensarbete 30 hp (A2E, teknik)", value: thesis ? 30 : 0, target: 30, unit: "hp" },
    advanced: { id: "advanced", label: "Minst 90 hp på avancerad nivå", value: advanced, target: 90, unit: "hp", detail: "Examensarbetet räknas in." },
    teknik: { id: "teknik", label: "Minst 150 hp inom huvudområdet teknik", value: teknik, target: 150, unit: "hp" },
    teknikAdv: { id: "teknikAdv", label: "Minst 60 hp teknik på avancerad nivå", value: teknikAdv, target: 60, unit: "hp", detail: "Examensarbetet räknas in." },
  };

  let checks;
  if (prog.id === "I") checks = checksI(kept, common);
  else if (prog.id === "ES") checks = checksES(kept, common, a1fTeknik);
  else {
    const a1f = sum(kept.filter((c) => c.level === "A1F"));
    checks = [common.total, common.thesis, common.advanced,
      { id: "a1f", label: "Minst 10 hp på A1F-nivå", value: a1f, target: 10, unit: "hp", detail: "Examensarbetet räknas inte." },
      common.teknik, common.teknikAdv];
  }
  for (const ch of checks) ch.ok = ch.value >= ch.target;

  const warnings = [];
  if (prog.courses.length && outside > prog.freeMax) {
    warnings.push(`Du har ${outside} hp kurser utanför studieplanen. Högst ${prog.freeMax} hp valfria kurser får ingå i examen.`);
  }
  for (const [a, b] of conflicts) {
    warnings.push(`${a.name} (${a.code}) och ${b.name} (${b.code}) kan inte båda räknas in i examen. Bara ${a.name} räknas.`);
  }
  // En examen på 300–304.5 hp är okej. Först vid 305 hp ingår kurser som inte behövs.
  if (total >= 305) {
    warnings.push(`Planen har ${total} hp. Examen omfattar 300 hp (upp till 304,5 hp går bra), så alla kurser behöver inte ingå.`);
  }

  return {
    checks, warnings, total, advanced, teknik, teknikAdv, outside,
    allOk: checks.every((c) => c.ok),
  };
}

// Energisystem (TES2Y)
function checksES(kept, common, a1fTeknik) {
  const tsCourses = kept.filter((c) => c.type === "ts" && c.inPlan);
  const tsCount = tsCourses.length;
  const tsUsedHp = sum(tsCourses.slice(0, 3));

  // Valbara tekniska/naturvetenskapliga kurser ur studieplanen, utöver de tre teknik och system-kurserna
  const electiveTechNat =
    sum(kept.filter((c) => c.inPlan && c.type !== "obl" && c.techNat)) - tsUsedHp;

  return [
    common.total, common.mandatory, common.thesis, common.advanced, common.teknik, common.teknikAdv,
    { id: "a1f", label: "Minst 10 hp teknik på A1F-nivå", value: a1fTeknik, target: 10, unit: "hp", detail: "Examensarbetet räknas inte." },
    {
      id: "ts", label: "Minst 3 kurser \"teknik och system\"", value: tsCount, target: 3, unit: "st",
      detail: tsCount ? tsCourses.map((c) => c.name.split(" – ")[0]).join(", ") : "Elkraftsystemanalys räknas också.",
    },
    {
      id: "electives", label: "Minst 20 hp valbara tekniska/naturvetenskapliga kurser ur studieplanen",
      value: Math.max(0, electiveTechNat), target: 20, unit: "hp",
      detail: "Utöver de tre teknik och system-kurserna. Miljörätt, Ingenjörsetik och Stora sociotekniska system räknas inte.",
    },
  ];
}

// Industriell ekonomi (TIE2Y): minst 20 hp i en profilering och 10 hp i den andra, sedan
// ytterligare 10 hp som passar profilerna. Etik i teknik och organisering får räknas till vilken som helst.
export function profileHp(kept) {
  const hp = { aff: 0, dig: 0, both: 0 };
  for (const c of kept) if (c.inPlan && c.profile) hp[c.profile] += c.hp;
  // Fördela "båda"-kurserna så att kravet 20 + 10 uppfylls så långt det går
  let best = null;
  for (let x = 0; x <= hp.both; x += 5) {
    const aff = hp.aff + x, dig = hp.dig + hp.both - x;
    const main = Math.max(aff, dig), other = Math.min(aff, dig);
    const score = Math.min(main, 20) + Math.min(other, 10);
    if (!best || score > best.score) best = { aff, dig, main, other, score, mainId: aff >= dig ? "aff" : "dig" };
  }
  return { ...best, total: hp.aff + hp.dig + hp.both };
}

function checksI(kept, common) {
  const a1f = sum(kept.filter((c) => c.level === "A1F"));
  const pr = profileHp(kept);
  const mainName = PROFILES[pr.mainId], otherName = PROFILES[pr.mainId === "aff" ? "dig" : "aff"];
  const extra = Math.max(0, pr.total - Math.min(pr.main, 20) - Math.min(pr.other, 10));
  return [
    common.total, common.mandatory, common.thesis, common.advanced,
    { id: "a1f", label: "Minst 10 hp på A1F-nivå", value: a1f, target: 10, unit: "hp", detail: "Examensarbetet räknas inte." },
    common.teknik, common.teknikAdv,
    { id: "profMain", label: "Minst 20 hp i en profilering", value: pr.main, target: 20, unit: "hp",
      detail: pr.main ? `Flest hp i ${mainName}.` : "Välj kurser i Affärsutveckling och innovation eller Industriell analys och digitalisering." },
    { id: "profOther", label: "Minst 10 hp i den andra profileringen", value: pr.other, target: 10, unit: "hp",
      detail: `${otherName}.` },
    { id: "profExtra", label: "Ytterligare 10 hp som passar profilerna", value: extra, target: 10, unit: "hp",
      detail: "Räknar profileringskurser utöver 20 + 10 hp. Andra kurser kan också passa profilerna. Fråga studievägledningen." },
  ];
}
