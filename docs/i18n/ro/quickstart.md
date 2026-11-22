# Începe

Setează instrumentele cu propriile culori și fonturi și refolosește munca pe care o ai deja. Nu ai nevoie de cont, iar crearea și exportul rulează pe dispozitivul tău.

::: steps
- <!--i:eti-sparkles--> **[Creează un fișier](/info/make-something.html)** Un cod QR în câteva minute, cu fiecare pas arătat.
- <!--i:eti-palette--> **[Adaugă-ți brandul](#put-your-brand-in)** Pornește de la o culoare, un fișier de tokenuri sau un design finalizat.
- <!--i:eti-folder-move--> **[Adu-ți munca](#bring-in-what-you-already-have)** Designuri, deck-uri și date pe care le ai deja, citite pe dispozitivul tău.
- <!--i:eti-repeat--> **[Creează mai multe de același fel](#make-many-share-and-automate)** Partajează un link, completează o foaie de calcul sau rulează instrumentul dintr-un script.
:::

[Ce este Lolly?](/info/what-is-lolly.html) este o introducere de cinci minute. [Cum funcționează Lolly](/info/how-lolly-works.html) arată cine ce face.

<!--i:eti-palette-->
## Adaugă-ți brandul

lolly.tools se deschide în **Lolly Demo**, propriul sistem de design demonstrativ al Lolly ([Descoperă Lolly Demo](/info/lolly-demo.html)). Sistemul tău de design înlocuiește Lolly Demo. Este un set mic de tokenuri de design (culori, fonturi și câteva reguli) cu care desenează fiecare instrument. Setează-l o singură dată și tot ce creezi pornește în stilul brandului tău.

Alege calea potrivită pentru ce ai:

- <!--i:palette--> **O culoare.** Deschide vizualizarea **Design System Setup** (`#/start`), dă un nume sistemului tău de design și alege o culoare primară. Lolly derivă din acea culoare o paletă accesibilă, cu suprafețe deschise și închise, text și accente. Alege un font și ai un brand funcțional.
- <!--i:upload--> **Un fișier de tokenuri.** **Add from…**, din partea de sus a Lolly Design System Setup, acceptă un fișier de tokenuri DTCG, Tokens Studio sau Penpot, un SVG sau un pachet `LollyBrand`. Paleta se completează din fișier. Cât timp sistemul de design este gol, **Start from a reference** de pe Board deschide același selector.
- <!--i:pentool--> **Un design finalizat.** În Lolly Design, alege **Import a design** și plasează un fișier Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint sau SVG ([toate formatele](/info/design-import.html#what-comes-in-from-each-app)). Vezi [Adu ce ai deja](#bring-in-what-you-already-have) mai jos.

Prima dată când deschizi galeria, un mesaj de întâmpinare din partea de sus propune un pas următor. Pe lolly.tools, **Start making** deschide Lolly Design la afișul Launch. La o instalare nouă, **Make it yours** deschide Lolly Design System Setup. Sub acel buton, **Bring a file** deschide un selector de fișiere pentru un design, iar cealaltă dintre cele două opțiuni apare ca link. Oricare dintre acestea sau butonul de închidere ascunde definitiv mesajul de întâmpinare.

![Secțiunea Colours din Lolly Design System Setup pentru un sistem de design nou: un chip live, un câmp și tot ce ține de prima decizie](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Opt secțiuni, folosite în orice ordine, duc sistemul de design mai departe: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** și **Skills**. Fiecare previzualizare din aplicație se actualizează pe măsură ce tastezi. [Lolly Design System Setup](/info/brand-studio.html) prezintă fiecare secțiune.

Fonturile sunt păstrate pe dispozitivul tău. Un font Google Fonts pe care îl alegi este stocat ca resursă de brand, astfel încât tipografia ta funcționează offline și nu se preia nimic când un instrument desenează.

### Vezi, schimbă și partajează un sistem de design

- **Vezi sistemul activ.** **Settings → Design system** arată sistemul de design activ ca o copertă și pagini, doar pentru citire.
- **Comută între ele.** **Settings → Preferences → Design systems** listează fiecare sistem de design de pe acest dispozitiv. O organizație poate folosi mai multe sisteme de design sau unul cu mai multe colourway-uri. [Arhitecturi de brand](/info/brand-architectures.html) prezintă variantele.
- **Partajează unul.** Exportă sistemul de design ca pachet `LollyBrand`: un singur fișier pe care un coleg îl importă ca să obțină aceeași paletă, aceleași fonturi și reguli.

Un sistem de design furnizat de versiunea ta de aplicație sau de organizația ta este **gestionat**: afișează un lacăt și rămâne doar pentru citire. Ca să-l modifici, creează o copie editabilă din **Settings → Preferences → Design systems**.

![Fila Design system din Settings: sistemul de design activ, prezentat ca o copertă și pagini](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Sistemul tău de design este alcătuit din tokenuri DTCG, formatul pe care Penpot îl citește și îl scrie și pe care Tokens Studio îl aduce în Figma. Paleta cu care creezi și paleta pe care o aplică Lolly sunt un singur document. [Tokenuri de design](/info/design-tokens.html) oferă detaliile.

::: details Pentru dezvoltatori: creează un pachet de brand din linia de comandă
`ingest:brand` creează un pachet de brand reutilizabil într-o copie de lucru a depozitului. Acceptă cele trei tipuri de containere pe care le exportă Penpot și Tokens Studio: un singur `tokens.json`, un director de fișiere pentru fiecare set cu `$metadata.json` sau o arhivă `project.penpot`.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` înregistrează brandul ca profil și îi construiește și validează catalogul. Nu schimbă niciodată profilul implicit: rulează cu `LOLLY_PROFILE=acme` ca să folosești noul pachet. [Configurare](/info/configuration.html) explică legătura dintre pachetele de brand și profiluri.
:::

<!--i:eti-folder-move-->
## Adu ce ai deja

**Fișiere Lolly Design.** Munca finalizată în Figma, Penpot, Illustrator, InDesign sau orice aplicație SVG se deschide în Lolly Design ca layout editabil. Textul rămâne editabil, formele rămân forme, iar imaginile ajung în biblioteca ta. Fișierul este citit în browserul tău și nu se încarcă nimic pe server. [Importă un design](/info/design-import.html) listează fiecare format și ce se păstrează.

**Deck-uri.** Trage un PowerPoint `.pptx` peste Lolly ca să-i salvezi diapozitivele ca resurse. Scrie un deck nou din Markdown în **Lolly Markdown Slides**. [Adaptează un deck la brand](/info/rebrand.html) mută un deck pe sistemul tău de design.

**Date.** Lipește sau trage un tabel CSV sau JSON ca să completezi câmpurile repetitive ale unui instrument. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) creează un fișier finalizat pentru fiecare rând.

### De la un design unic la un șablon

Un layout importat este o sesiune Lolly Design obișnuită. **Share with rules** transformă sesiunea într-un instrument. Alegi ce părți pot schimba ceilalți, iar ei le completează doar pe acelea.

![Păstrează originalul Lolly Design, alege intrările și limitele într-o copie de lucru, apoi partajează un instrument .lolly reutilizabil pe care destinatarii îl completează](/info/diagrams/concepts/share-with-rules.svg)

[Partajează un design cu reguli](/info/create-a-tool.html) parcurge fiecare pas.

<!--i:eti-repeat-->
## Creează în serie, partajează și automatizează

- <!--i:download--> **Exportă.** Instrumentele creează SVG, PDF, PNG, JPG, WebP, video și altele, la dimensiuni reale de tipar când este nevoie. Fiecare instrument oferă propriile formate. Vezi [Exportă un fișier](/info/exporting.html).
- <!--i:link--> **Partajează un link.** Setările unui instrument sunt incluse în linkul lui, așa că linkul redeschide același fișier oriunde.
- <!--i:layers--> **Creează câte unul pentru fiecare rând.** Alimentează un instrument dintr-o foaie de calcul în [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatizează.** Aceeași randare rulează din [CLI](/info/cli.html) și de la un [agent AI](/info/ai-agents.html).

Un link este o cerere completă. Tipul, titlul și tabelul de date ale graficului de mai jos au fost introduse în bara de adrese.

![Un grafic cu bare al înscrierilor lunare pe canale, în culorile sistemului de design, în care fiecare valoare a fost transmisă ca parametru de interogare, fără clicuri](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Unde mergi mai departe

- <!--i:people--> **[Creează](/info/creators.html)**: creare, animare, înregistrare, partajare și export.
- <!--i:code--> **[Automatizează](/info/builders.html)**: sisteme de design, crearea instrumentelor, linia de comandă, linkuri și agenți.
- <!--i:usercheck--> **[Gestionează](/info/operators.html)**: utilizarea Lolly pentru o echipă cu Lolly Work.
- <!--i:server--> **[Implementează](/info/operate.html)**: găzduirea Lolly și Lolly Work.
- <!--i:shieldcheck--> **[Încredere](/info/trust.html)**: confidențialitate, securitate și verificarea unui fișier pe cont propriu.
