# Lolly și API-urile de randare

_Ultima verificare: 5 noiembrie 2026._

Dacă generezi astăzi imagini din șabloane printr-un API, această pagină spune ce se schimbă dacă rulezi singur acea producție: pe propriul dispozitiv, în CI sau pe un server controlat de tine. [Mută-te de la un API de randare găzduit](/info/work-move-from-render-api.html) este ghidul practic.

## Ce fac mai bine API-urile de randare găzduite

[Bannerbear](https://www.bannerbear.com/) și [Placid](https://placid.app/) sunt servicii administrate, iar acesta este un avantaj real. Trimiți o cerere, iar altcineva rulează serverele, le ține pornite și se ocupă de sarcină.

- **Nimic de operat.** Fără server, bază de date, stocare, actualizări sau planificare de capacitate.
- **Un editor de șabloane găzduit** cu șabloane gata de adaptat.
- **Mai multe tipuri de ieșire dintr-un singur API.** Ambele publică endpointuri pentru video și PDF, iar Bannerbear documentează și ieșire animată, WebP și AVIF, capturi de ecran și eliminarea fundalului cu AI.
- **Propriile integrări și suport.**

Dacă acesta este aranjamentul pe care îl vrei, acele servicii sunt o alegere bună.

## Ce îți oferă găzduirea proprie

- **Conținutul tău rămâne pe sistemele tale.** Intrările, resursele și ieșirile se află pe infrastructura aleasă de tine. Randarea pe un dispozitiv sau în CI nu necesită niciun serviciu.
- **Regulile stau în instrument.** Culorile, fonturile, logourile și intrările blocate vin din [sistemul tău de design](/info/brand-studio.html), deci cel care apelează poate schimba doar ce permiți. [Lolly Work](/info/compare.html#what-runs-where) aplică vizibilitatea instrumentelor și politicile de intrare fiecărei cereri.
- **Același instrument peste tot.** Un instrument randează pe un laptop, într-un job CI sau pe un server din aceleași intrări, iar oamenii pot edita același instrument în aplicație.
- **Înregistrări pe care le deții.** [Chitanțe de randare](/info/work-renders.html#evidence-and-identity), o urmă de audit și Content Credentials unde configurezi o identitate de semnare.
- **Open source și fără contor.** Rulezi codul, iar ce plătești este propria infrastructură.

Preiei munca pe care o fac acele servicii pentru tine. Un server durabil are nevoie de o bază de date persistentă și de stocare pentru ieșiri, iar instrumentele care au nevoie de un browser au nevoie de workerul Chromium. [Instalează Lolly Work](/info/work-install.html) le descrie pe ambele.

## Cum se aliniază sarcinile

| Sarcină | API de randare găzduit | Lolly |
|---|---|---|
| Completarea unui șablon din date | Cerere API care numește un șablon și straturile lui | [URL](/info/url-mode.html), [CLI](/info/cli.html) sau [API de server](/info/work-automation-api.html) care numește un instrument și intrările lui |
| Multe fișiere dintr-un tabel | Loturi și colecții | [Batch](/info/batch.html) pe dispozitivul tău sau [loturi de randare](/info/work-renders.html#batches-with-durable-rows) pe un server |
| Așteptarea sau interogarea unui rezultat | Interogare periodică sau o opțiune sincronă | Randări durabile pe care le interoghezi sau o randare imediată |
| Apelarea unui webhook la final | Da | [Apeluri inverse semnate](/info/work-renders.html) către origini pe care le permiți |
| URL de imagine dinamică | Da | [Linkuri de partajare și URL-uri `/render`](/info/url-mode.html) |
| Editarea unui șablon | Editor găzduit | [Design](/info/using.html), pe dispozitivul tău |
| Agenți | Ambele publică un server MCP | [MCP](/info/mcp.html), cu un endpoint al organizației sub politica unui token pe Lolly Work |

Tipurile de ieșire proprii ale Lolly sunt listate în [Exportare](/info/exporting.html). Pe un server Work astăzi, randările durabile fac SVG, PNG, JPG și PDF, iar [video rămâne pe dispozitiv, în CLI și în MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Ce se transferă și ce nu

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Cererile tale | API-ul de migrare al Work are aceeași formă | La fel | La fel |
| Șabloanele tale | **Import** ca documente editabile, cu excepția tipurilor de strat fără schemă confirmată | Doar numele câmpurilor și o previzualizare. Reconstruiește fiecare șablon | Doar numele câmpurilor și o previzualizare. Reconstruiește fiecare șablon |
| URL-uri dinamice existente | Neacceptate | Neacceptate | URL-urile semnate continuă să funcționeze după o schimbare de gazdă, cu vechiul tău token privat |
| Webhookuri | Webhookurile înregistrate nu sunt acceptate | `webhook_url` funcționează | `webhook_success` funcționează |
| Ieșire WebP și AVIF | Refuzată pe nume | Neoferită | WebP refuzat pe nume |
| Animații, videoclipuri, colecții, capturi de ecran | Nu sunt în API-ul de migrare | Nu sunt în API-ul de migrare | Nu sunt în API-ul de migrare |

Tot ce este aici a fost construit din documentația publică a fiecărui furnizor și nu a fost rulat pe un cont real. [Ghidul de mutare](/info/work-move-from-render-api.html#check-it-on-your-own-account) are o listă scurtă de verificare dacă ai unul.

Mutarea nu este totul sau nimic. Poți muta un singur șablon și le poți păstra pe celelalte unde sunt, iar [părăsirea Lolly](/info/work-move-from-render-api.html#leave-lolly-too) rămâne la fel de deschisă: instrumentele sunt fișiere simple, iar CLI le randează fără server.

## Cine rulează serviciul

Cu Lolly, o persoană randează local sau o echipă rulează Lolly Work pe propria infrastructură. Trimiterea unui job pe server trimite intrările și resursele necesare la acea instanță, ceea ce diferă de calea pe dispozitiv.

Bannerbear și Placid sunt mărci comerciale ale proprietarilor lor. Această pagină descrie unde se suprapun produsele, din documentația lor publică, și nu este afiliată cu niciuna.
