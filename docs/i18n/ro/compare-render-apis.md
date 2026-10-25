# Lolly și API-urile de randare

_Ultima verificare: 28 septembrie 2026._

Dacă generezi astăzi imagini din șabloane printr-o API, această pagină spune cum face Lolly aceeași sarcină pe propriul tău dispozitiv, în CI sau pe propriul tău server.

## Ce fac mai bine API-urile de randare găzduite

[Bannerbear](https://www.bannerbear.com/) și [Placid](https://placid.app/) împachetează randarea ca servicii administrate, cu propria infrastructură, integrări și suport. Trimiți o cerere, iar altcineva rulează serverele.

## Unde se suprapun

Ambele transformă un șablon plus intrări în media. Lolly își ia intrările dintr-un [link](/info/url-mode.html), [CLI](/info/cli.html), o grilă batch sau un endpoint de server.

## Cum face Lolly sarcina comună

Același instrument randează pe un laptop, într-un job CI sau pe un server, din aceleași intrări. Randarea locală și în CI nu necesită deloc un serviciu.

![Setările de export batch: numele fișierului, formatul implicit, unitățile, DPI și numărul de rânduri de randat](/info/shots/use-batch-toolbar.svg)

Pe un server, [Lolly Work](/info/compare.html#what-runs-where) rulează motorul Lolly în spatele unei API și aplică vizibilitatea instrumentelor și politicile de intrare. [Serviciul lui de randare recuperabil](/info/work-renders.html) acceptă joburi singulare și loturi, trimitere idempotentă, stare, reîncercări limitate, anulare și ieșiri păstrate, iar munca întreruptă reia după o repornire când este configurată stocare persistentă.

Serverul are o cale rapidă SVG și PNG și un worker Chromium opțional pentru instrumentele care au nevoie de un browser. Automatizarea se autentifică cu tokenuri de serviciu, ieșirea terminată poate trece prin [livrare aprobată](/info/work-delivery.html) către destinații ale organizației, iar o identitate de semnare configurată adaugă Content Credentials ieșirii acceptate.

## Cine rulează serviciul

Cu Lolly, o persoană randează local sau o echipă rulează Lolly Work pe propria infrastructură. Trimiterea unui job pe server trimite intrările și resursele necesare la acea instanță, ceea ce diferă de calea pe dispozitiv. Un serviciu durabil are nevoie de o bază de date persistentă și de stocare pentru ieșiri, iar instrumentele dependente de browser au nevoie de workerul Chromium; [Instalează Lolly Work](/info/work-install.html) descrie ambele.

Bannerbear și Placid sunt mărci comerciale ale proprietarilor lor. Această pagină descrie unde se suprapun produsele și nu este afiliată cu niciuna.
