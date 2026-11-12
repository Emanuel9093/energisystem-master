// Kurskatalog för Civilingenjörsprogrammet i energisystem (TES2Y), Uppsala universitet / SLU.
// Källa: studieplan och utbildningsplan giltiga från och med HT 2026.
//   https://www.uu.se/utbildning/studieplan?query=10067
//
// Fält:
//   code    kurskod
//   name    kursnamn
//   hp      högskolepoäng (hela kursen, även när den går över två perioder)
//   level   G1N, G1F, G2F, G2E, A1N, A1F, A2E (GXX räknas som grundnivå)
//   teknik  true om kursen har huvudområdet Teknik
//   type    "obl" obligatorisk, "ts" "teknik och system"-kurs, "val" valbar, "till" tillvalskurs
//   term    termin 1–10, "S" för sommar, "X" för valfri period
//   period  läsperiod(er) som text
//   uni     "UU" eller "SLU"
//   oneOf   kurser med samma oneOf-grupp: exakt en räknas (t.ex. examensarbete UU/SLU)
//   techNat false för valbara kurser som varken är tekniska eller naturvetenskapliga

const c = (code, name, hp, level, teknik, type, term, period, extra = {}) => ({
  code, name, hp, level, teknik, type, term, period, uni: code.match(/^[A-ZÅÄÖ]{2}\d{4}$/) ? "SLU" : "UU", techNat: true, ...extra,
});

export const COURSES = [
  // Årskurs 1
  c("TN0367", "Introduktion till energisystem", 10, "G1N", true, "obl", 1, "1–2"),
  c("1MA090", "Algebra och geometri", 5, "G1N", false, "obl", 1, "1"),
  c("1MA013", "Envariabelanalys", 10, "G1F", false, "obl", 1, "1–2"),
  c("1FA105", "Mekanik baskurs", 10, "G1F", true, "obl", 1, "2–3"),
  c("1MA016", "Flervariabelanalys", 10, "G1F", false, "obl", 2, "3–4"),
  c("KE0049", "Allmän kemi och kemiska energikällor", 10, "G1N", false, "obl", 2, "3–4"),
  c("1TD433", "Programmeringsteknik I", 5, "G1N", true, "obl", 2, "4"),

  // Årskurs 2
  c("BI1360", "Energisystemens biogeokemiska förutsättningar", 10, "G1N", false, "obl", 3, "1–2"),
  c("1FA102", "Mekanik II", 5, "G1F", true, "obl", 3, "1"),
  c("MS0073", "Grundläggande matematisk statistik", 5, "G1F", false, "obl", 3, "1"),
  c("1FA514", "Elektromagnetism I", 5, "G1F", true, "obl", 3, "2"),
  c("1FA527", "Teknisk termodynamik", 5, "G1F", true, "obl", 3, "2"),
  c("KE0079", "Organisk kemi med energitillämpningar", 5, "G1F", false, "obl", 4, "3"),
  c("1EL016", "Strömningsmekanik", 5, "G1F", true, "obl", 4, "3"),
  c("1MA024", "Linjär algebra II", 5, "G1F", false, "obl", 4, "3"),
  c("1EL004", "Elkretsanalys", 5, "G1F", true, "obl", 4, "4"),
  c("TN0373", "Systemanalys med energitillämpningar", 5, "G1F", true, "obl", 4, "4"),
  c("1TD342", "Introduktion till beräkningsvetenskap", 5, "G1F", true, "obl", 4, "4"),

  // Årskurs 3
  c("FÖ0498", "Ekonomistyrning för ingenjörer", 5, "G1F", false, "obl", 5, "1 (ges även T7)"),
  c("1TD352", "Beräkningsvetenskap för dataanalys", 5, "G2F", true, "obl", 5, "1"),
  c("TN0285", "Energi- och livscykelanalys", 5, "G2F", true, "obl", 5, "1"),
  c("1MA034", "Transformmetoder", 5, "G1F", false, "obl", 5, "2"),
  c("1FA540", "Produktion och transport av värme", 5, "G1F", true, "obl", 5, "2"),
  c("KE0069", "Energisystemens miljöpåverkan", 5, "G1F", false, "obl", 5, "2"),
  c("1TE655", "Elkraftteknik", 5, "G2F", true, "obl", 6, "3"),
  c("1RT490", "Reglerteknik I", 5, "G2F", true, "obl", 6, "3"),
  c("1TE078", "Modern fysik", 5, "G1F", false, "val", 6, "3", { note: "Förkunskapskrav för kurser i åk 4–5" }),
  c("1TE061", "Industriell projektledning", 5, "G1F", true, "val", 6, "3"),
  c("1TE687", "Ingenjörsetik", 5, "G1F", false, "val", 6, "3", { techNat: false }),
  c("2JS905", "Miljörätt", 5, "G1N", false, "val", 6, "3", { techNat: false }),
  c("1TE642", "Praktisk prototypframtagning", 5, "G1F", true, "val", 6, "3"),
  c("1FA522", "Vågor och optik", 5, "G2F", false, "val", 6, "3"),
  c("1TE654", "Hållfasthetslära", 5, "G1F", true, "val", 6, "3 (ges även T7)"),
  c("1FA311", "Självständigt arbete i energisystem", 15, "G2E", true, "obl", 6, "4", { oneOf: "sjalvstandigt" }),
  c("EX0946", "Självständigt arbete i energisystem (SLU)", 15, "G2E", true, "obl", 6, "4", { oneOf: "sjalvstandigt" }),

  // Årskurs 4, termin 7
  c("1FA410", "Kärnkraft – teknik och system", 10, "A1N", true, "ts", 7, "1–2"),
  c("1TE029", "Vattenkraft – teknik och system", 10, "A1N", true, "ts", 7, "1–2"),
  c("1TE035", "Energieffektivisering i byggnader – teknik och system", 10, "A1N", true, "ts", 7, "1–2"),
  c("1TE765", "Kraftelektronik I", 5, "A1N", true, "val", 7, "1"),
  c("MX0162", "Miljökonsekvensbeskrivning", 5, "A1N", false, "val", 7, "1"),
  c("1TS359", "Energimarknadsanalys", 5, "A1N", true, "val", 7, "2"),
  c("TE0018", "Geografiska informationssystem för ingenjörer", 5, "A1N", true, "val", 7, "2"),

  // Årskurs 4, termin 8
  c("1TS309", "Fjärrvärme – teknik och system", 10, "A1N", true, "ts", 8, "3–4"),
  c("TN0352", "Bioenergi – teknik och system", 10, "A1N", true, "ts", 8, "3–4"),
  c("1TE038", "Vindkraft – teknik och system", 10, "A1N", true, "ts", 8, "3–4"),
  c("1TE043", "Vågkraft – teknik och system", 10, "A1N", true, "ts", 8, "3–4"),
  c("1GV334", "Energisäkerhet i lokala och globala energisystem", 5, "A1N", true, "val", 8, "3"),
  c("1FA412", "Framtida nukleära energisystem – analyser och simuleringar", 5, "A1F", true, "val", 8, "3"),
  c("1TS356", "Urbana och decentraliserade energisystem", 5, "A1N", true, "val", 8, "3"),
  c("TN0365", "Logistik", 5, "A1N", true, "val", 8, "4"),
  c("1RT495", "Reglerteknik II", 5, "A1N", true, "val", 8, "4 (även tillval P1)"),
  c("1FA591", "Mätteknik för energisystem", 5, "A1N", true, "val", 8, "4"),

  // Årskurs 5, termin 9
  c("1RT890", "Empirisk modellering", 10, "A1N", true, "val", 9, "1"),
  c("1TE028", "Solenergi – teknik och system", 10, "A1N", true, "ts", 9, "1–2"),
  c("TN0347", "Energisystemplanering", 10, "A1F", true, "val", 9, "1–2"),
  c("1TE700", "Elkraftsystemanalys", 10, "A1F", true, "ts", 9, "1–2", { note: "Räknas som teknik och system-kurs" }),
  c("1KB274", "Batterier och lagring", 5, "A1N", true, "val", 9, "1"),
  c("TN0350", "Hållbar utveckling i energibranschen", 5, "A1F", true, "val", 9, "1"),
  c("1FA594", "Säkerhetsanalyser inom energisektorn", 5, "A1F", true, "val", 9, "2"),
  c("5LH654", "Stora sociotekniska system", 5, "A1N", false, "val", 9, "2", { techNat: false }),
  c("1TE065", "Generatordesign", 10, "A1F", true, "val", 9, "2"),
  c("1TE724", "Avancerad solcellsdesign", 5, "A1F", true, "val", 9, "2"),

  // Årskurs 5, termin 10
  c("1FA392", "Examensarbete i energisystem", 30, "A2E", true, "obl", 10, "3–4", { oneOf: "examensarbete" }),
  c("EX1032", "Examensarbete i energisystem (SLU)", 30, "A2E", true, "obl", 10, "3–4", { oneOf: "examensarbete" }),

  // Tillvalskurser
  c("1TD354", "Beräkningsvetenskap för partiella differentialekvationer", 5, "A1N", true, "till", "X", "2"),
  c("1TE737", "Nätanslutning av variabla källor", 5, "A1F", true, "till", "X", "3"),
  c("1FA452", "Tillämpad reaktorfysik", 5, "A1F", true, "till", "X", "3"),
  c("1RT700", "Statistisk maskininlärning", 5, "A1N", true, "till", "X", "3"),
  c("1EL009", "Cybersäkerhet och styrning av elkraftsystem", 5, "A1F", true, "till", "X", "4"),
  c("1TE649", "CAD med FEM", 5, "G1F", true, "till", "X", "4"),
  c("1FA393", "Projektarbete i energisystem", 15, "G2F", true, "till", "X", "Valfri", { oneOf: "projekt" }),
  c("TE0024", "Projektarbete i energisystem (SLU)", 15, "G2F", true, "till", "X", "Valfri", { oneOf: "projekt" }),
  c("1FA394", "Fördjupande projektarbete i energisystem", 15, "A1F", true, "till", "X", "Valfri", { oneOf: "fordjupande" }),
  c("TE0023", "Fördjupande projektarbete i energisystem (SLU)", 15, "A1F", true, "till", "X", "Valfri", { oneOf: "fordjupande" }),
  c("1FA456", "Reaktorfysik med Python", 5, "A1N", true, "till", "S", "Sommar, distans"),
];

export const BY_CODE = Object.fromEntries(COURSES.map((x) => [x.code, x]));

// Kurspar där endast en får räknas in i examen (från studieplanen).
// Koder som inte finns i katalogen kan läggas till som egna kurser och kontrolleras ändå.
export const EXCLUSIVE_PAIRS = [
  ["1TD327", "1TD433"], ["1EL004", "1TE637"], ["1TD354", "1TD397"], ["1TD352", "1TD395"],
  ["1TD342", "1TD393"], ["1TS309", "1GV134"], ["5LH654", "5LH242"], ["1TE700", "1TE754"],
  ["FÖ0498", "FÖ0477"], ["1KB274", "1KB765"], ["1TS356", "1TE792"], ["1EL016", "1FA529"],
  ["1TS359", "TN0351"], ["TE0018", "TE0005"], ["TE0018", "TE0008"], ["TE0018", "TE0016"],
];

export const TERM_LABELS = {
  1: "Termin 1 (åk 1, HT)", 2: "Termin 2 (åk 1, VT)", 3: "Termin 3 (åk 2, HT)", 4: "Termin 4 (åk 2, VT)",
  5: "Termin 5 (åk 3, HT)", 6: "Termin 6 (åk 3, VT)", 7: "Termin 7 (åk 4, HT)", 8: "Termin 8 (åk 4, VT)",
  9: "Termin 9 (åk 5, HT)", 10: "Termin 10 (åk 5, VT)", X: "Tillvalskurser", S: "Sommarkurser",
};

export const TERM_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, "X", "S"];

export const LEVELS = ["G1N", "G1F", "G2F", "G2E", "A1N", "A1F", "A2E"];
