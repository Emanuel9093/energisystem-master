// Mappar som finns från början i kurspoolen, och kurser utanför studieplanen.
// Studenterna kan ändra beskrivningar, kurser och mappinnehåll i Kurspoolen.

export const SEED_FOLDERS = [
  {
    id: "programplanen",
    name: "Programplanen",
    description: "Alla kurser i studieplanen för Civilingenjörsprogrammet i energisystem (TES2Y), giltig från HT 2026. Kurserna kan räknas in i examen utan särskilt beslut.",
    sort: 1,
  },
  {
    id: "entreprenorskap",
    name: "Teknikbaserat entreprenörskap",
    description:
      "Kurspaketet \"Teknikbaserat entreprenörskap och affärsutveckling\", 30 hp, läses hösten i årskurs 5 (termin 9) i stället för de valbara kurserna. " +
      "Söks i konkurrens med studenter från andra program och har ingen platsgaranti. Kan bara ingå i examen för den som antogs till programmet 2025/2026 eller tidigare, " +
      "och räknas till de 30 hp som får väljas fritt. Kan inte kombineras med Stora sociotekniska system, Individ, organisation och ledarskap, Ingenjörsetik eller Miljörätt.",
    sort: 2,
    courseIds: [],
  },
  {
    id: "ovrig-matematik",
    name: "Övrig matematik",
    description:
      "För dig som vill läsa vidare till en kandidatexamen i matematik eller ett masterprogram i matematik. En kandidatexamen kräver 90 hp matematik (minst 30 hp på G2-nivå) " +
      "inklusive ett examensarbete på 15 hp, och masterprogrammet i matematik vid UU kräver en kandidatexamen med 90 hp matematik. Många av kurserna ges bara inom program, så kontrollera med studievägledningen.",
    sort: 3,
    courseIds: ["1MA090", "1MA013", "1MA016", "1MA024", "1MA034", "MS0073", "1TD342"],
  },
  {
    id: "sommarkurser",
    name: "Sommarkurser",
    description:
      "Kurser som läses under sommaren, ofta på distans. Lägg till en sommar med plustecknet mellan två år under Min plan. Sommarkurser kan bara läggas på en sommar. " +
      "Kurser som inte står i studieplanen räknas till de 30 hp som får väljas fritt. Ändra en kurs och bocka i Sommar om den ska finnas här.",
    sort: 4,
    courseIds: [],
  },
  {
    id: "utbyte",
    name: "Utbytesstudier",
    description:
      "Kurser som ES-studenter har läst på utbyte, så att du ser vad andra har tagit med sig hem. Ange universitet och land i kursens anteckning. " +
      "Utbyteskurser kan räknas som valbara eller valfria kurser, men det kräver ett beslut om tillgodoräknande. Kontakta studievägledningen innan du åker. " +
      "Kurser som bara gäller dig kan du i stället lägga till som privat kurs i kursväljaren.",
    sort: 5,
    courseIds: [],
  },
];

const uu = (code) => `https://www.uu.se/utbildning/kurs?query=${code}`;
const course = (code, name, hp, level, areas, offerings, extra = {}) => ({
  id: code, code, name, hp, level, areas, offerings, url: uu(code), uni: "UU", ...extra,
});
const HT = (...periods) => ({ sem: "HT", periods });
const VT = (...periods) => ({ sem: "VT", periods });
const M = ["Matematik"];
const MS = ["Matematik", "Matematisk statistik"];

export const SEED_EXTRA_COURSES = [
  course("1TE674", "Teknikbaserad affärsutveckling och entreprenörskap", 30, "A1F", ["Industriell teknik", "Teknik"], [HT(1, 2)], {
    year: 5, thick: true, folders: ["entreprenorskap"],
    prereq: "200 hp varav 150 hp inom teknik, naturvetenskap eller farmaci, med minst 30 hp på avancerad nivå. Antagning till kurspaketet i konkurrens.",
    note: "Kursen från den tidigare Entreprenörskolan. Vi har inte kunnat bekräfta exakt vilka kurskoder som ingår i det nya kurspaketet. Ändra gärna om du vet.",
  }),

  course("1MA349", "Grundläggande ringteori", 5, "G1F", M, [VT(4)], { folders: ["ovrig-matematik"],
    prereq: "5 hp matematik samt Grundläggande algebra. Ges på svenska, endast inom program." }),
  course("1MA007", "Algebraiska strukturer", 10, "G2F", M, [HT(1, 2)], { folders: ["ovrig-matematik"],
    prereq: "60 hp matematik, Linjär algebra II samt Grundläggande ringteori (kan läsas parallellt)." }),
  course("1MA226", "Reell analys", 10, "G2F", M, [HT(2, 3)], { folders: ["ovrig-matematik"],
    prereq: "", note: "Går över period 2–3 enligt kandidatprogrammets studieplan. Kontrollera förkunskaper och termin hos Matematiska institutionen." }),
  course("1MA022", "Komplex analys", 10, "G2F", M, [VT(3, 4)], { folders: ["ovrig-matematik"],
    prereq: "60 hp matematik/fysik varav 30 hp matematik, samt Flervariabelanalys." }),
  course("1MA032", "Ordinära differentialekvationer I", 5, "G1F", M, [HT(2), VT(4)], { folders: ["ovrig-matematik"],
    prereq: "10 hp matematik, Linjär algebra II samt Flervariabelanalys (kan läsas samtidigt). Endast inom program." }),
  course("1MA211", "Fourieranalys", 5, "G1F", M, [HT(2)], { folders: ["ovrig-matematik"],
    prereq: "15 hp matematik, Flervariabelanalys samt Linjär algebra II. Endast inom program.", note: "Överlappar delvis Transformmetoder." }),
  course("1MS034", "Sannolikhetsteori I", 5, "G1F", MS, [HT(1)], { folders: ["ovrig-matematik"],
    prereq: "10 hp matematik inklusive Flervariabelanalys." }),
  course("1MS035", "Inferensteori I", 5, "G1F", MS, [HT(2)], { folders: ["ovrig-matematik"],
    prereq: "15 hp matematik samt Sannolikhetsteori I." }),
  course("1MS036", "Sannolikhetsteori II", 5, "G2F", MS, [HT(1)], { folders: ["ovrig-matematik"],
    prereq: "60 hp varav 20 hp matematik, Sannolikhetsteori I, Flervariabelanalys samt Linjär algebra II." }),
  course("1MA053", "Partiella differentialekvationer, introduktionskurs", 5, "A1N", M, [VT(3)], { folders: ["ovrig-matematik"],
    prereq: "120 hp inkl. 60 hp matematik, Flervariabelanalys, Linjär algebra II, Transformmetoder eller Fourieranalys samt Engelska 6." }),
  course("1MA331", "Funktionalanalys", 5, "A1N", M, [VT(4)], { folders: ["ovrig-matematik"],
    prereq: "120 hp inkl. 90 hp matematik, Linjär algebra II, reell analys samt Engelska 6." }),
  course("1MA215", "Integrationsteori", 10, "A1N", M, [HT(1, 2)], { folders: ["ovrig-matematik"],
    prereq: "120 hp inkl. 90 hp matematik, reell analys samt Engelska 6.",
    note: "Halvfart hela hösten. Nivå (A1N) ej bekräftad mot kursplanen." }),
  course("1MS045", "Sannolikhetsteori och martingaler", 10, "A1N", MS, [HT(1, 2)], { folders: ["ovrig-matematik"],
    prereq: "120 hp inklusive 90 hp matematik. Sannolikhetsteori II. Engelska 6.",
    note: "Halvfart hela hösten. Nivå (A1N) ej bekräftad mot kursplanen." }),
  course("1MS030", "Stokastiska processer", 10, "A1F", MS, [VT(3, 4)], { folders: ["ovrig-matematik"],
    prereq: "120 hp inkl. 90 hp matematik, Integrationsteori, Sannolikhetsteori II samt Engelska 6.",
    note: "Halvfart hela våren. Nivå (A1F) ej bekräftad mot kursplanen." }),
  course("1MS014", "Tidsserieanalys", 10, "A1N", MS, [VT(4)], { folders: ["ovrig-matematik"],
    prereq: "120 hp inom teknik/naturvetenskap, Inferensteori I eller Sannolikhet och statistik, samt Engelska 6.",
    note: "Ges i period 4 i 67 % studietakt. Nivå (A1N) ej bekräftad mot kursplanen." }),
  course("1TD186", "Finansiella beräkningsmetoder – prissättning och värdering", 5, "A1N", ["Matematik", "Datavetenskap", "Teknik", "Tillämpad beräkningsvetenskap"], [HT(1)], { folders: ["ovrig-matematik"],
    prereq: "120 hp inom teknik/naturvetenskap, Beräkningsvetenskap II eller Introduktion till beräkningsvetenskap, samt Engelska 6.",
    note: "Ges av Institutionen för informationsteknologi. Räknas som matematik i ES-studenters studieplaner. Nivå och övriga huvudområden ej bekräftade mot kursplanen." }),
  course("1MA079", "Examensarbete C i matematik", 15, "G2E", M, [], { folders: ["ovrig-matematik"], anyPeriod: true,
    prereq: "60 hp matematik inkl. Flervariabelanalys och Linjär algebra II samt 15 hp matematik på G2F-nivå. Obligatoriskt för kandidatexamen i matematik." }),
];
