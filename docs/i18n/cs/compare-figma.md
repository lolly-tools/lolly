# Lolly a Figma

_Naposledy ověřeno: 28. září 2026._

Lolly podporuje design, živé úpravy a opakovatelnou produkci materiálů. [lolly.work](https://lolly.work) k této práci přidává organizační služby: identitu, sdílené projekty, řízení přístupu a schvalování.

## Kde se překrývají

Obě řešení umožňují rozmístit na plátně text, tvary a obrázky a pracovat s dalšími lidmi. Funkce Lolly [Import a design](/info/design-import.html) čte soubory Figma jako upravitelné layouty. Figma pokrývá i brandovou produkci založenou na šablonách: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) vytváří materiály ze šablon a plní je ze souborů CSV nebo XLSX.

Lolly promění design v [opakovaně použitelný nástroj s pravidly](/info/create-a-tool.html). Tento nástroj běží v prohlížeči nebo CLI a přijímá vstupy z URL, skriptu nebo dávkové mřížky. Stejná šablona slouží jednotlivci upravujícímu jeden materiál i týmu vytvářejícímu mnoho variant.

## Spolupráce a produktový design

[Figma Design](https://www.figma.com/design/) spojuje návrh rozhraní, komponenty, interaktivní prototypy a předání vývojářům. Její zavedené workflow produktového designu a ekosystém jsou relevantní, když tým potřebuje navrhnout a specifikovat kompletní aplikaci.

Lolly nabízí dva druhy živé spolupráce. [Soukromý collab](/info/collaborate.html) přímo spáruje dvě zařízení, bez účtu a bez nutnosti internetu ve sdílené síti. Pracovní collab využívá lolly.work pro ověřený přístup, sdílené úpravy, živé kurzory a uložené týmové relace. Spolupráce v rámci práce je implementována v klientovi Lolly i na serveru lolly.work; její současné nasazení na jednom uzlu neprokazuje paritu s provozním rozsahem Figmy.

## Nasazení a produkce

Kreativní aplikace Lolly a lolly.work jsou samostatně nasazované části téhož open source projektu. Samostatná Lolly dokáže renderovat offline bez účtu. lolly.work poskytuje SSO, SCIM, sdílené katalogy, oprávnění k projektům, schvalování, auditní záznamy a serverové renderování na infrastruktuře, kterou organizace kontroluje.

Týmové relace a úpravy pracovních collabů se dostávají na tuto instanci; lokální rendery mohou zůstat na zařízení. Content Credentials jsou u podporovaných exportů volitelné a serverové podepisování používá nakonfigurovanou identitu organizace. Oddělení vysvětluje [přehled kombinovaného řešení](/info/compare.html) a to, jak ověřovatel důvěřuje podepisujícímu, popisuje [Content Credentials Identity](/info/content-credentials-identity.html).

Figma je ochranná známka svého vlastníka. Tato stránka popisuje, kde se obě řešení překrývají, a není nijak spojena se společností Figma.
