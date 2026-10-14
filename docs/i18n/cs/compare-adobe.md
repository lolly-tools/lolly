# Lolly a Adobe

_Naposledy ověřeno: 28. září 2026._

Lolly zvládá úpravy a převody obrázků, layout, opakovatelnou brandovou produkci, tiskový výstup a Content Credentials. [lolly.work](https://lolly.work) k tomuto kreativnímu workflow přidává identitu organizace, sdílené materiály, schvalování a automatizovanou serverovou produkci.

## Kde se překrývají

Obě řešení podporují práci jako změna velikosti obrázků, skládání layoutů a export do profesionálních formátů. Lolly podporuje PDF/X, CMYK a rastrový výstup s vysokou bitovou hloubkou, s [možnostmi specifickými pro formáty](/info/formats.html). Její utility na zařízení převádějí a čistí soubory bez jejich nahrávání.

Specializované aplikace Adobe pokrývají rozsáhlé kreativní workflow. [Photoshop](https://www.adobe.com/products/photoshop.html) například nabízí podrobné nástroje pro úpravu fotografií, výběry, maskování a kompozici. Porovnej úpravy, které tvá práce vyžaduje, s nástroji Lolly; opakující se brandový materiál a složitá retuš mohou mít odlišné požadavky.

## Tvorba a organizační služby

Samostatná Lolly běží bez účtu Adobe i bez účtu Lolly a používá stejný engine v prohlížeči, desktopové aplikaci i CLI. Šablony a design tokeny činí výstupy opakovatelnými a [Share with rules](/info/create-a-tool.html) promění design v nástroj, který mohou vyplňovat ostatní.

lolly.work je samostatná služba v rámci projektu Lolly, open source pod MPL-2.0 stejně jako kreativní aplikace. Poskytuje SSO, SCIM, sdílené katalogy a projekty, schvalování, zásady přístupu, auditní záznamy a serverové renderování. Organizace může obě části provozovat sama a připojit stávající knihovny materiálů. Lokální tvorba zůstává na zařízení; sdílená práce a serverové úlohy využívají nakonfigurované služby.

## Content Credentials a identita

Lolly umí podepisovat podporované exporty přímo na zařízení, přičemž Content Credentials zapíná uživatel. Klíč vygenerovaný na zařízení dokládá integritu podpisu souboru; ověřovatel však musí podepisujícímu důvěřovat, než zobrazí ověřenou identitu. Organizace může používat vlastní certifikační autoritu a její kořenový certifikát distribuovat svým ověřovatelům. lolly.work podporuje také serverové podepisování pomocí nakonfigurovaného certifikátu a klíče organizace.

V rámci řešení Lolly je tak k dispozici osobní i organizační podepisování. Viz [Content Credentials Identity](/info/content-credentials-identity.html), [průvodce podepisováním v lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) a [přehled kombinovaného řešení](/info/compare.html). Transformační utility na zařízení nepřidávají vodoznaky Lolly ani metadata o původu.

Adobe, Photoshop a Creative Cloud jsou ochranné známky společnosti Adobe. Tato stránka popisuje, kde se řešení překrývají, a není nijak spojena se společností Adobe.
