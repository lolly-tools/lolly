# Transferul de date: bundle-ul `lolly-backup`

Lolly păstrează biblioteca ta personală pe dispozitiv. Un bundle de backup este modul în care se mută acea bibliotecă: exportă-l pe o instalare, transportă fișierul cum vrei (USB, AirDrop, email către tine sau o partajare de rețea) și importă-l pe alta. Exportul și importul nu au nevoie de server, iar ținta poate fi offline.

Această pagină este specificația formatului, pentru cei care construiesc shell-uri, instrumente sau scripturi în jurul copiilor de siguranță: ce este în zip, cum sunt controlate versiunile, cum se îmbină un import și ce se verifică. Ghidul pentru cei care își mută propria muncă este [Mută-ți munca pe alt dispozitiv](/info/find-your-work.html#move-your-work-to-another-device).

![Cele două butoane care mută o instalare întreagă: Export my data scrie un zip, Import data îl citește înapoi](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Domeniu.** Un bundle poartă *date de utilizator*, nu instrumente din catalog. Instrumentele și resursele din catalog se sincronizează separat și se presupune că sunt deja prezente pe țintă, cel mult la o versiune mai mare. Instrumentele făcute de utilizator călătoresc în `profile.json`. Importul nu instalează și nu actualizează niciodată un instrument din catalog.

## Obiective

- <!--i:box--> **Un format, fiecare shell.** Aplicația web, aplicațiile desktop și mobile și viitoarele shell-uri împart același plic și aceleași scheme de părți. Părțile opționale depind de capabilitățile fiecărui shell, iar părțile neacceptate sunt raportate. Fiecare punte de capabilități furnizează adaptorul ei de stocare.
- <!--i:shieldcheck--> **Supraviețuiește drumului.** Un bundle deformat sau trunchiat în tranzit eșuează zgomotos la import și nu se restaurează niciodată pe jumătate.
- <!--i:clock--> **Supraviețuiește acestei versiuni.** O aplicație mai veche poate importa în continuare părțile unui bundle mai nou pe care le recunoaște. Un format cu adevărat incompatibil este refuzat curat.
- <!--i:check--> **Sigur de îmbinat.** Importul pe o instalare deja în uz nu șterge niciodată nimic ce nu era în bundle.

## Plicul

Un bundle este un `.zip` simplu, deci supraviețuiește intact oricărui transport, iar orice instrument de dezarhivare îi poate inspecta conținutul.

Descărcarea este numită după persoana căreia îi aparține: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, de exemplu `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, deci un dosar Downloads cu copii de siguranță rămâne lizibil. Prenumele și numele vin din profil și sunt omise când nu sunt setate: fără profil dă `LollyTools-2026-06-26-1.zip`, iar doar un prenume dă `LollyTools-Ada-2026-06-26-1.zip`. Fiecare nume este redus la un token sigur pentru nume de fișier (litere și cifre Unicode păstrate, spații și punctuație eliminate, cel mult 32 de caractere). `<n>` este o secvență pe zi și pe dispozitiv, deci exporturile repetate din aceeași zi nu se ciocnesc și rămân în ordine. `backupFilename()` din `data-transfer.ts` construiește numele, iar conținutul zip-ului este același indiferent de nume.

| Cale | Obligatoriu | Conținut |
|---|---|---|
| `manifest.json` | da | Id-ul formatului, versiuni, numărători și integritate pe părți. Primul lucru la care se uită un cititor. |
| `profile.json` | când este setat | Întreaga înregistrare `me` a utilizatorului: nume, contact, referința fotografiei și indicatori, plus dosare, Trash, planuri de proiect, șabloane de utilizator și instrumente făcute de utilizator, favorite, instrumente ascunse, limba și alegerea de emoji. Citit prin `host.profile`. |
| `sessions.json` | da | Fiecare sesiune salvată: slot, id și versiune de instrument, etichetă, miniatură (data URL) și datele complete de intrare. Citit prin `host.state`. |
| `assets.json` | da | Metadate pentru fiecare resursă încărcată (imagini, fonturi, tokenuri de brand, logouri, copii salvate ale descărcărilor), fiecare indicând octeții ei din `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | pe resursă | Octeții bruți ai resursei, stocați necomprimați pentru că cei mai mulți sunt deja formate comprimate. Extensia este cosmetică; tipul MIME din `assets.json` este autoritar. |
| `assets/blobs/<n>.c2pa` | când există | Content Credentials extrase ca octeți binari exacți, referite prin `_credentialFile` în înregistrarea resursei. Nu sunt chei de semnare ale dispozitivului. |
| `design-systems.json` | când există | Sistemele de design făcute sau adăugate pe această instalare, ca `{ active, records }`. Vezi [Reguli de import](#import-rules). |
| `file-history.json` | opțional | Instantanee versionate ale resurselor, rapoarte de operațiuni terminate pe fișiere și manifeste complete de batch, cu o versiune proprie. Furnizat de adaptorul intern de backup `fileHistory` al shell-ului. |
| `revision-history.json` | opțional, backup-uri manuale | ID-uri stabile de creație, checkpoint-uri păstrate, miniaturi și ciorne de recuperare rulante. Furnizat de `host.state.history.backup` unde este acceptat. |
| `file-history/versions/` | pe instantaneu | Octeții și credențialele extrase ale resurselor anterioare, indiferent dacă resursa curentă mai există. |
| `file-history/results/` | pe operațiune terminată | Octeții exacți de ieșire. Niciun fișier original selectat pentru conversie nu este păstrat sau inclus. |
| `prefs.json` | da | Preferințe locale ale utilizatorului: `theme`, `sidebarWidth` și numărătoarea de activitate `ct-metrics`. |
| `lolly.txt` | da | Un rezumat lizibil al bundle-ului (numărători, profil, nume de fișier) pentru oricine deschide zip-ul fără Lolly. Regenerat la fiecare export și recunoscut la import, deci nu contează niciodată ca parte omisă. Este scris după harta de integritate, deci harta nu acoperă acest fișier. |

::: details Cum scrie exportul zip-ul
Exportul scrie zip-ul parte cu parte (`shells/web/src/lib/zip-stream.ts`). Încărcările, rezultatele salvate și versiunile salvate ale resurselor sunt citite în felii de 4 MiB, niciodată întregi, iar rezultatele și versiunile salvate sunt verificate mai întâi față de SHA-256 înregistrat. Apoi fiecare fișier este citit pentru suma de control și digestul de integritate, iar zip-ul se referă la el unde se află.

Nimic nu este recodificat, deci un fișier cu Content Credentials păstrează octeții exacți pe care îi acoperă semnătura lui, iar fiecare parte își păstrează octeții și digestul exacte. Pentru aceleași părți și aceeași oră, zip-ul este identic cu cel al scriitorului anterior din memorie, cu excepția faptului că un fișier de istoric de peste 16 MiB este comprimat pe bucăți. `tests/backup-streaming.test.ts` verifică asta față de digesturi de referință înregistrate.

Pe o bibliotecă sintetică de 192 MiB, măsurat în Node, finalizarea copiei a luat aproximativ 125 până la 150 MiB peste bibliotecă, față de aproximativ 850 MiB pentru scriitorul din memorie (`node scripts/bench-backup-finalise.ts`). Importul citește în continuare întregul zip în memorie.
:::

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
| `format` | Mereu `lolly-backup`. Un fișier fără el este respins ca „not a Lolly backup”. |
| `formatVersion` | Layoutul cu care a fost **scris** acest bundle. Crescut la orice schimbare a setului de părți sau a formelor. Cititorii **nu** se bazează pe acest câmp. |
| `minReader` | Versiunea minimă de cititor care poate importa acest bundle **în siguranță**. Acesta este câmpul pe care se bazează cititorii. |
| `app` | Id-ul aplicației producătoare, pentru diagnostic. |
| `exportedAt` | Marcajul de timp ISO al creării bundle-ului. |
| `counts` | Ce a pus scriitorul înăuntru, pentru afișare și verificări de bun-simț. |
| `integrity` | Opțional. Mapează fiecare parte, în afară de `manifest.json`, la un digest `sha256-<base64>` de tip SRI al octeților ei **necomprimați**. |

## Politica de versiuni

Două numere de versiune lasă formatul să crească fără să abandoneze instalările mai vechi.

![O schimbare a formatului de bundle este fie aditivă, pe care cititorii vechi o pot ignora, fie incompatibilă, unde un import greșit corupe. Aditiva crește formatVersion și păstrează minReader; incompatibila crește formatVersion și ridică minReader. Un cititor importă când minReader este cel mult versiunea lui proprie.](/info/diagrams/concepts/backup-version-gate.svg)

- Un cititor importă un bundle când `manifest.minReader` este cel mult versiunea lui proprie de cititor. Refuză, cu „needs a newer version of the app”, doar când bundle-ul cere un cititor mai nou.
- O schimbare **aditivă**, precum o parte opțională nouă sau un câmp opțional nou în manifest, crește `formatVersion` și lasă `minReader` în pace. Aplicațiile mai vechi importă în continuare fiecare parte pe care o recunosc, iar părțile pe care nu le recunosc sunt raportate ca omise, nu aruncate în tăcere.
- O schimbare **incompatibilă**, unde un import greșit al unei părți corupe date sau o parte opțională devine obligatorie, ridică `minReader`. Aplicațiile mai vechi refuză atunci curat, în loc să importe ceva ce nu pot trata.
- Dacă un bundle viitor setează `formatVersion` dar omite `minReader`, cititorii revin la controlul pe `formatVersion` și tratează schimbarea ca incompatibilă.

> **Regulă practică pentru autori:** dacă fiecare cititor existent ar face tot ce trebuie ignorând adăugarea ta, schimbarea este aditivă: crește `formatVersion` și lasă `minReader`. Altfel ridică `minReader`.

## Integritate

Când `manifest.integrity` este prezent, un cititor verifică SHA-256 al fiecărei părți listate **înainte să scrie ceva**. O nepotrivire („failed its integrity check”) sau o parte lipsă („incomplete”) oprește întregul import, deci nu există restaurare parțială. Asta prinde stricăciunea pe care o poate face un transport de fișiere: un AirDrop trunchiat, un gateway de email care a recodificat atașamentul, un sector USB defect.

Integritatea este în măsura posibilului. Este scrisă doar unde Web Crypto este disponibil (orice context sigur de browser și Node modern) și verificată doar când atât harta, cât și Web Crypto sunt prezente. Un bundle fără hartă, precum unul de dinainte să existe integritatea, se importă neschimbat: „cannot verify” nu înseamnă niciodată „corrupt”.

Manifestul nu se listează pe sine și nici `lolly.txt` regenerat. Digesturile acoperă părțile pentru care garantează manifestul.

## Reguli de import

Un import rulează într-unul din două moduri.

- **Merge** este ce face **Import data…** și ce face prima aderare la sync, **Bring it to this device**. Datele de pe țintă rămân și nimic ce nu era în bundle nu este atins: o sesiune pe care o avea ținta și bundle-ul nu supraviețuiește importului.
- **Replace** este ce folosește sincronizarea dispozitivelor pentru a ține dispozitivele în pas: preia înregistrarea de profil a copiei sincronizate, preferințele, sesiunile, imaginile și alegerea sistemului de design activ și elimină doar elementele șterse de alt dispozitiv de la ultima sincronizare. Restaurarea unei copii anterioare merge mai departe și face dispozitivul să se potrivească cu acea copie, eliminând tot ce copia nu conține, după ce salvează mai întâi dispozitivul. [Sincronizează-ți dispozitivele](/info/sync.html) acoperă ce vede o persoană.

Într-un merge, tot ce există doar pe țintă este păstrat, iar fiecare fel de date din bundle întâlnește ținta astfel:

| Date | Deja pe țintă | Doar în bundle |
|---|---|---|
| Sesiuni (după slot) și imagini încărcate (după id) | Copia salvată mai recent este păstrată, deci o copie de siguranță mai veche nu suprascrie niciodată munca mai nouă. Orele egale sau necunoscute păstrează copia țintei. | Adăugat |
| Dosare | Numele și părintele țintei sunt păstrate, iar dosarul primește membrii bundle-ului pe care nu îi are. O sesiune arhivată într-un dosar pe țintă rămâne arhivată acolo. | Adăugat |
| Favorite (instrumente, resurse de catalog și elemente Projects) | Combinate | Adăugat |
| Șabloane, șabloane Projects și instrumente de utilizator (după id) | Înregistrarea țintei este păstrată. | Adăugat |
| Intrări Trash | Intrarea țintei este păstrată. | Adăugat, deci un element care putea fi restaurat pe oricare instalare încă poate fi. O intrare al cărei dosar este reîn uz pe țintă sau al cărei slot Trash este deja folosit de țintă este omisă. |
| Alte câmpuri de profil (nume, date de contact, limbă, feature flags, instrumente ascunse și alte setări) | Valoarea țintei este păstrată. | Preluat unde câmpul țintei este gol |
| Preferințe (`prefs.json`) | Valoarea țintei este păstrată. | Scris unde ținta nu are |
| Sisteme de design (după id) | Înregistrarea bundle-ului o înlocuiește pe cea a țintei. | Adăugat. Alegerea activă a bundle-ului se aplică doar când ținta nu are un sistem de design propriu. |
| Istoricul creațiilor | Copia salvată mai recent rămâne curentă, iar cealaltă este păstrată ca ciornă protejată. | Adăugat |

**Sesiunile salvate se relegă automat la imaginile lor.** Referințele de resurse sunt păstrate după id, iar puntea le rezolvă din nou după restaurarea imaginilor, ceea ce oricum trebuie să facă, deoarece URL-urile `blob:` nu supraviețuiesc unei reîncărcări.

**Înregistrările de istoric nu se schimbă niciodată după ce sunt scrise.** Un import repetat de versiuni de resurse și ID-uri de operațiuni nu adaugă nimic, iar un ID care denumește deja octeți sau istoric diferiți este refuzat, nu suprascris. Reimportarea unei resurse curente identice îi păstrează versiunea, iar o resursă curentă schimbată trebuie să poarte o versiune diferită.

**Istoricul creațiilor are câteva reguli în plus.** O creație al cărei slot este folosit de țintă pentru o altă creație este adăugată ca o creație separată, iar o creație din Trash-ul țintei rămâne acolo. Un id de checkpoint care denumește conținut diferit pe țintă păstrează cel al țintei. O arhivă care eșuează propriile verificări oprește importul înainte să se schimbe vreun profil, sesiune, resursă sau preferință, iar un import repetat identic nu adaugă stocare.

**Rezumatul raportează ce s-a întâmplat.** Fiecare import returnează `profile`, `sessions`, `userAssets`, `prefs`, `skipped` și `failedAssets`.

- `failedAssets` numără resursele încărcate care nu au putut fi restaurate, de exemplu pentru că stocarea dispozitivului este plină.
- `skipped` numără părțile de la un scriitor mai nou pe care acest build nu le-a recunoscut. Aplicația îl arată („… · N newer items skipped”), deci o restaurare spune ce a lăsat în urmă.
- Cu istoricul fișierelor, rezumatul adaugă `assetVersions`, `fileOperations`, `fileBatches` și `failedHistory`. Epuizarea stocării sau un conflict de ID imuabil pot cauza o restaurare parțială, iar aplicația îi spune atunci persoanei să păstreze copia sursă.
- Cu istoricul creațiilor, adaugă `revisions` și `recoveryDrafts`, numărând doar ce a adăugat acest import, și `added`, `kept`, `replaced`, `copies` și `hidden` pentru cum a fost îmbinată fiecare creație. `skippedCheckpoints` numără checkpoint-urile al căror id denumește conținut diferit pe țintă, iar `historyLeftOut` numără checkpoint-urile și ciornele mai vechi care nu au încăput în spațiul de istoric al dispozitivului.
- Un import replace adaugă `removed` și `failedRemovals`.

Restaurarea nu este o singură tranzacție peste depozitele de profil, sesiuni, resurse și istoric. Sincronizarea în cloud **nu** avansează revizia aplicată după o restaurare parțială sau neacceptată, deci copia rămâne disponibilă pentru reîncercare.

## Ce nu călătorește

- **Cache-urile catalogului** (metadate și blob-uri de resurse descărcate, indexul de instrumente), pe care ținta le resincronizează gratis.
- **Instrumentele și resursele din catalog**, care sunt în afara domeniului și se presupun prezente pe țintă. Tokenurile de brand, fonturile și logourile adăugate de utilizator sunt resurse ale utilizatorului, deci călătoresc.
- **URL-urile `blob:` și de obiect**, pe care puntea le regenerează la încărcare.
- **Originalele conversiilor, leasing-urile active de execuție și secretele de acces sau semnare locale mașinii.** Acestea nu sunt istoric portabil. Un rezultat salvat este o copie, nu o promisiune că sursa originală a fost salvată.
- **Contorul secvenței de export**, contorul pe zi pentru denumirea descărcărilor din `localStorage` (`lolly-export-seq`). Este ținut în afara `PREF_KEYS`, deci nu călătorește niciodată într-un bundle.

Indicatorul de stocare arată aceeași împărțire. Saved sessions, My images și File results & versions intră într-un bundle. Cache-ul de resurse, previzualizările instrumentelor și fixările offline de sub ele pot fi toate reconstruite, deci rămân în urmă.

![Indicatorul de stocare împărțind datele acestui dispozitiv în categorii cu nume, cu Saved sessions și My images urmărite separat de Asset cache, aici la o instalare nouă unde fiecare categorie este încă goală](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Datele organizației cu Lolly Work

Acest bundle salvează biblioteca personală a dispozitivului. Nu este o copie de siguranță a unei instanțe **Lolly Work**: conturile organizației, politicile de acces, proiectele comune, versiunile de catalog, aprobările, joburile de randare și înregistrările de audit sunt ținute de acel serviciu. Reconectează-te și autentifică-te ca să recapeți accesul la munca comună; importul unui bundle personal nu acordă acel acces.

Operatorii salvează, păstrează și șterg datele de pe server cu ghidurile proprii ale Lolly Work: [Backup și restaurare](/info/work-operations.html#backup-and-restore) și [Stocarea Work și ciclul de viață al datelor](/info/work-data-lifecycle.html). Ștergerea sau exportul unui dispozitiv nu face niciuna dintre acele operațiuni pe server.

## Între shell-uri

`data-transfer.ts` citește și scrie doar prin puntea de capabilități (`host.profile`, `host.state`, `host.assets`) și preferințele `localStorage` comune. Același modul citește și scrie plicul comun pe web și în aplicațiile desktop și mobile, peste stocarea IndexedDB sau sistemul de fișiere. Părțile opționale de istoric apar doar unde adaptorul lor este disponibil, iar o parte neacceptată este raportată ca omisă la import. Suita fără interfață exersează părțile comune față de o punte în memorie, iar tranzacțiile de istoric au și teste în browser real.

Două shell-uri stau în afara acestei garanții, din motive diferite:

- **CLI-ul one-shot** nu are ce să transporte: starea lui este în memorie și durează o invocare.
- **TUI** păstrează starea în `~/.lolly` (sesiuni, dosare, profil), iar vederea lui Profile o poate salva, dar scrie o arhivă mai simplă proprie: `saved-state/<slot>.json` pe sesiune plus `profile.json` și `folders.json`, fără manifest, fără `formatVersion` sau `minReader` și fără hartă de integritate. Acest format nu o poate importa (un cititor o respinge ca „not a Lolly backup”), iar numele ei este confuz de asemănător (`lolly-backup-<stamp>.zip`). Unificarea celor două este un gol cunoscut.

## Încă neportabil

Plicul este un manifest plus părți cu nume, deci noi feluri de date portabile se pot alătura mai târziu ca părți aditive (un nou `formatVersion`, același `minReader`), iar cititorii de azi omit ce nu recunosc. Sistemele de design călătoresc deja astfel, ca `design-systems.json` plus resursele lor de utilizator.

Două nume sunt rezervate pentru date care nu călătoresc încă:

- **`tokens.json`** ar purta un document complet [W3C DTCG](https://tr.designtokens.org/format/) de design tokens, cu grupurile, seturile și temele lui, formatul pe care [Penpot îl importă și îl exportă](https://help.penpot.app/user-guide/design-systems/design-tokens/). Tokenurile de brand proprii ale unui utilizator călătoresc deja ca resursa `user/tokens/brand` în `assets.json`, iar tokenurile unui sistem de design călătoresc cu înregistrarea lui.
- **`penpot/`** este rezervat pentru un fișier Penpot ingerat sau subsetul lui relevant pentru Lolly, expus ca instrument.

Cititorii de azi nu cunosc încă niciunul dintre nume. Ca orice altceva din afara părților de mai sus, fiecare este pentru ei o parte necunoscută: lăsată neatinsă și numărată în `skipped`.

## Părți de istoric

Cele două părți de istoric sunt opționale și au versiuni proprii. Cei mai mulți cititori pot sări această secțiune.

::: details Istoricul creațiilor (v3)
Backup-urile manuale dintr-o instalare web cu istoric al creațiilor includ `revision-history.json`, cu propria schemă `{ version: 1, documents, revisions, recoveries }`. Poartă ID-urile păstrate, instantaneele canonice ale intrărilor, ștampilele de versiune, previzualizările raster și ciornele separate ale scriitorilor. Adaptorul de istoric captează sesiunile curente și capetele lor într-o singură tranzacție de citire, iar `sessions.json` folosește aceleași instantanee curente pentru cititorii mai vechi.

Restaurarea verifică SHA-256 al conținutului și numărul de octeți, identitățile unice, relațiile document și cap, ascendența, marcajele de timp, tipurile de previzualizare și limitele înainte să confirme arhiva într-o singură tranzacție. Referințele părinte compactate pot lipsi. Munca curentă existentă nu este niciodată înlocuită în tăcere: când o creație există pe ambele părți, partea care nu este păstrată curentă devine o ciornă protejată.

Limita de transfer a arhivei, 384 MiB, este verificată explicit, iar limitele de stocare sunt impuse fără a trunchia checkpoint-urile păstrate. Exportul scrie `revision-history.json` și `sessions.json` în bucăți, cu aceiași octeți pe care îi dă un singur `JSON.stringify`, deci textul fișierului nu este niciodată ținut întreg. Un fișier de istoric care ar depăși limita este abandonat în clipa în care o depășește și doar numărat de acolo încolo. Arhiva este apoi refăcută fără cele mai vechi checkpoint-uri automate ale ei, iar rezumatul exportului le numără ca `checkpointsLeftOut`, sau arhiva este refuzată în întregime.

Un shell fără această capabilitate restaurează sesiunile obișnuite și raportează partea de istoric ca omisă. Istoricul nativ în sistemul de fișiere rămâne neacceptat până când adaptorul lui furnizează tranzacții durabile de istoric. Oaspeții dintr-un collab privat nu au istoric durabil sau arhivă de recuperare.

Sincronizarea personală prin instantanee lasă istoricul creațiilor în afară. Aplicarea unui instantaneu pe un document local cu istoric păstrează starea de lucru anterioară ca ciornă de recuperare separată și invalidează tokenul de scriere al oricărui editor deschis. Checkpoint-urile lui imuabile rămân pe dispozitiv. Asta protejează istoricul local în timpul înlocuirii unui instantaneu; nu îmbină istoricele concurente ale dispozitivelor.

Referințele istorice la resurse sunt păstrate, în timp ce randarea rezolvă în continuare resursele prin biblioteca existentă a destinației. Această arhivă nu garantează încă octeții exacți ai resurselor vechi sau randările vechi ale instrumentelor. Octeții versiunilor de resurse și ai rezultatelor de fișiere călătoresc în propria parte de backup.
:::

::: details Versiuni salvate și rezultate de fișiere (v2)
Partea opțională de istoric conține `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, iar cititorii acceptă și forma mai veche history-v1 fără batch-uri. Fiecare instantaneu dă ID-ul stabil al resursei și versiunea exactă, ora salvării, lungimea în octeți și SHA-256 hex, plus o înregistrare de resursă ale cărei `_file` și `_credentialFile` opțional indică părți binare. Operațiunile poartă faptele fișierului original, cererea, raportul, marcajele de timp și `_file` de rezultat opțional. Numele backend-ului de stocare, handle-urile OPFS și leasing-urile de execuție nu călătoresc. Cititorii care cunosc doar history v1 refuză noua versiune de istoric înainte de import, în loc să piardă în tăcere apartenența la batch.

Manifestele batch înregistrează fiecare sursă selectată înainte de procesare, inclusiv fișierele niciodată citite, membrii anulați, eșecurile de rezervare a spațiului pentru rezultat și munca întreruptă. Fiecare membru are un ID de operațiune stabil, o referință de sursă și fapte, numele de ieșire cerut și raportul final. O sursă necitită are fapte declarate, nu un digest inventat. Importul validează identitatea membrului și consistența cu orice raport de operațiune purtat. Rapoartele batch rămân disponibile când rezultatele individuale au fost eliminate, dar o confirmare nu înseamnă că octeții de ieșire sunt încă stocați.

- **Mai întâi validarea.** Fiecare înregistrare de istoric cunoscută, raport și fișier referit este validat înainte ca vreun import de profil sau resurse să scrie. Octeții lipsă și SHA-256 nepotrivit eșuează chiar și când plicul nu are hartă de integritate. Credențialele extrase rămân tablouri de octeți, inclusiv importurile de la scriitori mai vechi care le-au serializat ca obiecte cu chei numerice.
- **Muncă în desfășurare.** Operațiunile în desfășurare devin înregistrări întrerupte în backup, cu un raport de eșec explicativ și fără rezultat. Restaurarea nu repornește niciodată munca de fundal și nu importă un lease activ. Reîncercarea înseamnă selectarea din nou a fișierului original, verificat față de SHA-256 înregistrat când este disponibil.
- **Stocare.** Rezultatele restaurate își confirmă octeții și metadatele împreună în IndexedDB. Rezultatele noi obișnuite folosesc OPFS unde este disponibil, cu rezervă IndexedDB. O operațiune live existentă nu este niciodată înlocuită de un import.
- **Limite de backup.** Exportul transmite acești octeți în arhivă, dar restaurarea încă dezarhivează un backup întreg în memorie, deci limitele rămân: **256 MiB de conținut de istoric**, **4 MiB de metadate de istoric**, cel mult **100 de operațiuni**, **100 de batch-uri** și **2.000 de instantanee**. Exportul refuză explicit istoricul prea mare sau incomplet și nu îl lasă niciodată în tăcere deoparte. Descarcă versiunile și rezultatele importante pe rând înainte să elimini copiile locale mai vechi. Aceste limite nu sunt o garanție măsurată de memorie de vârf pentru telefoane.
- **Bugete locale.** Istoricul local al rezultatelor are un buget de 512 MiB și un plafon de 100 de înregistrări. Instantaneele de resurse au un buget separat de 512 MiB și cel mult 20 de versiuni istorice pe resursă, iar octeții credențialelor extrase se numără la acel buget. Restaurarea respectă aceste limite și nu elimină niciodată în tăcere datele existente ale utilizatorului.
- **Metadate batch.** Metadatele batch locale au un buget separat de 4 MiB, cel mult 100 de manifeste și 20 de membri pe batch. Membrii în așteptare rezervă capacitate de metadate, cu un plafon de raport de 32 KiB pe membru. Acesta este un buget logic, nu o garanție de spațiu pe disc al browserului: un eșec real de cotă este arătat, iar raportul din memorie rămâne descărcabil. Reîncercarea unui membru batch creează un batch nou fără a suprascrie vechiul raport. Eliminarea unei înregistrări batch nu elimină octeții rezultatelor individuale sau resursele bibliotecii.
- **Rezultate în bibliotecă.** Rezultatele convertite pot fi adăugate în bibliotecă fără normalizare sau recodificare, cu hash-urile sursei și ieșirii și relația operațiunii atașate. Adăugările repetate refolosesc o copie neschimbată, iar o copie editată nu este niciodată suprascrisă. Imaginile raster pot porni un document Design nou, care folosește ID-ul curent al resursei din bibliotecă; impunerea fixărilor exacte de versiune în tot runtime-ul Design și în calea URL este o muncă separată. Rezultatele SVG, HTML, PDF și ZIP sunt păstrate ca resurse de fișier opace, nu promovate la conținut interactiv sau vectorial de încredere.
- **Unde văd oamenii asta.** **Convert → Recent file operations** arată folosirea istoricului, rapoartele, descărcările și managerul de versiuni, care găsește și versiuni anterioare ale resurselor șterse din bibliotecă. Restaurarea unui instantaneu creează o versiune curentă nouă și păstrează instantaneul selectat. **Settings → Preferences → Storage** numără rezultatele și versiunile separat de cache-urile de unică folosință.
- **Curățare.** Curățarea explicită a fișierelor temporare elimină doar octeții deținuți de operațiuni și nereferiți. Înregistrările curente își protejează fișierele, iar fișierele OPFS recente au o perioadă de grație de o oră. Rezultatele salvate și instantaneele de resurse nu sunt șterse automat.

Cititorii mai vechi acceptă în continuare plicul v2 (`minReader: 1`) și restaurează părțile pe care le cunosc, numărând părțile de istoric neacceptate ca omise. Recuperarea completă a istoricului necesită un shell cu adaptorul `fileHistory`, o cusătură în interiorul shell-ului, nu o nouă capabilitate `HostV1` orientată spre instrumente. Restaurarea reală pe două dispozitive este acoperită de poarta locală Chromium; recuperarea pe aplicațiile desktop, iOS și Android instalate urmează să fie acceptată separat.
:::

## Referință

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; numitorul `backupFilename()` este intern).
- Test de contract: `tests/data-transfer.test.ts`, acoperind dus-întors, îmbinare, integritate, compatibilitate înainte și poarta cititorului.
- Teste de contract pentru istoric: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` și `tests/file-result-library.test.ts`. Acceptare în browser: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` și `tests/file-result-reuse.browser.test.ts`.
- Suprafața de punte folosită: `host.profile`, `host.state` și `host.assets`; vezi [Host API](/info/host-api.html).
