// Kurskatalog för Civilingenjörsprogrammet i industriell ekonomi (TIE2Y), Uppsala universitet.
// Källa: studieplan och utbildningsplan giltiga från och med HT 2026.
//   https://www.uu.se/utbildning/studieplan?query=aec2f35d-04f4-4a33-9a54-44d67d940e26
//
// Samma fält som i courses.js, plus:
//   profile  "aff" = profilering Affärsutveckling och innovation,
//            "dig" = profilering Industriell analys och digitalisering,
//            "both" = får räknas till vilken som helst av dem (Etik i teknik och organisering)

const c = (code, name, hp, level, teknik, type, term, period, extra = {}) => ({
  code, name, hp, level, teknik, type, term, period, uni: "UU", techNat: true, ...extra,
});

export const I_COURSES = [
  // Årskurs 1
  c("1MA010", "Baskurs i matematik", 5, "G1N", false, "obl", 1, "1"),
  c("1TS301", "Industriell ekonomi I: företagets funktioner", 15, "G1N", true, "obl", 1, "1–3",
    { note: "Går över period 1–3 (5 hp per period)." }),
  c("1TS302", "Introduktion till industrial analytics", 5, "G1N", true, "obl", 1, "1"),
  c("1MA350", "Linjär algebra I", 5, "G1F", false, "obl", 1, "2"),
  c("1TS303", "Industriella produktionsfilosofier", 5, "G1N", true, "obl", 1, "2"),
  c("1MA013", "Envariabelanalys", 10, "G1F", false, "obl", 2, "3–4"),
  c("1DL042", "Programmering", 10, "G1N", true, "obl", 2, "3–4"),
  c("1FA104", "Mekanik", 5, "G1F", true, "obl", 2, "4"),

  // Årskurs 2
  c("1MA024", "Linjär algebra II", 5, "G1F", false, "obl", 3, "1"),
  c("1TS318", "Industriell ekonomi II: organisering, produktion och marknad", 10, "G1F", true, "obl", 3, "1–2"),
  c("1TD342", "Introduktion till beräkningsvetenskap", 5, "G1F", true, "obl", 3, "1"),
  c("1MA034", "Transformmetoder", 5, "G1F", false, "obl", 3, "2"),
  c("1EL007", "Virtuell utveckling av automatiserade produktionssystem", 5, "G1F", true, "obl", 3, "2"),
  c("1MA017", "Flervariabelanalys, allmän kurs", 5, "G1F", false, "obl", 4, "3"),
  c("1TE717", "Digitalteknik och elektronik", 10, "G1F", true, "obl", 4, "3"),
  c("1RT490", "Reglerteknik I", 5, "G2F", true, "obl", 4, "4"),
  c("1MS005", "Sannolikhet och statistik", 5, "G1F", false, "obl", 4, "4"),
  c("1TS320", "Industriell ekonomi III: projekt i affärs- och teknikutveckling", 5, "G2F", true, "obl", 4, "4"),

  // Årskurs 3
  c("1TS330", "Industriell ekonomi IV: företaget och omvärlden", 15, "G2F", true, "obl", 5, "1–3",
    { note: "Går över period 1–3 (5 hp per period)." }),
  c("1DL210", "Algoritmer och datastrukturer I", 5, "G1F", true, "obl", 5, "1"),
  c("1DL301", "Databasteknik I", 5, "G2F", true, "obl", 5, "1"),
  c("1TD184", "Optimeringsmetoder", 5, "A1N", true, "obl", 5, "2"),
  c("1TS368", "Entreprenörskap, teknik och samhälle", 5, "G2F", true, "obl", 5, "2"),
  c("1TS325", "Statistisk slutledning för tekniska tillämpningar", 5, "A1N", true, "obl", 6, "3"),
  c("1TD352", "Beräkningsvetenskap för dataanalys", 5, "G2F", true, "obl", 6, "3"),
  c("1TS332", "Självständigt arbete i industriell ekonomi", 15, "G2E", true, "obl", 6, "4", { thick: true }),

  // Årskurs 4, termin 7
  c("1TS340", "Strategisk ledning av teknikintensiva företag", 5, "A1N", true, "obl", 7, "1"),
  c("1TS341", "Ledarskap i en global värld", 5, "A1N", true, "obl", 7, "2"),
  c("1TE763", "Innovation – traditioner, teorier, trender", 10, "A1F", true, "val", 7, "1–2", { profile: "aff" }),
  c("1TS363", "Organisering av teknikintensivt arbete", 5, "A1N", true, "val", 7, "1", { profile: "aff" }),
  c("1TS328", "Industriell projektledning II", 5, "A1F", true, "val", 7, "2", { profile: "aff" }),
  c("1DL360", "Informationsutvinning I", 5, "A1N", true, "val", 7, "1", { profile: "dig" }),
  c("1DL400", "Databasteknik II", 5, "A1N", true, "val", 7, "2", { profile: "dig" }),
  c("1TS321", "Artificiell intelligens för industriell analys", 5, "A1N", true, "val", 7, "2", { profile: "dig" }),
  c("1DT118", "Cybersäkerhetsanalys", 5, "A1N", true, "val", 7, "2", { profile: "dig" }),

  // Årskurs 4, termin 8
  c("1TS342", "Teknologisk förändring och industriell (om)organisering", 5, "A1F", true, "obl", 8, "3"),
  c("1TS311", "Design av hälsoinnovationer", 5, "A1N", false, "val", 8, "3", { profile: "aff" }),
  c("1TE742", "Ledning för hållbarhet i globala industriföretag", 5, "A1N", true, "val", 8, "4", { profile: "aff" }),
  c("1TE735", "Industrialisering", 5, "A1F", false, "val", 8, "4", { profile: "aff" }),
  c("1TE051", "Projekt – fördjupning i produktutveckling/marknadsanalys", 5, "A1F", false, "val", 8, "4", { profile: "aff" }),
  c("1RT700", "Statistisk maskininlärning", 5, "A1N", true, "val", 8, "3", { profile: "dig" }),
  c("1TD169", "Data engineering I", 5, "A1N", true, "val", 8, "3", { profile: "dig" }),
  c("1TS360", "Modellering och optimering av produktionssystem", 5, "A1N", true, "val", 8, "4", { profile: "dig" }),

  // Årskurs 5, termin 9
  c("1TS364", "Teknik, affärsutveckling och ledning", 10, "A1F", true, "obl", 9, "1–2"),
  c("1TS352", "Vetenskapliga metoder för industriell ekonomi", 10, "A1F", true, "obl", 9, "1–2"),
  c("1TS353", "Etik i teknik och organisering", 5, "A1F", true, "val", 9, "1", { profile: "both" }),
  c("1TS344", "Kreativitet och hållbar design i teknikbaserat entreprenörskap", 5, "A1F", true, "val", 9, "1", { profile: "aff" }),
  c("2JS560", "Immaterialrätt och affärsjuridik", 5, "G1N", false, "val", 9, "2", { profile: "aff", techNat: false,
    note: "Studieplanen anger inte nivå eller huvudområde. Kontrollera i kursplanen." }),
  c("1RT705", "Avancerad probabilistisk maskininlärning", 5, "A1F", true, "val", 9, "1", { profile: "dig" }),
  c("1TS316", "Avancerad simulering och preskriptiv analys", 5, "A1F", false, "val", 9, "2", { profile: "dig" }),

  // Årskurs 5, termin 10
  c("1TS354", "Examensarbete i industriell ekonomi", 30, "A2E", true, "obl", 10, "3–4", { thick: true }),

  // Tillvalskurser
  c("1TS355", "Avancerad praktik i industriell ekonomi", 5, "A1N", true, "till", "X", "Valfri"),
];

// Huvudområden enligt studieplanen.
const T = "Teknik", M = "Matematik", DV = "Datavetenskap", IT = "Industriell teknik", DA = "Dataanalys";
export const I_AREAS = {
  "1MA010": [M], "1TS301": [T], "1TS302": [T], "1MA350": [M], "1TS303": [T], "1MA013": [M], "1DL042": [DV, T],
  "1FA104": ["Fysik", T], "1MA024": [M], "1TS318": [T], "1TD342": [DV, M, T], "1MA034": [M], "1EL007": [T],
  "1MA017": [M], "1TE717": [T], "1RT490": ["System i teknik och samhälle", T], "1MS005": [M], "1TS320": [T],
  "1TS330": [T], "1DL210": [DV, T], "1DL301": [DV, "System i teknik och samhälle", T],
  "1TD184": [DA, DV, T, "Tillämpad beräkningsvetenskap"], "1TS368": [T], "1TS325": ["Bioinformatik", IT, T],
  "1TD352": [DV, T], "1TS332": [T], "1TS340": [T], "1TS341": [IT, T], "1TE763": [IT, T], "1TS363": [IT, T],
  "1TS328": [IT, T], "1DL360": [DA, DV, T], "1DL400": [DA, DV, T], "1TS321": [DV, IT, T], "1DT118": [DV, T],
  "1TS342": [IT, T], "1TS311": [IT], "1TE742": [IT, T], "1TE735": [IT], "1TE051": [IT],
  "1RT700": ["Bildanalys och maskininlärning", DA, DV, M, T], "1TD169": [DA, DV, T, "Tillämpad beräkningsvetenskap"],
  "1TS360": [IT, T], "1TS364": [T], "1TS352": [T], "1TS353": [T], "1TS344": [T], "2JS560": [],
  "1RT705": [DA, DV, M, T], "1TS316": [DV, IT], "1TS354": [T], "1TS355": [T],
};

// Kurspar där endast en får räknas in i examen (från studieplanen).
export const I_PAIRS = [
  ["1MA350", "1MA025"], ["1TD342", "1TD393"], ["1EL007", "1TS319"], ["1TS363", "1TE779"], ["1TS360", "1TE776"],
];

export const PROFILES = { aff: "Affärsutveckling och innovation", dig: "Industriell analys och digitalisering" };
