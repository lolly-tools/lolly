# Paghahambing ng Lolly, tool por tool

Kung gumagamit ka na ng ibang produkto, sinasabi ng mga pahinang ito kung pinapalitan ng Lolly ang produktong iyon, gumagana kasabay nito o hindi bagay sa gawa mo. Ang bawat isa ay nagsisimula sa kung ano ang mas mahusay na ginagawa ng ibang produkto.

_Huling sinuri: 28 Setyembre 2026._

## Ihambing ayon sa produkto

- [Lolly at Canva](/info/compare-canva.html) - mga template, pang-araw-araw na disenyo at shared na brand production.
- [Lolly at Adobe](/info/compare-adobe.html) - pag-edit, conversion, propesyonal na output at Content Credentials.
- [Lolly at Figma](/info/compare-figma.html) - disenyo, live na collaboration at magagamit muling asset production.
- [Lolly at Penpot](/info/compare-penpot.html) - open-source na disenyo, shared token at gawa ng organisasyon.
- [Lolly at mga brand portal](/info/compare-brand-portals.html) - aprubadong library, naka-lock na template, identity, review at pag-uulat.
- [Lolly at mga rendering API](/info/compare-render-apis.html) - automated na paggawa sa device mo, sa CI o sa Lolly Work server.
- [Lolly at mga online file converter](/info/compare-converters.html) - format conversion sa sarili mong device.

Para sa paghahambing kada capability, tingnan ang [Paano nakikipagkumpitensya ang Lolly](/info/positioning.html). May petsa ang bawat paghahambing; ang pahayag na hindi na tumutugma sa alinman sa dalawang produkto ay kailangang itama.

## Ano ang tumatakbo saan

Sinasaklaw ng bawat paghahambing ang dalawang bahagi ng iisang open-source na proyekto. Ang **Lolly** ay ang engine, mga app at tool. Ang **Lolly Work** ay ang organisation server, pinapanatili sa [lolly-work repository](https://github.com/lolly-tools/lolly-work). Parehong MPL-2.0, at ang organisasyon ang nagpapasya kung aling mga Lolly Work service ang bubuksan.

::: cols
## Sa device mo: Lolly

- Walang account sa standalone na paggamit
- Paggawa, pag-edit, pag-convert at pag-export
- Gumagana offline kapag na-save na ang mga tool at asset na kailangan
- Content Credentials na pinipirmahan sa device
- Mga pribadong collab sa pagitan ng dalawang device, walang server

## Sa server ng organisasyon mo: Lolly Work

- Single sign-on, SCIM provisioning, mga papel at policy
- Mga shared catalogue, team project at work collab
- Mga approval, usage reporting at audit record
- Server rendering, mababawing job at aprubadong delivery
- Server signing gamit ang identity ng organisasyon
:::

Pinananatili ng standalone na paggamit ang mga file sa device. Ang pagpili ng shared project, work collab, server render o delivery ay nagpapadala ng data na kailangan ng feature na iyon sa server ng organisasyon mo.

## Ang ipinapalagay ng bawat paghahambing

Naaangkop ang mga limitasyong ito sa bawat page sa hanay na ito, kaya minsan lang nakasaad dito:

- **Tumatakbo ang mga work collab sa iisang server node ngayon.** Iba ang laki at kasaysayan ng operasyon nila sa mga matagal nang hosted na produkto. Itinatala ng [Work status at roadmap](/info/work-status.html) ang kasalukuyang mga limitasyon.
- **Demo sandbox ang site sa [lolly.work](https://lolly.work).** Ang matibay na deployment ng organisasyon ay nangangailangan ng persistent storage at operator; sinasaklaw ng [Install Lolly Work](/info/work-install.html) ang pareho.
- **Walang per-seat na bayad sa software licence** para sa Lolly o sa self-hosted na Lolly Work. Nagkakahalaga pa rin ang hosting, storage at operasyon.
- **Ang signature ay hindi pinagkakatiwalaang pumirma.** Dapat pagkatiwalaan ng verifier ang certificate na pumirma sa file bago ipakitang pinagkakatiwalaan ang pumirma; ipinapaliwanag ng [Content Credentials Identity](/info/content-credentials-identity.html) kung paano.
