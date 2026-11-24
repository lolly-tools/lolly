# Transfer de date: arhiva `lolly-backup`

O arhivă de backup mută biblioteca personală pe care Lolly o păstrează pe dispozitiv: export-o dintr-o instalare, transferă fișierul (USB, AirDrop, email către tine sau o partajare în rețea) și import-o în alta. Exportul și importul nu au nevoie de server, iar destinația poate fi offline.

Aceasta este specificația formatului pentru cei care construiesc interfețe gazdă, instrumente sau scripturi pentru copii de rezervă. Pentru a-ți muta propria muncă, citește [Mută-ți munca pe alt dispozitiv](/info/find-your-work.html#move-your-work-to-another-device).

![Cele două butoane care mută o instalare întreagă: Export my data scrie un singur zip, Import data îl citește înapoi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Domeniu de aplicare
O arhivă conține *date ale utilizatorului*, nu instrumente din catalog. Instrumentele și resursele din catalog se sincronizează separat și se presupune că sunt prezente la destinație, în cel mai rău caz la o versiune mai nouă. Instrumentele create de un utilizator călătoresc în `profile.json`. Importul nu instalează și nu actualizează niciodată un instrument din catalog.
:::

<!--i:eti-badge-check-->
## Obiective

- <!--i:box--> **Un format, toate interfețele gazdă.** Aplicația web, aplicațiile desktop și mobile și interfețele gazdă viitoare folosesc aceeași structură externă și aceleași scheme ale componentelor. Componentele opționale depind de capabilitățile fiecărei interfețe gazdă, iar componentele neacceptate sunt raportate. Fiecare punte de capabilități furnizează adaptorul său de stocare.
- <!--i:shieldcheck--> **Rezistă la transfer.** O arhivă deteriorată sau trunchiată în timpul transferului eșuează la import cu o eroare și nu se restaurează niciodată pe jumătate.
- <!--i:clock--> **Rămâne utilizabilă după această versiune.** O aplicație mai veche importă componentele pe care le recunoaște dintr-o arhivă mai nouă. Un format incompatibil este refuzat fără probleme.
- <!--i:check--> **Combinare sigură.** Importul într-o instalare deja folosită nu șterge niciodată nimic din ce nu era în arhivă.

<!--i:eti-package-->
## Structura externă

O arhivă este un simplu `.zip`. Rămâne intactă prin orice mijloc de transfer, iar orice instrument de dezarhivare îi poate inspecta conținutul.

Descărcarea poartă numele proprietarului ei: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, de exemplu `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Prenumele și numele de familie provin din profil și sunt omise când nu sunt setate: fără profil rezultă `LollyTools-2026-06-26-1.zip`, iar doar cu prenume rezultă `LollyTools-Ada-2026-06-26-1.zip`. Fiecare nume devine un token sigur pentru numele de fișiere (literele și cifrele Unicode sunt păstrate, spațiile și punctuația sunt eliminate, cel mult 32 de caractere). `<n>` este o secvență pentru fiecare zi și dispozitiv, deci exporturile repetate într-o zi nu intră în conflict și rămân în ordine. `backupFilename()` din `data-transfer.ts` construiește numele. Numele nu schimbă conținutul zipului.

| Cale | Obligatoriu | Conținut |
|---|---|---|
| `manifest.json` | da | ID-ul formatului, versiunile, numerele de elemente și integritatea fiecărei componente. Un cititor citește mai întâi acest fișier. |
| `profile.json` | când este setat | Înregistrarea `me` a utilizatorului: nume, contact, referință la fotografia de profil și indicatori, plus foldere, Trash, planuri de proiect, șabloane și instrumente create de utilizator, favorite, instrumente ascunse, limba și alegerea emoji. Citită prin `host.profile`. |
| `sessions.json` | da | Fiecare sesiune salvată: slot, ID-ul și versiunea instrumentului, etichetă, miniatură (URL de date) și toate datele de intrare. Citită prin `host.state`. |
| `assets.json` | da | Metadate pentru fiecare resursă încărcată (imagini, fonturi, tokenuri de brand, logouri, copii salvate ale descărcărilor), fiecare indicând octeții săi din `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | pentru fiecare resursă | Octeții bruți ai resursei, stocați necomprimați deoarece majoritatea sunt deja în formate comprimate. Extensia este cosmetică; tipul MIME din `assets.json` este autoritatea. |
| `assets/blobs/<n>.c2pa` | când există | Content Credentials extrase ca octeți binari exacți, referite prin `_credentialFile` în înregistrarea resursei. Acestea nu sunt chei de semnare ale dispozitivului. |
| `design-systems.json` | când există | Sistemele de design create sau adăugate în această instalare, ca `{ active, records }`. Vezi [Reguli de import](#import-rules). |
| `file-history.json` | opțional | Instantanee ale resurselor cu versiuni, rapoarte ale operațiilor de fișier terminate și manifeste complete de lot, cu o versiune proprie. Furnizat de adaptorul intern de backup `fileHistory` al interfeței gazdă. |
| `revision-history.json` | opțional, copii de rezervă manuale | ID-uri stabile ale creațiilor, puncte de control păstrate, miniaturi și ciorne de recuperare reînnoite continuu. Furnizat de `host.state.history.backup` unde este acceptat. |
| `file-history/versions/` | pentru fiecare instantaneu | Octeții anteriori ai resursei și certificatele extrase, indiferent dacă resursa curentă mai există. |
| `file-history/results/` | pentru fiecare operație terminată | Octeții exacți ai ieșirii. Niciun fișier original selectat pentru conversie nu este păstrat sau inclus. |
| `prefs.json` | da | Preferințe locale care aparțin utilizatorului: `theme`, `sidebarWidth` și contorul de activitate `ct-metrics`. |
| `lolly.txt` | da | Un rezumat lizibil al arhivei (numere de elemente, profil, nume de fișier) pentru oricine deschide zipul fără Lolly. Regenerat la fiecare export și recunoscut la import, deci nu este niciodată numărat ca o componentă omisă. Este scris după harta de integritate, deci harta nu acoperă acest fișier. |

::: details Cum scrie exportul zipul
Exportul scrie zipul componentă cu componentă (`shells/web/src/lib/zip-stream.ts`). Fișierele încărcate, rezultatele salvate și versiunile salvate ale resurselor sunt citite în segmente de 4 MiB, niciodată integral. Rezultatele și versiunile salvate sunt verificate mai întâi față de SHA-256 înregistrat. Fiecare fișier este apoi citit pentru suma de control și amprenta de integritate, iar zipul face referire la fișier în locul în care se află.

Nimic nu este recodificat. Fiecare componentă își păstrează octeții exacți și amprenta, deci un fișier care conține Content Credentials păstrează octeții acoperiți de semnătura sa. Pentru aceleași componente și același moment, zipul este identic cu cel al vechiului modul de scriere în memorie, cu excepția faptului că un fișier de istoric de peste 16 MiB este comprimat pe bucăți. `tests/backup-streaming.test.ts` verifică asta față de amprente de referință înregistrate.

Pentru o bibliotecă sintetică de 192 MiB, măsurată în Node, finalizarea copiei de rezervă a folosit aproximativ 125 până la 150 MiB în plus față de bibliotecă, comparativ cu aproximativ 850 MiB pentru modulul de scriere în memorie (`node scripts/bench-backup-finalise.ts`). Importul citește în continuare întregul zip în memorie.
:::

<!--i:eti-file-->
## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Câmp | Semnificație |
|---|---|
| `format` | Întotdeauna `lolly-backup`. Un fișier fără el este respins cu mesajul „nu este o copie de rezervă Lolly”. |
| `formatVersion` | Structura cu care a fost **scrisă** această arhivă. Incrementată la orice schimbare a setului sau structurii componentelor. Cititorii **nu** condiționează importul de acest câmp. |
| `minReader` | Versiunea minimă a cititorului care poate importa această arhivă **în siguranță**. Acesta este câmpul de care cititorii condiționează importul. |
| `app` | ID-ul aplicației care a produs arhiva, pentru diagnosticare. |
| `exportedAt` | Marcajul temporal ISO al creării arhivei. |
| `counts` | Ce a inclus modulul de scriere, pentru afișare și verificări de coerență. |
| `integrity` | Opțional. Asociază fiecare componentă, cu excepția `manifest.json`, cu o amprentă `sha256-<base64>` în stil SRI a octeților săi **necomprimați**. |

<!--i:eti-tag-->
## Politica de versiuni

Două numere de versiune permit formatului să se dezvolte fără să lase în urmă instalările mai vechi.

![O schimbare a formatului arhivei este fie aditivă, pe care cititoarele vechi o pot ignora, fie incompatibilă, caz în care un import greșit corupe datele. O schimbare aditivă incrementează formatVersion și păstrează minReader; una incompatibilă incrementează formatVersion și crește minReader. Un cititor importă când minReader este cel mult egal cu propria sa versiune.](/info/diagrams/concepts/backup-version-gate.svg)

- Un cititor importă o arhivă când `manifest.minReader` este cel mult egal cu propria sa versiune de cititor. Refuză, cu mesajul „necesită o versiune mai nouă a aplicației”, doar când arhiva cere un cititor mai nou.
- O schimbare **aditivă**, precum o componentă opțională nouă sau un câmp opțional nou în manifest, incrementează `formatVersion` și lasă `minReader` neschimbat. Aplicațiile mai vechi importă în continuare fiecare componentă pe care o recunosc, iar componentele pe care nu le recunosc sunt raportate ca omise, nu eliminate fără avertizare.
- O schimbare **incompatibilă**, în care importul greșit al unei componente corupe date sau o componentă opțională devine obligatorie, crește `minReader`. Aplicațiile mai vechi refuză atunci fără probleme în loc să importe ceva ce nu pot gestiona. Aplicațiile mai vechi refuză atunci arhiva fără probleme.
- Dacă o arhivă viitoare setează `formatVersion`, dar omite `minReader`, cititorii recurg la condiționarea importului de `formatVersion` și tratează schimbarea ca incompatibilă.

::: note Regulă practică pentru autori
Dacă fiecare cititor existent ar continua să funcționeze corect ignorând ceea ce adaugi, schimbarea este aditivă: incrementează `formatVersion` și păstrează `minReader`. Altfel, crește `minReader`.
:::

<!--i:eti-shield-check-->
## Integritate

Când `manifest.integrity` este prezent, un cititor verifică SHA-256 al fiecărei componente listate **înainte să scrie ceva**. O nepotrivire („nu a trecut verificarea de integritate”) sau o componentă lipsă („incomplet”) oprește importul, deci nu există restaurare parțială. Astfel sunt detectate deteriorările din timpul transferului: un transfer AirDrop trunchiat, un gateway de email care a recodificat atașamentul, un sector USB defect.

Integritatea este asigurată în limita posibilităților. Este scrisă doar unde Web Crypto este disponibil (orice context securizat de browser și Node modern) și verificată doar când sunt prezente atât harta, cât și Web Crypto. O arhivă fără hartă, precum una de dinaintea introducerii integrității, se importă neschimbată: „nu se poate verifica” nu înseamnă niciodată „corupt”.

Manifestul nu se listează nici pe sine, nici fișierul regenerat `lolly.txt`.

<!--i:eti-download-->
## Reguli de import

Un import rulează într-unul dintre două moduri.

- **Merge** este ceea ce fac **Import data…** și prima conectare la sincronizare, **Bring it to this device**. Datele de la destinație rămân și nimic din afara arhivei nu este atins.
- **Replace** este ceea ce folosește sincronizarea dispozitivelor pentru a le menține la zi. Preia înregistrarea de profil, preferințele, sesiunile, imaginile și alegerea sistemului de design activ din copia sincronizată. Elimină doar elementele șterse de alt dispozitiv de la ultima sincronizare. Restaurarea unei copii anterioare salvează mai întâi dispozitivul, apoi face dispozitivul să corespundă acelei copii și elimină tot ce copia nu conține. [Sincronizează-ți dispozitivele](/info/sync.html) prezintă ce vede utilizatorul.

O combinare tratează fiecare tip de date astfel:

| Date | Deja la destinație | Doar în arhivă |
|---|---|---|
| Sesiuni (după slot) și imagini încărcate (după ID) | Se păstrează copia salvată mai recent, deci o copie de rezervă mai veche nu suprascrie niciodată munca mai nouă. Momentele egale sau necunoscute păstrează copia de la destinație. | Adăugate |
| Foldere | Se păstrează numele și părintele de la destinație, iar folderul primește elementele din arhivă care îi lipsesc. O sesiune plasată într-un folder la destinație rămâne acolo. | Adăugate |
| Favorite (instrumente, resurse din catalog și elemente Projects) | Combinate | Adăugate |
| Șabloane, șabloane Projects și instrumente ale utilizatorului (după ID) | Se păstrează înregistrarea de la destinație. | Adăugate |
| Intrări Trash | Se păstrează intrarea de la destinație. | Adăugate, astfel încât un element care putea fi restaurat în oricare dintre instalări să poată fi restaurat în continuare. O intrare al cărei folder este din nou folosit la destinație sau al cărei slot Trash este deja folosit la destinație este omisă. |
| Alte câmpuri de profil (nume, date de contact, limbă, indicatori de funcții, instrumente ascunse și alte setări) | Se păstrează valoarea de la destinație. | Preluate unde câmpul de la destinație este gol |
| Preferințe (`prefs.json`) | Se păstrează valoarea de la destinație. | Scrise unde nu există la destinație |
| Sisteme de design (după ID) | Înregistrarea din arhivă o înlocuiește pe cea de la destinație. | Adăugate. Alegerea activă din arhivă se aplică doar când destinația nu are propriul sistem de design. |
| Istoricul creațiilor | Copia salvată mai recent rămâne curentă, iar cealaltă este păstrată ca ciornă protejată. | Adăugat |

**Sesiunile salvate se reconectează automat la imaginile lor.** Referințele la resurse sunt păstrate după ID. Puntea le rezolvă din nou după restaurarea imaginilor, deoarece URL-urile `blob:` nu rezistă la reîncărcare.

**Înregistrările istoricului nu se schimbă niciodată după ce sunt scrise.** Un import repetat al versiunilor de resurse și al ID-urilor de operații nu adaugă nimic, iar un ID care desemnează deja alți octeți sau alt istoric este refuzat, nu suprascris. Reimportarea unei resurse curente identice îi păstrează versiunea, iar o resursă curentă modificată trebuie să aibă o versiune diferită.

**Istoricul creațiilor mai are câteva reguli.** O creație al cărei slot este folosit la destinație pentru o altă creație este adăugată ca o creație separată, iar o creație din Trash de la destinație rămâne acolo. Dacă un ID de punct de control desemnează alt conținut la destinație, se păstrează conținutul de la destinație. O arhivă care nu trece propriile verificări oprește importul înainte de orice modificare a profilului, sesiunilor, resurselor sau preferințelor, iar un import repetat identic nu ocupă spațiu suplimentar.

**Rezumatul raportează ce s-a întâmplat.** Fiecare import returnează `profile`, `sessions`, `userAssets`, `prefs`, `skipped` și `failedAssets`.

- `failedAssets` numără resursele încărcate care nu au putut fi restaurate, de exemplu deoarece spațiul de stocare al dispozitivului este plin.
- `skipped` numără componentele provenite de la un modul de scriere mai nou pe care această versiune compilată nu le-a recunoscut. Aplicația arată numărul („… · N elemente mai noi omise”).
- Cu istoricul fișierelor, rezumatul adaugă `assetVersions`, `fileOperations`, `fileBatches` și `failedHistory`. Epuizarea spațiului de stocare sau un conflict de ID imuabil poate cauza o restaurare parțială, iar aplicația îi spune atunci utilizatorului să păstreze copia de rezervă sursă.
- Cu istoricul creațiilor, adaugă `revisions` și `recoveryDrafts`, numărând doar ceea ce a adăugat acest import, și `added`, `kept`, `replaced`, `copies` și `hidden` pentru modul în care a fost combinată fiecare creație. `skippedCheckpoints` numără punctele de control al căror ID desemnează alt conținut la destinație, iar `historyLeftOut` numără punctele de control și ciornele mai vechi care nu au încăput în spațiul pentru istoric al dispozitivului.
- Un import prin înlocuire adaugă `removed` și `failedRemovals`.

Restaurarea nu este o singură tranzacție pentru depozitele de profil, sesiuni, resurse și istoric. Sincronizarea în cloud **nu** avansează revizia aplicată după o restaurare parțială sau neacceptată, deci copia rămâne disponibilă pentru reîncercare.

<!--i:eti-unlink-->
## Ce nu se transferă

- **Cache-urile catalogului** (metadatele și bloburile resurselor descărcate, indexul instrumentelor), pe care destinația le sincronizează din nou.
- **Instrumentele și resursele din catalog**, presupuse prezente la destinație. Tokenurile de brand, fonturile și logourile adăugate de utilizator sunt resurse ale utilizatorului și se transferă.
- **URL-urile `blob:` și de obiect**, pe care puntea le regenerează la încărcare.
- **Originalele conversiilor, permisele temporare de execuție active și secretele de acces sau semnare locale dispozitivului.** Acestea nu sunt istoric portabil. Un rezultat salvat este o copie. Nu înseamnă că sursa originală a fost inclusă în copia de rezervă.
- **Contorul secvenței de export**, contorul zilnic pentru numele descărcărilor din `localStorage` (`lolly-export-seq`). Este exclus din `PREF_KEYS`, deci nu se transferă niciodată într-un pachet.

Indicatorul de stocare arată aceeași împărțire. Saved sessions, My images și File results & versions intră într-un pachet. Cache-ul resurselor, previzualizările instrumentelor și elementele fixate pentru acces offline pot fi reconstruite și rămân în urmă.

![Indicatorul de stocare împarte datele acestui dispozitiv în categorii denumite, urmărind Saved sessions și My images separat de Asset cache, aici într-o instalare nouă în care fiecare categorie este încă goală](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Datele organizației cu Lolly Work

Acest pachet face o copie de rezervă a bibliotecii personale a dispozitivului. Un pachet nu este o copie de rezervă a unei instanțe **Lolly Work**. Conturile organizației, politicile de acces, proiectele partajate, versiunile catalogului, aprobările, sarcinile de randare și înregistrările de audit sunt păstrate de acel serviciu. Reconectează-te și autentifică-te ca să recapeți accesul la munca partajată. Importul unui pachet personal nu acordă acel acces.

Operatorii fac copii de rezervă, păstrează și șterg datele de pe server folosind ghidurile proprii Lolly Work: [Copiere de rezervă și restaurare](/info/work-operations.html#backup-and-restore) și [Stocarea și ciclul de viață al datelor în Lolly Work](/info/work-data-lifecycle.html). Ștergerea datelor de pe un dispozitiv sau exportul lor nu efectuează niciuna dintre aceste operațiuni pe server.

<!--i:eti-monitor-->
## În diferitele interfețe de rulare

`data-transfer.ts` citește și scrie doar prin puntea de capabilități (`host.profile`, `host.state`, `host.assets`) și preferințele comune din `localStorage`. Același modul citește și scrie anvelopa comună pe web și în aplicațiile desktop și mobile, folosind IndexedDB sau stocarea în sistemul de fișiere. Componentele opționale de istoric apar doar acolo unde adaptorul lor este disponibil. Importul raportează o componentă neacceptată ca omisă. Suita fără interfață grafică testează componentele comune cu o punte în memorie, iar tranzacțiile de istoric au și teste într-un browser real.

Două interfețe de rulare nu intră sub această garanție:

- **CLI-ul cu o singură execuție** nu are nimic de transferat: starea lui este în memorie și durează o singură invocare.
- **TUI** păstrează starea în `~/.lolly` (sesiuni, dosare, profil). Vizualizarea sa Profile scrie o arhivă de rezervă proprie, mai simplă: `saved-state/<slot>.json` pentru fiecare sesiune plus `profile.json` și `folders.json`, fără manifest, fără `formatVersion` sau `minReader` și fără hartă de integritate. Un cititor al acestui format respinge acea arhivă ca „nu este o copie de rezervă Lolly”, deși numele sunt similare (`lolly-backup-<stamp>.zip`). Unificarea celor două este o lipsă cunoscută.

<!--i:eti-clock-->
## Încă nu sunt portabile

Tipuri noi de date portabile se pot adăuga ulterior sub formă de componente suplimentare (un nou `formatVersion`, același `minReader`). Sistemele de design se transferă deja astfel, ca `design-systems.json` împreună cu resursele utilizatorului aferente.

Două nume sunt rezervate pentru date care încă nu se transferă:

- **`tokens.json`** ar transporta un document de tokenuri de design [W3C DTCG](https://tr.designtokens.org/format/) cu grupurile, seturile și temele sale, formatul pe care [Penpot îl importă și îl exportă](https://help.penpot.app/user-guide/design-systems/design-tokens/). Tokenurile de brand proprii ale unui utilizator se transferă deja ca resursa `user/tokens/brand` din `assets.json`, iar tokenurile unui sistem de design se transferă împreună cu înregistrarea lui.
- **`penpot/`** este rezervat pentru un fișier Penpot preluat sau pentru subsetul lui relevant pentru Lolly, prezentat ca instrument.

<!--i:eti-history-->
## Componentele de istoric

Cele două componente de istoric sunt opționale și au propriile versiuni.

::: details Istoricul creațiilor (v3)
Copiile de rezervă manuale dintr-o instalare web cu istoric al creațiilor includ `revision-history.json`, cu propria schemă `{ version: 1, documents, revisions, recoveries }`. Acesta conține ID-urile păstrate, instantaneele canonice ale intrărilor, marcajele de versiune, previzualizările raster și ciornele separate ale autorilor modificărilor. Adaptorul de istoric capturează sesiunile curente și cele mai recente revizii ale lor într-o singură tranzacție de citire, iar `sessions.json` folosește aceleași instantanee curente pentru cititoarele mai vechi.

Restaurarea verifică SHA-256 și numărul de octeți ai conținutului, identitățile unice, relațiile dintre documente și reviziile lor curente, ascendența, marcajele de timp, tipurile și limitele previzualizărilor înainte de a salva definitiv arhiva într-o singură tranzacție. Referințele la părinții eliminați prin compactare pot lipsi. Munca curentă existentă nu este niciodată înlocuită pe ascuns: când o creație există în ambele părți, partea care nu rămâne curentă devine o ciornă protejată.

Arhiva are o limită de transfer de 384 MiB. Limitele de stocare sunt aplicate fără a trunchia punctele de control păstrate. Exportul scrie `revision-history.json` și `sessions.json` în fragmente, cu aceiași octeți pe care îi produce un singur `JSON.stringify`, deci textul fișierului nu este niciodată păstrat integral în memorie. Un fișier de istoric care ar depăși limita este abandonat în momentul depășirii și de atunci doar i se numără octeții. Arhiva este apoi refăcută fără cele mai vechi puncte de control automate, iar rezumatul exportului le numără în `checkpointsLeftOut`, sau arhiva este refuzată.

O interfață de rulare fără această capabilitate restaurează sesiunile obișnuite și raportează componenta de istoric ca omisă. Istoricul nativ din sistemul de fișiere rămâne neacceptat până când adaptorul său oferă tranzacții de istoric durabile. Invitații dintr-o colaborare privată nu au istoric durabil sau arhivă de recuperare.

Sincronizarea instantaneelor personale exclude istoricul creațiilor. Aplicarea unui instantaneu unui document local cu istoric îi păstrează starea de lucru anterioară ca o ciornă de recuperare separată și invalidează tokenul de scriere al oricărui editor deschis. Punctele de control imuabile rămân pe dispozitiv. Acest lucru protejează istoricul local în timpul înlocuirii cu un instantaneu. Nu combină istoricele concurente ale dispozitivelor.

Referințele istorice la resurse sunt păstrate, iar randarea continuă să rezolve resursele prin biblioteca existentă a destinației. Această arhivă nu garantează încă octeții exacți ai resurselor vechi sau randările vechi ale instrumentelor. Octeții versiunilor resurselor și ai rezultatelor fișierelor se transferă în propria componentă a copiei de rezervă.
:::

::: details Versiuni salvate și rezultate ale fișierelor (v2)
Componenta opțională de istoric conține `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, iar cititoarele acceptă și structura anterioară history-v1, fără loturi. Fiecare instantaneu indică ID-ul stabil al resursei și versiunea exactă, momentul salvării, lungimea în octeți și SHA-256 în hexazecimal, plus o înregistrare a resursei ale cărei `_file` și `_credentialFile` opțional indică componente binare. Operațiunile conțin datele despre fișierul original, cererea, raportul, marcajele de timp și `_file` opțional al rezultatului. Numele mecanismelor de stocare, referințele OPFS și permisele temporare de execuție nu se transferă. Cititoarele care cunosc doar history v1 refuză noua versiune de istoric înainte de import, deci apartenența la lot nu este niciodată eliminată pe ascuns.

Manifestele loturilor înregistrează fiecare sursă selectată înainte de procesare, inclusiv fișierele care nu au fost citite niciodată, elementele anulate, eșecurile de rezervare a spațiului pentru rezultate și munca întreruptă. Fiecare element are un ID stabil de operațiune, referința și datele sursei, numele de ieșire cerut și raportul final. O sursă necitită are date declarate, nu un hash inventat. Importul validează identitatea elementului și consecvența cu orice raport de operațiune inclus. Rapoartele Lolly Batch rămân disponibile când rezultatele individuale au fost eliminate, dar o confirmare nu înseamnă că octeții rezultatului sunt încă stocați.

- **Mai întâi validarea.** Fiecare înregistrare de istoric cunoscută, raport și fișier referit este validat înainte ca importul profilului sau al resurselor să scrie ceva. Octeții lipsă și valorile SHA-256 nepotrivite provoacă un eșec chiar dacă anvelopa nu are hartă de integritate. Atestările extrase rămân tablouri de octeți, inclusiv la importul din versiuni mai vechi care le serializau ca obiecte cu chei numerice.
- **Munca în curs.** Operațiunile în curs devin înregistrări întrerupte în copia de rezervă, cu un raport de eșec și fără rezultat. Restaurarea nu repornește niciodată munca în fundal și nu importă un permis temporar activ. Reîncercarea înseamnă selectarea din nou a fișierului original, verificat față de SHA-256 înregistrat când acesta este disponibil.
- **Stocare.** Rezultatele restaurate își salvează definitiv octeții și metadatele împreună în IndexedDB. Rezultatele noi obișnuite folosesc OPFS unde este disponibil, cu IndexedDB ca alternativă de rezervă. O operațiune activă existentă nu este niciodată înlocuită de un import.
- **Limitele copiei de rezervă.** Exportul transmite acești octeți în flux în arhivă, dar restaurarea încă dezarhivează o copie de rezervă întreagă în memorie, deci limitele rămân: **256 MiB de conținut de istoric**, **4 MiB de metadate de istoric**, cel mult **100 de operațiuni**, **100 de loturi** și **2.000 de instantanee**. Exportul refuză explicit istoricul supradimensionat sau incomplet și nu îl omite niciodată pe ascuns. Descarcă versiunile și rezultatele importante unul câte unul înainte de a elimina copiile locale mai vechi. Aceste limite nu reprezintă o garanție măsurată a consumului maxim de memorie pe telefoane.
- **Bugete locale.** Istoricul local al rezultatelor are un buget de 512 MiB și o limită de 100 de înregistrări. Instantaneele resurselor au un buget separat de 512 MiB și cel mult 20 de versiuni istorice pentru fiecare resursă, iar octeții atestărilor extrase intră în acel buget. Restaurarea respectă aceste limite și nu elimină niciodată pe ascuns datele existente ale utilizatorului.
- **Metadatele loturilor.** Metadatele locale ale loturilor au un buget separat de 4 MiB, cel mult 100 de manifeste și 20 de elemente per lot. Elementele în așteptare rezervă capacitate pentru metadate, cu o limită de 32 KiB pentru raportul fiecărui element. Acesta este un buget logic, nu o garanție a spațiului pe disc al browserului: o depășire reală a cotei este afișată, iar raportul din memorie rămâne disponibil pentru descărcare. Reîncercarea unui element al lotului creează un lot nou fără a suprascrie raportul vechi. Eliminarea unei înregistrări de lot nu elimină octeții rezultatelor individuale sau resursele bibliotecii.
- **Rezultatele în bibliotecă.** Rezultatele convertite pot fi adăugate în bibliotecă fără normalizare sau recodificare, cu hashurile sursei și rezultatului și relația cu operațiunea atașate. Adăugările repetate refolosesc o copie nemodificată, iar o copie editată nu este niciodată suprascrisă. Imaginile raster pot iniția un document Lolly Design nou, care folosește ID-ul curent al resursei din bibliotecă. Impunerea versiunilor fixate exact în întregul mediu de execuție și în calea URL a Lolly Design este o lucrare separată. Rezultatele SVG, HTML, PDF și ZIP sunt păstrate ca resurse de fișier opace, fără a fi promovate la conținut interactiv sau vectorial de încredere.
- **Unde se vede acest lucru.** **Convert → Recent file operations** arată spațiul folosit de istoric, rapoartele, descărcările și managerul de versiuni, care găsește și versiunile anterioare ale resurselor șterse din bibliotecă. Restaurarea unui instantaneu creează o versiune curentă nouă și păstrează instantaneul selectat. **Settings → Preferences → Storage** numără rezultatele și versiunile separat de cache-urile dispensabile.
- **Curățare.** Curățarea explicită a fișierelor temporare elimină doar octeții fără referințe care aparțin operațiunilor. Înregistrările curente își protejează fișierele, iar fișierele OPFS recente au o perioadă de grație de o oră. Rezultatele salvate și instantaneele resurselor nu sunt șterse automat.

Cititoarele mai vechi acceptă în continuare anvelopa v2 (`minReader: 1`) și restaurează componentele pe care le cunosc, numărând componentele de istoric neacceptate ca omise. Recuperarea completă a istoricului necesită o interfață de rulare cu adaptorul `fileHistory`, un punct de integrare intern al interfeței de rulare, nu o capabilitate `HostV1` expusă instrumentelor. Restaurarea reală între două dispozitive este acoperită de verificarea locală obligatorie în Chromium. Recuperarea în aplicațiile instalate pentru desktop, iOS și Android trebuie încă validată separat.
:::

<!--i:eti-code-->
## Referință

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; funcția de denumire `backupFilename()` este internă).
- Test de contract: `tests/data-transfer.test.ts`, care acoperă transferul dus-întors, combinarea, integritatea, compatibilitatea cu versiunile viitoare și verificarea compatibilității cititorului.
- Teste de contract pentru istoric: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` și `tests/file-result-library.test.ts`. Teste de acceptanță în browser: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` și `tests/file-result-reuse.browser.test.ts`.
- Interfața punții folosită: `host.profile`, `host.state` și `host.assets`; vezi [Host API](/info/host-api.html).
