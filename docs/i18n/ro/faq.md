# Întrebări & răspunsuri

Întrebări frecvente, randate ca acordeon pe `/info/start/faq.html`.

**Cum se întreține:** fiecare titlu `##` de mai jos este o întrebare. Tot ce se află sub titlu,
până la următorul `##`, este răspunsul. Răspunsurile folosesc Markdownul simplificat al site-ului:
separă paragrafele cu o linie goală. Adaugă, elimină sau reordonează întrebări aici și
rulează din nou `pnpm run build:info` (sau `pnpm run dev:web`).
Procesul de build ignoră tot ce se află deasupra primului `##` (acest titlu și aceste note).

Ordinea este cea potrivită unui începător: întâi condițiile ascunse, apoi fișierele tale, apoi obținerea
și rularea Lolly, apoi organizațiile, apoi cum a fost făcut. Ancora fiecărei întrebări
este construită din întrebarea în engleză de la aceeași poziție, deci o traducere păstrează
ordinea din engleză.

## De ce este gratuit? Care e capcana?

**Am construit Lolly pentru noi.** SUSE avea nevoie de mii de fișiere care respectă brandul, create fără să trimită nimic unor servicii externe. Așa că am construit un instrument care face totul pe dispozitiv și l-am publicat ca open source, ca tot ce mai facem. Continuăm să-l întreținem pentru că îl folosim în fiecare zi. **Nu există nicio obligație:** tot ce este aici funcționează cu sau fără noi.

Acea limită este trasată în licență, nu într-o promisiune: tot ce rulează local este gratuit, pentru totdeauna. O versiune publicată are o licență care nu poate fi retrasă. Niciun acord cu contribuitorii nu ar putea relicenția munca cuiva.

## Cât păstrează SUSE privat? (adică, când ne trage preșul de sub picioare)

Motorul, shell-urile, schemele și instrumentele independente de brand sunt open source. Mărcile comerciale și instrumentele cu brand SUSE rămân private și sunt deja separate. Instanța publică de la [lolly.tools](https://lolly.tools) rulează [Lolly Demo](/info/lolly-demo.html), propriul sistem de design Lolly.

Nimic de aici nu se bazează pe o promisiune: fiecare versiune publicată rămâne open source. Când o altă companie a închis sursele Linux pentru întreprinderi în 2023, SUSE a cofondat [OpenELA](https://openela.org) ca să păstreze acel cod deschis. Acest proiect moștenește acea poziție.

SUSE *construiește* instrumente interne pentru a conecta Lolly la propriile sisteme IT. Aceasta este configurația internă SUSE, nu o separare între dezvoltarea publică și cea privată. Lolly urmărește și să fie construit prin [Open Build Service](https://openbuildservice.org/), cu artefacte dintr-un lanț de aprovizionare securizat, livrate de [SUSE Application Collection](https://apps.rancher.io/applications).

## De ce numele „Lolly Tools”?

**Lolly** pentru că libertatea e dulce și pentru că în Australia, Noua Zeelandă și Marea Britanie o lolly este o bomboană.

**Tools** pentru că un instrument stă pe loc până îl iei în mână. Nu rulează când nu îl folosești și nu te urmărește când îl folosești.

## De ce este totul verde?

lolly.tools se deschide în [Lolly Demo](/info/lolly-demo.html), propriul sistem de design demonstrativ Lolly, a cărui culoare principală este verde. Treci la **Lolly Starter**, un sistem de design gol, sau la al tău în [Settings → Design systems](/#/settings?focus=design-systems-section).

## Pot folosi propriul brand?

Da. **Lolly Design System Setup** (`#/start`) construiește un sistem de design dintr-o culoare, un fișier de tokenuri de design sau un design finalizat. Fiecare instrument desenează apoi cu sistemul tău de design. [Start](/info/quickstart.html#put-your-brand-in) parcurge cele trei căi.

Un sistem de design furnizat de organizația ta sau de versiunea ta a aplicației este gestionat. Arată un lacăt și rămâne doar pentru citire. Ca să-l schimbi, fă o copie editabilă.

## Unde este ce am făcut ieri?

Dacă ai apăsat **Save as** sau **Save**, munca ta este în **Projects** pe ecranul principal, în browserul sau aplicația din care ai salvat. Dacă ai apăsat doar **Download**, fișierul este în descărcările browserului sau ale sistemului, iar o copie este de obicei în **Assets**. Instrumentele care [salvează pe măsură ce lucrezi](/info/find-your-work.html#which-tools-save-as-you-work) păstrează și munca nesalvată în **Projects**. [Găsește și recuperează-ți munca](/info/find-your-work.html) acoperă fiecare caz.

## Am închis fila. Mi-am pierdut munca?

Munca salvată este tot în **Projects**. Munca nesalvată s-a pierdut, cu excepția instrumentelor care salvează pe măsură ce lucrezi, care o păstrează tot în **Projects**. Data viitoare, apasă **Save as** înainte să pleci. Vezi [Dacă ai închis fila sau ai părăsit instrumentul](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Pot partaja munca mea ca fișier în loc de link?

Da. Când un link nu poate include totul, precum fotografiile tale sau un text lung, dialogul Share spune ce ar lipsi și oferă un fișier **.lolly**. Acel singur fișier conține designul, imaginile pe care le folosește și, dacă alegi, instrumentul.

Tu decizi cât se transmite. Numele și detaliile tale sunt incluse doar dacă profilul tău permite explicit asta. Grafica licențiată este exclusă dacă nu alegi să o incluzi. Cine deschide un fișier care conține un instrument este întrebat dacă are încredere în instrument înainte ca acesta să poată rula. Vezi [Partajarea muncii tale](/info/using.html#sharing-your-work).

## Ce fac detaliile din profilul meu?

Detaliile tale din **Settings** completează dinainte instrumentele care le cer, precum un nume pe un ecuson. Rămân pe acest dispozitiv. Nimic nu intră în ce creezi dacă nu activezi opțiunea de includere. Atunci detaliile pe care le alegi sunt sigilate în rezultat și te identifică drept sursă.

Partajarea și Sync trimit doar conținutul pe care îl alegi. Pe o instanță Lolly Work a unei organizații, sesiunile partajate și munca supusă regulilor organizației ajung și pe acel server. Vezi [Confidențialitate](/info/privacy.html).

## Cum obțin aplicațiile pentru mobil sau desktop?

Descarcă-le de la [Instalează Lolly](/info/install.html). Pagina listează fiecare versiune pentru macOS, Windows, Linux și Android și arată cum să verifici fișierul descărcat. iPhone și iPad primesc **Lolly Tools** din App Store. [Secțiunea iPhone și iPad](/info/install.html#iphone-and-ipad) conține linkul.

Oricine poate și să construiască și să distribuie propria copie a aplicației, cu instrumentele și setările de care are nevoie publicul său. [Ghidul de build](/info/build-guide.html) arată cum.

## Lolly spune că necesită WebGPU. Ce pot face?

Aplicația web desenează cu WebGPU, o funcționalitate grafică a browserelor actuale, și verifică disponibilitatea WebGPU înainte să deschidă un instrument. Încearcă acestea în ordine:

1. Actualizează browserul la versiunea curentă.
2. Pornește accelerarea grafică sau hardware în setările browserului, apoi repornește browserul.
3. Încearcă un browser testat: [Medii acceptate](/info/supported-environments.html) le listează.
4. Pe un Mac, iPhone sau iPad, [instalează în schimb aplicația](/info/install.html).

## Poate Lolly să editeze și să randeze fișierele mele Figma, Penpot, Illustrator sau InDesign?

Da. Deschide instrumentul **Design** și fă clic pe **Import a design**: acceptă un fișier Figma nativ **.fig** (Save local copy), un export Penpot **.penpot**, un fișier Illustrator **.ai** sau **.pdf**, un fișier InDesign **.idml** sau **.indd**, un document Affinity, un fișier Photoshop **.psd**, un fișier PowerPoint **.pptx**, un fișier CAD **.dxf** sau **orice SVG** ([fiecare format pe care îl citește](/info/design-import.html#what-comes-in-from-each-app)). Nu ai nevoie de cont, plugin sau licență pentru o aplicație de design.

![Canvasul deschis din Lolly Design - Import a design se află în meniul Lolly al barei de instrumente](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Straturile ajung ca niște casete editabile. Textul poate fi rescris, formele rămân forme, iar imaginile intră în biblioteca ta. Odată ce layoutul este salvat, **Share with rules** îl poate transforma într-un instrument pe care oricine are Lolly îl poate completa din nou. Vezi [Importă un design](/info/design-import.html).

## Pot două persoane să lucreze la același design fără internet?

Da. O persoană partajează o invitație (un link, un cod QR sau un cod scurt), iar cealaltă acceptă. Ambele dispozitive păstrează apoi aceeași sesiune live, cu indicatori de prezență și contururi de focus. Funcționează pe orice rețea comună, inclusiv un hotspot de telefon, pentru că nu există un server intermediar. Vezi [Lucrul împreună](/info/collaborate.html). Pentru colegi din rețele diferite, instanța Lolly Work a unei organizații oferă colaborări de lucru autentificate.

## Ce sunt comutatoarele de funcționalitate?

Comutatoarele de funcționalitate pornesc sau opresc părți din Lolly. La utilizarea de sine stătătoare, îți alegi setările personale. O organizație care folosește Lolly Work poate stabili valori implicite sau ascunde anumite comutatoare conform politicii sale, iar controalele gestionate sunt etichetate. Vezi [Folosește Lolly în organizația ta](/info/organisation.html).

![Comutatoare personale de funcționalitate în aplicația de sine stătătoare; politica organizației poate guverna anumite comutatoare](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Prin ce se deosebesc utilitarele de instrumente?

Un utilitar face rapid o singură sarcină pe un fișier pe care îl ai deja, precum comprimarea unui PDF, convertirea unei fotografii sau eliminarea datelor ascunse. Multe rulează pe dispozitivul tău fără să încarce nimic. Utilitarele păstrează în Lolly sarcinile pe care oamenii le încredințează de obicei unui site oarecare. Comprimarea unui contract, convertirea fotografiilor de vacanță care încă includ locația sau lipirea unui token într-un formatator online nu ar trebui să însemne predarea fișierului unui site cu perioadă de păstrare, jurisdicție și model de afaceri necunoscute. [Lolly Utilities](/info/utilities.html) le listează, iar [Schimbul pe care nu l-am acceptat niciodată](/info/status-quo.html) spune povestea din spatele lor.

![Vederea Utilities: Lolly Strip Hidden Data, Compress PDF, Convert Image și celelalte sarcini care rulează pe dispozitiv, toate într-un singur loc](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Poate organizația noastră să folosească SSO, proiecte partajate și aprobări?

Da, cu **Lolly Work**, serverul pentru organizații al aceluiași proiect open source. Rulează separat și adaugă autentificare unică prin furnizorul tău de identitate, provizionare SCIM, permisiuni de grup, proiecte și resurse partajate, colaborări de lucru live, aprobări și înregistrări de audit. Aplicația de zi cu zi funcționează în continuare pe cont propriu.

[Folosește Lolly în organizația ta](/info/organisation.html) acoperă autentificarea și găsirea muncii partajate. [Implementare](/info/deployment.html#organisation-services-with-lolly-work) acoperă configurarea Lolly Work. Conținutul partajat și înregistrările organizației urmează politicile de confidențialitate și păstrare ale acelei instanțe.

## La ce obstacole mă pot aștepta când adopt Lolly?

Mai ales schimbări în felul în care o echipă produce munca, nu în tehnologie. O echipă care vrea un set de instrumente supus regulilor organizației are nevoie de cineva care să creeze sistemul de design și primele șabloane. Oricine își poate crea în continuare propriile instrumente în Lolly Design din prima zi, fără să aibă nevoie de git. Procesele existente continuă să funcționeze chiar și când rezultatul lor nu respectă brandul. Transformarea reușită a unui rezultat vizibil, cu versiunea de dinainte și cea de după alăturate, convinge mai repede decât un plan.

[Adoptare & guvernanță](/info/adoption-governance.html) acoperă integrarea în funcție de rol, cum să măsori un proiect-pilot și cum poate arăta un proces de guvernanță.

## A fost Lolly creat prin „vibe coding”?

Lolly a fost dezvoltat cu programare asistată de AI, explorare asistată de AI și, în multe locuri, conținut asistat de AI, folosind o combinație de modele și furnizori, inclusiv modele de la companii de vârf din cloudul public. Un om a creat arhitectura, a selectat și îngrijit codul în mod deliberat și a coordonat direcția artistică a experienței.

Un aviz de securitate cu severitate ridicată sau critică în dependențele Lolly blochează CI. Un aviz care nu poate fi încă remediat este amânat doar ca excepție aprobată, cu un motiv scris. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) listează fiecare excepție păstrată în prezent, iar [notele de versiune](https://github.com/lolly-tools/lolly/releases) le listează pe cele incluse în fiecare versiune. SECURITY.md spune și cum să raportezi o vulnerabilitate.

Verificările din procesul de build resping și formulările care par generate automat în comentariile din cod, în aplicație și în această documentație, ca textul să rămână simplu pentru fiecare cititor. Un efect secundar este că unui detector îi poate fi mai greu să identifice ce text a scris un model. Nu ne-am propus acest efect.

Mai presus de toate, Lolly se sprijină pe decenii de muncă open source a experților din întreaga lume.

**Declarație privind AI generativă:**

- **Cod scris de LLM:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (această listă se poate extinde)
- **Explorare cu LLM:** Gemini 3.1, Fable, Codex Astra
- **Documentație:** Sonnet 5
- **Biblioteci open source:** Autorii lor respectivi, indicați în SBOM, comentarii și antetele fișierelor

Această listă nu include modelele încorporate în Lolly.

**Contribuții umane:**
- **Idei, revizuire și feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, Penpot Community, Tim Hildred (lista nu este exhaustivă)
- **Arhitectură, direcție artistică & curățarea conținutului de slabă calitate:** Andy Fitzsimon

## Unde au ajuns instrumentele cu marca SUSE?

Se află într-un depozit separat, privat. O clonă publică nu descarcă pachetul de brand SUSE, așa că o compilare pornită din ea folosește profilul neutru `lolly-start`, dacă nu alegi altul. Acel profil conține instrumentele comunității independente de brand și un brand gol pe care îl completezi cu al tău. [lolly.tools](https://lolly.tools) este compilat cu profilul `lolly-demo` și se deschide în [Lolly Demo](/info/lolly-demo.html), propriul sistem de design al Lolly. SUSE își operează propria instanță pentru a-și proteja mărcile comerciale.

## Ce aromă are logoul Lolly?

Unii spun limetă, alții mentă și uneori măr. Lolly aduce dulceața, iar tu creezi aroma.

## Ce înțelege Lolly prin suveranitatea conținutului?

Control asupra modului în care conținutul tău este creat, guvernat, stocat și mutat între sistemele pe care le alegi. Lolly permite producția locală, lucrările editabile și instrumentele portabile. Lolly Work adaugă servicii partajate controlate de organizație. Licențele surselor, dependențele disponibile și fluxurile de date ale procesului de lucru contează în continuare. [Ce este suveranitatea conținutului?](/info/content-sovereignty.html) explică fiecare formă de control și limitele ei.

## Putem păstra DAM-ul existent?

Da. Un DAM acceptat poate rămâne sursa de referință, în timp ce Lolly Work conectează resursele selectate la instrumentele Lolly. Accesul la sursă, editările permise, drepturile de utilizare și aprobarea rezultatului final sunt decizii separate. [Folosește Lolly cu DAM-ul existent](/info/use-with-dam.html) explică această configurație, iar [Experiența SUSE cu Brandfolder](/info/suse-brandfolder.html) consemnează utilizarea cu succes în timpul adoptării.
