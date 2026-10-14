# Lolly și API-urile de randare

_Ultima verificare: 28 septembrie 2026._

Lolly generează active din șabloane și date pe dispozitivul tău, în CI sau prin API-ul de server al [lolly.work](https://lolly.work). Soluția combinată acoperă randarea automată, precum și identitatea, politicile și livrarea din jurul joburilor de producție ale unei organizații.

## Unde se suprapun

[Bannerbear](https://www.bannerbear.com/) și [Placid](https://placid.app/) generează imagini și alte media din șabloane prin API-uri și integrări. Lolly folosește aceeași abordare de șablon plus intrări, cu [modul URL](/info/url-mode.html), [CLI](/info/cli.html), o grilă de loturi și endpointuri de server ca modalități de a trimite munca.

## Ce oferă lolly.work

lolly.work este serviciul de organizație implementat separat din proiectul Lolly. Rulează motorul Lolly în spatele unui API, aplică politici de vizibilitate a instrumentelor și de intrare și servește fișiere randate și linkuri de partajare semnate. [Serviciul său de randare recuperabil](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) acceptă joburi individuale și loturi, trimitere idempotentă, stare, reîncercări limitate, anulare și păstrarea ieșirilor. Munca întreruptă poate fi reluată după repornirea serverului atunci când este configurată stocarea persistentă.

Serverul folosește o cale rapidă de randare SVG/PNG și un worker Chromium opțional pentru instrumentele care au nevoie de un browser. Automatizarea se autentifică cu tokeni de serviciu, iar ieșirea finalizată poate fi trimisă prin [livrare guvernată](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) către destinațiile organizației. O identitate de semnare configurată activează semnarea C2PA pentru ieșirea compatibilă de pe server.

## Cine rulează serviciul

Bannerbear și Placid oferă randarea ca servicii gestionate, cu infrastructură și integrări proprii. Cu Lolly, o persoană poate randa local sau o echipă poate opera lolly.work pe propria infrastructură. Ambele depozite Lolly sunt open source sub MPL-2.0; autogăzduirea nu are taxă de licență software per randare, însă calculul, stocarea și operarea rămân costuri de planificat.

Site-ul public lolly.work este un sandbox de evaluare, nu un angajament de găzduire în producție. Un serviciu durabil are nevoie de bază de date și de stocare a ieșirilor persistente; instrumentele dependente de browser au nevoie de workerul Chromium. [Ghidul de instalare](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) și [pagina de stare](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) descriu aceste cerințe și limitele actuale.

Randarea locală și din CI rămâne disponibilă fără serviciul de organizație. Trimiterea unui job pe server transmite intrările sale și activele necesare către acea instanță; aceasta este distinct de calea de pe dispozitiv. Vezi [prezentarea generală a soluției combinate](/info/compare.html).

Bannerbear și Placid sunt mărci comerciale ale proprietarilor lor. Această pagină descrie unde se suprapun soluțiile și nu este afiliată cu niciuna dintre ele.
