# Lolly și API-urile de randare

_Ultima verificare: 5 noiembrie 2026._

Dacă generezi imagini din șabloane printr-un API, această pagină spune ce se schimbă când rulezi acea producție pe propriul dispozitiv, în CI sau pe un server pe care îl controlezi. [Migrează de la un API de randare găzduit](/info/work-move-from-render-api.html) oferă pașii.

<!--i:eti-award-->
## Ce fac mai bine API-urile de randare găzduite

[Bannerbear](https://www.bannerbear.com/) și [Placid](https://placid.app/) sunt servicii administrate: trimiți o cerere și altcineva operează serverele.

- **Nimic de operat.** Niciun server, nicio bază de date, stocare, actualizare sau planificare a capacității.
- **Un editor de șabloane găzduit** cu șabloane gata de adaptat.
- **Mai multe tipuri de rezultate dintr-un singur API.** Ambele publică endpointuri pentru video și PDF, iar Bannerbear documentează și rezultate animate, WebP și AVIF, capturi de ecran și eliminarea fundalului cu AI.
- **Integrări și asistență proprii.**

Dacă acesta este modul de lucru pe care îl vrei, acele servicii sunt o alegere bună.

<!--i:eti-home-->
## Ce îți oferă găzduirea pe infrastructura proprie

- **Conținutul tău rămâne pe sistemele tale.** Intrările, resursele și rezultatele se află pe infrastructura pe care ai ales-o. Randarea pe un dispozitiv sau în CI nu are nevoie de niciun serviciu.
- **Regulile se află în instrument.** Culorile, tipografia, logourile și intrările blocate provin din [sistemul tău de design](/info/brand-studio.html), astfel încât cine apelează poate schimba doar ce permiți. [Lolly Work](/info/compare.html#what-runs-where) aplică vizibilitatea instrumentelor și politicile pentru intrări fiecărei cereri.
- **Același instrument peste tot.** Un instrument randează din aceleași intrări pe un laptop, într-o sarcină CI sau pe un server. Oamenii pot edita același instrument în aplicație.
- **Înregistrări pe care le deții.** [Confirmări de randare](/info/work-renders.html#evidence-and-identity), un istoric de audit și Content Credentials acolo unde configurezi o identitate de semnare.
- **Open-source și fără taxare în funcție de utilizare.** Rulezi codul și plătești doar pentru propria infrastructură.

Preiei munca pe care acele servicii o fac pentru tine. Un server pentru utilizare de durată are nevoie de o bază de date persistentă și de stocare pentru rezultate. Instrumentele care au nevoie de un browser au nevoie de procesul de lucru Chromium. [Instalează Lolly Work](/info/work-install.html) le descrie pe ambele.

<!--i:eti-table-->
## Cum se compară sarcinile

| Sarcină | API de randare găzduit | Lolly |
|---|---|---|
| Completează un șablon din date | Cerere API care specifică un șablon și straturile lui | [URL](/info/url-mode.html), [CLI](/info/cli.html) sau [API de server](/info/work-automation-api.html) care specifică un instrument și intrările lui |
| Multe fișiere dintr-un tabel | Loturi și colecții | [Loturi](/info/batch.html) pe dispozitivul tău sau [loturi de randare](/info/work-renders.html#batches-with-durable-rows) pe un server |
| Așteaptă sau verifică periodic rezultatul | Verificare periodică sau o opțiune sincronă | Randări persistente pe care le verifici periodic sau o randare imediată |
| Apelează un webhook la finalizare | Da | [Apeluri de revenire semnate](/info/work-renders.html) către originile pe care le permiți |
| URL de imagine dinamică | Da | [Linkuri de partajare și URL-uri `/render`](/info/url-mode.html) |
| Editează un șablon | Editor găzduit | [Design](/info/using.html), pe dispozitivul tău |
| Agenți | Ambele publică un server MCP | [MCP](/info/mcp.html), cu un endpoint de organizație supus politicii unui token în Lolly Work |

Tipurile de rezultate proprii Lolly sunt listate în [Export](/info/exporting.html). Pe un server Work, randările persistente creează în prezent SVG, PNG, JPG și PDF, iar [video rămâne pe dispozitiv, în CLI și în MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Ce se transferă și ce nu

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Cererile tale | API-ul de migrare Work acceptă aceeași structură | La fel | La fel |
| Șabloanele tale | **Import** ca documente editabile, cu excepția tipurilor de straturi fără o schemă confirmată | Doar numele câmpurilor și o previzualizare. Reconstruiește-le pe fiecare | Doar numele câmpurilor și o previzualizare. Reconstruiește-le pe fiecare |
| URL-uri dinamice existente | Nu sunt acceptate | Nu sunt acceptate | URL-urile semnate continuă să funcționeze după schimbarea gazdei, cu vechiul tău token privat |
| Webhookuri | Webhookurile înregistrate nu sunt acceptate | `webhook_url` funcționează | `webhook_success` funcționează |
| Rezultate WebP și AVIF | Refuzate explicit după nume | Nu sunt oferite | WebP refuzat explicit după nume |
| Animații, videoclipuri, colecții, capturi de ecran | Nu prin API-ul de migrare | Nu prin API-ul de migrare | Nu prin API-ul de migrare |

::: note Construit pe baza documentației publice
Acest mecanism a fost construit pe baza documentației publice a fiecărui furnizor și nu a fost rulat pe un cont real. Dacă ai un cont, [ghidul de migrare](/info/work-move-from-render-api.html#check-it-on-your-own-account) are o scurtă listă de verificări.
:::

Poți muta un șablon și păstra restul unde sunt. [Plecarea de la Lolly](/info/work-move-from-render-api.html#leave-lolly-too) este la fel de deschisă: instrumentele sunt fișiere simple, iar CLI le randează fără server.

<!--i:eti-building-->
## Cine operează serviciul

Cu Lolly, o persoană randează local sau o echipă rulează Lolly Work pe propria infrastructură. O sarcină de server își trimite intrările și resursele necesare la acea instanță. Calea de pe dispozitiv nu face asta.

Bannerbear și Placid sunt mărci comerciale ale deținătorilor lor. Această pagină descrie unde se suprapun produsele, pe baza documentației lor publice, și nu este afiliată cu niciunul dintre ele.
