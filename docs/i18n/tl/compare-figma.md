# Lolly at Figma

_Huling sinuri: 28 Setyembre 2026._

Sinusuportahan ng Lolly ang disenyo, live editing at reusable na asset production. Idinadagdag ng [lolly.work](https://lolly.work) ang mga serbisyo ng organisasyon sa paligid ng gawaing iyon: identity, shared na proyekto, access control at mga approval.

## Kung saan sila nagtatagpo

Parehong hinahayaan kang mag-ayos ng type, hugis at imahe sa canvas at makipagtulungan sa iba. Binabasa ng [Import a design](/info/design-import.html) ng Lolly ang mga Figma file bilang nae-edit na layout. Sinasaklaw din ng Figma ang template-based na brand production: gumagawa ang [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) ng mga asset mula sa mga template at pinupunan ang mga ito mula sa CSV o XLSX file.

Ginagawa ng Lolly na [reusable na tool na may mga patakaran](/info/create-a-tool.html) ang isang disenyo. Tumatakbo ang tool na iyon sa browser o CLI at tumatanggap ng input mula sa URL, script o batch grid. Ang parehong template ay para sa indibidwal na nag-e-edit ng isang asset at para sa team na gumagawa ng maraming variant.

## Collaboration at product design

Pinagsasama ng [Figma Design](https://www.figma.com/design/) ang interface design, mga component, interactive prototype at developer handoff. Mahalaga ang matatag nitong workflow at ecosystem sa product design kapag kailangang magdisenyo at mag-specify ng buong application ang isang team.

Nag-aalok ang Lolly ng dalawang uri ng live collaboration. Direktang pinagtatambal ng [private collab](/info/collaborate.html) ang dalawang device, nang walang account at hindi kailangan ng internet sa shared na network. Gumagamit ang work collab ng lolly.work para sa authenticated na access, shared edit, live cursor at mga naka-save na team session. Ipinatupad ang work collaboration sa parehong Lolly client at lolly.work server; hindi nito pinatutunayang katumbas ito ng operating scale ng Figma dahil sa kasalukuyang single-node na deployment.

## Deployment at production

Hiwalay na dine-deploy na mga bahagi ng iisang open-source na proyekto ang mga creative app ng Lolly at ang lolly.work. Nakakapag-render nang offline ang standalone na Lolly nang walang account. Nagbibigay ang lolly.work ng SSO, SCIM, shared na catalogue, mga pahintulot sa proyekto, mga approval, mga audit record at server rendering sa imprastrakturang kontrolado ng organisasyon.

Umaabot sa instance na iyon ang mga team session at work collab edit; maaaring manatili sa device ang mga lokal na render. Opsyonal ang Content Credentials para sa mga sinusuportahang export, at gumagamit ang server signing ng naka-configure na identity ng organisasyon. Tingnan ang [pangkalahatang-ideya ng pinagsamang solusyon](/info/compare.html) para sa paghihiwalay at ang [Content Credentials Identity](/info/content-credentials-identity.html) para sa kung paano pinagkakatiwalaan ng verifier ang lumagda.

Ang Figma ay trademark ng may-ari nito. Inilalarawan ng pahinang ito kung saan nagtatagpo ang dalawang solusyon at hindi ito kaugnay ng Figma.
