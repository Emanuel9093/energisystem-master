# Masterplanering – energisystem och industriell ekonomi

En webbsida för studenter på Civilingenjörsprogrammet i energisystem (TES2Y, UU/SLU) och
Civilingenjörsprogrammet i industriell ekonomi (TIE2Y, UU). Den som skapar ett konto väljer program
(eller *Fyll i själv*). Programmet styr examenskraven, vilka kurser som är obligatoriska och rekommenderas,
vilka år 1–3 som fylls i, vilka studenter man ser och sidans färger och logga:

- **Energisystem**: färger och logga från [Föreningen Energisystem](https://www.essektionen.se/).
- **Industriell ekonomi**: marinblått och orange och loggan från [I-sektionen](https://www.isektionen-uu.se/).

Programmen beskrivs i `js/programs.js`. Kurserna finns i `js/courses.js` (ES) och `js/program-i.js` (I).
Ett nytt program läggs till med en egen kursfil, en rad i `PROGRAMS` och dess krav i `js/rules.js`.

- **Min plan**: ett år i taget, med fyra läsperioder och tre rader (normal studietakt). Klicka på en tom ruta för att välja kurs för den perioden. Kurser som går över två perioder blir långa, och självständigt arbete och examensarbete tar alla tre rader. Lägg till fler rader om du läser utökat. Klicka på en kurs för att markera den som planerad, pågående eller klar. Egna kurser (t.ex. utbytesstudier) kan läggas till i kursväljaren.
- **Examenskrav**: sidan kontrollerar direkt om planen uppfyller kraven för civilingenjörsexamen. Gemensamt för båda programmen: 300 hp, alla obligatoriska kurser, examensarbete 30 hp, 90 hp avancerad nivå, 150 hp teknik varav 60 hp avancerad nivå. För **industriell ekonomi** dessutom minst 10 hp på A1F-nivå, minst 20 hp i en profilering och 10 hp i den andra, 10 hp till som passar profilerna och högst 15 hp valfria kurser. För **energisystem**:
  - 300 hp totalt och alla obligatoriska kurser
  - examensarbete 30 hp (A2E, teknik)
  - minst 90 hp på avancerad nivå
  - minst 150 hp teknik, varav minst 60 hp på avancerad nivå
  - minst 10 hp teknik på A1F-nivå
  - minst 3 kurser "teknik och system" (Elkraftsystemanalys räknas)
  - minst 20 hp valbara tekniska/naturvetenskapliga kurser ur studieplanen
  - varningar för kurspar som inte får räknas tillsammans och för mer än 30 hp utanför studieplanen
- **ESare / I-studenter**: dina pågående och planerade kurser och vilka i ditt program som läser dem samma period. Klicka på en person för att se hela planen, eller sök efter person eller kurs.
- **Kurspoolen**: alla kurser med behörighet, huvudområden och när de ges (HT/VT, period). Kurserna ligger i mappar: *Programplanen* (ens eget program), en mapp per annat program, *Teknikbaserat entreprenörskap*, *Övrig matematik*, *Sommarkurser* och *Utbytesstudier*. Programplanernas mappar räknas ut från koden och kan inte ändras. Alla kan skapa nya mappar, lägga till kurser, ändra kurser (t.ex. att en kurs ges både HT och VT) och flytta kurser mellan mappar. Ändringar i studieplanens kurser kan återställas. Kursväljaren i Min plan hämtar kurserna härifrån.
- **Guide**: förklarar examenskraven och hur sidan används. Nya användare får en ruta under Min plan som länkar till guiden.
- **Behörighet**: röd lampa på planerade kurser man inte är behörig till, gul om man blir behörig när planerade kurser är klara. Kraven (hp och kurser som krävs) går att ändra i Kurspoolen under "Behörighet som kontrolleras". Startvärdena finns i `js/reqs.js`.
- **Somrar**: plustecknet mellan två år lägger till en sommar för sommarkurser.
- **Mina betyg**: fyll i betyg (3/4/5/G/VG) för kurser som är klara. Viktat snitt räknas ut automatiskt och visas som en kurva termin för termin. Betygen sparas privat och visas aldrig för andra.
- **Förfrågningar** (bara administratörer): godkänn studenter som inte kommer åt skolmailen.

År 1–3 fylls i automatiskt med programmets obligatoriska kurser (markerade som klara) när någon väljer program. De går att ta bort om man har tillgodoräknat något annat.

Kraven och kurserna kommer från [utbildningsplanen](https://www.uu.se/utbildning/utbildningsplan?query=8e0ca779-e57a-11f0-af1e-4773ce254d84) och [studieplanen](https://www.uu.se/utbildning/studieplan?query=10067), giltiga från HT 2026. Studieplanens kurser finns i `js/courses.js`, behörigheterna i `js/course-info.js`, mapparna och kurserna utanför studieplanen i `js/folders.js` och reglerna i `js/rules.js`. Sidan är ett hjälpmedel. Det är Examensenheten som avgör om du får ut examen.

## Köra lokalt

Sidan är ren HTML/JS utan byggsteg:

```bash
python -m http.server 5173
```

Öppna http://localhost:5173. Utan Supabase körs **demoläge**: din plan sparas i webbläsaren och de andra studenterna är påhittade.

## Koppla till Supabase (delad data och inloggning)

1. Skapa ett gratis projekt på https://supabase.com.
2. Öppna **SQL Editor**, klistra in innehållet i `supabase/schema.sql` och kör det.
3. Under **Authentication → URL Configuration**: sätt *Site URL* till sidans adress, t.ex. `https://<användarnamn>.github.io/energisystem-master/`.
4. Under **Project Settings → API**: kopiera *Project URL* och nyckeln *anon public* till `js/config.js`.

Nya konton skapas med skolmailen (@student.uu.se). Den som inte kommer åt skolmailen klickar på *Jag har inte tillgång till min skolmail* och skickar en förfrågan med en annan adress. En administratör godkänner adressen under fliken **Förfrågningar**, och sidan öppnar ett färdigt mejl till personen. Sedan skapar personen kontot själv. Kontrollen görs i databasen (en trigger på `auth.users`), så den går inte att kringgå från webbläsaren. Konton som fanns innan påverkas inte. Nya konton bekräftar sin adress via mejl, och glömda lösenord återställs via en mejllänk. *Kom ihåg mig* sparar inloggningen i webbläsaren; annars gäller den tills fliken stängs.

I Supabase: **Authentication → Sign In / Providers → Email** ska vara på, med *Confirm email* påslaget. Sätt minsta lösenordslängd till 8 under **Authentication → Policies** (eller motsvarande). Lägg `http://localhost:5173/` och sidans riktiga adress under *Redirect URLs* så att bekräftelse- och återställningslänkarna fungerar.

### Bli administratör

Kör en gång i SQL Editor, med din egen adress:

```sql
insert into public.admins (user_id) select id from auth.users where email = 'din@epost.se';
```

Logga sedan ut och in igen, så syns fliken **Förfrågningar**.

Varje student kan bara ändra sin egen plan. Andra ESares planer hämtas via databasfunktionen `classmate_plans()`. För den som bockat i "Dölj min plan och avklarade kurser" skickar den bara kurserna som pågår, så resten av planen lämnar aldrig databasen. Pågående kurser syns alltid.

> Supabases inbyggda mejlutskick är bara till för att testa: det skickar några få mejl i timmen och bara till adresser i projektets team. Innan andra studenter ska skapa konton behövs en egen SMTP-server under **Authentication → Emails → SMTP Settings** (till exempel Resend, som är gratis för små volymer).

## Publicera med GitHub Pages

GitHub Pages fungerar gratis för publika repon (privata repon kräver GitHub Pro). I repot: **Settings → Pages → Deploy from a branch → `main` / root**.

## Skydd och återställning

- Kurspoolen kan ändras av alla inloggade studenter, men bara namn, kod, hp, nivå, huvudområden, behörighet, länk, anteckning, perioder, rekommenderat år och mappar. Vilka kurser som är obligatoriska och hur examenskraven räknas styrs bara av koden (`js/courses.js`, `js/program-i.js` och `js/rules.js`).
- Varje ändring och borttagning i kurspoolen sparas i tabellen `pool_history`. Den syns bara för administratören i Supabase-panelen (**Table Editor → pool_history**). Där finns den gamla raden som JSON i `old_row` om något behöver återställas.
- "Ändrad av" sätts av databasen och kan inte förfalskas.
- Betygen ligger i en egen tabell som bara ägaren kan läsa.
