// Äldre studieplaner. De obligatoriska kurserna ändras lite varje år, och varje årskurs följer
// studieplanen som gällde det läsåret: den som började 2023 läser år 1 enligt planen från
// HT 2023, år 2 enligt planen från HT 2024 och så vidare. Planen från HT 2026 finns i
// courses.js (ES) och program-i.js (I) och gäller för alla senare läsår.
//
// Här finns bara de obligatoriska kurserna: [kurskod, { termin: "perioder" }].
//   ["1FA105", { 1: "2", 2: "3" }] = termin 1 period 2 och termin 2 period 3 (år 1, period 2–3)
//
// Källor (uu.se/utbildning/studieplan?query=…):
//   ES: 2023 = 3043, 2024 = 3372, 2025 = 3606
//   I:  2023 = 3047, 2024 = 3348, 2025 = 3607

export const LATEST_VERSION = 2026;
export const FIRST_VERSION = 2023;

const ES_2023 = [
  ["TN0367", { 1: "12" }], ["1MA090", { 1: "1" }], ["1MA013", { 1: "12" }], ["1FA105", { 1: "2", 2: "3" }],
  ["1MA016", { 2: "34" }], ["KE0049", { 2: "34" }], ["1TD433", { 2: "4" }],
  ["BI1360", { 3: "12" }], ["1FA102", { 3: "1" }], ["MS0073", { 3: "1" }], ["1FA514", { 3: "2" }], ["1FA527", { 3: "2" }],
  ["KE0068", { 4: "3" }], ["1TD342", { 4: "3" }], ["1FA529", { 4: "34" }], ["1EL004", { 4: "4" }], ["TN0362", { 4: "4" }],
  ["1MA024", { 5: "1" }], ["KE0069", { 5: "1" }], ["TN0285", { 5: "1" }], ["1MA034", { 5: "2" }], ["TN0319", { 5: "2" }], ["1TD352", { 5: "2" }],
  ["1TE655", { 6: "3" }], ["1RT490", { 6: "3" }], ["1FA311", { 6: "4" }], ["EX0946", { 6: "4" }],
  ["FÖ0477", { 7: "1" }],
];

const ES_2024 = ES_2023.map(([code, t]) => (code === "FÖ0477" ? ["FÖ0498", t] : [code, t]));

const ES_2025 = [
  ["TN0367", { 1: "12" }], ["1MA090", { 1: "1" }], ["1MA013", { 1: "12" }], ["1FA105", { 1: "2", 2: "3" }],
  ["1MA016", { 2: "34" }], ["KE0049", { 2: "34" }], ["1TD433", { 2: "4" }],
  ["BI1360", { 3: "12" }], ["1FA102", { 3: "1" }], ["MS0073", { 3: "1" }], ["1FA514", { 3: "2" }], ["1FA527", { 3: "2" }],
  ["KE0068", { 4: "3" }], ["1EL016", { 4: "3" }], ["1MA024", { 4: "3", 5: "1" }], ["1EL004", { 4: "4" }], ["TN0362", { 4: "4" }], ["1TD342", { 4: "4" }],
  ["KE0069", { 5: "1" }], ["TN0285", { 5: "1" }], ["1MA034", { 5: "2" }], ["TN0319", { 5: "2" }], ["1TD352", { 5: "2" }],
  ["1TE655", { 6: "3" }], ["1RT490", { 6: "3" }], ["1FA311", { 6: "4" }], ["EX0946", { 6: "4" }],
  ["FÖ0498", { 7: "1" }],
];

const I_2023 = [
  ["1MA010", { 1: "1" }], ["1TS301", { 1: "12", 2: "3" }], ["1TS302", { 1: "1" }], ["1MA025", { 1: "2" }], ["1TS303", { 1: "2" }],
  ["1MA013", { 2: "34" }], ["1DL042", { 2: "34" }], ["1FA104", { 2: "4" }],
  ["1MA024", { 3: "1" }], ["1TS318", { 3: "12" }], ["1TD342", { 3: "1" }], ["1MA034", { 3: "2" }], ["1EL007", { 3: "2" }],
  ["1MA017", { 4: "3" }], ["1TE717", { 4: "3" }], ["1RT490", { 4: "4" }], ["1MS005", { 4: "4" }], ["1TS320", { 4: "4" }],
  ["1TS330", { 5: "12", 6: "3" }], ["1DL210", { 5: "1" }], ["1DL301", { 5: "1" }], ["1TD184", { 5: "2" }], ["1TS331", { 5: "2" }],
  ["1TS325", { 6: "3" }], ["1TD352", { 6: "3" }], ["1TS332", { 6: "4" }],
  ["1TS340", { 7: "1" }], ["1TS341", { 7: "2" }], ["1TS342", { 8: "3" }],
];

const I_2024 = [
  ...I_2023.filter(([code]) => code !== "1TS331"),
  ["1TE777", { 5: "2" }], ["1TS351", { 9: "12" }], ["1TS352", { 9: "12" }],
];

const I_2025 = I_2024.map(([code, t]) => (code === "1MA025" ? ["1MA350", t] : [code, t]));

export const VERSIONS = {
  ES: { 2023: ES_2023, 2024: ES_2024, 2025: ES_2025 },
  I: { 2023: I_2023, 2024: I_2024, 2025: I_2025 },
};

// Kurser som bara finns i äldre studieplaner: [kod, namn, hp, nivå, huvudområden]
export const OLD_COURSES = {
  ES: [
    ["KE0068", "Organisk kemi med energitillämpningar", 5, "G1F", ["Kemi"]],
    ["TN0362", "Systemanalys med energitillämpningar", 5, "G1F", ["Teknik"]],
    ["FÖ0477", "Industriell ekonomi och hållbar innovation", 5, "G1N", ["Företagsekonomi"]],
  ],
  I: [
    ["1MA025", "Linjär algebra och geometri I", 5, "G1F", ["Matematik"]],
    ["1TS331", "Systemtänkande och modellering", 5, "G2F", ["Industriell teknik", "Teknik"]],
    ["1TE777", "Teknikbaserat entreprenörskap", 5, "A1N", ["Industriell teknik", "Teknik"]],
    ["1TS351", "Teknik, affärsutveckling och ledning", 10, "A1F", ["Teknik"]],
  ],
};

// Studieplanen (läsåret) som gäller för årskurs y för den som började startYear.
export const versionFor = (startYear, y) =>
  Math.min(LATEST_VERSION, Math.max(FIRST_VERSION, (Number(startYear) || LATEST_VERSION) + y - 1));
