# Transfer de date - pachetul `lolly-backup`

Tot ce acumulează un utilizator Lolly rămâne **pe dispozitivul lui** - fără cont, fără cloud. Pachetul de transfer de date este modul în care această valoare se mută: îl exporți pe o instalare, transporți fișierul prin orice mijloc (USB, AirDrop, email către tine însuți, o partajare de rețea) și îl imporți pe alta. Fișierul *este* transportul. Ținta poate fi offline sau online. Nu contează, pentru că nimic nu comunică vreodată cu un server.

![Cele două butoane care mută o instalare întreagă: Export my data scrie un zip, Import data îl citește înapoi](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Această pagină este specificația formatului. Pentru ghidul pentru utilizatorul final, vezi [Using Lolly → Moving to another device](/info/using.html). Implementarea este [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), iar [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) fixează contractul de round-trip.

> **Domeniu de aplicare.** Un pachet poartă *date de utilizator*, nu instrumente. Instrumentele și activele din catalog sunt sincronizate separat și se presupune că sunt deja prezente pe țintă (în cel mai rău caz la o versiune mai nouă). Importul nu instalează și nu actualizează niciodată un instrument.

## Obiective

- <!--i:box--> **Un format, orice shell.** Aceiași octeți sunt produși și consumați de PWA-ul web, aplicațiile desktop/mobile Tauri și orice shell viitor. Pachetul este contractul. Puntea de capabilități a fiecărui shell este adaptorul specific platformei din spatele lui.
- <!--i:shieldcheck--> **Supraviețuiește călătoriei.** Un pachet deteriorat sau trunchiat în tranzit eșuează vizibil la import, niciodată nu restaurează pe jumătate.
- <!--i:clock--> **Supraviețuiește acestei versiuni.** O aplicație mai veche poate importa totuși părțile recunoscute dintr-un pachet mai nou. Un format cu adevărat incompatibil este refuzat curat.
- <!--i:check--> **Sigur la îmbinare.** Importul pe o instalare deja în uz nu șterge niciodată nimic care nu era în pachet.

## Plicul

Un pachet este un simplu `.zip`. Descărcarea este denumită după persoana căreia îi aparține - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (de exemplu `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - astfel încât un folder Descărcări plin de backup-uri rămâne lizibil. Părțile de prenume și nume vin din profil și sunt omise când nu sunt setate. Fără profil rezultă `LollyTools-2026-06-26-1.zip`, iar doar un prenume dă `LollyTools-Ada-2026-06-26-1.zip`. Fiecare parte este curățată într-un token sigur pentru nume de fișier (literele/cifrele Unicode păstrate, spațiile/punctuația eliminate, plafonat la 32 de caractere). `<n>` este o secvență per-zi, per-dispozitiv, astfel încât exporturile repetate în aceeași zi nu se ciocnesc și rămân în ordine. `backupFilename()` din [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) construiește numele. Conținutul zip-ului este identic indiferent de nume. În interior:

| Cale | Obligatoriu | Conținut |
|---|---|---|
| `manifest.json` | da | Id-ul formatului, versiuni, numărători și integritate per-parte. Primul lucru la care se uită un cititor. |
| `profile.json` | dacă e setat | Înregistrarea `me` a utilizatorului (nume, contact, referință fotografie, flag-uri). Citit prin `host.profile`. |
| `sessions.json` | da | Fiecare sesiune salvată: slot, id/versiune instrument, etichetă, miniatură (data-URL) și datele complete de intrare. Citit prin `host.state`. |
| `assets.json` | da | Metadate pentru fiecare activ încărcat (imagini, fonturi, tokenuri de brand), fiecare indicând spre octeții săi din `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per activ | Octeții bruți ai activului (fișiere de imagine și font). Stocați necomprimați (formate deja comprimate). Extensia este cosmetică. MIME-ul din `assets.json` este autoritatea. |
| `prefs.json` | da | Preferințe locale deținute de utilizator: `theme`, `sidebarWidth` și contorul de activitate `ct-metrics`. |
| `lolly.txt` | da | Un rezumat lizibil pentru oameni al pachetului (numărători, profil, nume de fișier) pentru oricine deschide zip-ul fără Lolly. Regenerat la fiecare export și recunoscut la import, astfel încât nu este niciodată numărat ca parte omisă. Este scris *după* harta de integritate, deci rămâne în afara ei. |

Pachetul este un zip simplu în mod intenționat: supraviețuiește intact oricărui transport, iar orice instrument de dezarhivare îl poate inspecta.

`profile.json` este cea mai mică parte și cea pe care un cititor o vede prima în aplicație: detaliile pe care un producător le completează o singură dată, plus opțiunea de consimțământ care permite instrumentelor să le folosească.

![Formularul de detalii Profile care devine profile.json - nume, contact, fotografie și opțiunea de consimțământ alături](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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

Importul este **îmbinare cu suprascriere**, niciodată înlocuire totală:

- Datele existente pe țintă sunt lăsate la locul lor.
- Orice cheie care se ciocnește - profilul, un slot de sesiune, un id de imagine încărcată - este înlocuită de copia importată.
- Nimic din ce nu era în pachet nu este atins. O sesiune pe care ținta o avea, dar pachetul nu, supraviețuiește importului.

Sesiunile salvate se relegă automat de imaginile lor: referințele către active sunt păstrate după id, iar puntea le rerezolvă după ce imaginile încărcate sunt restaurate (oricum trebuie să o facă, deoarece URL-urile `blob:` nu supraviețuiesc unei reîncărcări).

Rezumatul importului raportează `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` numără activele încărcate care nu au putut fi restaurate (de exemplu, stocarea dispozitivului plină). Este distinct de `skipped`, care numără părțile de la un scriitor mai nou, compatibil înainte, pe care această versiune nu le-a recunoscut. UI-ul afișează `skipped` („… · N newer items skipped”), astfel încât restaurarea este onestă cu privire la ce a lăsat în urmă.

## Ce nu călătorește

- **Cache-urile de catalog** (metadatele și blob-urile activelor descărcate, indexul de instrumente) - resincronizate gratuit pe țintă.
- **Instrumentele și activele de brand** - în afara domeniului de aplicare și presupuse deja prezente pe țintă.
- **URL-urile `blob:` / object** - regenerate de punte la încărcare.
- **Contorul secvenței de export** - contorul de denumire a descărcărilor per-zi (cheia `localStorage` `lolly-export-seq`) este o comoditate locală de denumire. Este ținut în afara `PREF_KEYS`, deci nu călătorește niciodată într-un pachet.

Contorul de stocare detaliază aceeași separare. Saved sessions și My images călătoresc într-un pachet. Asset cache, previzualizările instrumentelor și fixările offline de sub ele sunt toate re-derivabile, deci rămân în urmă.

![Contorul de stocare împărțind datele acestui dispozitiv în categorii denumite, cu Saved sessions și My images urmărite separat de Asset cache, aici pe o instalare nouă unde fiecare categorie este încă goală](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garanția cross-shell

`data-transfer.ts` citește și scrie exclusiv prin puntea de capabilități (`host.profile`, `host.state`, `host.assets`) și preferințele partajate din `localStorage`. Deoarece puntea este singura interfață, *același* modul produce un pachet identic byte cu byte pe fiecare shell, chiar dacă stocarea de dedesubt diferă - IndexedDB pe web, sistemul de fișiere pe Tauri. Shell-urile Tauri reutilizează acest modul neschimbat. Doar implementarea lor `host.state` diferă. Testul headless verifică ciclul complet de dus-întors față de o punte în memorie, motiv pentru care el le reprezintă pe toate.

Două shell-uri stau în afara acestei garanții, din motive diferite:

- **CLI-ul cu execuție unică** nu are nimic de transportat - starea sa este în memorie și efemeră per invocare.
- **TUI-ul** persistă starea (`~/.lolly`: sesiuni, foldere, profil), iar vizualizarea Profile poate face o copie de rezervă a ei, dar scrie o arhivă *mai simplă*, proprie: `sessions/<slot>.json` per sesiune plus `profile.json` și `folders.json`, fără manifest, fără `formatVersion`/`minReader` și fără hartă de integritate. **Nu** poate fi importată de acest format - un cititor o respinge ca fiind "not a Lolly backup" - și, derutant, folosește un nume similar (`lolly-backup-<stamp>.zip`). Unificarea celor două este un decalaj cunoscut.

## Puncte de extensie rezervate

Plicul este, prin proiectare, un manifest plus un set de părți numite, astfel încât noi tipuri de date portabile să îl poată folosi mai târziu **fără o schimbare incompatibilă**. Ele se integrează ca părți aditive (`formatVersion` nou, același `minReader`), iar cititorul de azi sare peste ce nu recunoaște. Acestea sunt pe [foaia de parcurs](/info/overview.html#roadmap), nu sunt încă implementate. Numele sunt rezervate aici pentru ca formatul să rămână coerent atunci când vor apărea.

- **`tokens.json` - jetoane de design (design tokens).** Un document de jetoane de design [W3C DTCG](https://tr.designtokens.org/format/) (formatul pe care [Penpot îl importă și exportă](https://help.penpot.app/user-guide/design-systems/design-tokens/) - jetoane cu `$value`/`$type`/`$description`, organizate în grupuri, seturi și teme). Un set de jetoane în pachet permite unui utilizator să își mute primitivele de brand între instalări împreună cu sesiunile sale. Pe termen mai lung, un set de jetoane ingerat devine o sursă de prim rang față de care se rezolvă uneltele și activele de paletă.
- **`penpot/` - fișiere Penpot ingerate.** Un director rezervat pentru un fișier Penpot (sau subsetul său extras, relevant pentru Lolly) importat și expus *ca unealtă*. Pachetul va transporta definiția ingerată, astfel încât aceasta călătorește împreună cu restul datelor utilizatorului.

Orice se află în afara acestor nume rezervate și a părților de mai sus reprezintă, pentru un cititor, o parte necunoscută: lăsată neatinsă și numărată în `skipped`.

## Referință

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - denumitorul `backupFilename()` este intern).
- Test de contract: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - cazuri de dus-întors, îmbinare, integritate, compatibilitate înainte și blocare la nivel de cititor.
- Suprafața punții folosită: `host.profile`, `host.state`, `host.assets` - vezi [Host API](/info/host-api.html).
