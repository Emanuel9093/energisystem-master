// Kontrollerar en studieplan mot examenskraven för civilingenjörsexamen i energisystem.
// Kraven kommer från utbildningsplanen (avsnitten "Preciserade krav").

import { COURSES, BY_CODE, EXCLUSIVE_PAIRS } from "./courses.js";

export const STATUSES = {
  done: "Klar",
  ongoing: "Läser nu",
  planned: "Planerad",
};

const isAdvanced = (c) => c.level.startsWith("A");
const isThesis = (c) => c.level === "A2E";

// Bygger listan av kurser som räknas, med katalogkurser och egna kurser.
export function resolveCourses(plan, statuses) {
  const list = [];
  for (const [code, status] of Object.entries(plan.courses || {})) {
    if (!statuses.includes(status) || !BY_CODE[code]) continue;
    list.push({ ...BY_CODE[code], status, inPlan: true });
  }
  for (const x of plan.custom || []) {
    if (!statuses.includes(x.status)) continue;
    list.push({
      code: (x.code || "").toUpperCase(), name: x.name, hp: Number(x.hp) || 0, level: x.level,
      teknik: !!x.teknik, type: "extern", status: x.status, inPlan: false, techNat: true, customId: x.id,
    });
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
  const codes = new Map(kept.map((c) => [c.code, c]));
  for (const [a, b] of EXCLUSIVE_PAIRS) {
    if (codes.has(a) && codes.has(b)) {
      conflicts.push([codes.get(a), codes.get(b)]);
      kept = kept.filter((c) => c.code !== b);
      codes.delete(b);
    }
  }
  return { kept, conflicts };
}

const sum = (arr) => arr.reduce((s, c) => s + c.hp, 0);

export function evaluate(plan, statuses = ["done", "ongoing", "planned"]) {
  const { kept, conflicts } = dedupe(resolveCourses(plan, statuses));
  const codes = new Set(kept.map((c) => c.code));

  const total = sum(kept);
  const advanced = sum(kept.filter(isAdvanced));
  const teknik = sum(kept.filter((c) => c.teknik));
  const teknikAdv = sum(kept.filter((c) => c.teknik && isAdvanced(c)));
  const a1fTeknik = sum(kept.filter((c) => c.teknik && c.level === "A1F"));

  const thesis = kept.find((c) => isThesis(c) && c.teknik && c.hp >= 30);

  // Obligatoriska kurser (grupper med oneOf kräver en av kurserna)
  const missing = [];
  const groupsDone = new Set();
  for (const c of COURSES.filter((x) => x.type === "obl")) {
    if (c.oneOf) {
      if (groupsDone.has(c.oneOf)) continue;
      groupsDone.add(c.oneOf);
      const alts = COURSES.filter((x) => x.oneOf === c.oneOf);
      if (!alts.some((a) => codes.has(a.code))) missing.push({ ...c, name: c.name.replace(" (SLU)", "") + " (UU eller SLU)" });
    } else if (!codes.has(c.code)) {
      missing.push(c);
    }
  }

  const tsCourses = kept.filter((c) => c.type === "ts");
  const tsCount = tsCourses.length;
  const tsUsedHp = sum(tsCourses.slice(0, 3));

  // Valbara tekniska/naturvetenskapliga kurser ur studieplanen, utöver de tre teknik och system-kurserna
  const electiveTechNat =
    sum(kept.filter((c) => c.inPlan && c.type !== "obl" && c.techNat)) - tsUsedHp;
  const outside = sum(kept.filter((c) => !c.inPlan));

  const checks = [
    { id: "total", label: "Minst 300 hp totalt", value: total, target: 300, unit: "hp" },
    {
      id: "mandatory", label: "Alla obligatoriska kurser", value: missing.length === 0 ? 1 : 0, target: 1,
      detail: missing.length
        ? `Saknas: ${missing.slice(0, 4).map((m) => m.name).join(", ")}${missing.length > 4 ? ` och ${missing.length - 4} till` : ""}`
        : "Alla obligatoriska kurser finns med.",
      missing,
    },
    {
      id: "thesis", label: "Examensarbete 30 hp (A2E, teknik)", value: thesis ? 30 : 0, target: 30, unit: "hp",
    },
    { id: "advanced", label: "Minst 90 hp på avancerad nivå", value: advanced, target: 90, unit: "hp", detail: "Examensarbetet räknas in." },
    { id: "teknik", label: "Minst 150 hp inom huvudområdet teknik", value: teknik, target: 150, unit: "hp" },
    { id: "teknikAdv", label: "Minst 60 hp teknik på avancerad nivå", value: teknikAdv, target: 60, unit: "hp", detail: "Examensarbetet räknas in." },
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
  for (const ch of checks) ch.ok = ch.value >= ch.target;

  const warnings = [];
  if (outside > 30) {
    warnings.push(`Du har ${outside} hp kurser utanför studieplanen. Normalt får högst 30 hp valfria kurser ingå i examen.`);
  }
  for (const [a, b] of conflicts) {
    warnings.push(`${a.name} (${a.code}) och ${b.name} (${b.code}) kan inte båda räknas in i examen. Bara den första räknas.`);
  }
  if (total > 300) {
    warnings.push(`Planen har ${total} hp. Examen omfattar 300 hp, så alla kurser behöver inte ingå.`);
  }

  return {
    checks, warnings, total, advanced, teknik, teknikAdv, outside,
    allOk: checks.every((c) => c.ok),
  };
}
