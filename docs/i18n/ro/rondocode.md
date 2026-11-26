# Melodii Lolly Rondocode

<a id="rondocode-songs"></a>

O melodie rondocode este muzică scrisă sub formă de cod: sintetizatoare, tipare și un mix, redate în timp ce tastezi. Lolly poate reda o melodie pe fundalul unui video, iar utilitarul **Rondocode** scrie melodii și le exportă ca audio; ambele înregistrează melodia în Content Credentials ale fișierului.

<!--i:eti-music-->
## Redă o melodie în Lolly

Selectorul de resurse acceptă o melodie ca fișier `.rondo` sau `.rondo.json` ori ca link de partajare `rondocode.com` lipit. O melodie se redă pe orice durată cerută de clipul ei. Poate fi **fundalul muzical** al unui export video sau poate fi redată în playerul ambiental al modului Neurospicy.

Codul melodiei rulează în mediul izolat Lolly, fără rețea și fără acces la fișierele tale. Orice parte pe care o randare nu o poate reda, precum un microfon live sau cântatul fără modelele de voce, este listată în detaliile resursei.

Din terminal, `lolly mix` acceptă o melodie ca întreagă coloană sonoră; vezi [Randare CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Scrie și exportă o melodie

Deschide instrumentul **Rondocode** din **Utilities** ca să scrii o melodie în editorul live rondocode și să o auzi în timp ce tastezi. Export-o ca **WAV**, **MP3**, **M4A**, **Opus** sau **FLAC**, ca ZIP cu piste separate, ca **MIDI** sau ca înregistrare a ceea ce se redă. Din terminal, `lolly rondocode --export=mid` scrie același fișier MIDI. **Export length** setează câte secunde durează un export audio. Fișierul melodiei (`.rondo.json`) este codul tău așa cum l-ai scris, fără nimic adăugat.

O melodie își poate cânta versurile cu `sing()`. Modelele de voce descărcate produc cântatul pe dispozitivul tău. Un fișier care conține cântat sintetizat îl declară întotdeauna ca generat de AI (vezi [Funcții AI](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Melodii în certificat

Un export video sau audio care redă o melodie rondocode înregistrează fiecare melodie în Content Credentials ca sursă:

- numele melodiei;
- SHA-256 al fișierului său `.rondo.json`;
- cum a fost randată: în mediul izolat Lolly, clasa de execuție `vm`, cu versiunea motorului de randare și valoarea inițială, precum și orice parte pe care randarea nu a putut-o reda.

Muzica calculată din codul unei melodii este marcată ca media algoritmică, deci Lolly Verify nu o semnalează ca AI. Înainte să exporți, o linie sub **Download** listează melodiile pe care le va înregistra certificatul. După export, aceeași linie raportează ce a găsit o citire a fișierului livrat. Debifează **C2PA Credentials** pentru a omite înregistrarea. O imagine statică nu înregistrează nicio melodie, deoarece nu are sunet. O imagine statică nu înregistrează nicio melodie. `lolly mix` și [serverul MCP](/info/mcp.html) scriu aceeași înregistrare.

<!--i:eti-file-->
## Fișiere din utilitarul Rondocode

Majoritatea utilitarelor de pe dispozitiv nu scriu certificat, deoarece transformă un fișier pe care îl deții deja. Lolly Rondocode creează conținut audio nou, deci fiecare fișier audio pe care îl scrie conține Content Credentials care înregistrează melodia ca sursă: WAV, MP3, M4A, Opus, FLAC, fiecare pistă separată dintr-un ZIP cu piste separate și o înregistrare a ceea ce se redă.

- Randările proprii ale editorului rulează în cadrul său privat (clasa de execuție `frame`) și înregistrează versiunea editorului.
- O randare realizată de CLI sau de un link de partajare rulează în clasa `vm` și înregistrează versiunea motorului de randare și valoarea inițială.
- Un WAV declară același lucru și în comentariul său RIFF.

Când o melodie cântă, declarația AI poate fi citită automat. Tipul de sursă digitală al certificatului este media compozită realizată cu modele antrenate, înregistrarea listează părțile cântate, iar câte o declarație AI C2PA pentru fiecare model identifică fiecare model prin care a trecut cântatul: Supertonic-3 pentru conversia textului în vorbire, aliniatorul de foneme wav2vec 2.0, codificatorul ContentVec și vocea RVC, cu depozitul și commitul din care Lolly îl găzduiește.

### Ce conține fișierul MIDI

Fișierul MIDI este un Standard MIDI File, format 1. Prima pistă conține tempoul și o măsură de 4/4, urmată de câte o pistă pentru fiecare sintetizator, cu numele sintetizatorului. Fiecare notă își păstrează începutul, durata și intensitatea. Un sintetizator al cărui nume indică un instrument, precum un bas, coarde, un pad sau un pian, primește instrumentul General MIDI corespunzător, iar un nume de percuție este pus pe canalul 10. Un acordaj care nu are douăsprezece tonuri este rotunjit la cel mai apropiat semiton cu o ajustare pitch bend.

Un fișier MIDI nu poate conține setările sintetizatoarelor, filtrele, efectele, magistralele, sample-urile sau cântatul, deci un DAW redă notele cu propriile instrumente. Tempoul este citit din ciclurile pe secundă ale melodiei, cu un ciclu considerat o măsură de patru timpi, deoarece măsura proprie a melodiei nu face parte din ceea ce returnează motorul de randare.

Un fișier MIDI nu are loc pentru un certificat, deci un eveniment text din fișier conține declarația, iar panoul de export îți spune asta. Panoul descrie toate acestea înainte să exporți. După fiecare export, editorul citește înapoi fișierul salvat și raportează doar ce a găsit acea citire.

Pentru ce înregistrează Content Credentials în general, vezi [Exportă un fișier](/info/exporting.html#content-credentials-c2pa).
