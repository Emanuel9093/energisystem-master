// Guidesidan: vad som krävs för examen och hur sidan används.

const PARTS = [
  { hp: 175, label: "Obligatoriska kurser åk 1–3", sub: "inkl. självständigt arbete 15 hp", cls: "p-obl" },
  { hp: 30, label: "Teknik och system", sub: "minst 3 kurser à 10 hp", cls: "p-ts" },
  { hp: 30, label: "Examensarbete", sub: "30 hp, A2E", cls: "p-ex" },
  { hp: 35, label: "Valbara ur studieplanen", sub: "varav minst 20 hp tekniska/naturvet.", cls: "p-val" },
  { hp: 30, label: "Valfritt", sub: "vilket ämne som helst vid UU/SLU", cls: "p-free" },
];

export function guideHTML() {
  return `
    <div class="guide">
      <header class="guide-hero card">
        <img src="assets/es-logo.png" alt="" width="120">
        <div>
          <h1>Så funkar ES Masterplanering</h1>
          <p>Här planerar du dina fem år på Civilingenjörsprogrammet i energisystem, ser direkt om planen räcker till examen
          och ser vilka kurser andra ESare läser. Läs igenom sidan en gång, så kommer du igång på fem minuter.</p>
          <nav class="guide-toc">
            <a href="#g-krav">Vad krävs för examen?</a>
            <a href="#g-start">Kom igång</a>
            <a href="#g-flikar">Flikarna</a>
            <a href="#g-integritet">Vad syns för andra?</a>
            <a href="#g-faq">Vanliga frågor</a>
          </nav>
        </div>
      </header>

      <section class="card" id="g-krav">
        <h2>Vad krävs för civilingenjörsexamen?</h2>
        <p>Examen omfattar <strong>300 hp</strong>. De tre första åren är nästan helt obligatoriska. Under år 4–5 väljer du
        själv kurser, men valen måste uppfylla kraven nedan. Så här brukar de 300 hp fördelas:</p>
        <div class="hp-bar" role="img" aria-label="Fördelning av 300 hp">
          ${PARTS.map((p) => `<div class="${p.cls}" style="flex:${p.hp}"><strong>${p.hp} hp</strong><span>${p.label}</span></div>`).join("")}
        </div>
        <div class="hp-legend">
          ${PARTS.map((p) => `<div><i class="${p.cls}"></i><span><strong>${p.label}</strong> · ${p.hp} hp<br><small>${p.sub}</small></span></div>`).join("")}
        </div>
        <p class="muted small">Fördelningen är ett exempel. Valbara och valfria kurser kan bytas mot varandra så länge kraven nedan är uppfyllda.</p>

        <h3>Kraven som sidan kontrollerar</h3>
        <ol class="req-list">
          <li><strong>300 hp totalt</strong> med godkända kurser. Det går bra att ta ut examen med upp till 304,5 hp.</li>
          <li><strong>Alla obligatoriska kurser</strong> i studieplanen. Självständigt arbete och examensarbete kan läsas vid UU eller SLU, men bara en av varianterna räknas. Har du läst de äldre kurserna Strömningsmekanik för energirelaterade tillämpningar (1FA529) eller Termokemisk omvandling (TN0319) räknas de i stället för Strömningsmekanik (1EL016) respektive Produktion och transport av värme (1FA540).</li>
          <li><strong>Examensarbete 30 hp</strong> på A2E-nivå inom teknik (termin 10).</li>
          <li><strong>Minst 90 hp på avancerad nivå</strong> (A1N, A1F, A2E), examensarbetet inräknat. Exjobbet och tre teknik och system-kurser ger 60 hp, så du behöver minst 30 hp till på avancerad nivå.</li>
          <li><strong>Minst 150 hp inom huvudområdet teknik</strong>, varav <strong>minst 60 hp på avancerad nivå</strong>.</li>
          <li><strong>Minst 10 hp teknik på A1F-nivå</strong>, examensarbetet inte inräknat. Exempel: Elkraftsystemanalys, Energisystemplanering och Generatordesign.</li>
          <li><strong>Minst tre "teknik och system"-kurser</strong> i åk 4–5 (30 hp). Elkraftsystemanalys räknas också som en sådan.</li>
          <li><strong>Minst 20 hp valbara tekniska eller naturvetenskapliga kurser ur studieplanen</strong>, utöver de tre teknik och system-kurserna. Miljörätt, Ingenjörsetik och Stora sociotekniska system räknas inte hit.</li>
          <li><strong>Högst 30 hp valfria kurser</strong> utanför studieplanen, från vilket huvudområde som helst vid UU eller SLU. Här ingår också kurspaketet i teknikbaserat entreprenörskap.</li>
        </ol>
        <p>Vissa kurser får inte räknas in tillsammans, till exempel 1TS309/1GV134 och 1KB274/1KB765. Sidan varnar om du har valt båda. Hela listan finns i
        <a href="https://www.uu.se/utbildning/studieplan?query=10067" target="_blank" rel="noopener">studieplanen</a>, och kraven finns i
        <a href="https://www.uu.se/utbildning/utbildningsplan?query=8e0ca779-e57a-11f0-af1e-4773ce254d84" target="_blank" rel="noopener">utbildningsplanen</a>.</p>
      </section>

      <section class="card" id="g-start">
        <h2>Kom igång</h2>
        <ol class="steps">
          <li><strong>Skapa ett konto</strong> med valfri e-postadress och ett lösenord, och bekräfta adressen via mejlet du får. Bocka i <em>Kom ihåg mig</em> så slipper du logga in varje gång. Har du glömt lösenordet kan du återställa det via mejlen.</li>
          <li><strong>Skriv ditt namn</strong> högst upp under Min plan, så att andra ESare ser vem du är.</li>
          <li><strong>Kolla år 1–3.</strong> De obligatoriska kurserna är redan ifyllda och markerade som klara. Har du tillgodoräknat något annat
          klickar du på kursen och väljer <em>Ta bort från planen</em> och lägger in det du har läst i stället.</li>
          <li><strong>Planera år 4–5.</strong> Klicka på en tom ruta för att välja kurs. Du ser bara kurser som ges i den perioden. En kurs som går
          period 1–2 hamnar alltid i period 1–2, även om du klickar i period 2.</li>
          <li><strong>Sätt status</strong> på kurserna genom att klicka på dem: <span class="chip planned">Planerad</span>
          <span class="chip ongoing">Läser nu</span> <span class="chip done">Klar</span>.</li>
          <li><strong>Följ examenskraven</strong> i panelen bredvid planen. Gröna bockar betyder att kravet är uppfyllt.</li>
        </ol>

        <h3>Rutnätet</h3>
        <ul class="tips">
          <li>Varje år har fyra läsperioder: HT är period 1–2 och VT är period 3–4.</li>
          <li>Tre rader motsvarar normal studietakt (15 hp per period). Läser du utökat klickar du på <em>Lägg till rad</em>.</li>
          <li>Kurser som går över två perioder blir långa. Kurser i högre studietakt blir höga: en rad motsvarar 5 hp per period, så Tidsserieanalys (10 hp i en period) tar två rader och självständigt arbete och examensarbete tar alla tre. Kurser under 10 hp tar alltid en rad.</li>
          <li>Under <em>Hp per huvudområde</em> i panelen till höger ser du hur många hp du har i teknik, matematik, fysik och andra ämnen.</li>
          <li><strong>Behörighet:</strong> planerade kurser får en <span class="lamp-demo missing"></span> röd lampa om du inte är behörig enligt din plan och en <span class="lamp-demo pending"></span> gul lampa om du blir behörig när dina planerade kurser är klara. Klicka på kursen för att se vad som saknas. Sidan räknar bara hp (totalt, per huvudområde och på avancerad nivå) och vilka kurser du har läst före kursen. Krav som Engelska 6 kontrolleras inte. Har du tillgodoräknat något kan du bocka i <em>Jag är behörig ändå</em>. Kraven som kontrolleras står under <em>Behörighet som kontrolleras</em> när du ändrar en kurs i Kurspoolen, och där kan alla ESare rätta dem.</li>
          <li><strong>Sommarkurser:</strong> klicka på plustecknet mellan två år för att lägga till en sommar. Sommaren har en enda period och visas som en lista. Sommarkurser kan bara läggas på en sommar.</li>
          <li>Papperskorgen till höger tar bort en rad. Knapparna under rutnätet fyller i årets obligatoriska kurser, markerar hela året som klart eller tömmer året.</li>
        </ul>
      </section>

      <section class="card" id="g-flikar">
        <h2>Flikarna</h2>
        <div class="tab-cards">
          <div><h3>Min plan</h3><p>Dina fem år, ett år i taget, och kontrollen av examenskraven. Välj <em>Bara klara kurser</em> för att se hur långt du har kommit.</p></div>
          <div><h3>ESare</h3><p>Överst ser du dina pågående och planerade kurser och vilka andra ESare som läser dem samma period. Klicka på en person för att se hela hens plan, eller sök efter en person eller kurs.</p></div>
          <div><h3>Kurspoolen</h3><p>Alla kurser med behörighet, huvudområden och när de ges, sorterade i mappar. Alla ES-studenter kan lägga till kurser, skapa mappar och rätta uppgifter, till exempel om en kurs ges både HT och VT. Ändringarna syns för alla.</p></div>
          <div><h3>Mina betyg</h3><p>Fyll i betyg för klara kurser så räknas ditt snitt ut automatiskt, viktat med hp, och du ser en kurva över hur snittet har ändrats termin för termin. G och VG räknas inte in.</p></div>
        </div>
      </section>

      <section class="card" id="g-integritet">
        <h2>Vad syns för andra?</h2>
        <ul class="tips">
          <li><strong>Syns för andra ES-studenter:</strong> ditt namn, startår och vilka kurser du har i planen, med status. Dina pågående och planerade kurser syns alltid. Bocka i <em>Dölj mina avklarade kurser för andra ESare</em> om du inte vill visa vad du redan har läst.</li>
          <li><strong>Syns aldrig för andra:</strong> dina betyg och din e-postadress.</li>
          <li><strong>Kurspoolen är gemensam.</strong> Det du ändrar där syns för alla, med ditt namn som senaste ändrare.</li>
        </ul>
      </section>

      <section class="card" id="g-faq">
        <h2>Vanliga frågor</h2>
        <details><summary>Jag har tillgodoräknat en kurs. Hur gör jag?</summary>
          <p>Ta bort den obligatoriska kursen ur planen och lägg in kursen du läste. Finns den inte i Kurspoolen kan du lägga till den där, eller lägga till en privat kurs längst ner i kursväljaren.</p></details>
        <details><summary>Ska jag välja examensarbete vid UU eller SLU?</summary>
          <p>Det beror på var ditt exjobb examineras. Båda räknas, men bara en av dem får ingå. Väljer du den andra varianten i kursväljaren byts den du redan har ut.</p></details>
        <details><summary>Kan jag lägga en kurs i en period där den inte ges?</summary>
          <p>Kursväljaren visar de kurser som ges i perioden du klickade på, och de hamnar alltid i rätt perioder. Läser du en kurs på egen hand och tentar den i en annan period eller på sommaren kan du söka efter den, klicka på den och välja <em>Lägg till ändå</em>. Den får då ett varningstecken i planen. Har kursen bytt perioder kan du rätta det i Kurspoolen under <em>Ändra</em>.</p></details>
        <details><summary>Vad är kurspaketet i teknikbaserat entreprenörskap?</summary>
          <p>Ett 30 hp-paket hösten i årskurs 5 som söks i konkurrens. Det räknas till de 30 hp som får väljas fritt och kan inte kombineras med Stora sociotekniska system, Ingenjörsetik eller Miljörätt. Se mappen i Kurspoolen.</p></details>
        <details><summary>Hur gör jag med utbytesstudier?</summary>
          <p>Kurser du läser på utbyte räknas bara in i examen om de har <strong>tillgodoräknats</strong>. Det gäller alltid, även om kursen liknar en kurs i studieplanen. Prata med studievägledningen innan du åker och ansök om tillgodoräknande när du är hemma igen.
          I Kurspoolen finns mappen <em>Utbytesstudier</em> med kurser som andra ESare har läst utomlands. Där kan du också lägga till dina egna kurser så att andra ser dem.
          Vill du inte dela kursen kan du lägga till den som en privat kurs längst ner i kursväljaren.</p></details>
        <details><summary>Stämmer kontrollen alltid?</summary>
          <p>Sidan följer studieplanen och utbildningsplanen från HT 2026, men det är ett hjälpmedel. Det är Examensenheten som avgör om du får ut din examen. Fråga studievägledningen om du är osäker.</p></details>
      </section>
    </div>`;
}
