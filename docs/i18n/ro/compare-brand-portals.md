# Lolly și portalurile de brand

_Ultima verificare: 28 septembrie 2026._

Lolly și [lolly.work](https://lolly.work) împreună acoperă fluxurile de creare și guvernanță pentru care echipele folosesc portaluri de brand: active aprobate, șabloane blocate, control al accesului, revizuire și distribuție. Compară această soluție combinată cu Bynder, Frontify, Marq sau Brandfolder când alegi cum găsesc oamenii activele de brand și cum creează altele noi.

## Creare și servicii de organizație

Motorul și aplicațiile Lolly produc fișierele. Șabloanele, design tokenii și intrările permise definesc ce poate schimba cineva, iar randarea poate rămâne pe dispozitivul său. Lolly de sine stătător nu cere cont.

lolly.work este serviciul de organizație din același proiect, întreținut într-un [depozit separat](https://github.com/lolly-tools/lolly-work) și implementat alături de Lolly. Adaugă identitate, stocare partajată, politici, aprobări și raportare. Ambele părți sunt open source sub MPL-2.0. Separarea permite unei persoane să folosească Lolly independent, iar unei organizații să ruleze soluția combinată pe o infrastructură pe care o controlează.

## Ce oferă soluția combinată

| Nevoie | Lolly + lolly.work |
|---|---|
| Autentificare și provizionare | Autentificare unică (SSO) prin OIDC, mai mulți furnizori de identitate, provizionare de utilizatori și apartenență la grupuri prin SCIM 2.0, și dezactivarea conturilor, care revocă sesiunile existente. Un furnizor de identitate doar SAML se poate conecta printr-o punte OIDC, precum Keycloak. |
| Șabloane aprobate | Lolly definește intrările editabile ale șablonului; lolly.work aplică vizibilitatea pe grupuri și politicile de intrare care blochează valori, restrâng opțiuni sau ascund controale. |
| Bibliotecă de active partajată | Încărcări aparținând instanței, colecții, metadate personalizate și cataloage cu acces controlat, plus conectori care citesc biblioteci DAM și de stocare existente. |
| Revizuire | Pași de aprobare ordonați, grupuri de aprobatori eligibili, reguli de cvorum și separarea atribuțiilor; revizuirea poate guverna trimiterile în catalog și livrarea către destinațiile organizației. |
| Istoricul și disponibilitatea activelor | Versiuni și rollback pentru activele aparținând instanței, retenție și blocări legale, disponibilitate programată, expirare și revocare. Furnizorii conectați își păstrează propriul istoric sursă. |
| Raportare | Numărători de utilizare și descărcare a activelor, activitate a instrumentelor și a exporturilor, tablouri de bord și o urmă de audit. Atribuirea utilizării urmează politica de telemetrie a implementării; setarea implicită de atribuire necesită consimțământ. |
| Distribuție | Linkuri cu expirare și revocabile, colecții partajate, acces pentru invitați și livrare către destinațiile configurate ale organizației. |

[Ghidurile operatorului lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) descriu aceste funcții și configurarea lor. Sunt capacități disponibile, nu funcții care cer construirea unui alt sistem în jurul Lolly.

## Alegerea unui flux de portal

Portalurile consacrate oferă găzduire gestionată, suport și fluxuri DAM ample. De exemplu, [DAM-ul enterprise Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combină descoperirea activelor, controalele de acces, fluxurile de aprobare și distribuția. Compară exact fluxul de revizuire și de drepturi de care ai nevoie: Lolly oferă controale de metadate, acces și disponibilitate, dar clearance-ul juridic și obligațiile de licențiere necesită în continuare procesul unei organizații. Lanțurile sale de aprobare sunt secvențiale; nu modelează fluxuri de lucru cu ramificații arbitrare.

Stiva Lolly este mai tânără, iar [pagina de stare lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) consemnează limitele ei de implementare. În special, site-ul public lolly.work este un sandbox de evaluare. O implementare durabilă într-o organizație are nevoie de stocare persistentă și de un operator. Nu există taxă de licență software per utilizator pentru autogăzduire; infrastructura și administrarea costă totuși bani.

Un DAM existent poate rămâne și sursa de adevăr. Conectorii de catalog ai lolly.work pun activele sale aprobate la dispoziția Lolly, unde oamenii creează fișiere noi după regulile organizației. Aceasta este o alegere de integrare; biblioteca și aprobările proprii ale Lolly sunt disponibile atunci când organizația vrea să gestioneze singură aceste fluxuri.

Vezi [Cum se compară Lolly](/info/positioning.html) pentru comparația de capacități și [Lolly comparat, instrument cu instrument](/info/compare.html) pentru restul acestui set. Numele furnizorilor identifică produsele comparate; Lolly nu este afiliat cu acestea.
