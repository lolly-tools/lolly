# Paggamit ng Lolly

Isang praktikal na gabay sa aktuwal na *paggamit* ng app - pagbukas ng tool, pagtrabaho sa canvas, pag-export, pag-save at pag-share. Lahat ng nandito ay tumatakbo **sa device mo**: walang account, walang upload, walang kailangang internet pagkatapos ng unang load.

> Bago ka rito? Ang [Quickstart](/info/quickstart.html) ang magpapasimula sa iyo sa paggawa sa loob ng ilang minuto, at ang [Lolly for Operators](/info/operators.html) ang sumasaklaw sa pag-install/pag-deploy ng app; ang pahinang ito ay tungkol sa pagpapatakbo nito kapag bukas na.

## Pagbukas ng tool

Ang home screen ay ang **gallery** - lahat ng tool, nakagrupo ayon sa kategorya. I-click ang isang card para buksan ang tool; kung nagtrabaho ka na rito dati, ibabalik ng **Continue** na button ang pinakahuli mong session. Gamitin ang search box para mag-filter ayon sa pangalan - o mag-[Search](/info/search.html) mula sa bar sa ibaba ng anim na listing screen (ang gallery, Utilities, Projects, ang Catalogue, ang Dashboard at Profile), na umaabot sa naka-save mong gawa, sa catalogue at sa mga setting mo bukod pa sa mga tool. Sa loob ng isang tool, umuurong ang bar para sa sariling chrome ng tool.

![Ang tool gallery - bawat tool bilang isang card, nakagrupo ayon sa kategorya](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Bawat tool ay isang split view: **controls** sa isang gilid, at buhay na **preview** (ang canvas) sa kabila. Baguhin ang alinmang control at agad na nag-a-update ang preview.

![Split view ng isang tool - ang control stack sa kaliwa, at ang live na grouped bar chart na iginuhit nito sa kanan](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> May ilang tool (tulad ng **Design**) na bumubukas bilang **free canvas** - isang chromeless at direct-manipulation na surface kung saan dinadrag, binabago ang laki, iniikot at isinasnap mo ang mga box ng teksto, hugis at larawan, at dini-double-click para i-edit ang teksto sa mismong kinalalagyan nito. Nag-e-export ito sa parehong render path gaya ng ibang tool, kaya ang canvas *ang* file mismo. Tingnan ang [Ang free canvas](#the-free-canvas-design) sa ibaba.

Dalawang paraan para hubugin ang grid mismo tungo sa gusto mo:

- <!--i:star--> **I-star ang ginagamit mo.** Lagyan ng ★ ang isang card at magkakaroon ito ng sarili nitong malaking tile sa strip sa itaas ng grid - tingnan ang [Ang mga paborito mo](/info/favourites.html).
- <!--i:eyeoff--> **Itago ang tool na hindi mo ginagamit.** I-right-click ang isang card (o pumili ng ilan at gamitin ang selection bar) → **Hide tool**. Mawawala ito sa grid, at sa mga nahahanap ng pagtatype sa grid; may kulay-abong **Show hidden tools (N)** na tile sa dulong bahagi na muling maglalabas sa kanila, malabo, at bawat isa ay may **Unhide tool** sa sarili nitong menu. Tungkol lang sa grid mo ang pagtatago - bumubukas pa rin ang tool mula sa isang naka-save na link o bookmark, at nananatili ito kung nasaan man ito para sa lahat ng iba.

![Ang dulo ng Tools grid na nakalabas ang mga nakatagong tool: ang malabong QR Code Generator card, at sa tabi nito ang kulay-abong tile na nagbalik dito sa view, na ngayon ay nagbabasang Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

Kapag mas gusto mong magtanong kaysa maghanap, kinukuha ng **Ask Lolly** (`#/ask`) ang tanong na tinipa mo at ibinabalik ang tugmang bahagi ng dokumentasyong ito nang **verbatim** - ang mismong salita ng mga gabay, hindi buod at hindi gawa ng makina - kasama ang sipi ng pahinang pinanggalingan nito at isang **Open in docs** na link sa tabi. Sa ilalim ng sagot ay ang mga lugar sa app na tumutugma sa parehong tanong: isang tool, isang setting, isang naka-save na project, bawat isa ay button na dumederetso roon.

Ang transcript ay memorya ng session: magtanong ulit at unti-unting nabubuo ang thread habang tumatagal, tapos mag-reload at magsisimula itong bago. May **Ask Lolly: *ang query mo*** na row sa ibaba ng mga search result - sa ilalim ng anumang tiyak na hit na nakita ng ibang grupo - na dumederetsong nagpapasa ng tanong, kaya puwede kang magsimula sa bar at tumapos dito.

## Ang canvas (preview)

Laging ipinapakita ng preview ang eksaktong ie-export.

**Desktop**

- **Zoom:** Cmd/Ctrl-scroll, o pinch sa trackpad - nakasentro ang zoom sa pointer mo.
- **Pan:** pindutin nang matagal ang **Space** at mag-drag, o mag-drag gamit ang **middle mouse button**. (Nananatiling libre ang simpleng pag-click para sa pag-click ng mga bahagi ng disenyo.)
- **Keyboard:** `0` = fit sa window · `1` = 100% · `+` / `−` = zoom.
- **Zoom HUD:** ang maliit na `−  NN%  +  Fit` na control sa sulok. I-click ang porsyento para mag-toggle sa Fit ↔ 100%.

![Ang zoom HUD sa sulok ng canvas - minus, ang buhay na porsyento, plus, Fit, tapos ang theme at sound toggle](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Touch**

- **Pinch** para mag-zoom, **drag** para mag-pan, **double-tap** para bumalik sa fit.

**I-click para tumalon sa isang control:** i-click ang alinmang elemento sa disenyo at makukuha ng tugmang sidebar input ang focus at lilitaw ito sa view - para sa isang paulit-ulit na row group, binubuksan nito ang mismong row na na-click mo, kaya isang tap lang ang layo ng pag-edit sa nakikita mo.

Ang pagbabago ng dimensyon ay laging nagbabalik sa view sa isang malinis na fit.

### Ang free canvas (Design)

Nagdaragdag ang mga free-canvas na tool ng working surface *sa paligid* ng artboard, parang pasteboard ng isang designer:

- **Off-canvas staging.** I-drag ang isang box lampas sa gilid ng frame at mananatili itong ganap na **nakikita at napipili** - ipwesto sa gilid ang mga elemento habang inaayos mo ang komposisyon, tapos i-drag muli papasok. Ang lahat ng nasa labas ng frame ay **bahagyang pinalalabo** para agad mabasa ang export area, at pinananatili ng frame ang anino nito para markahan kung saan eksaktong nagsisimula ang file.
- **Ang frame lang ang nag-e-export.** Ang na-export na file ay nakahangga sa artboard - anumang naiwan sa labas (o ang bahagi ng box na lumalampas sa gilid) ay basta na lang naikakrop palabas ng output, sa raster at vector na format nang pareho.
- **Mag-zoom out lampas sa Fit** (hanggang 20%) para makita ang buong pasteboard kapag may inilagay kang mga bagay na malayo sa labas ng frame.
- **Nababago ang laki ng artboard.** Ang pagpapalit ng export dimensions ay binabago ang laki ng frame sa kinalalagyan nito; pinananatili ng mga box ang posisyon nila, kaya puwede mong i-reframe ang isang layout sa paligid ng umiiral na nilalaman.

![Ang libreng canvas ng Design - ang artboard kasama ang pasteboard na nakapaligid dito](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**I-flip ang isang selection.** Mag-right-click sa anumang box at piliin ang **Flip horizontal** o **Flip vertical** para i-mirror ito sa lugar, o pindutin ang `Shift+H` / `Shift+V` mula sa keyboard - Shift, dahil ang hubad na `V` ay ang Pointer tool. Nagmi-mirror ang bawat napiling box sa sarili nitong axis sa isang undo step, at tunay na transform ang mirror, kaya nananatili ito sa na-export na SVG, PDF at PNG at hindi lamang sa canvas.

### Pagguhit ng sarili mong hugis (ang pen)

Sapat na ang mga box, bilog at rounded frame para sa karamihan ng layout. Kapag kailangan mo ng hugis na wala sa listahang iyon, iguhit mo: inilalagay ka ng **Pen** na button sa rail (o ng `P` key) sa drawing mode. Tatlong solong key ang naglilipat sa pagitan ng mga mode - **`V`** pabalik sa Pointer, **`P`** para sa Pen, **`N`** para sa node tool (**Edit points**) - at ang Pointer ang laging labasan mula sa kung nasaan ka man.

![Ang tool rail ng free canvas: isang drag grip, ang Lolly menu, tapos Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards at Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **I-click** para maglagay ng point. Sa default na curve type, ang **pag-click at pag-drag** ay naglalabas ng mga handle ng point na iyon, at iyon ang paraan para gumuhit ng kurba sa halip na sulok - pindutin ang **Alt** habang nagki-click para sa matulis na sulok. (Sa ibang curve type, sulok ang bawat inilagay na point at walang ginagawa ang drag; tingnan ang **Spline type** sa ibaba.)
- Nagsi-snap ang mga point sa artboard at sa iba mo pang box habang inilalagay mo ang mga ito, at iginuguhit ang parehong mga gabay na ipinapakita ng karaniwang drag. Pinipigil ng Alt ang grid habang gumuguhit ka, at ang grid at ang mga gilid naman habang dinadrag mo ang isang point pagkatapos.
- **I-click ang unang point mo** para isara ang loop at matapos sa isang kilos. Kung hindi, pindutin ang **Enter**, mag-double-click o magpalit lang ng tool - itinatago ang guhit, hindi itinatapon.
- Isa-isang baitang ang ginagawa ng **Escape**: ang unang pindot ay iniiwan ang guhit at wala itong isinusulat, at ang pangalawa ay lumalabas sa pen.
- Ang **Delete** habang gumuguhit ay nag-aalis ng huling point na inilagay mo.

Ang resulta ay isang ordinaryong box sa canvas. Ilipat ito, baguhin ang laki nito, iikot ito, i-group ito, i-align ito, i-restack ito, bigyan ito ng fill, gradient, anino o opacity - kumikilos ang isang path gaya ng bawat ibang box, at wala ni isa sa mga control na iyon ang tumatrato rito nang iba.

Dumarating din itong may kulay na. Ang unang path na iginuhit mo ay kumukuha ng fill at stroke na ibinibigay ng brand mo sa isang path, at pagkatapos noon ay kinukuha ng bawat bagong path ang **huli mong ginamit** - magtakda ng fill nang minsan at magpatuloy sa pagguhit, sa halip na kulayan muli ang bawat hugis. (Sa isang tool na walang sinasabi ang brand tungkol sa mga path, ang iginuhit na path ay may stroke na kulay na nakita mong ginamit habang iginuguhit ito, kaya hindi ito kailanman nagiging invisible.)

**Pag-edit muli sa mga point.** I-double-click ang hugis (o gamitin ang **Edit points** sa object bar) at babalik ang mga point. I-drag ang isang point para ilipat ito, i-drag ang isang handle para baguhin ang tutok nito, i-click kahit saan sa kurba para magpasok ng point, rubber-band ang isang grupo ng point at pindutin ang Delete para alisin ang mga napili. Laging may hindi bababa sa dalawang point ang isang path, kaya hindi mo ito maaaksidenteng mabura nang tuluyan.

Ang **Spline type** ang nagpapasya kung anong uri ng kurba ang dumadaan sa mga point mo, at ito ang pagpiling sulit intindihin:

| Uri | Ang ginagawa nito |
|---|---|
| **Smooth (auto)** | Ang default. Kinakalkula nito ang sariling haba ng mga handle, kaya ang simpleng click-click-click ay nagbibigay ng tunay na makinis na kurba nang walang pakikipagbuno sa mga handle. Kung magtatakda ka ng handle, itinatali nito ang *direksyon* at nananatili sa kurba ang pagmamay-ari ng haba. |
| **Bezier handles** | Ang klasikong pen. Ang mga handle ang control point, at ang pagpasok ng point ay hindi kailanman naggagalaw sa kurba. |
| **Through the points** | Dumadaan nang eksakto sa bawat point na inilagay mo, walang handle. |
| **B-spline** | Dumadaloy malapit sa mga point sa halip na dumaan sa mga ito, para sa mas malambot na hugis. |
| **Straight lines** | Isang polyline. |

Ang paglipat ng umiiral na path sa isang uring kumakalkula ng sarili nitong handle ay nagtatanong muna, dahil hindi na mababawi ang mga haba ng handle na itinakda mo - laging walang bawas ang paglipat sa **Bezier handles**. Sa gitna ng pagguhit ay walang prompt: dumederetso ang paglipat sa draft, at kasama roon ang anumang handle na nahila mo na. Sa mga uring may hawak sa sariling handle, bahagyang nagbabago ang hugis ng kurba kapag nagpasok ka ng point; sa **Bezier handles** ay hindi.

May dala ring continuity rule ang bawat point, na ipinapakita ng hugis nito sa canvas - parisukat para sa **Corner** (magkahiwalay na gumagalaw ang mga handle), bilog para sa **Smooth** (nananatiling magkahanay ang mga handle), bilog na may singsing para sa **Symmetric** (magkahanay at magkapantay ang haba). Itakda ito para sa alinmang napiling point at agad itong susundin muli ng kurba.

![Dalawang pen path na direktang na-render mula sa isang link: isang S-curve na may stroke at isang saradong blob na may fill](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Ang iginuhit na path ay dala rin ng link gaya ng lahat ng iba, kaya ang hugis na iginuhit mo ay muling bumubukas mula sa isang share link at magkatulad ang render nito mula sa CLI. Walang bahagi nito ang nakadepende sa editor.

### Pagsasama ng mga hugis (path operations)

Pumili ng dalawa o higit pang hugis, **i-right-click** ang canvas (two-finger tap sa touch) at ihahain ng menu ang mga operasyong inaasahan mo sa isang drawing app:

- Pinagsasama sila ng **Union** sa iisang hugis, at pinananatili ang kulay ng pinakaitaas.
- Inaalis ng **Subtract** ang lahat ng nasa itaas mula sa hugis na nasa ilalim.
- Ang **Intersect** ay nagtitira lang ng bahaging nagsasapawan.
- Ang **Exclude** ay nagtitira ng lahat maliban sa bahaging nagsasapawan.

May tatlo pang gumagana sa iisang hugis: ang **Outline stroke…** ay ginagawang hugis na may fill ang isang stroke sa parehong outline (kapaki-pakinabang kapag gusto mong panatilihin ang kapal nang eksakto sa pagkakaguhit), ang **Offset path…** ay pinalalaki ang silweta palabas o, kapag negatibong numero, pinaliliit ito papasok, at ang **Simplify** ay muling binubuo ang isang path nang mas kaunti ang segment sa parehong hugis.

![Isang gasuklay at isang singsing na may tunay na butas, pareho ay gawa ng Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Ang resulta ay isang bagong path na patuloy mong mae-edit gamit ang pen. Tunay na butas ang mga butas - ang **Fill rule** na control sa stroke panel ang nagpapasya kung ang magkakapatong na contour ay pupunuin (*non-zero*) o bubutasan (*even-odd*).

May dalawang bagay na sadyang hindi ginagawa ng mga operasyong ito. **Tumatanggi sila sa halip na manira**: subukang i-intersect ang dalawang hugis na hindi nagsasapawan at sasabihin sa iyong walang matitira, at walang magbabago. At ang text at image box ay walang outline na mapagtatrabahuhan, kaya hinahayaan na lang sila sa halip na tayahin sa pamamagitan ng frame nila. Ang pinagsamang resulta ay iniimbak bilang payak na Bezier curve, na siya ring ginagawa ng isang drawing app - hindi nakakaligtas sa operasyon ang orihinal na spline type.

## Timeline (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

Nagdaragdag ang **Sequence Studio** ng *oras* sa free canvas. Bawat box ay puwedeng magsimula sa isang sandali, tumakbo nang may haba at mag-animate papasok at palabas, at ang timeline na nakadock sa ilalim ng artboard ang pinag-aayusan mo sa kanila. Buksan mo ito at may tumutugtog nang sequence - isang title card, isang clip, isang end card, isang lower-third at isang music bed - kaya nakikita ang modelo bago ka pa magbago ng kahit ano.

![Ang timeline ng Sequence Studio: ang transport, ang ruler, isang overlay lane, ang magnetic sequence row kasama ang mga clip at seam chip nito, at ang Always on strip](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

May dalawang uri ng row, at ang pagkakaiba nila ang buong punto:

- Ang **sequence row** ay *magnetic*. Magkakadikit ang mga clip, sunod-sunod, at ang pag-drag sa isa ay nagsasaayos muli ng takbo sa halip na mag-iwan ng butas. Magbura ka ng clip at magsasara ang iba. Ito ang gulugod mo.
- Malaya ang **overlay lanes**. Ang isang lower-third, isang logo, isang caption - anumang lumulutang sa ibabaw ng gulugod sa sarili nitong oras - ay may sariling lane at sariling simula.
- Sa ilalim ng mga iyon, tinitipon ng **Always on** ang mga box na walang timing: mga tanawing basta naroon lang sa buong takbo. Ang `+` sa isang chip ay itinataas ang isa papunta sa isang lane; ibinabalik ito ng **Make always on**.

![Ang editing stage: ang artboard sa gitna at harapan, ang tool rail sa kaliwa at ang zoom HUD sa sulok](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Ang pagbukas sa timeline ay nagbibigay dito ng keyboard, kaya ang Space at ang mga arrow key ang nagpapatakbo sa playhead sa halip na sa pahina - at dahil bumubukas ito nang mag-isa sa isang komposisyong may timing na, totoo iyon sa mismong sandaling mag-load ang Sequence Studio.

> Mas malalim ang tinatalakay ng **[Ang sequence editor](/info/sequence-editor.html)** sa apat na bagay na nagpapasya kung mahuhulaan ang pakiramdam ng pag-edit sa oras: kung aling clip ang ine-edit ng isang click sa canvas, ang onion-skin na anino ng mga katabing clip, ang saklaw ng split at ang Join na nagbabawi sa isang hiwa, at ang pagtitrim (kasama ang set ng keyboard). Pindutin ang `?` habang naka-focus ang timeline para sa shortcut sheet.

**Pag-edit.** I-drag ang gitna ng isang clip para ilipat o ayusin muli ito, mag-drag sa loob ng ilang pixel mula sa alinmang dulo para i-trim ito, at pindutin ang **Split at playhead** (o `S`) para hatiin ang isang clip sa dalawa. Kailangan ng Split ng clip na may tunay na **Length** at ng playhead na medyo nasa loob nito, kaya hindi mahahati ang isang open-ended na clip (ang music bed, halimbawa). Naka-on bilang default ang **Snap to edges** at nagsi-snap ito sa mga gilid ng clip, sa playhead at sa buong segundo, at may Alt para lampasan ito. Bawat drag ay iisang hakbang ng undo, at ang drag preview ay tumatakbo sa parehong aritmetika ng commit, kaya ang nakikita mo habang nagda-drag ang siya mong makukuha.

Pumili ng clip at ibibigay sa iyo ng inspector ang parehong mga pag-edit bilang numero: **Length**, **Trim in** (gaano kalalim sa source ito nagsisimula), **Speed** bilang set ng nakatakdang multiplier mula ×0.25 hanggang ×4, **Animate in** / **Animate out** kasama ang haba nila at **Mute clip**. Sadyang walang **Start** na field ang clip sa magnetic row - ang row ang may hawak sa pagkakasunod-sunod, kaya nagda-drag ka para ilipat ito.

Ang **Transitions** ay mga preset, hindi keyframe: Fade, Pop, Grow, Rise, Drop, ang apat na Slides, Zoom in at out, Tilt, Swoop, Spin, Drift o **Cut (no animation)**. Nakabatay sa laki ng object ang mga distansya, kaya tama pa rin ang dating ng parehong preset sa isang full-frame na card at sa isang maliit na badge. Sa pagitan ng dalawang magkatabing clip sa sequence row ay may **seam chip**: i-click ito at piliin ang **Cut** o **Crossfade**, na agad na ilalapat at magsasara. Buksan muli ang parehong chip para baguhin ang **Length (ms)** at pindutin ang **Done**. Ang crossfade ay iniimbak bilang isang fade out ng isa at isang fade in ng susunod, at ang aktuwal na dissolve ay kinukuha ng export mula sa pares na iyon - kaya nga parang dalawang fade ang crossfade sa preview at tunay na paglipat naman sa file.

**Tunog.** Magdagdag ng **Audio** na clip at mabubuhay ito sa timeline gaya ng anumang ibang clip: waveform, trim, mute. (Ang binuong bed na kasama sa default na session ang tanging eksepsiyon - sinisintesa ito sa oras ng export, kaya nananatiling payak at tahimik ang bar nito hangga't hindi ka nagre-render.) Pindutin ang mic para **mag-record ng voiceover** diretso sa timeline, may count-in at level meter, at nase-save ang take bilang sarili mong asset sa puntong sinimulan mo. Pindutin ang camera sa tabi nito para **mag-record ng video** sa parehong paraan: naka-crop ang take sa export size ng artboard habang ito'y nire-record, kaya ipinapakita ng maliit na self-view kung ano mismo ang mapupunta sa sequence sa playhead, full frame - ang paraan para makuha ang clip ng isang kasamahan mula sa isang shared link. Ang musika, diyalogo at ang sariling soundtrack ng isang clip ay pawang umaabot sa na-export na mix. (Ibang bagay ang **Audio track** ng export panel: isang bed na inilalatag sa ilalim ng buong clip, may fade at ducking. Magkasamang umiiral ang dalawa.)

**Pag-render nito.** Ang motion export ay isang **deterministic composite**, hindi screen recording - ang bawat frame ay dine-decode, iginuguhit at ine-encode sa eksaktong oras, kaya hindi nakadepende ang file sa pagsabay ng makina mo, at walang praktikal na hangganan ng frame sa MP4 o WebM. Ang sariling haba ng timeline ang nagtatakda ng tagal maliban kung magta-type ka ng isa. Itinatatak ang Content Credentials gaya sa alinmang ibang export. Ang still na export ay nagbibigay sa iyo ng frame sa playhead, o ng buong contact sheet mula sa **Frames** na field sa tabi ng laki ng output - tingnan ang [Pag-export](/info/exporting.html#stills-from-a-timed-composition).

Ilang limitasyong dapat tandaan: may hangganang isang oras ang isang sequence, nagbu-buffer ng frame ang GIF at animated PNG kaya nananatili silang maikli, tahimik ang audio sa clip na hindi ×1 ang bilis (wala pang time-stretching) at nakatago rito ang **Record live** dahil mas mainam na daan ang compositor.

**Higit pa sa mga preset: keyframe, depth, at isang camera.** Ang isang transition ay nagbibigay ng animation sa isang clip habang dumarating at umaalis ito. Para i-pose ang isang box *sa loob* ng isang clip - paganahin itong lumutang, mag-fade, mag-blur, angatin ito mula sa page, at ibalik ito - magdagdag ng keyframe: piliin ang clip, pindutin ang **+Keyframe** (ang diamond sa tool cluster ng timeline, ang diamond sa object bar ng canvas, o `K`) at ang posisyon ng playhead ang magpapasya kung aling pose ang isusulat ng susunod mong edit. Ang parehong keyframe system ay nagbibigay sa bawat timed na komposisyon ng isang **camera** na pumapasok, nag-pan sa buong eksena, at humuhugot ng focus, na ginagawang isang stack ng mga layer mula sa isang patag na SVG na maaari mong lipatan. Ang **[Animating](/info/animating.html)** ang buong gabay.

May parehong timeline ang Design na tool, kaya puwede mong bigyan ng timing ang isang layout nang hindi lumilipat sa ibang tool, at nag-e-export din ito ng motion.

## Pagpepresenta

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Ang isang Design na dokumentong binubuo ng mga **artboard** ay deck na. Buksan ang **Lolly menu** sa tool rail at piliin ang **Present** - ang huling row - at magiging full-screen na slide ang bawat artboard, ayon sa pagkakasunod-sunod ng mga artboard sa canvas. Tumatakbo ang deck sa isang kopya ng mga na-render na artboard, kaya hindi nagagalaw ang editor sa ilalim at ibinabalik ka nang eksakto sa pinanggalingan mo kapag umalis ka.

- **Sumulong** gamit ang **Space**, `→`, **Page Down** o isang click sa strip sa kanang gilid ng screen; bumalik gamit ang `←`, **Page Up** o ang strip sa kaliwang gilid. Tumatalon ang **Home** at **End** sa una at huling slide. Isang maliit na bar ng mga control ang lumalabas kapag ginalaw mo ang pointer at nagtatago muli kapag tumigil ka.
- **Overview** (`O` o ang grid button) ay inilalatag ang bawat artboard nang sabay-sabay sa ayos na ibinigay mo sa kanila sa canvas; i-click ang isa para buksan ito.
- **Reveal steps.** Right-click ang isang box at piliin ang **Reveal at step 1**, **2** o **3** sa halip na ang default na **Always visible**. Maghihintay ang box na iyon hanggang sumulong ka sa hakbang nito, kaya maaaring dumating ang isang slide nang paunti-unti; ang mga box na magkapareho ang numero ay dumarating nang magkasama.
- **Speaker view** (`S`) ay nagbubukas ng pangalawang window na may kasalukuyang slide, ang susunod, ang mga tala mo para sa slide na iyon at isang tumatakbong orasan. Kung babawalan ng browser ang pop-up, babalik ito sa isang panel sa ibabaw ng deck. Itinatakda ang mga tala kada artboard at hindi kailanman lumalabas sa slide mismo.
- Nagpapanatili ang `B` ng itim na screen (anumang key ang magbabalik sa slide), ibinabalik ng `F` sa fullscreen at binabalatan ng **Escape** ang isang layer sa isang pagkakataon: mula overview pabalik sa deck, mula deck pabalik sa editor.
- **Kiosk.** Bigyan ang isang artboard ng **Length** at mananatili roon ang deck sa haba ng oras na iyon, pagkatapos ay sumusulong ito mismo sa likod ng manipis na progress bar; ang `K` (o ang pause button, na lalabas lamang kapag may Length na ang isang bagay) ay huminto at muling magsisimula nito. Idagdag ang `kiosk` sa link at babalot ang deck sa dulo, na siyang gumagawa nitong signage.

Link din ang deck. Ang `?present` ay dumederetso rito, ang `s=` ay nagpapangalan sa slide - isang posisyon, isang artboard id o `id.step` para sa isang build step - at nag-a-update ang address habang gumagalaw ka, kaya ang ipinapadala mo ay ang slide na kinaroroonan mo. Sa mga tool author: nakadokumento ang mga parameter na iyon sa pahinang [URL Mode](/info/url-mode.html#reserved-parameters).

## Sa telepono

Sa makikitid na screen, dumadaloy ang layout tungo sa iisang column:

- Nagiging **sheet ang mga control** sa itaas na may **drag grip** sa ibabang gilid nito. I-drag ang grip para baguhin ang laki nito - nagsi-snap ito sa **peek / half / full** - o **i-tap** ang grip para mag-toggle sa collapsed ↔ expanded. Pinupuno ng preview ang espasyo sa ibaba at nananatili itong nakikita habang nag-e-edit ka.
- Ang lumulutang na **Export** na button ay nagbubukas ng export sheet - lahat ng control para sa format, laki, copy, save at download sa isang lugar. Isara ito sa pamamagitan ng pag-tap sa backdrop.

![Isang tool sa screen na kasinlapad ng telepono - mga control bilang sheet sa itaas, ang binuong palette na pumupuno sa preview sa ibaba at ang render pill na lumulutang sa ibaba-gitna](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Mga control (inputs)

Inilalabas lang ng mga tool ang mga input na nilayong mag-iba-iba - ang lahat ng iba pa (kulay, layout, tipograpiya, lohika) ay nakakandado ng may-akda ng tool, kaya ang anumang gawin mo ay umaayon sa mga patakarang itinakda ng may-akda. Kabilang sa mga input ang teksto, slider, colour picker, dropdown, petsa, image picker at paulit-ulit na row group. May ilang nakagrupo sa ilalim ng mga collapsible section.

![Ang control stack ng isang tool - isang text field, mga colour trigger at isang slider, at wala nang iba dahil ikinandado ng may-akda ang lahat ng iba pa](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Reset:** Ibinabalik ng *Clear changes* ang bawat input sa mga default nito.

### Undo at redo

Ang **Cmd/Ctrl-Z** ay bumabalik at ang **Cmd/Ctrl-Shift-Z** (o **Cmd/Ctrl-Y**) ay sumusulong muli. Ang parehong pares ay nakaupo bilang **Undo** at **Redo** na button sa row sa itaas ng mga control - sa free canvas ay nasa tool rail sila - at kumukupas ang bawat isa habang wala nang mababawi. Sinasabi ng bawat hakbang kung ano iyon: mag-undo ng kulay at pangangalanan ng maliit na mensahe ang input na kaka-restore lang nito, na may **Redo** na button dito para sa pagbabalik.

- **Isang hakbang ang isang drag.** Ang paulit-ulit na pagbabago sa parehong control sa loob ng kalahating segundo ay pinagsasama, kaya ang paghila sa isang slider sa buong saklaw nito ay iisang undo sa halip na dalawang daan.
- **Ang huling 100 hakbang ang itinatago** - nalalaglag sa dulo ang mas luma. Ang paggawa ng bagong edit pagkatapos mag-undo ay binubura ang forward stack, gaya rin ng nangyayari saanman.
- **Habang nasa isang text box ang caret mo**, sa mismong field na ang Cmd/Ctrl-Z, karakter kada karakter. Ang Lolly ang pumapalit para sa mga control na walang sariling kapaki-pakinabang na undo: mga slider, dropdown, kulay at switch.
- **Ang pagpili ng file** sa isang **file** na input ay hindi isang hakbang - hawak lang ang mga byte na iyon sa loob ng session, kaya wala namang maibabalik.

Sa isang live na [collaboration](/info/collaborate.html), ang history ay nananatiling sa iyo lamang. Ang isang pagbabagong dumarating mula sa ibang device ay hindi kailanman napupunta sa stack mo, kaya ang undo ay maaari lang bumawi sa isang bagay na ginawa mo mismo.

## Mga detalye mo at headshot

Ang **Profile** (kanang itaas ng gallery) ang may hawak ng pangalan mo, mga detalye sa pakikipag-ugnayan at isang opsyonal na **headshot**. Ang mga tool na humihingi ng mga field na iyon ay awtomatikong pinupunan ang mga ito - itakda ang mga ito nang minsan at kusang mapupunan ang email signature, lockup at badge mo. Puwede mo pa ring palitan ang alinmang field kada session. Sumang-ayon gamit ang **Use my details to create** para sumama ang mga detalye mo bilang may-akda ng ini-export mo.

Ang headshot at mga detalye mo ay nakatira **sa device na ito lamang**. Puwedeng higit pa sa iyo ang isang profile - isang koponan o isang tungkuling pinapasok mo paminsan-minsan. Tingnan ang **[Mga profile](/info/profile.html)** para sa buong larawan, kasama ang pagkakaroon ng higit sa isa.

## Pag-save at pagpapatuloy

I-click ang **Save** para itago ang kasalukuyang mga input bilang isang session para sa tool na iyon. Puwede kang magtago ng maraming pinangalanang session kada tool; ang **Continue** na button ng bawat tool ay muling binubuksan ang pinakahuli mo, at ang **history button** (kanang itaas, katabi ng profile mo) ay naglilista ng bawat naka-save na session sa lahat ng tool. Nasa device lang ang mga session. Para ayusin ang mga ito, buksan ang **Projects** (sa ibaba).

![Ang render pill na may dalawang kalahati - isang pataas na arrow na nagbubukas ng export panel, at isang tsek na nagse-save ng session sa kinalalagyan nito](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projects

Ang **Projects** - buksan ito mula sa **Projects** na tab sa tabi ng **Tools**, o mula sa **Profile → Storage → Organise in Projects** - ay tahanan ng lahat ng naka-save mo, at gumagana ito tulad ng isang file manager:

![Projects - mga naka-save na session na nakaayos sa mga folder na puwedeng ilagay sa loob ng isa pa](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Mga folder sa loob ng folder.** Igrupo ang mga naka-save na session sa mga folder, at mga folder sa loob ng folder, kasinglalim ng gusto mo. Gumawa ng folder, palitan ang pangalan nito o i-drag ang isang tile papunta sa ibang folder para ilipat ito; may breadcrumb na maghahatid sa iyo pabalik pataas. May laging naroong **Uncategorised** na folder na humahawak sa anumang hindi pa naisasampa.
- <!--i:clock--> **Mag-sort sa sarili mong paraan.** Ang **View & sort** ay nag-aalok ng **Name**, **Date added**, **Last modified** (ang default) at, sa loob ng folder, **By tool**. Laging nauuna ang mga folder anuman ang aktibong sort - inaayos lang ng sort ang mga session at folder sa loob ng sarili nilang grupo.
- <!--i:document--> **Isampa agad ang bagong gawa.** Ang **New asset** ("Start a fresh creation" sa root, "Add to *folder*" sa loob ng isa) ay nagbubukas ng tool at awtomatikong isinasampa sa folder na iyon ang unang save nito.
- <!--i:checklist--> **Multi-select (desktop).** Lagyan ng tsek ang checkbox ng isang tile, mag-drag ng selection box sa bakanteng espasyo o **Shift/Cmd-click**; **i-right-click** ang isang tile para sa context menu nito. Tapos kumilos sa buong napili nang sabay-sabay - gumagana ang parehong galaw at parehong lumulutang na action bar sa Tools gallery, sa Utilities, sa Catalogue at sa Projects, hindi lang dito.
- <!--i:download--> **I-render ang isang buong folder o napili.** Ini-export ng **Render folder** ang bawat naka-save na session sa isang folder - kasama ang mga sub-folder nito - bilang isang nested na `.zip`. Ganoon din ang ginagawa ng **Render selection** para sa anumang multi-selection, at ang iisang session ay dumederetsong nagre-render sa sariling file nito. Hindi kailangan ng Batch/Pro.
- <!--i:link--> **Dumeretso sa naka-save na gawa ng isang tool.** Lagyan ng tsek ang isa o higit pang tool sa Tools gallery at piliin ang **View sessions** mula sa selection bar - bubukas ang Projects na ipinapakita lang ang mga session na ginawa gamit ang mga tool na iyon, kasama ang **Clear** para bumalik sa buong view.
- <!--i:link--> **I-share ang isang naka-save na session.** I-right-click ang isang session → **Share link** para kopyahin ang link na muling magbubukas nito nang may eksaktong parehong mga input (ang buong Share dialog - tingnan sa ibaba).

![Bukas ang View and sort na popover sa Projects, may row para sa theme, isang View na pagpipilian sa pagitan ng Preview o List at ang Name, Date added at Last modified sa ilalim ng Sort](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**Ang inaalok ng selection bar** ay bahagyang nagkakaiba kada view, dahil hindi lahat ng aksyon ay may saysay saanman:

- **Tools / Utilities:** Favourite (o Unfavourite), Hide (o Unhide), Available offline (o Remove from offline), **View sessions** (ang paglipat na inilarawan sa itaas) at Copy link kapag eksaktong isang card ang napili.
- **Catalogue:** Ang Favourite at Hide ay puwede sa anumang napili; ang Duplicate, Download at Delete ay lumilitaw lang kapag ang bawat napiling item ay isa sa sarili mong mga upload - ang ibinahaging design-system na asset ay isang permanenteng kasunduan, kaya nananatiling hindi ito naaabot ng tatlong iyon kahit sa bulk.
- **Projects:** **Render selection**, **Move to…**, **New folder**, **Delete**, **Edit together** kapag ang napili ay dalawa hanggang walong session ng iisang tool (binubuksan sila nang magkakatabi sa ilalim ng isang pinagsamang sidebar) at **Edit as sheet**, na binubuksan naman ang buong napili bilang mga row sa batch grid. Ang isang iyon ay **walang limitasyon sa laki** at walang pakialam kung sa parehong tool nanggaling ang mga session, kaya ito ang labasan kapag mas malaki o mas magkakahalo ang napili kaysa sa dalawa-hanggang-walo ng Edit together.

> Isang bitag sa label: umiiral lang ang **View sessions** kapag may bagay nang *napili*. Ang pag-right-click sa isang card na hindi napili ay nag-aalok naman ng **N saved sessions**, na binubuksan ang sariling history dialog ng tool na iyon sa halip na dalhin ka sa Projects.

![Dalawang tool card na naka-tick sa Tools gallery, kasama ang floating selection bar na nagsasabing "2 selected" at nag-aalok ng Available offline, View sessions, Favourite, at Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Pagbabahagi ng gawa mo

Dalawang paraan ang labasan ng isang disenyo: bilang link o bilang file. Inaalok ng Share dialog ang pareho. Buksan ito gamit ang **Share** sa export controls; ang **Share link** sa isang naka-save na session sa Projects ay binubuksan ang parehong dialog para sa session na iyon.

### Ang link

Nakukuha sa URL ng pahina ang bawat input, kaya ang link *ang* disenyo mismo. Sa itaas ng dialog nakaupo ang handang-kopyahing link, na may dalawang nakatiklop na seksyon sa ilalim nito.

- Nasa **Link options** ang **Shortest link** (ang isang malaking disenyo ay gumagawa ng mahabang URL, kaya siniksik nito ang buong estado sa isang maliit na token at ipinapakita sa iyo ang natipid na karakter; naroon pa rin lagi ang nababasang anyo), ang **Password-protect this link** (AES-256 sa buong link, at hindi kailanman nasa loob nito ang password) at ang **Pin this tool version** - ang `_v` na flag, na nagtatali sa link sa bersyon ng tool na tinitingnan mo para hindi mabago ng isang susunod na update ang ini-render nito.
- Ang **Link behaviour** ang mangyayari kapag binuksan ito ng tatanggap: fullscreen, nakabukas na agad ang export panel, download-sa-pagbukas gamit ang `&export` o copy-to-clipboard gamit ang `&copy`.

I-paste ang link sa isang katrabaho, i-bookmark ito o i-commit ito. (Buong detalye: [URL Mode](/info/url-mode.html).)

**May mga tool na ginagawang buong produkto ang link.** Tinitipon ng Jump Page ang mga link mo sa isang page para ibigay - isang bio link, isang talumpati sa conference, isang shop front. Walang kailangang i-host at walang account sa likod nito: ang page ang link, kaya bumubukas ito kasing bilis ng paglalakbay ng URL. Sa editor, makikita mo ang tapos na page sa tabi ng mga field; ang isang bisitang nagbukas ng link ay makakakuha nito sa buong lapad, isang link kada eksena habang nag-i-scroll sila.

![Jump Page sa editor - ang heading, tatlong eksena ng link bawat isa may sariling wash, at isang footer na Made with Lolly, na naka-layout bilang isang page sa canvas](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Sinasabi ng dialog kung ano ang hindi kayang dalhin ng isang link.** May tatlong bagay na hindi kasya sa isang URL: isang larawan o file na idinagdag mo mula sa device na ito, isang napakahabang halaga ng teksto o isang napakalaking listahan. Binibilang ang bawat isa habang binubuo ang link. Kung may kinailangang alisin, pinangangalanan ito ng dialog at itinuturo ka nito sa file sa ibaba, sa halip na abutan ka ng link na bumubukas nang nawawala ang larawan. Ang link na *mahaba* lang ay binibigyan ng mas banayad na paalala kasama ang bilang ng karakter nito, dahil kaya pang isalba ng packing ang haba.

### Ang .lolly na file

Ang **Download .lolly**, na nasa Share dialog ng tool na pinagtatrabahuhan mo, ay isinusulat ang parehong disenyo bilang isang file. Dala nito ang naka-save na session kasama ang mga larawan at file na idinagdag mo mula sa device mo. Sumasakay din sa loob nito ang mga catalogue na likhang ginagamit ng disenyo, kaya kumpletong bumubukas ang file sa isang makinang hindi pa nakakakita ng brand mo. Kung may share sheet ang device mo, ang **Send to…** ay diretsong iniaabot dito ang file na iyon (AirDrop, isang Android share) sa halip na i-save ito sa disk.

Ang `.lolly` ay isang ordinaryong zip. Palitan ang pangalan nito ng `.zip` at buksan ito: ang sarili mong mga larawan ay nasa ilalim ng `assets/uploads/` at ang catalogue na likha ay nasa `assets/catalog/`, bawat isa ay may tunay na pangalan at extension, nakalista sa `manifest.json` ang bawat isa at sinasabi ng README sa itaas kung ano ang file.

May tatlong bagay na ikaw ang magpapasya bago ito umalis:

- **Kung isasama ang iyong pangalan.** Isinusulat ang iyong pangalan, email at organisasyon sa file lamang kapag naka-on ang **Use my details to create** sa iyong profile. Kapag naka-off ito, itinatala ng file na ginawa ito gamit ang Lolly at kung kailan - wala nang tungkol sa iyo.
- **Kung isasama ang licensed art.** Pinipigil bilang default ang licensed at brand-locked assets. Kung gumagamit ng mga ito ang disenyo, sinasabi ng dialog kung ilan at nag-aalok ito ng dalawang button - *Download without them* o *Include and download* - dahil ang pagsasama sa kanila ay nagbibigay ng mismong mga file sa kahit sinong magbukas ng `.lolly`.
- **Kung isasama ang tool.** Pinapasok ng **Include the tool** ang sariling mga file ng tool kasama ng disenyo, para bumukas ito sa isang device na walang tool na iyon. Dumarating itong naka-tick para sa isang custom na tool - isang fork o isang pribadong brand tool na malamang na wala ang tatanggap - at naka-untick para sa isang tool na nakalista sa signed catalogue, dahil galing sa parehong pinagmulan ang kopya nila. (Sa isang build na walang signed catalogue, itinuturing na custom ang bawat tool at nagsisimulang naka-tick ang box.)

**Pagbukas ng isa.** I-drop ang isang `.lolly` sa app: pupunta ang mga asset sa library mo, pupunta ang session sa Projects, at bubukas ang tool dito. Walang sa iyo ang mao-overwrite: dumarating ang session bilang isang bagong naka-save na slot, samantalang ang isang asset na nasa device na ito ay tinutugma gamit ang checksum at ginagamit muli sa halip na duplicado. Sinusuri ang bawat bahagi laban sa sariling checksum ng file habang papasok, kaya ang isang kopyang nasira sa transit ay tatanggihan sa halip na kalahating ma-import.

Kung may dalang tool ang file na wala sa iyo, nagtatanong ang Lolly bago tumakbo ang tool na iyon: pinangangalanan ng **Trust this tool?** ang tool at ang may-akda nito at malinaw nitong sinasabi na ang pagbukas dito ay nagpapatakbo ng sariling code ng tool sa device mo, at ang **Trust & install** ang daan papasok. Tumanggi ka at nase-save pa rin sa projects mo ang ibinahaging gawa, naghihintay doon sa araw na idagdag mo ang tool. (May isang uri ng tool na hindi pa puwedeng i-sideload - ang code nito ay ipinapadala bilang isang module - at tinatanggihan din ito sa parehong paraan.)

Parehong nag-aabot ng snapshot ang isang link at ang isang file. Para magtrabaho sa parehong session *nang sabay* sa iba - dalawang device, walang server, hindi kailangan ng internet kung nasa iisang network kayo - tingnan ang [Pagtutulungan](/info/collaborate.html).

## Live camera (mga tool na tumutugon sa galaw)

Bawat photo **Filter** - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch at Imperfections - ay nagpapakita ng **Go live** na button kung saan may kamerang magagamit. I-on mo ito at susundan ng epekto ang webcam mo frame kada frame, kaya tumutugon ito sa galaw; puwede mong i-record ang resulta sa GIF, WebM o MP4. Ang mga frame ay binabasa at pinoproseso **sa device mo** at hindi kailanman umaalis dito, at ibinibitiw ang kamera sa mismong sandaling huminto ka o umalis sa tool. (May **Take a photo** din ang bawat image picker para kumuha ng iisang frame bilang larawang nasa device.)

## My images

Kapag pinayagan ka ng isang tool na magdagdag ng larawan mula sa device mo, itinatago ito nang eksakto sa dating nito - kaya nabe-verify pa rin ang Content Credential dito - at nase-save sa personal mong **My images** na library (sa ilalim ng **Profile → Storage**). Tanging ang talagang napakalaking file ang nagtatanong kung itatago o babaguhin ang laki nito. Gamitin itong muli sa anumang tool. Para linisin ang EXIF/GPS habang pumapasok ang mga larawan, i-on ang **Strip metadata from uploads** sa profile mo. Walang hangganan: ganap na lokal ang library at limitado lang ito ng imbakan ng device mo - pamahalaan o burahin ang mga larawan doon.

## Ang Catalogue - ang library ng mga asset mo

Ang **Catalogue** (`#/c`, o ang **Catalog** na bahagi ng Projects · Tools · Utilities · Catalog na switch sa itaas ng bawat listing view) ay tinitipon ang lahat ng puwedeng gamitin ng mga tool mo - mga brand logo, larawan, audio at motion, nakagrupo ayon sa uri - at dito rin nakatira ang **sarili mong mga creative file**. Walang server, walang admin console, walang pull request: nasa device mo ang lahat.

![Ang Catalogue - mga brand asset, swatch at font, kasama ang sarili mong mga upload](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Ipasok ang mga file mo.** I-drag ang anumang larawan, SVG, audio clip, video, Lottie, PDF, o PowerPoint deck sa upload area - o mag-click para pumili - at makikita ito agad sa catalogue mo, handa na sa asset picker ng bawat tool. Ang isang multi-page PDF o isang `.pptx` ay magtatanong kung aling mga page o slide ang itatago - bawat isa ay nagiging isang SVG asset. Mag-ingest nang kahit magkano; hindi ito kailanman aalis sa device mo.
- <!--i:star--> **I-favourite ang mga madalas mong gamitin.** ★ ang isang asset (o isang brand swatch) at ito'y mapipin sa itaas ng bawat picker, para isang click lang ang layo ng paborito mong logo o kulay.
- <!--i:folder--> **Ayusin.** I-recategorise ang isang asset sa ibang grupo, itago ang isang shared brand asset na hindi mo ginagamit (may **Show hidden** para ibalik ito) o burahin nang tuluyan ang sarili mong mga upload. Gumagana rin dito ang parehong multi-select na galaw at floating action bar tulad sa Projects, kaya kahit alin sa mga iyon ay magagawa sa buong seleksyon nang sabay-sabay.
- <!--i:layers--> **Tanggalin ang background ng isang video.** Buksan ang detalye ng isang video o i-right-click ang card nito sa anumang asset picker at piliin ang **Remove background…** para i-save ang isang transparent na alternatibo - isang animated WebP o PNG na may tunay na alpha. Pumili ng isang **Method**: ang isang **On-device model** ay gumugupit ng isang subject mula sa isang busy na eksena, o ang isang **Colour key** ay nagtatanggal ng isang pantay na naiilawang, patag na backdrop tulad ng isang green screen o isang plain na pader, may **Tolerance**, **Softness**, at **Spill removal** para ayusin ang gilid. Hindi kailangan ng colour key ng pag-download ng model at ng network, kaya inaalok ang **Remove background** sa anumang video at kadalasang mas malinis sa maayos na footage. Ang isang kontrol na **Resolution** (360, 480, 720, o 1080p, hindi kailanman lalampas sa source) ay ipinagpapalit ang detalye para sa mas maliit, mas mabilis na file. Tumatakbo ito bilang isang background job sa device mo. Ang tapos na cut-out ay naka-save sa tabi ng orihinal bilang sarili nitong asset, at ang Content Credential ng source video ay sumasama bilang isang ingredient. (Tingnan ang [Isang beses ginawa, parehong kinukuha](/info/ai-features.html) kung bakit nananatiling isang ordinaryong edit ang pag-alis ng background.)

### Dalhin ang palette at font mo kahit saan

Higit pa sa pagpapakita ang ginagawa ng **Swatches** na panel ng Catalogue - i-click ang isang kulay para kopyahin ito, o **i-download ang buong brand palette** sa format na sinasalita ng iba mong tool:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** o **CSS classes** - ilagay ang brand diretso sa isang stylesheet o build;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - i-load ito sa Illustrator o Photoshop;
- <!--i:pentool--> **GIMP palette (.gpl)** - para sa GIMP o Inkscape.

![Ang Swatches na panel - ang limang palette download button sa itaas, tapos ang bawat brand na kulay bilang chip na puwedeng kopyahin](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Nililista ng **Fonts** na panel ang mga brand face mo na may **download** sa tabi ng bawat isa, para i-install nang lokal o iabot sa isang print shop. (Ang Colours room ng [Brand Studio](/info/brand-studio.html) ay nag-aalok ng parehong palette download.)

Ang mga asset ay isang kalahati ng bukas at gawin-mo-mismo na landas; ang kabila ay ang **paggawa ng sarili mong mga tool** - ang free canvas (Design, inilarawan sa itaas) ang nagpapagawa sa iyo ng isa nang biswal, walang kailangang code.

## Tunog at accessibility

Layunin ng Lolly na maging kumportableng gamitin para sa lahat. Nanabigahan ang interface sa keyboard, may wastong label ang mga custom na control para sa mga screen reader at ang buhay na preview ng bawat tool ay inilalabas bilang isang naka-label na larawang naglalarawan ng ginagawa nito.

May marahang layer ng **assistive sounds** na nagpapatunay sa ginagawa mo - ang pagdating sa gallery, isang wasto laban sa hindi wastong pagsusuri ng Content Credentials, ang pagsara ng isang panel, ang paglipat ng filter. **Naka-off ito bilang default**: i-on ang **Sound** saanman lumitaw ang switch (sa options popover ng bawat view, o sa **Profile**), at naaalala ang pinili mo.

May apat na opt-in na comfort setting sa ilalim ng **Profile → Accessibility**: ang **Reduce motion** (inaalis ang mga transition at palamuti ng app), ang **Hide colourful previews** (mahinahong icon-at-teksto na gallery card, at mas tahimik na project thumbnail), ang **High contrast** (mas malakas na border, teksto at focus ring) at ang **Large text** (mas malaking tipo ng app - mga label, menu, teksto ng button). Ang apat ay pinapakalma ang app *sa paligid* ng gawa mo: hindi sila kailanman umaabot sa loob ng isang tool canvas o nagbabago ng kahit isang pixel ng ini-export mo, at naka-off ang bawat isa hangga't hindi mo ino-on. Buong detalye sa [Ang profile mo → Accessibility](/info/profile.html#accessibility).

Sa tabi ng Sound na switch ay ang **Neurospicy Mode** - isang opsyonal at nakakakalmang background focus track na tahimik na tumutugtog habang nagtatrabaho ka. Ang pag-on nito ay nagbubukas ng maliit na **player dock** sa ibabang sulok na sumusunod sa iyo sa buong app; mula rito ay puwede kang maghanap at pumili ng track, lumaktaw pasulong at paurong, itakda ang lakas at i-minimise o isara ito. Sumasaklaw ang listahan ng track sa ilang kategorya - mga procedural na himig ng *Lolly Sings*, ambient na loop at beat, sarili mong na-upload na audio at ilang live na internet **radio** na istasyon (kailangan ng koneksyon ang mga ito; offline na tumutugtog ang lahat ng iba). **Naka-off ito bilang default** at, gaya ng Sound, naaalala ito sa lahat ng session at device. Ang pag-off sa Sound ay pinapatahimik din ang focus track.

## Imbakan at privacy

Nakaimbak ang lahat sa lokal na database ng browser mo (IndexedDB): ang profile mo, ang mga naka-save na session, ang mga na-upload na larawan at isang cache ng na-download na nilalaman ng catalog. Ipinapakita ng **Profile → Storage** ang paggamit at pinapayagan ka nitong:

- <!--i:box--> **Clear cache** - alisin ang na-download na nilalaman ng catalog (muling nagsi-sync sa susunod na load).
- <!--i:trash--> **Clear all my data** - burahin ang profile, mga session at larawan. *Hindi na ito mababawi.*

![Ang storage card sa screen na kasinlapad ng telepono: pinangalanan ang bawat kategorya ng datos na nasa device, kasama ang Clear all my data na button sa ibaba](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Wala sa lokal na datos na ito ang ipinapadala kahit saan - walang telemetry, walang cloud rendering. Ang kumpletong listahan ng kung ano ang kinukuha o ipinapadala ng app ay nasa [Privacy Policy](/info/privacy.html), at inililista ng [Server Surface](/info/server-surface.html) ang mga opsyonal na bahagi ng server.

## Paglipat sa ibang device

Dahil nasa device mo ang lahat, pinapayagan ka ng **Profile → Storage → Move to another device** na dalhin ang lahat sa isang pangalawang install - walang account, walang cloud:

- <!--i:download--> Ang **Export my data** ay nagda-download ng iisang `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (ang mga bahagi ng pangalan ay galing sa profile mo at inaalis kapag hindi nakatakda; ang `<n>` ay pang-araw-araw na counter para hindi magbanggaan ang mga export sa iisang araw) na naglalaman ng profile mo, ng bawat naka-save na session (kasama ang thumbnail nito), ng mga na-upload mong larawan at ng mga kagustuhan mo (theme, lapad ng sidebar, lokal na istatistika ng aktibidad).
- <!--i:upload--> Ang **Import data…** sa kabilang install ay binabasa muli ang file na iyon. **Pinagsasama** nito: anumang may parehong pangalan (ang profile mo, isang session slot, isang larawan) ay pinapalitan ng na-import na kopya; itinatago ang lahat ng iba pa sa device na iyon. Awtomatikong nagkakabit muli ang mga naka-save na session sa mga na-import mong larawan.

Hindi kasama ang catalog cache - muli itong nagda-download sa bagong device. Ang bundle ay isang payak na zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, format id `lolly-backup`), kaya buo itong nakakaligtas sa email, USB o AirDrop at ito rin ang format na binabasa ng bawat shell. May checksum ang bawat bahagi, kaya ang file na nasira sa daan ay nahuhuli sa pag-import sa halip na ma-restore nang kalahating sira. (Buong spec ng format: [Data Transfer](/info/data-transfer.html).)

## Pag-import ng disenyo (Figma, Penpot, Illustrator, InDesign)

Puwede mong dalhin sa Lolly ang isang umiiral na disenyo at ipagpatuloy ang trabaho rito: buksan ang **Design**, i-click ang **Import a design** sa canvas toolbar, at pumili ng Figma na **.fig** o SVG, Penpot na **.penpot**, Illustrator na **.ai** / **.pdf** o InDesign na **.idml**. Nagiging mae-edit na box sa free canvas ang mga layer - nananatiling matitipa muli ang teksto, napupunta sa **My images** ang mga larawan at umaayon ang tipo at mga kulay sa mga brand global - tapos ang resulta ay nase-save, naibabahagi at nire-render gaya ng anumang ibang session. Ganap na nangyayari sa device mo ang pag-parse. Buong detalye: **[Pag-import ng disenyo](/info/design-import.html)**.

## Pag-export

Tingnan ang **[Pag-export at mga format](/info/exporting.html)** para sa buong kuwento - pagpili ng format, laki ng output at mga print unit, transparency, video at copy/share. Sa madaling salita: pumili ng format, itakda ang laki kung kailangan at **Download** (o **Copy** papunta sa clipboard).

## Batch (Pro) mode

Para sa mga power user, nagre-render ang **Batch** (naka-link mula sa gallery, nasa likod ng Pro feature flag, na naka-on bilang default) ng maraming baryasyon nang sabay - isang grid kung saan ang bawat row ay isang set ng mga input, na sabay-sabay na ini-export. Mainam para sa paglo-localise ng isang card sa isang dosenang wika o sa paggawa ng bawat baryasyon ng laki sa iisang pasada. Punan ang mga row sa pamamagitan ng pagtatype, pag-paste diretso mula sa spreadsheet o pag-import ng CSV (puwede ka ring mag-export pabalik ng isa), at itakda ang format, laki at output filename kada row. I-save ang buong grid bilang isang pinangalanang **batch session** na muling bubukas mula sa gallery, at i-download ang bawat row bilang iisang `.zip`.

![Ang batch toolbar - pangalan ng zip, unit, DPI, at ang format na minamana ng bawat row, may Sessions at Render sa kanan](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Ang Batch ay para sa paggawa ng **maraming baryasyon ng iisang template** nang sabay. Para i-render muli ang mga session na **naka-save mo na**, gamitin ang **Projects → Render folder / Render selection** (sa itaas) - hindi kailangan ng Pro.

## Magkatabing pag-edit (Multi-edit)

Ang Batch ay maraming variant ng *isang* disenyo. Ang **Multi-edit** ang kalahati pang bahagi ng trabaho: maraming **magkakaibang** naka-save na disenyo na bukas nang sabay-sabay, kaya isang pagbabago ang aaplikado sa lahat ng ito. Mag-tick sa pagitan ng **dalawa hanggang walo** na naka-save na session sa **Projects** at piliin ang **Edit together** mula sa selection bar; bubukas ang mga ito bilang live na card magkatabi sa `#/multi?s=<slot>,<slot>…`. Bawat card ay isang tunay na render ng session na iyon, hindi isang naka-imbak na thumbnail, kaya kung ano ang nakikita mo ay kung ano ang ie-export nito.

Isang sidebar ang nagpapatakbo sa lahat:

- <!--i:sliders--> Ang **Shared** ang nangunguna - bawat input na idineklara ng dalawa o higit pa sa mga napiling session sa *parehong paraan* (parehong id, parehong uri, parehong constraint - ang parehong merge rule na ginagamit ng batch grid sa mga column nito). I-edit nang minsan ang isang shared na control at kakalat ang halaga sa bawat session na nagdedeklara nito, buhay sa bawat card. Ang dalawang session ng parehong tool ay nagbabahagi ng lahat; ang dalawang magkaibang tool ay nagbabahagi ng anumang nagkataong pareho sa kanila, at wala nang iba.
- <!--i:document--> Sa ilalim nito, **isang nakatiklop na card kada session** kasama ang lahat ng sariling input ng session na iyon, sa parehong katapatan ng sariling sidebar ng tool - mga asset picker, paulit-ulit na row group, colour field - kasama ang isang siksik na export block: **Format**, **W** / **H**, **Unit**, **DPI** at sarili nitong **Download**. Ang Download na iyon ay sine-save muna ang session at saka ito nire-render sa karaniwang session-export na daan, kaya dala ng file ang parehong filename, format at Content Credentials na dadalhin nito kung diretso mula sa tool.
- <!--i:search--> Ang **Filter inputs…** sa itaas ay pinapaliit ang mga control sa *bawat* card nang sabay - at ganoon mo naaabot ang "ang headline" sa walong session nang hindi ito hinahanap sa scroll.

I-click ang alinmang canvas (o pindutin ang Enter dito) at bubukas ang sidebar card ng session na iyon at lilitaw ito sa view. Ang **Save all** ay isinusulat pabalik ang bawat session sa sarili nitong slot. Ang **Download all** ay nagse-save muna, tapos nire-render ang buong set sa parehong pipeline ng **Render selection** ng Projects - isang zip, kasama ang opsyonal na password lock na inaalok sa daan.

Dalawang tapat na limitasyon. Totoo ang hangganang dalawa-hanggang-walo: bawat card ay nagta-mount ng sarili nitong live runtime, at iyon ang bilang na nananatiling maagap - ang link na humihingi ng higit pa (o ng session na wala na) ay sasabihin ito sa halip na mag-load nang kalahati. At pinangangalanan ng link ang *iyong* mga naka-save na slot, kaya muli nitong binubuksan ang set na iyon sa device na ito; hindi ito isang share link.

Kapag mas malaki sa walo ang napili, may halong iba't ibang tool o may kasamang mga larawan bukod sa mga session, ang labasan ay ang **Edit as sheet** sa parehong selection bar: binubuksan nito ang buong napili bilang **mga row sa batch grid** (`#/pro?s=…`), walang limitasyon sa laki at walang panuntunang iisang tool. Wala sa dalawa ang mga folder - may sarili silang daan ng pagbukas sa grid. (Ang [Search](/info/search.html) ang isang bagay na hindi pa umaabot dito: ang Multi-edit ang tanging view na hindi kilala ng search bar.)

## Offline at pag-install

Ang Lolly ay isang PWA. Pagkatapos ng unang load ay gumagana ito **offline** - i-install ito mula sa address bar ng browser mo (o *Add to Home Screen* sa mobile) para sa isang parang-app at full-screen na karanasan. Nag-a-update ito nang mag-isa kapag online ka na muli.

Tungkol sa mga update: kung hindi ma-load ang isang view kaagad pagkatapos ng isang update (isang blangkong panel, isang "failed to fetch" sa sulok), i-reload ang page nang isang beses - kukunin ng app ang bagong bersyon nang malinis at hindi maaapektuhan ang trabaho, session, at brand mo. Iniimbak nito ang lahat sa device mo, hindi sa page.
