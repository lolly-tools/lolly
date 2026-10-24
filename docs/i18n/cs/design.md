# Design: volné plátno

Design je nástroj pro rozvržení, která žádná šablona nepokrývá: plakát od nuly, sada snímků, pohybový kus se zvukovou stopou. Místo formuláře ovládacích prvků dostaneš plátno z polí, která přetahuješ, měníš jim velikost, otáčíš je a píšeš do nich. Exportuje se stejnou vykreslovací cestou jako každý jiný nástroj, takže to, co vidíš na plátně, je soubor, který dostaneš.

Tato stránka provádí plátnem od prvního pole po hotovou sadu snímků: okno, tvarování polí, kreslení vlastních tvarů, umisťování 3D scén a jiných nástrojů, přidávání času, kontrola výsledku a prezentování hotové sady. [Používání Lolly](/info/using.html) pokrývá, co Design sdílí s každým nástrojem, třeba ukládání a sdílení.

![Volné plátno Designu - kresebná plocha a okolní podložka](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Okno Design

**Horní lišta** začíná tlačítky **Home**, **File menu** a názvem dokumentu (kliknutím na název dokument přejmenuješ). Uprostřed jsou **Undo**, **Redo**, **History**, ovládání zvětšení (s **Fit all** a **Fit artboard**) a přepínače **Timeline**, **Navigator** a **Inspector**. Vpravo jsou **Share**, **Present** a **Export**. Na telefonu se méně používaná tlačítka přesunou do **More actions**.

**Lišta nástrojů** po straně drží nabídku Lolly a nástroje, kterými kreslíš: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, pak tlačítka Timeline, Artboards a Auto-arrange.

![Lišta nástrojů volného plátna: úchyt pro tažení, nabídka Lolly, pak Ukazatel, Přidat rámeček, Pero, Upravit body, Čára, Časová osa, Kresebné plochy a Automaticky uspořádat](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Plátno funguje jako návrhářův stůl kolem kreslicí plochy:

- **Odlož pole mimo kreslicí plochu.** Přetáhni pole za okraj rámu a zůstane viditelné a vybratelné. Vše mimo rám je vyblednuté a rám si drží stín, aby označil, kde soubor začíná.
- **Exportuje se jen kreslicí plocha.** Cokoli mimo rám nebo část pole přečnívající přes okraj se z výstupu ořízne v rastrových i vektorových formátech.
- **Oddal za Fit**, až na 20 %, abys viděl vše, co jsi odložil.
- **Změň velikost kreslicí plochy** změnou velikosti exportu. Pole si drží pozice, takže můžeš přerámovat rozvržení kolem existujícího obsahu.

![Editační scéna: kreslicí plocha uprostřed, lišta nástrojů vlevo a HUD zvětšení v rohu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator a Inspector

**Navigator** vypisuje každou kreslicí plochu (s nadpisem **Artboards**, v sadě snímků **Slides**) jako sbalitelnou skupinu jejích **Layers**. Vyber název kreslicí plochy, abys na ni skočil, rozbal ji pro výběr nebo přeřazení vrstev a šipkami se pohybuj seznamem; Left se vrátí na nadpis kreslicí plochy. **Pages** seskupuje kreslicí plochy do pojmenovaných stránek a výběr stránky mění jen to, které kreslicí plochy editor ukazuje.

**Inspector** staví na první místo ovládání textu nebo obrázku vybraného objektu. Čipy voleb pokrývají rychlé volby a **Advanced** drží podrobnosti stylu. Na telefonu se Inspector otevře jako list z **More actions**; Escape nebo Back list zavře a výběr zůstane.

![Sekce Document v Inspectoru: karty Selection a Canvas, pak Dimensions a Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Změna velikosti, škálování a otáčení

Vyber objekt, pak táhni úchyt pro změnu velikosti, nebo táhni kulatý úchyt pod výběrem pro otočení objektu. Tažení velikosti funguje ve dvou režimech:

- **Resize**, výchozí, mění jen pole. Text se přeformátuje na novou velikost a velikost písma, tloušťka čáry, poloměr rohů a efekty zůstanou, jak byly.
- **Scale** zvětšuje nebo zmenšuje celý objekt s jeho obsahem: velikost písma, čára, poloměr rohů, stín, rozostření, odsazení i mezery se změní o stejnou míru.

Stiskni `K` pro zapnutí nebo vypnutí Scale. Bez klávesnice zvol **Scale mode** v nabídce Lolly, nebo stiskni a podrž tlačítko **Pointer** na liště (nebo na něj klikni pravým tlačítkem) a zvol **Scale**; na dotykové obrazovce má lišta objektu také přepínač Scale. Když je Scale zapnuté, tlačítko Pointer ukazuje ikonu Scale a každý úchyt má uprostřed tečku. `V` nebo **Escape** se vrátí k Resize a ponechá výběr. Každý dokument se otevírá s vypnutým Scale, takže nikdo nezmění čáry omylem.

**Škálování číslem.** Se zapnutým Scale nebo s vybranými několika objekty klikni na údaj na liště objektu a otevři vyskakovací okno **Scale**. Zadej procento, šířku nebo výšku, vyber bod, který zůstane na místě, v mřížce 3 x 3 a zvol **Apply**. Každé škálování je jeden krok vrácení.

**Několik objektů.** Výběr několika objektů má úchyty na hranách i v rozích. Dokud je každý objekt vzpřímený nebo otočený o celé čtvrtobraty a výběr neobsahuje skupinu ani kruh, tažení rohu mění šířku a výšku volně. Jinak výběr drží proporce a údaj přidá **Proportional**. Při tažení malý štítek ukazuje velikost, v režimu Scale procento.

**Překlopení výběru.** Klikni pravým tlačítkem a zvol **Flip horizontal** nebo **Flip vertical**, nebo stiskni `Shift+H` nebo `Shift+V` (Shift, protože samotné `V` je Pointer). Zrcadlení je skutečná transformace, takže exportované SVG, PDF i PNG překlopení zachovají.

**Klávesy držené při tažení** se projeví v okamžiku stisku nebo uvolnění; listy zkratek (`?`) je také vypisuje.

| Držet | Změna velikosti nebo škálování | Otáčení | Přesouvání |
|---|---|---|---|
| **Shift** | Drží proporce (Scale vždy) | Otáčí po krocích 15 stupňů | Beze změny |
| **Alt** (Option) | Pracuje od středu | Otáčí volně | Vypne přichytávání a mřížku |
| **Cmd/Ctrl** | Vypne přichytávání a mřížku | Otáčí volně | Vypne přichytávání a mřížku |

Bez držené klávesy se otočení přitáhne na nejbližších 15 stupňů, jakmile se k nim přiblíží na 4 stupně. Kreslicí plochy se neotáčejí, takže nemají úchyt otáčení.

::: details Úchyty, zóny uchopení a dotyk
**Uchop kdekoli podél hrany.** Každá strana výběru je po celé délce pruhem pro změnu velikosti a s myší nebo perem je těsně mimo každý roh zóna otáčení. Ukazatel ukazuje, co tažení udělá. Stisk v pruhu nebo zóně se stane změnou velikosti nebo otočením až po zahájení tažení, takže prosté kliknutí stále vybírá jako dřív. Zamčený objekt nemá úchyty, pruhy ani zóny.

**Malé objekty zůstávají přesouvatelné.** U objektu s 25 pixely na obrazovce nebo méně se prostřední úchyty skryjí a ostatní se posunou kousek od obrysu, takže stisk na objekt objekt přesune. Při 10 pixelech nebo méně zmizí i rohové úchyty a tenká čára si drží úchyt na každém konci. Stisk těsně vedle tenké čáry nebo drobného objektu, mimo jeho úchyty, objekt přesune.

**Velké oblasti uchopení.** Na dotykové obrazovce je každá rohová zóna čtvrtinou šířky a výšky výběru na obrazovce, mezi 24 a 44 pixely, a každá zóna strany pokrývá úsek mezi dvěma rohy. Když je výběr pro to příliš malý, zóny se přesunou mimo jeho obrys. Zóna pod ukazatelem nebo prstem je zastíněná. Chceš-li stejné zóny s myší nebo perem, zapni **Large grab areas** v nabídce Lolly; nastavení zůstává na tomto zařízení.

**Dva prsty na výběru.** Na dotykové obrazovce polož dva prsty na vybraný objekt: štípnutím škáluješ, stočením otáčíš nebo oběma prsty pohybuješ a neseš výběr, vše jako jeden krok vrácení. Se zapnutým Scale štípnutí škáluje i obsah; s vypnutým mění velikost v poměru. Stočení se přichytí na nejbližších 15 stupňů, je-li blízko, a pohyb dvěma prsty se nikdy nepřichytává. První prst musí dosednout na výběr a druhý rychle následovat, na výběr nebo těsně za jeho okraj. Dva prsty kdekoli jinde zvětšují a posouvají zobrazení, a stejně tak dva prsty na výběru, který obsahuje kreslicí plochu nebo zamčený objekt, pokrývá většinu zobrazení nebo přesahuje jeho okraj.
:::

## Kresli vlastní tvary

Pole, kruhy a zaoblené rámy pokrývají většinu rozvržení. Pro jakýkoli jiný tvar ho nakresli: tlačítko **Pen** na liště (nebo `P`) tě přepne do režimu kreslení. Mezi režimy přepínají tři jednotlivé klávesy: `V` pro Pointer, `P` pro Pen a `N` pro **Edit points**. Pointer je vždy cesta ven.

- **Kliknutím** umístíš bod. U výchozího typu křivky **kliknutí s tažením** vytáhne úchyty bodu a vytvoří křivku; podrž **Alt** při kliknutí pro ostrý roh. (U ostatních typů křivek je každý bod rohem a tažení nedělá nic.)
- Body se při umisťování přichytávají ke kreslicí ploše a dalším polím. Alt při kreslení potlačí mřížku a při pozdějším tažení bodu mřížku i hrany.
- **Klikni na první bod** pro uzavření tvaru. Jinak stiskni **Enter**, dvakrát klikni nebo přepni nástroj a kresba se zachová.
- **Escape** funguje po jednom kroku: první stisk kresbu opustí, druhý opustí pero.
- **Delete** při kreslení odstraní poslední bod.

Výsledkem je běžné pole. Cestu přesouvej, měň jí velikost, otáčej, seskupuj, zarovnávej, přeskládávej, vyplňuj, stínuj nebo vyblednuj jako jakékoli jiné pole. První cesta převezme výplň a čáru, které tvá značka cestě dává, a každá další převezme to, co jsi naposledy použil. V nástroji, jehož značka pro cesty nic nenastavuje, je nová cesta vykreslena barvou, kterou jsi kreslil, takže tvar nikdy není neviditelný.

**Body znovu upravit.** Dvakrát klikni na tvar nebo použij **Edit points** na liště objektu. Tažením bodu ho přesuneš, tažením úchytu přemíříš křivku, kliknutím na křivku vložíš bod nebo táhni rámeček kolem několika bodů a stiskni Delete. Cesta vždy zachová alespoň dva body.

**Spline type** určuje, jaký druh křivky vede tvými body:

| Typ | Co dělá |
|---|---|
| **Smooth (auto)** | Výchozí. Vypočítá si délky úchytů sám, takže prosté kliknutí dává hladkou křivku. Úchyt, který nastavíš, připne směr a křivka si stále vlastní délku. |
| **Bezier handles** | Klasické pero: ovládáš každý úchyt a vložení bodu nikdy nepohne křivkou. |
| **Through the points** | Prochází přesně každým bodem, bez úchytů. |
| **B-spline** | Plyne poblíž bodů, ne jimi, pro jemnější čáru. |
| **Straight lines** | Lomená čára. |

Přepnutí existující cesty na typ, který si úchyty vypočítá sám, se nejprve zeptá, protože délky úchytů, které jsi nastavil, nelze obnovit; přepnutí na **Bezier handles** je vždy bez ztrát. Uprostřed kreslení se přepnutí projeví hned a všechny úchyty, které jsi vytáhl, se zahodí.

Každý bod také nese pravidlo spojitosti, vyjádřené jeho tvarem: čtverec pro **Corner** (úchyty se pohybují nezávisle), kruh pro **Smooth** (úchyty zůstávají v jedné přímce) a kruh s prstencem pro **Symmetric** (v přímce a stejně dlouhé). Nastav pravidlo pro vybrané body a křivka ho hned následuje.

![Dvě perové cesty vykreslené rovnou z odkazu: obtažená křivka do S a uzavřená vyplněná skvrna](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Nakreslená cesta putuje ve sdíleném odkazu jako jakékoli jiné pole a vykresluje se stejně z příkazového řádku.

## Kombinace tvarů

Vyber dva nebo více tvarů, klikni pravým tlačítkem na plátno (na dotyku klepni dvěma prsty) a zvol:

- **Union** je sloučí do jednoho tvaru s výplní nejvyššího z nich.
- **Subtract** vyřízne vše nahoře ze spodního tvaru.
- **Intersect** ponechá jen překryv.
- **Exclude** ponechá vše kromě překryvu.

Další tři fungují na jediném tvaru. **Outline stroke…** změní čáru na vyplněný obrys stejné tloušťky. **Offset path…** zvětší obrys směrem ven, nebo se zápornou hodnotou zmenší dovnitř. **Simplify** přestaví cestu s menším počtem segmentů při stejném obrysu.

![Půlměsíc a prstenec se skutečnou dírou, oba vytvořené pomocí Subtract](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Výsledkem je nová cesta, kterou můžeš dál upravovat perem, uložená jako prosté Bézierovy křivky, takže původní typ splinu se nepřenáší. Díry jsou skutečné díry: ovládací prvek **Fill rule** na panelu čáry rozhoduje, zda se překrývající kontury vyplní (*non-zero*), nebo prorazí (*even-odd*). Operace raději odmítnou, než by něco zničily: požádáš-li o průnik dvou tvarů, které se nepřekrývají, nic se nezmění. Textová a obrázková pole nemají obrys, takže zůstanou nedotčena.

## 3D scény a nástroje uvnitř návrhu

Pole může obsahovat víc než obrázek. Oba níže uvedené druhy drží recept, ne vykreslený obrázek, takže se překreslí v jakékoli velikosti a okamžiku, který dokument žádá, a aktualizace zdroje dosáhne každého návrhu, který zdroj používá.

### 3D scény

Zvol **3D scene** v nabídce přidání na liště a táhni rám: 3D Studio se otevře na novém poli a to, co tam nastavíš, se vrátí na plátno. Poté **Edit in 3D Studio** v sekci **3D scene** Inspectoru studio znovu otevře. [Umístění scény v Design](/info/3d-studio.html#place-a-scene-in-design) pokrývá plakáty, časovou osu, export a sdílení.

### Nástroje uvnitř návrhu

Zvol **Image** v nabídce přidání na liště, táhni rám a vyber nástroj na kartě **Tools** výběru. Nástroj vyplní rám svými výchozími hodnotami a Inspector se otevře na sekci **Tool**, která drží vlastní ovládací prvky toho nástroje. Změň pole a pole se o chvíli později aktualizuje, jako jeden krok vrácení. **Image fit** a **Image position** fungují jako u jakéhokoli obrázku a **Replace with another tool or image** vymění obsah pole.

**Nástroje, které se hýbou,** hrají uvnitř pole: smyčková ilustrace se na plátně dál opakuje, po otevření časové osy sleduje přehrávací hlavu a exportuje se snímek po snímku do GIF, MP4 nebo WebM. Když nástroj říká, jak dlouho trvá jedna smyčka, pole dostane klip přesně té délky, takže video drží celé smyčky. Klip, který jsi přečasoval, si drží tvé časování a vypnutí pohybu nástroje z pole opět udělá statický obrázek.

## Časová osa (Sekvence)

**Sequence** je časová osa Design: přidává plátnu čas. Každé pole může začít v okamžiku, běžet po určitou délku a animovat se dovnitř a ven a časová osa ukotvená pod kreslicí plochou je místo, kde je uspořádáš. Začni od šablony **Video** v Design a krátká sekvence je už připravena: dvě časované textové karty na řádku sekvence a procedurální hudební podklad pod nimi, takže vidíš, jak časová osa funguje, než cokoli změníš.

![Časová osa Sekvence: transport, pravítko, překryvová dráha, magnetický řádek sekvence s klipy a spojovacími čipy a pás Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Existují dva druhy řádků:

- **Řádek sekvence** je magnetický. Klipy leží těsně za sebou, přetažení jednoho přeřadí průběh a smazání jednoho zavře mezeru. To je páteř.
- **Překryvné dráhy** jsou volné. Spodní třetina, logo nebo titulek plave nad páteří ve vlastním čase, každý na své dráze.
- Pod nimi **Always on** drží pole bez časování, přítomná po celou dobu. `+` na čipu jedno přesune na dráhu; **Make always on** jej vrátí.

Otevření časové osy jí dá klávesnici, takže Space a šipky řídí přehrávací hlavu. Kompozice, která už časování má, otevře časovou osu sama.

**Úpravy.** Táhni klip za střed pro přesun, táhni poblíž kteréhokoli konce pro ořez a stiskni **Split at playhead** (nebo `S`) pro rozříznutí na dvě. Split potřebuje klip se skutečnou **Length** a přehrávací hlavu kousek uvnitř, takže klip s otevřeným koncem, například hudební podklad, rozdělit nejde. **Snap to edges** je ve výchozím stavu zapnuto a přichytává ke hranám klipů, přehrávací hlavě a celým sekundám; podrž Alt pro tažení bez přichytávání. Každé tažení je jeden krok vrácení a náhled při tažení používá stejnou aritmetiku jako výsledek.

Vyber klip a inspektor dává stejné úpravy jako čísla: **Length**, **Trim in** (jak hluboko do zdroje klip začíná), **Speed** od ×0.25 do ×4, **Animate in** a **Animate out** s jejich délkami a **Mute clip**. Klip na magnetickém řádku nemá pole **Start**, protože pořadí vlastní řádek.

**Přechody** jsou předvolby: Fade, Pop, Grow, Rise, Drop, čtyři Slides, Zoom in a out, Tilt, Swoop, Spin, Drift nebo **Cut (no animation)**. Vzdálenosti se škálují s objektem, takže jedna předvolba vypadá správně na celoobrazové kartě i na malém odznaku. Mezi dvěma klipy na řádku sekvence vybírá **seam chip** **Cut** nebo **Crossfade**; otevři jej znovu pro nastavení **Length (ms)** a stiskni **Done**. V crossfade první klip hraje za střihem a mizí, zatímco další se objevuje, stejně v náhledu i v souboru.

**Zvuk.** Klip **Audio** žije na časové ose jako každý jiný klip, s vlnou, ořezem a ztlumením. Vygenerovaný hudební podklad šablony Video se syntetizuje při exportu, takže jeho lišta zůstává prostá a tichá, dokud nevykreslíš. Stiskni mikrofon pro **nahrání komentáře** rovnou na časovou osu, s odpočtem a měřičem úrovně; záznam se uloží jako tvůj vlastní asset na přehrávací hlavě. Tlačítko kamery vedle mikrofonu **nahraje video** stejným způsobem, při nahrávání ořezané na kreslicí plochu, takže kolega může přidat klip ze sdíleného odkazu. Vyber jakýkoli klip se zvukem a jeho pás se otevře pod časovou osou pro hlasitost, panorama, EQ, výšku tónu, normalizaci a efekty jako **Voice cleanup**; pás pokrývá [Sound](/info/sequence-editor.html#sound) v průvodci editorem sekvencí. **Audio track** v panelu exportu je oddělená věc: jeden podklad pod celým klipem, s prolínáním a ducking.

![Časová osa s vybraným hudebním klipem: jeho pruh běží podél spodku s Rychlostí, Prolínáním, Hlasitostí, Posunem, EQ, Výškou, Normalizací hlasitosti a slotem Efekt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Vykreslování.** Pohybový export kreslí, dekóduje a kóduje každý snímek v přesném čase, takže soubor nezávisí na tom, zda tvůj počítač stíhá, a MP4 a WebM nemají praktický strop snímků. Délka časové osy určuje trvání, pokud nezadáš jiné, a Content Credentials se razítkují jako u každého jiného exportu. Statický export dává snímek na přehrávací hlavě nebo kontaktní arch z pole **Frames**; viz [Statické snímky z časované kompozice](/info/exporting.html#stills-from-a-timed-composition). Sekvence je omezena na jednu hodinu. GIF a animované PNG drží každý snímek v paměti, takže se hodí pro krátké klipy. **Record live** je zde skryto, protože vykreslení snímek po snímku je lepší cesta.

**Klíčové snímky, hloubka a kamera.** Přechod animuje klip při příchodu a odchodu. Chceš-li pole v rámci klipu zapózovat (drift, prolnutí, rozostření, zvednout ho ze stránky a zase usadit), vyber klip a stiskni **+Keyframe**: kosočtverec v nástrojích časové osy, kosočtverec na liště objektu na plátně nebo **Shift+K** s fokusem na časové ose. Pozice přehrávací hlavy rozhoduje, kterou pózu zapíše tvá další úprava. Stejné klíčové snímky dávají časované kompozici kameru, která najíždí, posouvá se a vytahuje ostrost. [Animace](/info/animating.html) je úplný průvodce a [Editor sekvencí](/info/sequence-editor.html) pokrývá výběr, onion skin, dělení, ořez a značky.

## Před exportem

Design kontroluje dokument, než soubor odešleš. Karta **Before you export** v sekci **Document** Inspectoru a znovu v panelu exportu čte uloženou strukturu vrstev, pak se podívá na usazené plátno kvůli oříznutému textu a kontrastu plných barev. Ptá se stejného registru písem, který používá obrysování SVG a PDF, zda má každý textový úsek bajty písma, které lze vložit. Pozadí z obrázků a přechodů jsou uvedena jako vizuální kontroly, ne s vymyšleným skóre kontrastu.

### Zkontroluj kompozici proti designovému systému

Karta v panelu exportu také porovnává kompozici s tvým designovým systémem, ve stejné verzi designového systému, kterou používá vykreslení. Dívá se na autorské barvy, aliasy tokenů, volby písem a ID assetů obrázků. Vlastní hodnota může být záměrná a obrázek mimo deklarované assety značky je položka k revizi, ne zakázaný obrázek.

Kde existuje konkrétní návrh barvy nebo písma, jeho tlačítko změní tu jednu vrstvu a **Undo** obnoví originál. Zamčené nebo mezitím změněné vrstvy se starým návrhem nikdy nepřepíšou. Přechody, efekty, vnořený obsah nástrojů, práva a subjektivní kvalita jsou mimo toto porovnání a žádná kontrola nebrání Download.

### Interní pravidla a signál psaní

Karta v panelu exportu také kontroluje interní pravidla, která tvůj designový systém přináší, například tloušťku a zarovnání textu, schválené dvojice barev nebo logo pro každou plochu, vrstvu po vrstvě. Každý nález je varování s názvem vrstvy nad pravidlem. Pravidlo, pro které toto sestavení nemá kontrolu, je uvedeno jako nezkontrolované, nikdy jako dodržené. [Usage & rules](/info/brand-studio.html#usage-rules) pravidla vypisuje a `lolly check` uplatňuje tatáž na uložený dokument.

Stejná karta ukazuje signál psaní pro text, který dokument kreslí: jeho pásmo (none, weak, notable nebo strong), pak větu samotného Verify se skóre ze 100 a až třemi označenými frázemi, každou s vrstvou, která je drží. **Open the text in Verify** odnese ten text do [Verify](/#/verify) pro úplné čtení; [Důkazy AI ve Verify](/info/verify-ai-evidence.html) vysvětlují, co skóre váží. Skóre je signál, ne verdikt: počítá vzorce běžné v generovaném psaní a nepozná, kdo slova napsal. Skryté vrstvy jsou z obou kontrol vynechány a karta říká kolik.

Nálezy interních pravidel a silný signál psaní se počítají do součtu "to fix" na kartě, aby byly snadno k nalezení. Informují a nikdy neblokují: Download zůstává dostupné a není co odmítnout ani zaznamenat jako výjimku. Agent pracující v otevřeném dokumentu dostane stejnou zprávu přes své nástroje webu ([Agenti v otevřeném dokumentu](/info/open-document-agents.html)).

Tiskové kontroly (spadávka, rozlišení, pokrytí inkoustem a počty desek) se připojí ke stejné kartě, když zapneš **Settings → Feature flags → Print preflight**. V ostatních nástrojích je tento příznak tím, co kartu vůbec ukáže; tiskové kontroly popisuje [Export souboru](/info/exporting.html).

## Prezentování

Dokument Design složený z kreslicích ploch už je sada snímků. Stiskni **Present** v horní liště a každá kreslicí plocha se stane snímkem na celou obrazovku, v pořadí, v jakém leží na plátně. Tlačítko se jmenuje **Preview**, dokud **Design outcome** dokumentu není **Slides**. Sada běží na kopii vykreslených kreslicích ploch, takže odchod tě vrátí přesně tam, kde jsi byl.

Šipka vedle **Present** otevře **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** a **Export slides as video**.

| Klávesa | Co dělá |
|---|---|
| **Space**, `→`, **Page Down** | Další krok nebo snímek (nebo klikni na pruh u pravého okraje) |
| `←`, **Page Up** | Zpět (nebo klikni na pruh u levého okraje) |
| **Home**, **End** | První nebo poslední snímek |
| `O` | Přehled: každá kreslicí plocha v rozložení tvého plátna; kliknutím jednu otevřeš |
| `S` | Zobrazení řečníka: aktuální snímek, další snímek, poznámky a hodiny ve druhém okně |
| `B` | Černá obrazovka; libovolná klávesa snímek vrátí |
| `F` | Zpět na celou obrazovku |
| `K` | Pozastavení nebo restart kioskové sady |
| **Escape** | Sloupne jednu vrstvu: přehled na sadu, sada na editor |

Malý ovládací pruh se objeví, když pohneš ukazatelem, a znovu se skryje, když přestaneš. Pokud prohlížeč blokuje vyskakovací okno řečníka, zobrazení řečníka se otevře jako panel nad sadou. Poznámky patří ke každé kreslicí ploše a na snímku se nikdy neobjeví.

- **Postupné odkrývání.** Klikni pravým tlačítkem na pole a místo **Always visible** zvol **Reveal at step 1**, **2** nebo **3** a pole počká, až postoupíš na jeho krok. Pole se stejným číslem přijdou společně.
- **Kiosk.** Dej kreslicí ploše **Length** a sada tam tak dlouho setrvá a pak postoupí za tenkým ukazatelem průběhu. Přidej do odkazu `kiosk` a sada se na konci zacyklí, pro digitální signage.
- **Zásobníky podsnímků.** Klikni pravým tlačítkem na kreslicí plochu a zvol **Stack under the previous slide**, aby se stala krokem toho snímku. Přehled ukáže jednu kartu a řádek **Stack** v inspektoru říká, ke kterému snímku kreslicí plocha patří.
- **Morph.** Když dva po sobě jdoucí snímky mají pole se stejným názvem **Morph match** (třeba `hero`), přechod to pole přesune, změní mu velikost a barvu místo střihu. **Morph** přechod pro celou sadu totéž udělá s každým spárovaným párem.
- **Vyprávění.** **Speaker notes** každé kreslicí plochy lze číst nahlas. V sekci **Document** Inspectoru zvol **Voice**, volitelně druhý hlas k **Blend with**, **Speed** a **Lead-in** a **Tail** v milisekundách; **Show captions when presenting** ukazuje slova, jak jsou vyslovována. Hlas běží na tvém zařízení a tytéž poznámky se stanou zvukovou stopou exportu videa, zvukem snímků v exportu PowerPoint a namluveným filmem v [balíčku SCORM](/info/create/exporting.html#scorm-course-packages).

Sada je také odkaz. `?present` se otevře rovnou do ní a `s=` vybere snímek (pozici, ID kreslicí plochy nebo `id.step` pro krok sestavení) a adresa tě sleduje, takže to, co pošleš, je snímek, na kterém jsi. Dokumentují je [Rezervované parametry URL](/info/url-parameters.html#what-happens-on-open).

**Present with camera** umístí tvou kameru, logo a titulek se jménem nad snímky, se soukromými ovládacími prvky a uloženými scénami; viz [Prezentace s kamerou](/info/presenting.html). Pole **Web page** může během přednášky převzít ovladač, když v jeho inspektoru zapneš **Make interactive**: v jeho kroku **Focus on click** ovládají Nahoru a Dolů stránku, zatímco Další pokračuje v sadě. [Živé stránky, které berou ovladač](/info/interactive-pages.html) pokrývá styly fokusu, zastavení rolování a schválení webu.

## Kam dál

- **[Text v Design](/info/text-composition.html)**: úpravy textu na plátně, plynutí článků mezi rámci a typografie.
- **[Animace](/info/animating.html)**: klíčové snímky, hloubka, kamera scény a vrstvy Lift.
- **[Import návrhu](/info/design-import.html)**: otevři soubor z Figmy, Penpotu, Illustratoru nebo InDesignu jako upravitelná pole.
- **[Sdílej návrh s pravidly](/info/create-a-tool.html)**: změň dokument Design na nástroj jen se vstupy, které zvolíš.
- **[Export souboru](/info/exporting.html)**: formáty, velikosti, tiskové jednotky a video.
