# Lolly comparat, instrument cu instrument

Dacă folosești deja alt produs, aceste pagini spun dacă Lolly înlocuiește acel produs, funcționează alături de el sau nu se potrivește muncii tale. Fiecare începe cu ce face mai bine celălalt produs.

_Ultima verificare: 28 septembrie 2026._

## Compară pe produs

- [Lolly și Canva](/info/compare-canva.html) - șabloane, design de zi cu zi și producție de brand comună.
- [Lolly și Adobe](/info/compare-adobe.html) - editare, conversie, ieșire profesională și Content Credentials.
- [Lolly și Figma](/info/compare-figma.html) - design, colaborare live și producție reutilizabilă de resurse.
- [Lolly și Penpot](/info/compare-penpot.html) - design open source, tokenuri comune și munca organizației.
- [Lolly și portalurile de brand](/info/compare-brand-portals.html) - biblioteci aprobate, șabloane blocate, identitate, revizuire și raportare.
- [Lolly și API-urile de randare](/info/compare-render-apis.html) - generare automată pe dispozitivul tău, în CI sau pe un server Lolly Work.
- [Lolly și convertoarele de fișiere online](/info/compare-converters.html) - conversia formatelor pe propriul dispozitiv.

Pentru vederea capacitate cu capacitate, vezi [Cum se compară Lolly](/info/positioning.html). Fiecare comparație are dată; o afirmație care nu mai corespunde unuia dintre produse trebuie corectată.

## Ce rulează unde

Fiecare comparație acoperă două părți ale unui singur proiect open source. **Lolly** este motorul, aplicațiile și instrumentele. **Lolly Work** este serverul organizației, întreținut în [depozitul lolly-work](https://github.com/lolly-tools/lolly-work). Ambele sunt MPL-2.0, iar o organizație decide ce servicii Lolly Work pornește.

::: cols
## Pe dispozitivul tău: Lolly

- Fără cont pentru folosirea de sine stătătoare
- Creare, editare, conversie și export
- Funcționează offline după ce instrumentele și resursele necesare sunt salvate
- Content Credentials semnate pe dispozitiv
- Collab-uri private între două dispozitive, fără server

## Pe serverul organizației tale: Lolly Work

- Single sign-on, provizionare SCIM, roluri și politici
- Cataloage comune, proiecte de echipă și work collab-uri
- Aprobări, raportare de utilizare și înregistrări de audit
- Randare pe server, joburi recuperabile și livrare aprobată
- Semnare pe server cu identitatea organizației
:::

Folosirea de sine stătătoare păstrează fișierele pe dispozitiv. Alegerea proiectelor comune, a unui work collab, a unei randări pe server sau a livrării trimite datele de care are nevoie acea funcție la serverul organizației tale.

## Ce presupune fiecare comparație

Aceste limite se aplică fiecărei pagini din acest set, deci sunt enunțate o singură dată aici:

- **Work collab-urile rulează astăzi pe un singur nod de server.** Scala și istoricul lor de operare diferă de produsele găzduite consacrate. [Starea și harta Work](/info/work-status.html) înregistrează limitele curente.
- **Site-ul de la [lolly.work](https://lolly.work) este un sandbox demo.** O instalare durabilă a unei organizații are nevoie de stocare persistentă și de un operator; [Instalează Lolly Work](/info/work-install.html) le acoperă pe amândouă.
- **Nu există taxă de licență software per loc** pentru Lolly sau un Lolly Work găzduit propriu. Găzduirea, stocarea și operarea costă totuși bani.
- **O semnătură nu este un semnatar de încredere.** Un verificator trebuie să aibă încredere în certificatul care a semnat un fișier înainte să arate semnatarul ca de încredere; [Identitate Content Credentials](/info/content-credentials-identity.html) explică cum.
