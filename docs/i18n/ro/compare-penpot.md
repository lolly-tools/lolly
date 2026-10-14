# Lolly și Penpot

_Ultima verificare: 28 septembrie 2026._

Lolly și Penpot oferă ambele instrumente de design open source, design tokeni partajați și colaborare în timp real. Lolly combină crearea pe dispozitiv cu [lolly.work](https://lolly.work), serviciul său de organizație implementat separat.

## Fundamente de design comune

[Design tokenii Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) folosesc formatul DTCG, pe care Lolly îl citește și el. Culorile, tipografia și alte valori de token pot fi partajate între cele două fluxuri de lucru. [Import a design](/info/design-import.html) din Lolly deschide un export `.penpot` ca layout editabil.

Pluginul Lolly Export pentru Penpot este întreținut de Lolly. Folosește motorul Lolly pentru Content Credentials C2PA opționale (opt-in), pe dispozitiv. Integritatea semnăturii și încrederea în semnatar sunt lucruri separate: un verificator are nevoie de o identitate în care are încredere, așa cum este descris în [Content Credentials Identity](/info/content-credentials-identity.html).

## Fluxuri de lucru de design și de echipă

[Penpot](https://penpot.app/) oferă design de interfețe, componente, layouturi flexibile, prototipuri interactive și inspecție pentru dezvoltatori. Are implementări găzduite și autogăzduite, cu [opțiuni de instalare Docker și Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Canvasul Design al Lolly creează active editabile și poate transforma un layout într-un [instrument cu reguli](/info/create-a-tool.html). Același instrument randează în browser, în aplicația desktop sau în CLI și poate genera variante pornind de la date. Pentru lucrul în echipă, Lolly are atât [collaburi private](/info/collaborate.html) directe între două dispozitive, cât și collaburi de lucru prin lolly.work, cu editări partajate, cursoare și sesiuni de echipă salvate.

## Cum diferă implementările

Lolly de sine stătător randează și semnează pe dispozitiv, fără cont sau server. lolly.work adaugă SSO, provizionare SCIM, cataloage și proiecte partajate, roluri, aprobări, jurnale de audit și randare pe server. Ambele depozite sunt open source sub MPL-2.0 și pot fi operate de organizație. Munca partajată folosește instanța configurată; crearea locală rămâne disponibilă independent.

Alegerea depinde de muncă: fluxul Penpot de design de interfețe și prototipare, producția repetabilă de active din Lolly sau o combinație care folosește tokeni partajați și designuri importate. Colaborarea de lucru din Lolly rulează în prezent pe un singur nod de server, iar [starea implementării](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) ar trebui să facă parte din evaluarea unei organizații.

Penpot este o marcă comercială a proprietarului său. Pluginul de mai sus aparține Lolly. Vezi [Cum se compară Lolly](/info/positioning.html) și [prezentarea generală a soluției combinate](/info/compare.html) pentru comparația mai largă.
