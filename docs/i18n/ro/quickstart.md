# Ghid de pornire rapidă

Lolly îți transformă regulile - culori, tipografie, layout-uri, logică - în instrumente pe care oricine le poate folosi pentru a crea fișiere finite: imagini, PDF-uri, carduri pentru social media, video, doar completând câteva câmpuri. Ai puține de învățat și nimic de încărcat: crearea și exportul rulează pe dispozitivul tău, online sau offline.

Aceasta este pagina pe care s-o citești prima. Două lucruri te fac productiv: **fă-ți Lolly al tău** și **adu ce ai deja** (fișierele tale de design și tokenii). Orice altceva e la un link distanță.

> Ești nou în Lolly și vrei doar să creezi ceva? [Creează ceva în 60 de secunde](/info/make-something.html) te trece prin trei exemple, sau [deschide aplicația](/#/), alege orice instrument din galerie, completează câmpurile și apasă **Export**. Revino aici când vrei să poarte brandul *tău*.

![Vizualizarea Utilities - instrumentele de zi cu zi care rulează pe dispozitiv, ca Strip Hidden Data, Compress PDF și Convert Image, toate într-un singur loc](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Fă-l al tău - configurează-ți sistemul de design

Brandul tău în Lolly este un mic document de **design tokens** - culori, fonturi și câteva reguli - pe baza căruia randează fiecare instrument. Setează-l o dată și tot ce creezi este pe brand prin construcție, nu prin review. Există trei căi de intrare; alege-o pe cea care se potrivește cu locul unde brandul tău trăiește deja.

### Începe de la zero (constructorul de sistem de design)

Prima rulare te lasă în **galerie**, cu un scurt dialog de bun venit peste ea, care oferă trei căi de intrare - **Make it yours** (fă-l al tău: Brand Studio, la `#/start`), **Bring your design** (adu-ți designul: trage un fișier Figma, Penpot, InDesign sau PDF și se deschide ca layout editabil - cea mai rapidă cale spre [Adu ce ai deja](#2-bring-in-what-you-already-have), mai jos) și **Explore the community tools** (explorează instrumentele comunității) - plus un rând de limbi, dacă engleza nu e a ta. Alege primul card și ajungi în [**Brand Studio**](/info/brand-studio.html). Dă-i un nume și o culoare primară, iar Lolly *derivă* din ea o paletă completă și accesibilă - suprafețe deschise/închise, text, accente - folosind aceeași matematică a culorii pe care motorul o folosește peste tot.

![Camera Colours din Brand Studio - o culoare primară și paleta accesibilă pe care Lolly o derivă din ea](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Alege un font și ai un brand funcțional în mai puțin de un minut. De acolo, cele șase camere ale studioului - Overview, Colours, Type, Logos, Tokens, Files - te lasă să-l duci oricât de departe vrei, în orice ordine, rafinând orice de câte ori revii. Fila **Design system** din dashboard (`#/d`) arată rezultatul doar în citire și trimite înapoi la `#/start`, acolo unde se face editarea (dacă nu cumva ești pe o versiune de Lolly cu brandul blocat, unde brandul e fix și nu ai ce schimba).

### Importă un brand pe care îl ai deja

Dacă brandul tău este deja capturat ca design tokens - din **Penpot**, **Tokens Studio** (Figma) sau orice fișier **DTCG** simplu - adu-l integral, în loc să-l retastezi. Două căi:

- <!--i:palette--> **În aplicație:** [constructorul de sistem de design: Brand Studio](/info/brand-studio.html) (`#/start`) îl preia prin **Add from…**, din josul barei de camere - un fișier de tokeni, un export Penpot, un SVG sau un pachet `LollyBrand`. Trage-l acolo și paleta prinde viață.
- <!--i:code--> **Din linia de comandă**, pentru a ridica un pachet de brand reutilizabil:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` acceptă toate cele trei forme de container în care Penpot / Tokens Studio exportă același document - un singur `tokens.json`, un director (`$metadata.json` + fișiere per set) sau o arhivă `project.penpot`. Cu `--activate` înregistrează brandul ca profil, comută la el și reconstruiește catalogul. Vezi [Configurare](/info/configuration.html) pentru modul în care pachetele de brand și profilurile se îmbină.

### Ajustează-l în aplicație

Odată ce un brand e activ, continuă să-l modelezi în [**Brand Studio**](/info/brand-studio.html) (`#/start`) - schimbi o culoare sau un rol și fiecare previzualizare din aplicație se actualizează pe măsură ce tastezi. (Fila **Design system** de la `#/d` din dashboard *arată* brandul doar în citire; în Studio îl editezi.)

![Fila Design-system din Dashboard - brandul activ, afișat doar în citire](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Același brand este rezumat pe cardul **Profile → Your brand** (Profil → Brandul tău). Fonturile sunt reale: alegi din Google Fonts, iar Lolly stochează fișierul **pe dispozitivul tău** ca resursă de brand, astfel încât tipografia ta călătorește offline și nimic nu este preluat la randare.

Când ești mulțumit, **exportă brandul ca pachet `LollyBrand`** - un singur fișier pe care un coleg îl poate importa pentru a obține exact aceeași paletă, fonturi și reguli. Așa se mută un brand între oameni și mașini, fără un server la mijloc.

> **Tokenii de brand merg în ambele sensuri.** Pentru că brandul Lolly *este* tokeni DTCG - formatul pe care Penpot îl citește și îl scrie nativ și pe care Tokens Studio îl aduce în Figma - paleta cu care *proiectezi* și paleta pe care Lolly o *impune* sunt un singur document, nu două liste pe care le ții sincronizate manual. Vezi [Design Tokens](/info/design-tokens.html).

## 2. Adu ce ai deja

Nu pornești de la o pagină goală. Lolly se deschide pentru munca de design și formatele deschise pe care le ai deja.

### Fișiere de design open-source

Lucrările finite din **Figma, Penpot, Illustrator, InDesign sau orice aplicație SVG** nu trebuie să rămână blocate în aplicația în care le-ai desenat. Deschide **Design**, dă click pe **Import a design**, iar fișierul se deschide ca un *layout viu* - nu o imagine aplatizată. Fiecare strat devine o casetă editabilă: textul rămâne re-tastabil, formele rămân forme, imaginile ajung în biblioteca ta, iar arta vectorială complexă este păstrată fidel. Sosește deja conformă cu fețele de brand și cu regulile tale de culoare.

| Ai | Adu-l ca |
|---|---|
| Un frame din Figma | Nativ `.fig` (File → Save local copy), sau un export SVG |
| Un design din Penpot | Exportul său `.penpot`, sau orice SVG |
| Un fișier din Illustrator | Nativ `.ai` (compatibil PDF) sau `.pdf` - se deschide direct |
| Un layout din InDesign | `.idml` (File → Export → InDesign Markup) |
| Orice altceva | **Orice SVG** - ușa universală de intrare |

Tot importul se întâmplă **pe dispozitivul tău** - fișierul este parsat în browser și nimic nu este încărcat. Detaliile complete, și exact ce se păstrează, sunt în [Import a design](/info/design-import.html).

Ai în schimb o **prezentare PowerPoint**? Trage `.pptx` peste **Deck Builder** ca s-o editezi slide cu slide, deja aliniată la brandul tău - sau rulează **Rebrand a Deck** ca să primești aceeași prezentare re-tematizată, cu grafice și animații intacte.

### De la o creație unică la un șablon

Iată câștigul: un layout importat este o sesiune obișnuită de Design, deci odată ce îl **salvezi**, trăiește la o URL. Oricine are Lolly poate deschide acea URL, poate schimba cuvintele, poate înlocui o imagine și poate randa propria versiune - fără aplicație de design, iar părțile blocate rămân blocate. Un design de unică folosință devine un instrument reutilizabil. Asta e toată ideea, atinsă fără să scrii o linie de configurare.

### Date deschise și instrumente deschise

[Setul de instrumente al comunității](/info/builders.html) este open source și agnostic de brand - coduri QR, hărți stradale, filtre, utilitare de confidențialitate - și randează pe baza brandului *tău* din momentul în care îl activezi.

Alimentează instrumentele și cu propriile tale date deschise: lipește sau trage un tabel **CSV** sau **JSON**, iar câmpurile repetitive ale unui instrument se completează din el, câte o resursă finită per rând.

## 3. Creează ceva, apoi distribuie-l sau automatizează-l

Cu un brand activ și materialul tău la îndemână, fiecare instrument produce un fișier finit:

- <!--i:download--> **Randează** orice instrument în **SVG, PDF, PNG, JPG, WebP, video** și altele - la dimensiuni reale de print și unități fizice, atunci când ai nevoie. Vezi [Export și formate](/info/exporting.html).
- <!--i:link--> **Distribuie un link.** Fiecare stare de instrument este o URL, deci o resursă finită este reproductibilă și adresabilă prin parametri - commite link-ul, regenerează-l la cerere.
- <!--i:layers--> **Fă-o în masă.** Alimentează un șablon dintr-o foaie de calcul în [grila batch](/info/exporting.html): o resursă finită per rând.
- <!--i:cpu--> **Automatizează-l.** Aceeași randare rulează din [CLI](/info/cli.html) și dintr-un [agent AI](/info/ai-agents.html) - o URL este API-ul.

„O URL este API-ul” e literal. Graficul de mai jos nu a fost desenat de nimeni: tipul, titlul și întregul tabel de date au fost scrise în bara de adrese, iar același link randează același grafic pe orice dispozitiv.

![Un grafic de arie al înregistrărilor lunare, ale cărui valori au ajuns toate ca parametru de interogare, nu ca un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Ce urmează

Trei căi, în funcție de ce ai venit să faci:

- <!--i:people--> **[Lolly pentru Creatori](/info/creators.html)** - creezi lucruri. Avantajele și cum să obții maximum din aplicație.
- <!--i:code--> **[Lolly pentru Dezvoltatori](/info/builders.html)** - creezi instrumente, integrezi și implementezi. Documentația tehnică.
- <!--i:shieldcheck--> **[Lolly pentru Operatori](/info/operators.html)** - ești responsabil de brand, securitate și lansare la nivelul unei organizații.
