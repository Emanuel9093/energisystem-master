# Energisystem – masterplanering

Färger och logga kommer från [Föreningen Energisystem](https://www.essektionen.se/).

En webbsida för oss på Civilingenjörsprogrammet i energisystem (TES2Y, UU/SLU):

- **Min plan**: ett år i taget, med fyra läsperioder och tre rader (normal studietakt). Klicka på en tom ruta för att välja kurs för den perioden. Kurser som går över två perioder blir långa, och självständigt arbete och examensarbete tar alla tre rader. Lägg till fler rader om du läser utökat. Klicka på en kurs för att markera den som planerad, pågående eller klar. Egna kurser (t.ex. utbytesstudier) kan läggas till i kursväljaren.
- **Examenskrav**: sidan kontrollerar direkt om planen uppfyller kraven för civilingenjörsexamen:
  - 300 hp totalt och alla obligatoriska kurser
  - examensarbete 30 hp (A2E, teknik)
  - minst 90 hp på avancerad nivå
  - minst 150 hp teknik, varav minst 60 hp på avancerad nivå
  - minst 10 hp teknik på A1F-nivå
  - minst 3 kurser "teknik och system" (Elkraftsystemanalys räknas)
  - minst 20 hp valbara tekniska/naturvetenskapliga kurser ur studieplanen
  - varningar för kurspar som inte får räknas tillsammans och för mer än 30 hp utanför studieplanen
- **Klasskompisar**: dina pågående och planerade kurser och vilka som läser dem samma period. Klicka på en person för att se hela planen, eller sök efter person eller kurs.
- **Kurspoolen**: alla kurser med behörighet, huvudområden och när de ges (HT/VT, period). Kurserna ligger i mappar: *Programplanen*, *Teknikbaserat entreprenörskap* och *Övrig matematik*. Alla kan skapa nya mappar, lägga till kurser, ändra kurser (t.ex. att en kurs ges både HT och VT) och flytta kurser mellan mappar. Ändringar i studieplanens kurser kan återställas. Kursväljaren i Min plan hämtar kurserna härifrån.
- **Guide**: förklarar examenskraven och hur sidan används. Nya användare får en ruta under Min plan som länkar till guiden.
- **Somrar**: plustecknet mellan två år lägger till en sommar för sommarkurser.
- **Mina betyg**: fyll i betyg (3/4/5/G/VG) för kurser som är klara. Viktat snitt räknas ut automatiskt och visas som en kurva termin för termin. Betygen sparas privat och visas aldrig för klasskompisar.

År 1–3 fylls i automatiskt med de obligatoriska kurserna (markerade som klara) när någon skapar sin plan. De går att ta bort om man har tillgodoräknat något annat.

Kraven och kurserna kommer från [utbildningsplanen](https://www.uu.se/utbildning/utbildningsplan?query=8e0ca779-e57a-11f0-af1e-4773ce254d84) och [studieplanen](https://www.uu.se/utbildning/studieplan?query=10067), giltiga från HT 2026. Studieplanens kurser finns i `js/courses.js`, behörigheterna i `js/course-info.js`, mapparna och kurserna utanför studieplanen i `js/folders.js` och reglerna i `js/rules.js`. Sidan är ett hjälpmedel. Det är Examensenheten som avgör om du får ut examen.

## Köra lokalt

Sidan är ren HTML/JS utan byggsteg:

```bash
python -m http.server 5173
```

Öppna http://localhost:5173. Utan Supabase körs **demoläge**: din plan sparas i webbläsaren och klasskompisarna är påhittade.

## Koppla till Supabase (delad data och inloggning)

1. Skapa ett gratis projekt på https://supabase.com.
2. Öppna **SQL Editor**, klistra in innehållet i `supabase/schema.sql` och kör det.
3. Under **Authentication → URL Configuration**: sätt *Site URL* till sidans adress, t.ex. `https://<användarnamn>.github.io/energisystem-master/`.
4. Under **Project Settings → API**: kopiera *Project URL* och nyckeln *anon public* till `js/config.js`.

Inloggning sker med en länk som mejlas till studentadressen (`@student.uu.se` eller `@stud.slu.se`). Vill du ändra vilka adresser som släpps in ändrar du både `ALLOWED_EMAIL_DOMAINS` i `js/config.js` och funktionen `email_allowed` i `schema.sql`.

Varje student kan bara ändra sin egen plan. Klasskompisarnas planer hämtas via databasfunktionen `classmate_plans()`. Den tar bort avklarade kurser för den som bockat i "Dölj mina avklarade kurser för klasskompisar", så de lämnar aldrig databasen. Pågående och planerade kurser syns alltid.

> Supabases inbyggda mejlutskick är begränsat till några få mejl i timmen. Om många ska logga in samtidigt: lägg in en egen SMTP-server under **Authentication → Emails → SMTP Settings**.

## Publicera med GitHub Pages

GitHub Pages fungerar gratis för publika repon (privata repon kräver GitHub Pro). I repot: **Settings → Pages → Deploy from a branch → `main` / root**.

## Skydd och återställning

- Kurspoolen kan ändras av alla inloggade ES-studenter, men bara namn, kod, hp, nivå, huvudområden, behörighet, länk, anteckning, perioder, rekommenderat år och mappar. Vilka kurser som är obligatoriska och hur examenskraven räknas styrs bara av koden (`js/courses.js`).
- Varje ändring och borttagning i kurspoolen sparas i tabellen `pool_history`. Den syns bara för administratören i Supabase-panelen (**Table Editor → pool_history**). Där finns den gamla raden som JSON i `old_row` om något behöver återställas.
- "Ändrad av" sätts av databasen och kan inte förfalskas.
- Betygen ligger i en egen tabell som bara ägaren kan läsa.
