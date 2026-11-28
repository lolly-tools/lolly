# Cum funcționează Lolly

Un instrument Lolly conține regulile pentru un tip de fișier: layoutul, tipografia, culorile și ce părți pot schimba ceilalți. Tu, un coleg, un script sau un agent AI completați câmpurile, iar fiecare fișier respectă acele reguli.

<!--i:eti-repeat-->
## Un instrument, regulile tale, multe fișiere

Regulile brandului se află în instrument. Configurează instrumentul o singură dată și fiecare rezultat primește aceeași tipografie, culoare și spațiere, de la un card la o foaie de calcul cu rânduri într-o duzină de limbi.

![Un instrument wordmark cu un câmp completat: tipografia, culoarea și spațierea au fost stabilite la crearea instrumentului](/info/shots/aud-rules-in-the-tool.svg)

Persoana care creează al o sutălea fișier doar introduce cuvintele. Tu decizi cum se verifică munca și cine o verifică. Lolly lasă mai puțin de verificat și accelerează crearea următorului fișier.

<!--i:eti-users-->
## Cine lucrează cu un instrument

Trei roluri dintr-o organizație lucrează la același card de campanie.

![Un designer stabilește regulile o singură dată într-un instrument; un dezvoltator îl rulează dintr-un script și oricine îi poate completa câmpurile; ambele căi produc fișiere finalizate](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Un designer stabilește regulile.** Aranjează cardul în Lolly Design cu tipografia și culorile brandului, apoi alege ce câmpuri rămân deschise. Face asta o singură dată, așa că nimeni nu mai localizează manual cardul.
- <!--i:code--> **Un dezvoltator extinde utilizarea instrumentului.** Același instrument rulează într-un script nocturn prin linia de comandă. Un grafic actualizat sau o versiune într-o limbă nouă apare fără ca cineva să redeschidă designul.
- <!--i:people--> **Oricine îl completează.** Un reprezentant de vânzări aflat în avion, fără rețea și fără pregătire în design, deschide instrumentul și creează cardul pentru întâlnirea de mâine.
:::

Graficul actualizat al dezvoltatorului este o randare ca aceasta, creată dintr-un șir de date și câteva setări:

![Un grafic cu arii suprapuse și titlu, cu cele trei serii în benzi dintr-o paletă rece, în care axele, legenda și titlul sunt plasate de șablon, nu manual](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Minutul în care reprezentantul termină treaba depinde de regulile designerului și de scriptul dezvoltatorului. Fiecare rol lucrează cu același instrument.

<!--i:eti-train-->
## Patru căi către un fișier

Fiecare cale rulează același motor pe același instrument, așa că fișierul creat de un script corespunde celui pe care îl previzualizezi în aplicație.

![Parametrii URL și argumentele din linia de comandă devin același model de intrare, procesat printr-un mediu de execuție și o punte de export comune](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **În aplicație, unul câte unul.** Deschide un instrument, completează câmpurile și apasă **Export**. [Creează primul tău fișier](/info/make-something.html) te ghidează printr-un exemplu.
- <!--i:layers--> **În aplicație, mai multe deodată.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) preia un tabel lipit sau importat și randează un fișier finalizat pentru fiecare rând.
- <!--i:cpu--> **Dintr-un script sau de la un agent AI.** [CLI](/info/cli.html) rulează un instrument fără interfață grafică, iar [serverul MCP](/info/mcp.html) permite unui agent să descopere și să ruleze instrumente. Un link către un instrument include și intrările lui, așa că un link este o cerere completă.
- <!--i:server--> **Prin serverul organizației tale.** [Lolly Work](/info/organisation.html) randează pe server conform autentificării și politicii organizației tale privind instrumentele, păstrează sarcini pe care le poate relua și reține rezultatul pentru descărcare sau livrare aprobată.

Calea pe care o poate folosi o sarcină depinde de formatele instrumentului și de capacitățile gazdei. Unele formate au nevoie de un browser, așa că linia de comandă le trimite unui nivel de execuție în browser. [Randează cu CLI](/info/cli-rendering.html) listează unde se randează fiecare format.

<!--i:eti-monitor-->
## Ce rulează unde

Crearea, editarea și exportul rulează pe dispozitivul tău, fără cont. O funcție care are nevoie de un server, precum Sync sau trimiterea unui fișier către un serviciu conectat, se conectează doar când o folosești. Cu Lolly Work, proiectele partajate, editarea live în echipă, aprobările și sarcinile de pe server folosesc serverul organizației tale. [Ce rulează unde](/info/compare.html#what-runs-where) prezintă cele două părți alăturat.

<!--i:eti-graduation-cap-->
## Citește în continuare

- [Creează primul tău fișier](/info/make-something.html), ca să încerci acum.
- [Începe](/info/quickstart.html), ca să adaugi propriul sistem de design.
- [Automatizează](/info/builders.html), pentru linia de comandă, linkuri și agenți.
- [Arhitectura Lolly](/info/overview.html), pentru contribuitori: motorul, interfețele care îl găzduiesc și regulile care le țin împreună.
