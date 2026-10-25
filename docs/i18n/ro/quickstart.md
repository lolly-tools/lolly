# Start

Până la sfârșitul acestei pagini, instrumentele tale vor purta propriile tale culori și fonturi, iar munca pe care o ai deja va fi gata de refolosit. Nu ai nevoie de cont, iar crearea și exportul rulează pe dispozitivul tău.

::: timeline
- <!--i:sparkle--> **Fă un fișier.** [Fă primul tău fișier](/info/make-something.html) te ghidează printr-un cod QR în câteva minute.
- <!--i:palette--> **Pune-ți brandul.** Pornește de la o culoare, un fișier de tokenuri sau un design terminat.
- <!--i:layers--> **Fă mai multe la fel.** Partajează un link, completează o foaie de calcul sau rulează instrumentul dintr-un script.
:::

Ești nou în idee? [Ce este Lolly?](/info/what-is-lolly.html) este introducerea de cinci minute, iar [Cum funcționează Lolly](/info/how-lolly-works.html) arată cine ce face.

## Pune-ți brandul

lolly.tools se deschide în **Lolly Demo**, sistemul de design de probă al Lolly; [Cunoaște Lolly Demo](/info/lolly-demo.html) arată ce vezi. Sistemul tău de design îl înlocuiește: un set mic de tokenuri de design, adică culori, fonturi și câteva reguli, cu care desenează fiecare instrument. Setează-l o dată și tot ce faci pornește în stilul brandului.

Alege traseul potrivit cu ce ai:

- <!--i:palette--> **O culoare.** Deschide **Design System Setup** (`#/start`), dă un nume sistemului tău de design și alege o culoare primară. Lolly derivă din ea o paletă completă și accesibilă, cu suprafețe deschise și închise, text și accente. Alege un font și ai un brand funcțional.
- <!--i:upload--> **Un fișier de tokenuri.** **Add from…**, la baza barei de camere din Design System Setup, primește un fișier de tokenuri DTCG, Tokens Studio sau Penpot, un SVG sau un pachet `LollyBrand`. Plasează-l și paleta se completează. Cât sistemul de design este încă gol, **Start from a reference** din camera Overview deschide același selector.
- <!--i:pentool--> **Un design terminat.** În Design, alege **Import a design** și plasează un fișier `.fig`, `.penpot`, `.ai`, `.idml` sau SVG. Vezi [Adu ce ai deja](#bring-in-what-you-already-have) mai jos.

Prima dată când deschizi galeria, o scurtă bun venit oferă aceleași alegeri: **Make it yours** deschide Design System Setup, **Bring your design** deschide un selector de fișiere pentru un design, iar **Explore the community tools** închide mesajul de bun venit.

![Camera Colours din Design System Setup la o instalare nouă: un chip live, un câmp și toată prima decizie](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

De acolo, șapte camere o duc cât de departe vrei, în orice ordine: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** și **Usage & rules**. Fiecare previzualizare din aplicație se actualizează pe măsură ce tastezi. [Design System Setup](/info/brand-studio.html) acoperă fiecare cameră.

Fonturile sunt păstrate pe dispozitivul tău. Alege un Google Font și Lolly stochează fișierul ca resursă de brand, deci tipografia ta călătorește offline și nu se preia nimic când un instrument desenează.

### Vezi, comută și partajează un sistem de design

- **Vezi-l pe cel activ.** **Settings → Design system** arată sistemul de design activ ca o copertă și pagini, doar pentru citire.
- **Comută între ele.** **Settings → Preferences → Design systems** listează fiecare sistem de design de pe acest dispozitiv. O organizație poate rula mai multe sisteme de design sau unul cu mai multe colourway-uri; [Arhitecturi de brand](/info/brand-architectures.html) cartografiază aranjamentele.
- **Partajează unul.** Exportă sistemul de design ca pachet `LollyBrand`: un singur fișier pe care un coleg îl importă ca să obțină aceeași paletă, aceleași fonturi și reguli.

Un sistem de design furnizat de versiunea ta sau de organizația ta este **administrat**: arată un lacăt și rămâne doar pentru citire. Ca să schimbi unul, fă o copie editabilă din **Settings → Preferences → Design systems**.

![Fila Design system din Settings: sistemul de design activ ca o copertă și pagini](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Sistemul tău de design înseamnă tokenuri DTCG, formatul pe care Penpot îl citește și îl scrie și pe care Tokens Studio îl aduce în Figma, deci paleta cu care proiectezi și paleta pe care o aplică Lolly sunt un singur document. [Tokenuri de design](/info/design-tokens.html) are detaliile.

::: details Pentru dezvoltatori: construiește un pachet de brand din linia de comandă
Ca să ridici un pachet de brand reutilizabil într-un checkout, `ingest:brand` acceptă cele trei containere pe care le exportă Penpot și Tokens Studio: un singur `tokens.json`, un director cu fișiere pe seturi cu `$metadata.json` sau o arhivă `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` înregistrează brandul ca profil și îi construiește și validează catalogul. Nu schimbă niciodată profilul implicit: rulează cu `LOLLY_PROFILE=acme` ca să folosești noul pachet. [Configurare](/info/configuration.html) explică cum se potrivesc pachetele de brand și profilurile.
:::

## Adu ce ai deja

Nu pornești de la o pagină goală.

**Fișiere de design.** Munca terminată din Figma, Penpot, Illustrator, InDesign sau orice aplicație SVG se deschide în Design ca un layout viu: textul rămâne editabil, formele rămân forme, iar imaginile ajung în biblioteca ta. Fișierul este citit în browser și nimic nu este încărcat. [Importă un design](/info/design-import.html) listează fiecare format și ce se păstrează.

**Deck-uri.** Plasează un PowerPoint `.pptx` pe Lolly ca să-i arhivezi diapozitivele ca resurse, scrie un deck nou din Markdown în **Markdown Slides** sau folosește [Rebrand a deck](/info/rebrand.html) ca să muți întregul deck pe sistemul tău de design.

**Date.** Lipește sau plasează un tabel CSV sau JSON, iar câmpurile repetitive ale unui instrument se completează din el, sau [Batch](/info/batch.html#make-many-versions-of-one-design) face un fișier terminat pe rând.

### De la o creație unică la un șablon

Un layout importat este o sesiune Design obișnuită. **Share with rules** îl transformă într-un instrument: alegi ce părți pot schimba ceilalți, iar ei completează doar acelea.

![Păstrează masterul Design, alege intrările și limitele într-o copie de creație, apoi partajează un instrument .lolly reutilizabil pe care destinatarii îl completează](/info/diagrams/concepts/share-with-rules.svg)

[Partajează un design cu reguli](/info/create-a-tool.html) parcurge fiecare pas.

## Fă mai multe, partajează și automatizează

- <!--i:download--> **Exportă.** Instrumentele fac SVG, PDF, PNG, JPG, WebP, video și altele, în formatele oferite de fiecare instrument, la dimensiuni reale de tipar când ai nevoie. Vezi [Exportă un fișier](/info/exporting.html).
- <!--i:link--> **Partajează un link.** Setările unui instrument călătoresc în link, deci linkul redeschide același fișier oriunde.
- <!--i:layers--> **Fă unul pe rând.** Conduce un instrument dintr-o foaie de calcul în [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizează.** Aceeași randare rulează din [CLI](/info/cli.html) și dintr-un [agent AI](/info/ai-agents.html).

Un link este o cerere completă. Nimeni nu a desenat diagrama de mai jos: tipul, titlul și întregul tabel de date au fost tastate în bara de adrese, iar același link desenează aceeași diagramă pe orice dispozitiv.

![Un grafic de arie al înregistrărilor lunare, ale cărui valori au ajuns toate ca parametru de interogare, nu ca un clic](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Ce urmează

- <!--i:people--> **[Creează](/info/creators.html)**: crearea, animarea, înregistrarea, partajarea și exportul.
- <!--i:code--> **[Automatizează](/info/builders.html)**: sisteme de design, crearea de instrumente, linia de comandă, linkuri și agenți.
- <!--i:usercheck--> **[Administrează](/info/operators.html)**: rularea Lolly pentru o echipă cu Lolly Work.
- <!--i:server--> **[Instalează](/info/operate.html)**: găzduirea Lolly și Lolly Work.
- <!--i:shieldcheck--> **[Încredere](/info/trust.html)**: confidențialitate, securitate și verificarea unui fișier de unul singur.
