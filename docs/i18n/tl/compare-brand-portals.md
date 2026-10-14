# Lolly at mga brand portal

_Huling sinuri: 28 Setyembre 2026._

Sama-samang sinasaklaw ng Lolly at [lolly.work](https://lolly.work) ang mga workflow sa paglikha at governance na ginagamitan ng mga team ng mga brand portal: mga aprubadong asset, naka-lock na template, access control, review at distribution. Ihambing ang pinagsamang solusyong iyon sa Bynder, Frontify, Marq o Brandfolder sa pagpili kung paano hahanapin ng mga tao ang mga brand asset at gagawa ng bago.

## Creation at mga organisation service

Ang engine at mga app ng Lolly ang gumagawa ng mga file. Ang mga template, design token at pinahihintulutang input ang tumutukoy kung ano ang maaaring baguhin ng isang tao, at maaaring manatili sa device nila ang rendering. Hindi nangangailangan ng account ang standalone na Lolly.

Ang lolly.work ang organisation service sa iisang proyekto, minementena sa isang [hiwalay na repository](https://github.com/lolly-tools/lolly-work) at dine-deploy kasama ng Lolly. Nagdaragdag ito ng identity, shared storage, policy, mga approval at reporting. Parehong open source sa ilalim ng MPL-2.0 ang dalawang bahagi. Dahil sa paghihiwalay, maaaring gamitin ng indibidwal ang Lolly nang mag-isa at mapapatakbo ng organisasyon ang pinagsamang solusyon sa imprastrakturang kontrolado nito.

## Ano ang ibinibigay ng pinagsamang solusyon

| Pangangailangan | Lolly + lolly.work |
|---|---|
| Sign-in at provisioning | OIDC single sign-on, maraming identity provider, SCIM 2.0 user provisioning at group membership, at pag-disable ng account na nagre-revoke sa mga umiiral na session. Maaaring kumonekta ang SAML-only na identity provider sa pamamagitan ng OIDC bridge tulad ng Keycloak. |
| Mga aprubadong template | Dine-define ng Lolly ang mga nae-edit na input ng template; naglalapat ang lolly.work ng group visibility at mga input policy na nagla-lock ng mga value, naglilimita ng mga pagpipilian o nagtatago ng mga control. |
| Shared na asset library | Mga upload na pag-aari ng instance, mga collection, custom metadata at mga catalogue na may access control, pati mga connector na nagbabasa ng mga umiiral na DAM at storage library. |
| Review | Mga magkakasunod na hakbang ng approval, mga karapat-dapat na approver group, mga quorum rule at paghihiwalay ng mga tungkulin; maaaring pamahalaan ng review ang mga catalogue submission at delivery sa mga target ng organisasyon. |
| Kasaysayan at availability ng asset | Mga bersyon at rollback para sa mga asset na pag-aari ng instance, retention at mga hold, naka-iskedyul na availability, expiry at revocation. Pinapanatili ng mga nakakonektang provider ang sarili nilang source history. |
| Reporting | Bilang ng paggamit at download ng asset, aktibidad ng tool at export, mga dashboard at audit trail. Sumusunod ang usage attribution sa telemetry policy ng deployment; nangangailangan ng consent ang default na attribution setting. |
| Distribution | Mga link na nag-e-expire at maaaring i-revoke, mga shared collection, guest access at delivery sa mga naka-configure na destinasyon ng organisasyon. |

Inilalarawan ng [mga operator guide ng lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) ang mga feature na ito at ang pag-configure ng mga ito. Mga available na capability ang mga ito, hindi mga feature na nangangailangan ng pagbuo ng ibang sistema sa paligid ng Lolly.

## Pagpili ng workflow ng portal

Nag-aalok ang mga matatag nang portal ng managed hosting, suporta at malawak na DAM workflow. Halimbawa, pinagsasama ng [enterprise DAM ng Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) ang asset discovery, access control, approval workflow at distribution. Ihambing ang eksaktong review at rights workflow na kailangan mo: nagbibigay ang Lolly ng metadata, access at availability control, habang kailangan pa rin ng proseso ng organisasyon para sa legal clearance at mga obligasyon sa lisensya. Magkakasunod ang mga approval chain nito; hindi nito minomodelo ang mga arbitraryong sumasanga na workflow.

Mas bata ang Lolly stack, at itinatala ng [status page ng lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) ang mga limitasyon sa deployment nito. Sa partikular, evaluation sandbox ang pampublikong site ng lolly.work. Ang pangmatagalang deployment ng organisasyon ay nangangailangan ng persistent storage at isang operator. Walang bayad sa software license kada seat para sa self-hosting; may gastos pa rin ang imprastraktura at administrasyon.

Maaari ring manatiling source of truth ang umiiral na DAM. Ginagawang available sa Lolly ng mga catalogue connector ng lolly.work ang mga aprubadong asset nito, kung saan gumagawa ang mga tao ng bagong file ayon sa mga patakaran ng organisasyon. Pagpili iyon sa integration; available ang sariling library at mga approval ng Lolly kapag gusto ng organisasyong pamahalaan ang mga workflow na iyon nang mag-isa.

Tingnan ang [Paano nakikipagkumpitensya ang Lolly](/info/positioning.html) para sa paghahambing ng mga capability at ang [Paghahambing ng Lolly, tool por tool](/info/compare.html) para sa iba pang bahagi ng set na ito. Tinutukoy ng mga pangalan ng vendor ang mga produktong inihahambing; hindi kaugnay ng mga ito ang Lolly.
