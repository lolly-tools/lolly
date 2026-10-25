# Melodii Rondocode

O melodie rondocode este muzică scrisă ca cod: sintetizatoare, tipare și un mix, redate pe măsură ce tastezi. Lolly poate reda o melodie sub un video, iar utilitarul **Rondocode** te lasă să scrii una și s-o exporți ca audio. Ambele înregistrează melodia în Content Credentials ale fișierului, deci muzica spune de unde vine.

## Redă o melodie în Lolly

Selectorul de resurse primește o melodie ca fișier `.rondo` sau `.rondo.json` ori ca link de partajare `rondocode.com` lipit. O melodie este cod care își face propriul sunet, deci rulează cât lungime cere clipul ei. Poate fi **music bed** sub un export video sau poate rula în playerul ambiental din Neurospicy Mode.

Codul melodiei rulează în sandbox-ul Lolly, fără rețea și fără acces la fișierele tale. Orice parte pe care o randare nu o poate reda, precum un microfon live sau cântatul fără modelele de voce, este listată în detaliile resursei.

Din terminal, `lolly mix` ia o melodie ca întreaga coloană sonoră; vezi [Randare CLI](/info/cli-rendering.html).

## Scrie și exportă o melodie

Deschide **Rondocode** din **Utilities** ca să scrii o melodie în editorul live rondocode și s-o auzi pe măsură ce tastezi. Exportă-o ca **WAV**, **MP3**, **M4A**, **Opus** sau **FLAC**, ca ZIP de stems, ca **MIDI** sau ca înregistrare a ceea ce se redă. **Export length** setează câte secunde durează un export audio. Fișierul melodiei în sine (`.rondo.json`) este codul tău așa cum a fost scris și nu poartă nimic adăugat.

O melodie poate cânta versurile cu `sing()`. Cântatul este făcut pe dispozitivul tău de modele de voce descărcate, iar un fișier care conține cântat sintetizat declară mereu cântatul ca generat de AI (vezi [Funcții AI](/info/ai-features.html)).

## Melodii în credențială

Un export video sau audio care redă o melodie rondocode înregistrează fiecare melodie în Content Credentials ca sursă:

- numele melodiei;
- SHA-256 al fișierului ei `.rondo.json`;
- cum a fost randată: în sandbox-ul Lolly, clasa de execuție `vm`, cu versiunea și seed-ul randerului și orice parte pe care randarea nu a putut-o reda.

Muzica calculată din codul unei melodii este marcată ca media algoritmică, deci Verify nu o semnalează ca AI. Înainte să exporți, o linie sub **Download** listează melodiile pe care credențiala le va înregistra; după export, aceeași linie raportează ce a găsit o citire a fișierului livrat. Debifează **C2PA Credentials** ca să omiți înregistrarea. O imagine statică nu înregistrează nicio melodie, pentru că nu are sunet. `lolly mix` și [serverul MCP](/info/mcp.html) scriu aceeași înregistrare.

## Fișiere de la utilitarul Rondocode

Cele mai multe utilitare pe dispozitiv nu scriu credențială, pentru că transformă un fișier pe care îl deții deja. Rondocode face audio nou, deci fiecare fișier audio pe care îl scrie poartă Content Credentials care înregistrează melodia ca sursă: numele ei, SHA-256 al fișierului `.rondo.json` și unde a rulat codul. Asta acoperă WAV, MP3, M4A, Opus, FLAC, fiecare stem dintr-un ZIP de stems și o înregistrare a ceea ce se redă.

- Randările editorului însuși rulează în cadrul lui privat (clasa de execuție `frame`) și înregistrează versiunea editorului.
- O randare făcută de CLI sau de un link de partajare rulează în clasa `vm` și înregistrează versiunea și seed-ul randerului.
- Un WAV afirmă același lucru și în comentariul lui RIFF.
- Muzica calculată din codul melodiei este media algoritmică și nu este marcată ca AI.

Când o melodie cântă, fișierul declară cântatul ca generat de AI într-o formă citibilă de mașină. Tipul sursei digitale al credențialei este media compusă făcută cu modele antrenate, înregistrarea listează părțile cântate, iar o declarație C2PA AI pe model identifică fiecare model prin care a trecut cântatul: text-to-speech Supertonic-3, aliniatorul de foneme wav2vec 2.0, codificatorul ContentVec și vocea RVC, cu depozitul și commit-ul de unde îl găzduiește Lolly. Un fișier care conține cântat sintetizat nu este niciodată salvat fără acea declarație.

Un fișier MIDI nu are loc pentru o credențială, deci un eveniment text din fișier poartă în schimb afirmația, iar panoul de export îți spune asta. Panoul descrie toate acestea înainte să exporți, iar după fiecare export editorul citește fișierul salvat și raportează doar ce a găsit citirea.

Pentru ce înregistrează Content Credentials în general, vezi [Exportă un fișier](/info/exporting.html#content-credentials-c2pa).
