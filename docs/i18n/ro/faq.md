# Întrebări și răspunsuri

Întrebări frecvente, randate ca acordeon la `/info/start/faq.html`.

**Cum se întreține:** fiecare titlu `##` de mai jos este o întrebare; tot ce se află sub el
(până la următorul `##`) este răspunsul. Răspunsurile folosesc același markdown simplu ca
restul site-ului - separă paragrafele cu o linie goală. Adaugă, șterge sau
reordonează întrebările aici și rulează din nou `pnpm run build:info` (sau `pnpm run dev:web`).
Tot ce se află deasupra primului `##` (acest titlu și aceste note) este ignorat de build.

Ordinea este cea a unui începător: mai întâi capcana, apoi fișierele tale, apoi
obținerea și rularea Lolly, apoi organizațiile, apoi cum a fost făcut. Ancora fiecărei întrebări
este construită din întrebarea în engleză de pe aceeași poziție, deci o traducere păstrează
ordinea din engleză.

## De ce este gratuit? Unde e șmecheria?

**Am construit Lolly pentru noi înșine.** SUSE avea nevoie de mii de fișiere în stilul brandului, făcute fără să dea nimic unor servicii externe. Așa că am construit un instrument care face totul pe dispozitiv și l-am lansat ca open source, ca tot ce facem. Continuăm să-l întreținem pentru că îl folosim zilnic. **Nu există nicio obligație:** tot ce este aici funcționează cu sau fără noi.

Linia aceea este trasată în licență, nu într-o promisiune: tot ce rulează local este gratuit, pentru totdeauna. O versiune lansată este licențiată astfel încât să nu poată fi retrasă și nu există un acord de contribuitor care ar putea relicenția munca cuiva.

## Cât păstrează SUSE privat? (adică, când se trage covorul de sub picioare)

Motorul, shell-urile, schemele și instrumentele agnostice de brand sunt open source. Mărcile comerciale SUSE și instrumentele de brand rămân partea privată și sunt deja separate. Instanța publică de la [lolly.tools](https://lolly.tools) rulează [Lolly Demo](/info/lolly-demo.html), sistemul de design propriu al Lolly.

Nimic de aici nu se sprijină pe o promisiune: fiecare versiune lansată rămâne open source, iar singurul lucru reținut este marca comercială. Când o altă companie și-a închis în 2023 sursele enterprise Linux, SUSE a co-fondat [OpenELA](https://openela.org) ca să păstreze acel cod deschis, aceeași poziție pe care o moștenește acest proiect.

Dezvăluire completă: SUSE *construiește* instrumente interne pentru a conecta Lolly la propriile sisteme IT. Aceasta este configurația internă a SUSE, nu o împărțire între dezvoltare publică și privată. Lolly își propune și să fie construit prin [Open Build Service](https://openbuildservice.org/), cu artefacte securizate ale lanțului de aprovizionare livrate de [SUSE Application Collection](https://apps.rancher.io/applications).

## De ce numele "Lolly Tools"?

**Lolly** pentru că libertatea este dulce și pentru că în Australia, Noua Zeelandă și Marea Britanie "lolly" înseamnă bomboană.

**Tools** pentru că o unealtă stă nemișcată până când o iei în mână. Nu funcționează când nu o folosești și nu te supraveghează cât timp o folosești.

## De ce este totul verde?

lolly.tools se deschide în [Lolly Demo](/info/lolly-demo.html), sistemul de design de probă al Lolly, iar culoarea lui principală este verdele. Este un exemplu, nu o regulă. Treci la **Lolly Starter**, un sistem de design gol, sau la al tău din [Settings → Design systems](/#/settings?focus=design-systems-section).

## Pot folosi propriul brand?

Da. **Design System Setup** (`#/start`) construiește un sistem de design dintr-o culoare, un fișier de tokenuri de design sau un design terminat, iar apoi fiecare instrument desenează cu sistemul tău de design. [Start](/info/quickstart.html#put-your-brand-in) parcurge cele trei trasee.

Un sistem de design furnizat de organizația ta sau de versiunea ta este administrat: arată un lacăt și rămâne doar pentru citire, iar poți face o copie editabilă pentru a-l schimba.

## Unde e lucrul pe care l-am făcut ieri?

Dacă ai apăsat **Save as** sau **Save**, este în **Projects**, pe ecranul principal, în browserul sau aplicația din care ai salvat. Dacă ai apăsat doar **Download**, fișierul este unde browserul sau sistemul tău salvează descărcările și de obicei o copie este în **Assets**. Instrumentele care [salvează pe măsură ce lucrezi](/info/find-your-work.html#which-tools-save-as-you-work) păstrează munca nesalvată tot în **Projects**. [Găsește și recuperează-ți munca](/info/find-your-work.html) acoperă fiecare caz.

## Am închis fila. S-a dus lucrarea mea?

Lucrarea salvată e tot în **Proiecte**. Lucrarea nesalvată dispare, cu excepția instrumentelor care salvează pe măsură ce lucrezi, care o păstrează și ele în **Proiecte**. Data viitoare, apasă **Salvează ca** înainte să pleci. Vezi [Dacă ai închis fila sau ai părăsit instrumentul](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Pot să îmi partajez lucrarea ca fișier în loc de link?

Da. Când un link nu poate purta tot, precum fotografiile tale sau textele lungi, dialogul Share spune ce ar lipsi și oferă în schimb un fișier **.lolly**: un singur fișier cu designul, imaginile pe care le folosește și, dacă alegi, instrumentul însuși.

Tu decizi cât călătorește. Numele și detaliile tale intră doar dacă profilul tău acceptă, iar arta licențiată este reținută, dacă nu alegi să incluzi arta. Cine deschide un fișier care poartă un instrument este întrebat dacă are încredere în instrument înainte ca acesta să ruleze. Vezi [Partajarea muncii tale](/info/using.html#sharing-your-work).

## Ce fac detaliile mele de profil?

Detaliile tale din **Settings** completează în avans instrumentele care le cer, precum un nume pe un ecuson. Rămân pe acest dispozitiv. Dacă activezi și opt-in-ul, detaliile alese de tine sunt sigilate în ce creezi, numindu-te sursa. Nimic nu este inclus dacă nu alegi să-ți incluzi detaliile.

Partajarea și Sync trimit doar conținutul pe care îl alegi. Pe instanța Lolly Work a unei organizații, sesiunile comune și munca guvernată merg și ele la acel server. Vezi [Confidențialitate](/info/privacy.html).

## Cum obțin aplicațiile pentru mobil sau desktop?

Descarcă-le din [Instalează Lolly](/info/install.html). Pagina listează fiecare versiune pentru macOS, Windows, Linux și Android și arată cum verifici fișierul descărcat. iPhone și iPad primesc **Lolly Tools** din App Store; [secțiunea iPhone și iPad](/info/install.html#iphone-and-ipad) are linkul.

Oricine își poate construi și distribui propria copie a aplicației, cu instrumentele și setările de care are nevoie publicul său. [Ghidul de construire](/info/build-guide.html) arată cum.

## Lolly spune că necesită WebGPU. Ce pot face?

Aplicația web desenează cu WebGPU, o funcție grafică a browserelor actuale, și o verifică înainte să deschidă un instrument. Încearcă în ordine:

1. Actualizează browserul la versiunea curentă.
2. Activează accelerarea grafică sau hardware în setările browserului, apoi repornește browserul.
3. Încearcă un browser testat: [Medii acceptate](/info/supported-environments.html) le listează.
4. Pe un Mac, iPhone sau iPad, [instalează aplicația](/info/install.html) în schimb.

## Poate Lolly să editeze și să randeze fișierele mele Figma, Penpot, Illustrator sau InDesign?

Da. Deschide **Design** și fă clic pe **Import a design**: acceptă un **.fig** Figma nativ (Save local copy), un export Penpot **.penpot**, un Illustrator **.ai** sau **.pdf**, un InDesign **.idml** (File → Export → InDesign Markup) sau **orice SVG**. Nu ai nevoie de cont, plugin sau licență pentru aplicația de design.

![Canvasul liber al Design - Importă o creație stă în meniul Lolly al barei de instrumente](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Straturile sosesc ca casete editabile: textul rămâne editabil, formele rămân forme, iar imaginile se alătură bibliotecii tale. Salvează-l, iar **Share with rules** poate transforma layoutul într-un instrument pe care oricine are Lolly îl poate completa din nou. Vezi [Importă un design](/info/design-import.html).

## Pot două persoane să lucreze la același design fără internet?

Da. O persoană partajează o invitație, ca link, cod QR sau cod scurt, iar cealaltă o acceptă. Apoi ambele dispozitive țin aceeași sesiune live, cu prezență și inele de focus cu tot. Funcționează în orice rețea comună, inclusiv pe un hotspot de telefon într-un subsol, pentru că nu există server la mijloc. Vezi [Lucrul împreună](/info/collaborate.html). Pentru colegi din rețele diferite, instanța Lolly Work a unei organizații oferă work collab-uri autentificate.

## Ce sunt feature flags?

Feature flags pornesc sau opresc părți din Lolly. În folosirea de sine stătătoare, îți alegi setările personale. O organizație care folosește Lolly Work poate seta valori implicite sau ascunde comutatoare alese sub politica ei, iar controalele administrate sunt etichetate. Vezi [Folosește Lolly în organizația ta](/info/organisation.html).

![Feature flags personale în aplicația de sine stătătoare; politica organizației poate guverna comutatoare alese](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Prin ce se deosebesc utilitarele de instrumente?

Un utilitar face o sarcină rapidă pe un fișier pe care îl ai deja, precum comprimarea unui PDF, convertirea unei fotografii sau eliminarea datelor ascunse, iar multe rulează pe dispozitivul tău fără să se încarce nimic. Există ca sarcinile pe care oamenii le dau de obicei unui site oarecare să rămână în Lolly. Comprimarea unui contract, convertirea fotografiilor din vacanță cu locația încă în ele sau lipirea unui token într-un formatator online nu ar trebui să însemne să dai fișierul unui site cu păstrare, jurisdicție și model de afaceri necunoscute. [Utilitare](/info/utilities.html) le listează, iar [Târgul pe care nu l-am acceptat niciodată](/info/status-quo.html) spune povestea din spatele lor.

![Vederea Utilities: Strip Hidden Data, Compress PDF, Convert Image și celelalte sarcini pe dispozitiv, toate într-un loc](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Poate organizația noastră folosi SSO, proiecte comune și aprobări?

Da, cu **Lolly Work**, serverul de organizație al aceluiași proiect open source. Rulează separat și adaugă single sign-on prin furnizorul tău de identitate, provizionare SCIM, permisiuni de grup, proiecte și resurse comune, work collab-uri live, aprobări și înregistrări de audit. Aplicația de zi cu zi funcționează în continuare singură.

[Folosește Lolly în organizația ta](/info/organisation.html) acoperă autentificarea și găsirea muncii comune, iar [Instalare](/info/deployment.html#organisation-services-with-lolly-work) acoperă configurarea. Conținutul comun și înregistrările organizației urmează politicile de confidențialitate și păstrare ale acelei instanțe.

## La ce obstacole mă pot aștepta când adopt Lolly?

Mai ales se schimbă lucruri de partea producției, nu tehnologia. O echipă care vrea un set guvernat de instrumente are nevoie de cineva care să creeze sistemul ei de design și primele șabloane, deși oricine poate începe din prima zi să-și facă propriile instrumente în Design, fără git. Iar procesele existente continuă să funcționeze chiar și când rezultatul lor nu respectă brandul, deci convertirea bună a unui rezultat vizibil, înainte și după unul lângă altul, convinge mai repede decât un plan.

[Adopție și guvernanță](/info/adoption-governance.html) acoperă integrarea pe roluri, cum măsori un pilot și cum poate arăta un proces de guvernanță.

## Lolly a fost „vibe coded”?

Lolly a fost dezvoltat cu programare asistată de AI, descoperire asistată de AI și, în multe locuri, conținut asistat de AI, folosind un mix de modele și furnizori, inclusiv cele de la companii de frontieră din cloud-ul public. Un om a creat arhitectura, a îngrijit codul cu intenție și a condus artistic experiența.

O avertizare de severitate înaltă sau critică în dependențele Lolly blochează CI. O avertizare care nu poate fi încă remediată este reținută doar ca excepție aprobată, cu un motiv scris. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) listează fiecare excepție ținută astăzi, iar [notele de versiune](https://github.com/lolly-tools/lolly/releases) le listează pe cele purtate de fiecare versiune. SECURITY.md spune și cum raportezi o vulnerabilitate.

Verificările din build resping și formulările care par făcute de mașină în comentariile de cod, în aplicație și în aceste documente, ca textul să rămână simplu pentru fiecare cititor. Un efect secundar este că un detector poate găsi mai greu ce text a scris un model. Nu ne-am propus să cauzăm asta.

Cel mai important, Lolly stă pe umerii a decenii de muncă open source a unor experți din întreaga lume.

**Declarație privind AI generativă:**

- **Cod scris de LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (lista se poate extinde)
- **Descoperire cu LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentație:** Sonnet 5
- **Biblioteci open source:** Autorii lor respectivi, exprimați în SBOM, comentarii și antete de fișiere

Această listă nu include modelele integrate direct în Lolly.

**Contribuții umane:**
- **Idei, revizuire și feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (listă neexhaustivă)
- **Arhitectură, direcție artistică și curățător de slop:** Andy Fitzsimon

## Unde au dispărut instrumentele cu brand SUSE?

Trăiesc într-un depozit separat, privat. O clonă publică nu preia deloc pachetul de brand SUSE, deci un build din ea folosește profilul neutru `lolly-start`, dacă nu alegi altul: instrumentele comunitare agnostice de brand plus un brand gol pe care îl completezi cu al tău. [lolly.tools](https://lolly.tools) este construit cu profilul `lolly-demo` și se deschide în [Lolly Demo](/info/lolly-demo.html), sistemul de design propriu al Lolly. SUSE își operează propria instanță pentru a-și proteja mărcile comerciale.

## Ce aromă are logoul Lolly?

Unii spun Lime, alții Mentă și uneori Măr; Lolly aduce dulceața, tu creezi aroma!
