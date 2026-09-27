# Transfer de date - pachetul `lolly-backup`

Tot ce acumulează un utilizator Lolly rămâne **pe dispozitivul lui** - fără cont, fără cloud. Pachetul de transfer de date este modul în care această valoare se mută: îl exporți pe o instalare, transporți fișierul prin orice mijloc (USB, AirDrop, email către tine însuți, o partajare de rețea) și îl imporți pe alta. Fișierul *este* transportul. Ținta poate fi offline sau online. Nu contează, pentru că nimic nu comunică vreodată cu un server.

![Cele două butoane care mută o instalare întreagă: Export my data scrie un zip, Import data îl citește înapoi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Această pagină este specificația formatului. Pentru ghidul pentru utilizatorul final, vezi [Găsește și recuperează-ți lucrarea → Mută-ți lucrarea pe alt dispozitiv](/info/find-your-work.html#move-your-work-to-another-device). Implementarea este [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), iar [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixează contractul de round-trip.

> **Domeniu de aplicare.** Un pachet poartă *date de utilizator*, nu instrumente din catalog. Instrumentele din catalog și activele din catalog sunt sincronizate separat și se presupune că sunt deja prezente pe țintă (în cel mai rău caz la o versiune mai nouă); instrumentele pe care un utilizator și le-a făcut singur călătoresc în interiorul `profile.json`. Importul nu instalează și nu actualizează niciodată un instrument din catalog.

## Obiective

- <!--i:box--> **Un format, orice shell.** PWA-ul web, aplicațiile desktop/mobile Tauri și shell-urile viitoare împart același plic și aceleași scheme de părți acceptate. Părțile opționale depind de capabilitățile fiecărui shell; părțile neacceptate sunt raportate. Fiecare punte de capabilități furnizează propriul adaptor de stocare.
- <!--i:shieldcheck--> **Supraviețuiește călătoriei.** Un pachet deteriorat sau trunchiat în tranzit eșuează vizibil la import, niciodată nu restaurează pe jumătate.
- <!--i:clock--> **Supraviețuiește acestei versiuni.** O aplicație mai veche poate importa totuși părțile recunoscute dintr-un pachet mai nou. Un format cu adevărat incompatibil este refuzat curat.
- <!--i:check--> **Sigur la îmbinare.** Importul pe o instalare deja în uz nu șterge niciodată nimic care nu era în pachet.

## Plicul

Un pachet este un simplu `.zip`. Descărcarea este denumită după persoana căreia îi aparține - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (de exemplu `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - astfel încât un folder Descărcări plin de backup-uri rămâne lizibil. Părțile de prenume și nume vin din profil și sunt omise când nu sunt setate. Fără profil rezultă `LollyTools-2026-06-26-1.zip`, iar doar un prenume dă `LollyTools-Ada-2026-06-26-1.zip`. Fiecare parte este curățată într-un token sigur pentru nume de fișier (literele/cifrele Unicode păstrate, spațiile/punctuația eliminate, plafonat la 32 de caractere). `<n>` este o secvență per-zi, per-dispozitiv, astfel încât exporturile repetate în aceeași zi nu se ciocnesc și rămân în ordine. `backupFilename()` din [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) construiește numele. Conținutul zip-ului este identic indiferent de nume. În interior:

| Cale | Obligatoriu | Conținut |
|---|---|---|
| `manifest.json` | da | Id-ul formatului, versiuni, numărători și integritate per-parte. Primul lucru la care se uită un cititor. |
| `profile.json` | dacă e setat | Întreaga înregistrare `me` a utilizatorului: nume, contact, referință fotografie de profil și flag-uri, plus foldere, coș de gunoi, planuri de proiect, șabloane de utilizator și instrumente făcute de utilizator, favorite, instrumente ascunse, alegerea de limbă și de emoji. Citit prin `host.profile`. |
| `sessions.json` | da | Fiecare sesiune salvată: slot, id/versiune instrument, etichetă, miniatură (data-URL) și datele complete de intrare. Citit prin `host.state`. |
| `assets.json` | da | Metadate pentru fiecare activ încărcat (imagini, fonturi, tokenuri de brand, logouri, copii salvate ale descărcărilor), fiecare indicând spre octeții săi din `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per activ | Octeții bruți ai activului (fișiere de imagine și font). Stocați necomprimați (formate deja comprimate). Extensia este cosmetică. MIME-ul din `assets.json` este autoritatea. |
| `assets/blobs/<n>.c2pa` | când e prezent | Content Credentials extrase, ca octeți binari exacți, referențiate prin `_credentialFile` în înregistrarea activului. Acestea nu sunt chei de semnare ale dispozitivului. |
| `design-systems.json` | când e prezent | Sistemele de design create sau adăugate pe această instalare, ca `{ active, records }`. Îmbinate după id la import; alegerea activă a pachetului se aplică doar când ținta n-are propriul sistem de design. |
| `file-history.json` | opțional | Instantanee versionate ale activelor, rapoarte finale de operații pe fișiere și manifeste complete de loturi. Partea de istoric are propria versiune; furnizată de adaptorul intern de backup `fileHistory` al shell-ului. |
| `revision-history.json` | opțional, copii de rezervă manuale | ID-uri stabile de creație, puncte de control reținute, miniaturi și ciorne de recuperare glisante. Furnizată de `host.state.history.backup` unde e acceptat. |
| `file-history/versions/` | per instantaneu | Octeții activului anterior și acreditările extrase, indiferent dacă activul curent mai există. |
| `file-history/results/` | per operație finalizată | Octeții exacți de ieșire. Niciun fișier original selectat pentru conversie nu e reținut sau inclus. |
| `prefs.json` | da | Preferințe locale deținute de utilizator: `theme`, `sidebarWidth` și contorul de activitate `ct-metrics`. |
| `lolly.txt` | da | Un rezumat lizibil pentru oameni al pachetului (numărători, profil, nume de fișier) pentru oricine deschide zip-ul fără Lolly. Regenerat la fiecare export și recunoscut la import, astfel încât nu este niciodată numărat ca parte omisă. Este scris *după* harta de integritate, deci rămâne în afara ei. |

Pachetul este un zip simplu în mod intenționat: supraviețuiește intact oricărui transport, iar orice instrument de dezarhivare îl poate inspecta.

`profile.json` este cea mai mică parte și cea pe care un cititor o vede prima în aplicație: detaliile pe care un producător le completează o singură dată, plus opțiunea de consimțământ care permite instrumentelor să le folosească.

![Formularul de detalii Profile care devine profile.json - nume, contact, fotografie și opțiunea de consimțământ alături](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
| `format` | Întotdeauna `lolly-backup`. Un fișier fără el este respins ca „not a Lolly backup”. |
| `formatVersion` | Structura cu care a fost **scris** acest pachet. Crescut la orice schimbare a setului sau formei părților. Cititorii **nu** se condiționează de el. |
| `minReader` | Versiunea minimă de cititor necesară pentru a importa acest pachet **în siguranță**. Acesta este câmpul de care se condiționează cititorii. |
| `app` | Id-ul aplicației producătoare, pentru diagnosticare. |
| `exportedAt` | Marca de timp ISO la care a fost creat pachetul. |
| `counts` | Ce a pus scriitorul înăuntru, pentru afișare și verificare de sanitate. |
| `integrity` | Opțional. Mapează fiecare parte, cu excepția `manifest.json`, la un digest în stil SRI `sha256-<base64>` al octeților săi **necomprimați**. |

## Politica de versiuni (compatibilitate înainte)

Separarea dintre `formatVersion` și `minReader` este ceea ce permite formatului să crească fără a abandona instalările mai vechi:

- Un cititor importă un pachet când `manifest.minReader ≤` propria sa versiune de cititor. Refuză (cu „needs a newer version of the app”) doar când pachetul cere explicit un cititor mai nou.
- O schimbare **aditivă** - o nouă parte *opțională*, sau un nou câmp opțional în manifest - crește `formatVersion`, dar lasă `minReader` neschimbat. Aplicațiile mai vechi importă în continuare fiecare parte pe care o recunosc. Părțile pe care nu le recunosc sunt omise (vezi mai jos), nu eliminate în tăcere.
- O schimbare **incompatibilă** - una în care un import greșit al unei părți corupe datele, sau în care o parte anterior opțională devine obligatorie - crește `minReader`. Aplicațiile mai vechi refuză atunci curat, în loc să importe ceva ce nu pot gestiona.
- Dacă un pachet viitor setează `formatVersion`, dar omite `minReader`, cititorii se raportează conservator la `formatVersion` (tratează schimbarea ca fiind incompatibilă).

> **Regulă practică pentru autori:** dacă fiecare cititor existent ar face totuși ce trebuie ignorând adăugarea ta, este aditivă - crește `formatVersion`, lasă `minReader`. Altfel, crește `minReader`.

## Integritate

Când `manifest.integrity` este prezent, un cititor verifică SHA-256 al fiecărei părți listate **înainte de a scrie ceva**. O nepotrivire („failed its integrity check”) sau o parte lipsă („incomplete”) abandonează întregul import - nu există restaurare parțială. Acest lucru prinde coruperea pe care un transport de fișiere o poate introduce (un AirDrop trunchiat, o poartă de email care a recodat atașamentul, un sector USB defect).

Integritatea este „best-effort” prin design: este scrisă doar acolo unde Web Crypto este disponibil (orice context de browser securizat și Node modern), și verificată doar când atât harta, cât și Web Crypto sunt prezente. Un pachet fără hartă - de exemplu unul dinainte de existența integrității - se importă neschimbat. „Cannot verify” nu este niciodată tratat drept „corrupt”.

Manifestul nu se listează nici pe sine, nici README-ul regenerat `lolly.txt`. Digest-urile acoperă părțile pentru care manifestul garantează.

## Semantica importului

Importul este o **îmbinare**, niciodată o înlocuire totală:

- Datele existente de pe țintă sunt lăsate la locul lor.
- Când un slot de sesiune sau un id de imagine încărcată se află pe ambele părți, este păstrată copia salvată mai recent, astfel încât un backup mai vechi nu suprascrie niciodată o lucrare mai nouă de pe țintă. Când orele sunt egale sau necunoscute, este păstrată copia țintei. Pe o instalare web cu istoric de creație, aceeași regulă decide care copie a unei creații rămâne curentă, iar cealaltă copie este păstrată ca o ciornă protejată (vezi mai jos).
- Înregistrarea de profil este îmbinată, nu înlocuită. Fiecare folder de pe țintă rămâne cu conținutul lui; un folder din pachet pe care ținta nu îl are este adăugat, iar un folder aflat pe ambele părți păstrează numele și părintele țintei și primește membrii din pachet pe care nu îi are. O sesiune plasată într-un folder de pe țintă rămâne plasată acolo.
- Favoritele (instrumente, active din catalog și elemente din Proiecte) sunt combinate. Șabloanele, șabloanele din Proiecte și instrumentele făcute de utilizator din pachet sunt adăugate atunci când ținta nu are nicio înregistrare cu acel id. Sunt păstrate intrările din Coșul de gunoi de pe ambele părți, astfel încât un element care putea fi restaurat pe oricare dintre instalări poate fi restaurat în continuare.
- Fiecare alt câmp de profil (nume, detalii de contact, limbă, feature flags, instrumente ascunse și celelalte setări) păstrează valoarea țintei. Un câmp gol pe țintă preia valoarea din pachet. La fel se întâmplă și cu `prefs.json`: o preferință este scrisă doar acolo unde ținta nu are niciuna.
- Aplicarea obișnuită a sincronizării dispozitivelor este excepția: pentru a ține dispozitivele la zi, ea preia înregistrarea de profil, preferințele, sesiunile și imaginile din copia sincronizată. Restaurarea unei copii mai vechi face la fel, pentru că se întoarce intenționat în timp. Prima alăturare, **Bring it to this device**, îmbină la fel ca un import.
- Versiunile istorice ale activelor și ID-urile de operații sunt excepții imuabile: un import repetat este idempotent, iar un ID care numește deja octeți/istoric diferiți este refuzat, nu suprascris. Reimportarea unui activ curent identic îi păstrează versiunea. Un activ curent schimbat trebuie să poarte o versiune diferită.
- Istoricul de creație se îmbină și el. O creație aflată pe ambele părți păstrează copia salvată mai recent ca fiind curentă, iar cealaltă copie ca o ciornă protejată; o creație al cărei slot este folosit de țintă pentru o altă creație este adăugată alături de aceasta; o creație aflată în Coșul de gunoi al țintei rămâne acolo. Un id de punct de control care numește un conținut diferit pe țintă îl păstrează pe cel al țintei. O arhivă care își eșuează propriile verificări oprește importul înainte de orice schimbare de profil, sesiune, activ sau preferință. Un import repetat identic nu adaugă stocare.
- Nimic din ce nu era în pachet nu este atins. O sesiune pe care ținta o avea, dar pachetul nu, supraviețuiește importului.

Sesiunile salvate se relegă automat de imaginile lor: referințele către active sunt păstrate după id, iar puntea le rerezolvă după ce imaginile încărcate sunt restaurate (oricum trebuie să o facă, deoarece URL-urile `blob:` nu supraviețuiesc unei reîncărcări).

Rezumatul importului raportează `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` numără activele încărcate care nu au putut fi restaurate (de exemplu, stocarea dispozitivului plină). Este distinct de `skipped`, care numără părțile de la un scriitor mai nou, compatibil înainte, pe care această versiune nu le-a recunoscut. UI-ul afișează `skipped` („… · N newer items skipped”), astfel încât restaurarea este onestă cu privire la ce a lăsat în urmă.

Când istoricul de fișiere e prezent, rezumatul mai poartă și `assetVersions`, `fileOperations` și `failedHistory`. Epuizarea stocării sau conflictele de ID imuabil pot cauza o restaurare parțială; interfața îi spune utilizatorului să păstreze copia de rezervă sursă. Sincronizarea cloud **nu** își avansează revizia aplicată după o restaurare parțială sau neacceptată, așa că instantaneul rămâne disponibil pentru reîncercare. Restaurarea nu e o singură tranzacție de-a lungul tuturor depozitelor de profil/sesiune/activ/istoric.

## Istoricul de creație (v3)

Copiile de rezervă manuale de la o gazdă web capabilă de istoric includ `revision-history.json` cu propria schemă `{ version: 1, documents, revisions, recoveries }`. Poartă ID-urile reținute, instantanee canonice de intrare, mărci de versiune, previzualizări raster și ciorne separate de scriitor. Adaptorul de istoric captează sesiunile curente și capetele lor într-o singură tranzacție de citire; `sessions.json` folosește aceleași instantanee curente pentru cititorii mai vechi.

Restaurarea verifică SHA-256 și numărul de octeți ai payload-ului, identitățile unice, relațiile document/cap, ascendența, mărcile temporale, tipurile de previzualizare și limitele înainte de a angaja arhiva într-o singură tranzacție. Referințele părinte compactate pot lipsi. Lucrarea curentă existentă nu este niciodată înlocuită în tăcere: când o creație există pe ambele părți, partea care nu este păstrată drept curentă devine o ciornă protejată. Limita de transfer de 384 MiB a arhivei e verificată explicit, iar limitele de stocare sunt impuse fără să trunchieze punctele de control reținute. Copia de rezervă generală folosește încă o implementare ZIP în memorie și nu e o arhivă în flux (streaming).

Rezumatul adaugă `revisions` și `recoveryDrafts`, numărând doar ce a adăugat acest import, și `added`, `kept`, `replaced`, `copies` și `hidden` pentru cum a fost îmbinată fiecare creație. Un shell fără această capabilitate restaurează sesiunile obișnuite și raportează partea de istoric ca omisă. Istoricul pe sistemul de fișiere nativ rămâne neacceptat până când adaptorul lui furnizează tranzacții de istoric durabile. Starea de invitat P2P nu are niciun istoric durabil sau arhivă de recuperare.

Sincronizarea personală de instantanee exclude explicit istoricul de creație. Aplicarea unui instantaneu unui document local cu istoric păstrează starea lui de lucru anterioară ca o ciornă de recuperare separată și invalidează tokenul de scriere al oricărui editor deschis. Punctele lui de control imuabile rămân pe dispozitiv. Asta protejează istoricul local în timpul înlocuirii instantaneului; nu îmbină istoricele concurente ale dispozitivelor.

Referințele istorice ale activelor sunt reținute, în timp ce randarea rezolvă în continuare activele prin biblioteca existentă a destinației. Această arhivă nu garantează încă octeții exacți ai activelor vechi sau randările vechilor instrumente. Octeții versiunilor de active și ai rezultatelor de fișiere continuă să călătorească prin partea lor separată existentă de backup.

## Versiuni salvate și rezultate de fișiere (v2)

Partea opțională de istoric conține `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; cititorii mai acceptă și forma anterioară history-v1, fără loturi. Fiecare instantaneu identifică ID-ul stabil al activului și versiunea exactă, ora salvării, lungimea în octeți și SHA-256 hex, plus o înregistrare de activ ale cărei `_file` și, opțional, `_credentialFile` indică spre părți binare. Operațiile poartă faptele fișierului original, cererea, raportul, mărcile temporale și opționalul `_file` de rezultat; numele de backend de stocare, handle-urile OPFS și contractele de execuție (leases) nu călătoresc. Cititorii mai vechi, doar history-v1, refuză noua versiune de istoric înainte de import, în loc să renunțe în tăcere la apartenența la lot.

Manifestele de loturi înregistrează fiecare sursă selectată înainte de procesare, inclusiv fișiere niciodată citite, membri anulați, eșecuri de rezervare a spațiului de rezultat și lucrări întrerupte. Fiecare membru are un ID de operație stabil, o referință/fapte de sursă, un nume de ieșire cerut și un raport final. O sursă necitită are fapte declarate, nu un digest inventat. Importul validează identitatea membrului și consistența cu orice raport de operație purtat. Rapoartele de lot rămân disponibile chiar și când rezultatele individuale au fost eliminate explicit, dar o chitanță nu implică faptul că octeții ei de ieșire sunt încă stocați.

- Fiecare înregistrare de istoric, raport și fișier referențiat cunoscut e validat înainte ca vreo scriere de import de profil sau activ să aibă loc. Octeții lipsă și SHA-256 nepotrivit eșuează chiar dacă plicul n-are hartă de integritate. Acreditările extrase rămân array-uri de octeți, inclusiv la importuri de la scriitori mai vechi care le-au serializat JSON ca obiecte cu chei numerice.
- Operațiile în curs devin înregistrări întrerupte în copia de rezervă, cu un raport explicativ de eșec și fără rezultat. Restaurarea nu repornește niciodată lucrul din fundal și nu importă un contract de execuție (lease) activ. Reîncercarea cere selectarea fișierului original, verificat față de SHA-256-ul lui înregistrat, când e disponibil.
- Rezultatele restaurate își angajează octeții și metadatele împreună în IndexedDB. Rezultatele noi obișnuite folosesc OPFS unde e disponibil, cu o soluție de rezervă în IndexedDB. O operație vie existentă nu e niciodată înlocuită de un import.
- Asamblarea ZIP a istoricului e încă în memorie: limita actuală e **256 MiB de payload de istoric**, **4 MiB de metadate de istoric**, cel mult **100 de operații**, **100 de loturi** și **2.000 de instantanee**. Exportul refuză explicit un istoric supradimensionat sau incomplet; nu-l omite niciodată în tăcere. Descarcă individual versiunile/rezultatele importante înainte să elimini copiile locale mai vechi. Aceste limite nu sunt o garanție măsurată de memorie de vârf pentru telefoane.
- Istoricul local de rezultate are un buget de 512 MiB și un plafon de 100 de înregistrări. Instantaneele de active au un buget separat de 512 MiB și cel mult 20 de versiuni istorice per activ; octeții de acreditări extrase contează în acel buget de instantanee. Restaurarea respectă aceste limite și nu evacuează niciodată în tăcere datele existente ale utilizatorului.
- Metadatele locale de loturi au un buget separat de 4 MiB, cel mult 100 de manifeste și 20 de membri per lot. Membrii în așteptare rezervă capacitate de metadate, cu un plafon de 32 KiB de raport per membru. Ăsta e un buget logic, nu o garanție de spațiu pe disc al browserului; un eșec real de cotă e semnalat, iar raportul din memorie rămâne descărcabil. Reîncercarea unui membru de lot creează un lot nou fără să suprascrie raportul vechi. Eliminarea unei înregistrări de lot nu elimină octeții individuali de rezultat sau activele din bibliotecă.
- Rezultatele convertite pot fi adăugate explicit în bibliotecă fără normalizare sau reencodare. Sumele de control sursă/ieșire și relația de operație însoțesc activul. Adăugările repetate refolosesc o copie neschimbată; o copie editată nu e niciodată suprascrisă. Imaginile raster pot porni un document Design nou. Acel document folosește ID-ul curent al activului din bibliotecă: impunerea unor fixări exacte de versiune de-a lungul întregului runtime și traseu URL al Design rămâne lucru separat. Rezultatele SVG/HTML/PDF/ZIP sunt păstrate ca active de fișier opace de această predare, nu promovate la conținut interactiv/vectorial de încredere.
- **Convert → Recent file operations** expune utilizarea istoricului, rapoartele, descărcările și managerul de versiuni. Managerul mai găsește și versiuni anterioare ale activelor din bibliotecă care au fost șterse. Restaurarea unui instantaneu creează o versiune curentă nouă, păstrând intact instantaneul selectat. **Setări → Stocare** contabilizează rezultatele și versiunile separat de cache-urile de unică folosință.
- Curățarea explicită a fișierelor temporare elimină doar octeții deținuți de operație și nereferențiați. Înregistrările curente își protejează fișierele; fișierele OPFS recente au o perioadă de grație de o oră. Rezultatele salvate și instantaneele de active nu sunt șterse automat.

Cititorii mai vechi acceptă în continuare plicul v2 (`minReader: 1`) și restaurează părțile familiare, numărând părțile de istoric neacceptate ca omise. Recuperarea completă a istoricului cere un shell cu adaptorul `fileHistory`; asta e o cusătură internă shell-ului, nu o nouă capabilitate `HostV1` orientată spre instrumente. Restaurarea reală între două dispozitive e acoperită de poarta Chromium locală; acceptarea recuperării pe Tauri/iOS/Android instalate rămâne separată.

## Ce nu călătorește

- **Cache-urile de catalog** (metadatele și blob-urile activelor descărcate, indexul de instrumente) - resincronizate gratuit pe țintă.
- **Instrumentele din catalog și activele din catalog** - în afara domeniului de aplicare, și presupuse deja prezente pe țintă. Tokenurile de brand, fonturile și logourile pe care le-a adăugat utilizatorul sunt active de utilizator, așa că ele călătoresc.
- **URL-urile `blob:` / object** - regenerate de punte la încărcare.
- **Originalele de conversie, contractele de execuție (leases) vii și secretele locale de mașină de acces/semnare** - nu sunt payload de istoric portabil. Un rezultat salvat e o copie, nu o promisiune că sursa originală a fost salvată.
- **Contorul secvenței de export** - contorul de denumire a descărcărilor per-zi (cheia `localStorage` `lolly-export-seq`) este o comoditate locală de denumire. Este ținut în afara `PREF_KEYS`, deci nu călătorește niciodată într-un pachet.

Contorul de stocare detaliază aceeași separare. Sesiuni salvate, Imaginile mele și Rezultatele fișierului & versiunile călătoresc într-un pachet. Cache de active, Previzualizări instrumente și fixările offline de sub ele sunt toate re-derivabile, deci rămân în urmă.

![Contorul de stocare împărțind datele acestui dispozitiv în categorii denumite, cu Saved sessions și My images urmărite separat de Asset cache, aici pe o instalare nouă unde fiecare categorie este încă goală](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garanția cross-shell

`data-transfer.ts` citește și scrie exclusiv prin puntea de capabilități (`host.profile`, `host.state`, `host.assets`) și preferințele partajate din `localStorage`. Același modul citește și scrie plicul comun pe web și pe Tauri, peste stocarea IndexedDB sau de sistem de fișiere. Părțile opționale de istoric apar doar acolo unde adaptorul corespunzător e disponibil; o parte neacceptată e raportată ca omisă la import. Suita headless exersează părțile comune față de o punte în memorie, în timp ce tranzacțiile de istoric au și teste în browser real.

Două shell-uri stau în afara acestei garanții, din motive diferite:

- **CLI-ul cu execuție unică** nu are nimic de transportat - starea sa este în memorie și efemeră per invocare.
- **TUI-ul** persistă starea (`~/.lolly`: sesiuni, foldere, profil), iar vizualizarea Profile poate face o copie de rezervă a ei, dar scrie o arhivă *mai simplă*, proprie: `saved-state/<slot>.json` per sesiune plus `profile.json` și `folders.json`, fără manifest, fără `formatVersion`/`minReader` și fără hartă de integritate. **Nu** poate fi importată de acest format - un cititor o respinge ca fiind „not a Lolly backup” - și, derutant, folosește un nume similar (`lolly-backup-<stamp>.zip`). Unificarea celor două este un decalaj cunoscut.

## Puncte de extensie rezervate

Plicul este, prin proiectare, un manifest plus un set de părți numite, astfel încât noi tipuri de date portabile să îl poată folosi mai târziu **fără o schimbare incompatibilă**. Ele se integrează ca părți aditive (`formatVersion` nou, același `minReader`), iar cititorul de azi sare peste ce nu recunoaște. Acestea nu sunt încă implementate. Numele sunt rezervate aici pentru ca formatul să rămână coerent atunci când vor apărea.

- **`tokens.json` - jetoane de design.** Un document de jetoane de design [W3C DTCG](https://tr.designtokens.org/format/) (formatul pe care [Penpot îl importă și exportă](https://help.penpot.app/user-guide/design-systems/design-tokens/) - jetoane cu `$value`/`$type`/`$description`, organizate în grupuri, seturi și teme). Un set de jetoane în pachet permite unui utilizator să își mute primitivele de brand între instalări împreună cu sesiunile sale. (Propriile jetoane de brand ale unui utilizator călătoresc deja astăzi ca activul `user/tokens/brand` din `assets.json`; această parte ar purta un document DTCG întreg cu seturile și temele lui.) Pe termen mai lung, un set de jetoane ingerat devine o sursă de prim rang față de care se rezolvă instrumentele și activele de paletă.
- **`penpot/` - fișiere Penpot ingerate.** Un director rezervat pentru un fișier Penpot (sau subsetul său extras, relevant pentru Lolly) importat și expus *ca unealtă*. Pachetul va transporta definiția ingerată, astfel încât aceasta călătorește împreună cu restul datelor utilizatorului.

Orice se află în afara acestor nume rezervate și a părților de mai sus reprezintă, pentru un cititor, o parte necunoscută: lăsată neatinsă și numărată în `skipped`.

## Referință

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - denumitorul `backupFilename()` este intern).
- Test de contract: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - cazuri de dus-întors, îmbinare, integritate, compatibilitate înainte și blocare la nivel de cititor.
- Teste de contract pentru istoric: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) și [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Acceptare în browser: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) și [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Suprafața punții folosită: `host.profile`, `host.state`, `host.assets` - vezi [Host API](/info/host-api.html).
