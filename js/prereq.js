// Behörighetskontroll. Kraven är förenklade från kursernas behörighetstexter:
// vi räknar bara hp (totalt, inom teknik/naturvetenskap, per huvudområde och på avancerad
// nivå) och kursspecifika krav. Gymnasiekurser, Engelska 6 o.d. antar vi att alla har.
// Kraven ligger på kursen i kurspoolen (c.req) och kan ändras där. Startvärden: reqs.js.

import { pool, courseById, HP_KEYS } from "./pool.js";


// Huvudområden som inte räknas som teknik/naturvetenskap
const NOT_TN = new Set(["Företagsekonomi", "Idéhistoria", "Juridik", "Rättsvetenskap", "Nationalekonomi", "Statskunskap", "Kulturgeografi"]);

export const HP_LABEL = {
  total: "totalt", tn: "inom teknik/naturvetenskap", adv: "på avancerad nivå",
  Teknik: "inom teknik", Matematik: "matematik", Fysik: "fysik", Kemi: "kemi", Biologi: "biologi",
};

// Tidsläge i "periodsteg": varje år har period 1–4 och sommaren som steg 5.
const startOf = (it) => (it.year - 1) * 5 + (it.summer ? 5 : it.period);
const endOf = (it) => startOf(it) + (it.summer ? 0 : it.span - 1);

// Vad en kurs i planen ger: hp, huvudområden, nivå och vilka kurskoder den motsvarar.
function facts(it) {
  const c = it.code ? courseById(it.code) : null;
  const x = c || it.custom || it.snap || {};
  const hp = Number(x.hp) || 0;
  const areas = c ? c.areas : x.teknik ? ["Teknik"] : [];
  const level = String(x.level || "");
  const codes = new Set();
  if (c) {
    codes.add(c.id);
    // Varianter (UU/SLU eller äldre kurs) räknas som samma kurs
    if (c.oneOf) for (const id of groupMembers(c.oneOf)) codes.add(id);
  } else if (it.code) codes.add(it.code);
  else if (it.custom?.code) codes.add(String(it.custom.code).trim().toUpperCase());
  return { hp, areas, adv: level.startsWith("A"), tn: areas.some((a) => !NOT_TN.has(a)) || (!c && !!x.teknik), codes };
}

// Alla kurser i samma oneOf-grupp i kurspoolen.
const groupMembers = (group) => pool.courses.filter((c) => c.oneOf === group).map((c) => c.id);

const describeCodes = (alts) => alts.map((a) => courseById(a.replace("~", ""))?.name || a.replace("~", "")).join(" eller ");

// Behörighet för en kurs i planen.
// Returnerar null om kursen saknar krav eller inte är planerad, annars
// { state: "ok" | "pending" | "missing", items: [{ text, state }] }
export function eligibility(plan, item) {
  const req = item.code ? courseById(item.code)?.req : null;
  if (!req || (!Object.keys(req.hp).length && !req.c.length)) return null;
  const s = startOf(item), e = endOf(item);
  const others = plan.items.filter((x) => x !== item && x.id !== item.id);
  const before = others.filter((x) => endOf(x) < s);
  const parallel = others.filter((x) => startOf(x) <= e);

  const sum = (list, key) => {
    const seen = new Set();
    let n = 0;
    for (const x of list) {
      const f = facts(x);
      const k = x.code || x.id;
      if (seen.has(k)) continue;
      seen.add(k);
      if (key === "total" || (key === "tn" && f.tn) || (key === "adv" && f.adv) || f.areas.includes(key)) n += f.hp;
    }
    return n;
  };
  const done = (list) => list.filter((x) => x.status === "done");

  const items = [];
  for (const [key, need] of Object.entries(req.hp || {})) {
    const hd = sum(done(before), key), ha = sum(before, key);
    items.push({
      text: `${need} hp ${HP_LABEL[key] || key.toLowerCase()}`,
      detail: ha >= need && hd < need ? `${hd} hp klara, ${ha} hp med planerade kurser` : `${ha} hp innan kursen`,
      state: hd >= need ? "ok" : ha >= need ? "pending" : "missing",
    });
  }
  for (const group of req.c || []) {
    const alts = group.split("|");
    const has = (list) => alts.some((a) => {
      const par = a.startsWith("~");
      const code = a.replace("~", "");
      return (par ? list.parallel : list.before).some((x) => facts(x).codes.has(code));
    });
    const okDone = has({ before: done(before), parallel: done(parallel) });
    const okAll = has({ before, parallel });
    const par = alts.some((a) => a.startsWith("~"));
    items.push({
      text: describeCodes(alts) + (par ? " (får läsas parallellt)" : ""),
      state: okDone ? "ok" : okAll ? "pending" : "missing",
    });
  }
  const state = items.some((i) => i.state === "missing") ? "missing" : items.some((i) => i.state === "pending") ? "pending" : "ok";
  return { state, items };
}
