# Lolly at mga brand portal

_Huling sinuri: 28 Setyembre 2026._

Kung iniingatan ng organisasyon mo ang mga aprubadong asset nito sa Bynder, Frontify, Marq o Brandfolder, inihahambing ng pahinang ito iyon sa Lolly kasama ang Lolly Work: kung paano nakakahanap ang mga tao ng brand asset, at kung paano sila gumagawa ng bagong file mula sa mga iyon.

## Ang mas mahusay na ginagawa ng itinatag na portal

Ang mga itinatag na portal ay nag-aalok ng managed hosting, suporta at malawak na asset-management workflow. Halimbawa, pinagsasama ng [enterprise DAM ng Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) ang asset discovery, access control, approval workflow at distribution. Mas bata ang Lolly stack at sunud-sunod ang mga approval chain nito sa halip na arbitraryong branching workflow. Itinatala ng [Work status at roadmap](/info/work-status.html) ang mga limitasyon ng deployment nito.

## Kung saan sila nagtatagpo

Parehong sinasaklaw ang mga aprubadong asset, naka-lock na template, access control, review at distribution. Ang Lolly ang gumagawa ng mga file: tinutukoy ng mga template, design token at pinapayagang input kung ano ang puwedeng baguhin ng tao, at puwedeng manatili ang rendering sa device nila. Nagdaragdag ang Lolly Work ng identity, shared storage, policy, approval at pag-uulat sa infrastructure na kontrolado ng organisasyon.

![Ang aktibong design system sa Settings, ipinapakita bilang cover at mga pahina: ang mga kulay, type at logo na ginagamit ng bawat tool sa pagguhit](/info/shots/dashboard-brand.svg)

## Ang ibinibigay ng Lolly at Lolly Work

| Pangangailangan | Lolly + Lolly Work |
|---|---|
| Sign-in at provisioning | OIDC single sign-on, maraming identity provider, SCIM 2.0 user provisioning at group membership, at pag-disable ng account na nagbabawi ng mga umiiral na session. Ang SAML-only na identity provider ay maaaring kumonekta sa pamamagitan ng OIDC bridge tulad ng Keycloak. |
| Mga aprubadong template | Dinedefine ng Lolly ang mga mae-edit na input ng template; naglalapat ang Lolly Work ng group visibility at input policy na nagla-lock ng mga value, naglilimita ng mga pagpipilian o nagtatago ng mga kontrol. |
| Shared na asset library | Mga upload na pag-aari ng instance, collection, custom metadata at mga catalogue na may access control, kasama ang mga connector na nagbabasa ng umiiral na DAM at storage library. |
| Review | Mga ordered na hakbang sa pag-apruba, karapat-dapat na approver group, quorum rule at paghihiwalay ng tungkulin; ang review ay maaaring mamahala sa mga catalogue submission at delivery sa mga target ng organisasyon. |
| History at availability ng asset | Mga bersyon at rollback para sa mga asset na pag-aari ng instance, retention at hold, nakaiskedyul na availability, expiry at revocation. Ang mga konektadong provider ay nag-iingat ng sarili nilang source history. |
| Mga lisensya at credit | Itinatala ng Lolly ang lisensya ng bawat source na ginagamit ng file at inihahanda ang mga credit na utang nito; ipinapaliwanag ng [Creative rights at mga credit](/info/creative-rights.html) kung ano ang itinatala nito at saan isinusulat ang mga credit. Hindi nito nililinis ang mga karapatan. |
| Pag-uulat | Mga bilang ng paggamit at download ng asset, aktibidad ng tool at export, mga dashboard at audit trail. Sinusunod ng usage attribution ang telemetry policy ng deployment; ang default na attribution setting ay nangangailangan ng pahintulot. |
| Distribution | Mga link na nag-e-expire at mababawi, shared collection, guest access at delivery sa mga naka-configure na destinasyon ng organisasyon. |

Inilalarawan ng [Catalog at nilalaman](/info/work-catalog.html), [Mga approval](/info/work-approvals.html) at [Policy at governance](/info/work-governance.html) ang mga feature na ito at ang configuration nila.

## Pag-iingat ng umiiral mong portal

Ang umiiral na DAM ay maaaring manatiling source of truth. Ang mga catalogue connector ng Lolly Work ay ginagawang available sa Lolly ang mga aprubadong asset nito, kung saan gumagawa ang mga tao ng bagong file sa ilalim ng mga patakaran ng organisasyon. Pagpili iyon sa integrasyon; nandiyan ang sariling library at approval ng Lolly kapag gusto ng organisasyon na patakbuhin ang mga iyon mismo. Inililista ng [Ano ang tumatakbo saan](/info/compare.html#what-runs-where) ang mga limitasyong pinagsasaluhan ng bawat paghahambing.

Tingnan ang [Paano naghahambing ang Lolly](/info/positioning.html) para sa paghahambing ng kakayahan. Ang mga pangalan ng vendor ay kumikilala sa mga produktong inihahambing; hindi kaugnay ng mga ito ang Lolly.
