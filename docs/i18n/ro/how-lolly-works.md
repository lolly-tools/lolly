# Cum funcționează Lolly

Un instrument Lolly păstrează regulile pentru un fel de fișier: layoutul, tipografia, culorile și ce părți pot schimba ceilalți. Tu, un coleg, un script sau un agent AI completați câmpurile, iar fiecare fișier iese corect. Această pagină arată cine ce face și cele patru trasee de la un instrument la un fișier terminat.

## Un instrument, regulile tale, multe fișiere

Regulile brandului trăiesc în instrument, nu în fiecare fișier pe care îl face. Pune instrumentul la punct o dată și fiecare rezultat moștenește aceeași tipografie, culoare și spațiere, fie că e un singur card, fie o foaie de calcul cu rânduri în o duzină de limbi.

![Un instrument de wordmark cu un câmp completat: tipografia, culoarea și spațierea au fost stabilite când a fost făcut instrumentul](/info/shots/aud-rules-in-the-tool.svg)

Persoana care face al suta fișier doar tastează cuvintele. Cum verifici munca și cine o verifică rămâne decizia ta. Lolly face mai mic ce merită verificat și următorul fișier mai rapid de făcut.

## Cine atinge un instrument

Urmărește un card de campanie printr-o organizație și apar trei perechi de mâini. Fiecare se sprijină pe precedenta.

![Un designer stabilește regulile o dată într-un instrument; un dezvoltator îl rulează dintr-un script și oricine îi poate completa câmpurile; amândoi fac fișiere terminate](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un designer stabilește regulile.** Aranjează cardul în Design cu tipografia și culorile brandului, apoi alege ce câmpuri rămân deschise. O face o singură dată, deci nimeni nu mai localizează cardul de mână.
- <!--i:code--> **Un dezvoltator scalează instrumentul.** Același instrument rulează într-un script nocturn prin linia de comandă, deci o diagramă proaspătă sau o versiune într-o limbă nouă sosește fără ca cineva să redeschidă designul.
- <!--i:people--> **Oricine îl completează.** Un reprezentant de vânzări într-un avion, fără rețea și fără pregătire în design, deschide instrumentul și face cardul pentru ședința de mâine.
:::

Diagrama proaspătă din pasul dezvoltatorului este o randare ca aceasta, făcută dintr-un șir de date și câteva setări, fără ca cineva să deschidă un fișier de design:

![O diagramă cu arii suprapuse, cu titlu, ale cărei trei serii sunt în benzi dintr-o paletă rece, cu axe, legendă și titlu plasate de șablon, nu de mână](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Minutul ușor al reprezentantului este posibil doar datorită grijii designerului și scriptului dezvoltatorului. Fiecare rol lucrează cu același instrument, nu cu un produs separat.

## Patru trasee spre un fișier

Fiecare traseu rulează același motor pe același instrument, deci fișierul făcut de un script se potrivește cu cel pe care îl previzualizezi în aplicație.

![Parametrii URL și argumentele din linia de comandă devin același model de intrare, rulat printr-un singur runtime și punte de export comune](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **În aplicație, pe rând.** Deschide un instrument, completează câmpurile și apasă **Export**. [Fă primul tău fișier](/info/make-something.html) te ghidează prin unul.
- <!--i:layers--> **În aplicație, mai multe deodată.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) ia un tabel lipit sau importat și randează un fișier terminat pe rând.
- <!--i:cpu--> **Dintr-un script sau de un agent AI.** [CLI](/info/cli.html) rulează un instrument fără interfață, iar [serverul MCP](/info/mcp.html) lasă un agent să descopere și să ruleze instrumente. Și un link către un instrument poartă intrările lui, deci un link este o cerere completă.
- <!--i:server--> **Prin serverul organizației tale.** [Lolly Work](/info/organisation.html) randează pe server sub autentificarea și politica de instrumente ale organizației tale, păstrează joburi pe care le poate relua și ține rezultatul pentru descărcare sau livrare aprobată.

Ce traseu poate folosi un job depinde de formatele instrumentului și de ce poate face gazda: unele formate cer un browser, deci linia de comandă le predă unui nivel de browser. [Randează cu CLI](/info/cli-rendering.html) listează ce formate se randează unde.

## Ce rulează unde

Crearea, editarea și exportul rulează pe dispozitivul tău, fără cont. O funcție care are nevoie de server, precum Sync sau trimiterea unui fișier la un serviciu conectat, se conectează doar când folosești acea funcție. Cu Lolly Work, proiectele comune, editarea live în echipă, aprobările și joburile pe server folosesc serverul organizației tale. [Ce rulează unde](/info/compare.html#what-runs-where) pune cele două părți una lângă alta.

## Citește în continuare

- [Fă primul tău fișier](/info/make-something.html), ca să încerci acum.
- [Start](/info/quickstart.html), ca să-ți pui propriul sistem de design.
- [Automatizează](/info/builders.html), pentru linia de comandă, linkuri și agenți.
- [Arhitectura Lolly](/info/overview.html), pentru contribuitori: motorul, shell-urile și regulile care le țin împreună.
