# Lolly și Figma

_Ultima verificare: 28 septembrie 2026._

Lolly susține design, editare în timp real și producție de active reutilizabile. [lolly.work](https://lolly.work) adaugă serviciile de organizație din jurul acestei munci: identitate, proiecte partajate, controale de acces și aprobări.

## Unde se suprapun

Ambele permit aranjarea textului, a formelor și a imaginilor pe un canvas și lucrul cu alte persoane. [Import a design](/info/design-import.html) din Lolly citește fișierele Figma ca layouturi editabile. Figma acoperă și producția de brand pe bază de șabloane: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) creează active din șabloane și le completează din fișiere CSV sau XLSX.

Lolly transformă un design într-un [instrument reutilizabil cu reguli](/info/create-a-tool.html). Acel instrument rulează în browser sau în CLI și acceptă intrări dintr-un URL, dintr-un script sau din grila de loturi. Același șablon servește atât o persoană care editează un activ, cât și o echipă care produce multe variante.

## Colaborare și design de produs

[Figma Design](https://www.figma.com/design/) reunește design de interfețe, componente, prototipuri interactive și predare către dezvoltatori. Fluxul său consacrat de design de produs și ecosistemul său sunt relevante atunci când o echipă trebuie să proiecteze și să specifice o aplicație completă.

Lolly oferă două tipuri de colaborare în timp real. Un [collab privat](/info/collaborate.html) împerechează direct două dispozitive, fără cont și fără internet într-o rețea comună. Un collab de lucru folosește lolly.work pentru acces autentificat, editări partajate, cursoare în timp real și sesiuni de echipă salvate. Colaborarea de lucru este implementată atât în clientul Lolly, cât și în serverul lolly.work; implementarea sa actuală pe un singur nod nu stabilește paritate cu scara de operare a Figma.

## Implementare și producție

Aplicațiile creative Lolly și lolly.work sunt părți implementate separat ale aceluiași proiect open source. Lolly de sine stătător poate randa offline, fără cont. lolly.work oferă SSO, SCIM, cataloage partajate, permisiuni de proiect, aprobări, jurnale de audit și randare pe server, pe o infrastructură controlată de organizație.

Sesiunile de echipă și editările din collaburile de lucru ajung la acea instanță; randările locale pot rămâne pe dispozitiv. Content Credentials sunt opționale pentru exporturile compatibile, iar semnarea pe server folosește o identitate de organizație configurată. Vezi [prezentarea generală a soluției combinate](/info/compare.html) pentru separare și [Content Credentials Identity](/info/content-credentials-identity.html) pentru modul în care un verificator ajunge să aibă încredere în semnatar.

Figma este o marcă comercială a proprietarului său. Această pagină descrie unde se suprapun cele două soluții și nu este afiliată cu Figma.
