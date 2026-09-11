# Lolly'yi kullanma

Uygulamayı gerçekten *kullanmaya* dair pratik bir rehber - bir araç açmak, kanvasta çalışmak, dışa aktarmak, kaydetmek ve paylaşmak. Buradaki her şey **cihazında** çalışır: hesap yok, yükleme yok, ilk yüklemeden sonra internet gerekmez.

> Yeni misin? [Hızlı başlangıç](/info/quickstart.html) seni dakikalar içinde bir şeyler üretir hale getirir, [Operatörler için Lolly](/info/operators.html) ise uygulamayı kurmayı/dağıtmayı anlatır; bu sayfa ise açıldıktan sonra onu kullanmakla ilgili.

## Bir araç açma

Ana ekran **galeri**dir - kategoriye göre gruplanmış tüm araçlar. Aracı açmak için bir karta tıkla; daha önce üzerinde çalıştıysan bir **Devam et** düğmesi en son oturumunu sürdürür. İsme göre filtrelemek için arama kutusunu kullan - ya da altı listeleme ekranının (galeri, Yardımcı araçlar, Projeler, Katalog, Panel ve Profil) altındaki çubuktan [Ara](/info/search.html); bu arama, araçların yanı sıra kaydedilmiş işlerine, kataloğa ve ayarlarına da ulaşır. Bir aracın içinde çubuk, aracın kendi arayüzüne yer açmak için kenara çekilir.

![Araç galerisi - kategoriye göre gruplanmış, her biri bir kart olarak tüm araçlar](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Her araç bölünmüş bir görünümdür: bir tarafta **kontroller**, diğer tarafta canlı bir **önizleme** (kanvas). Herhangi bir kontrolü değiştir, önizleme anında güncellenir.

![Bir aracın bölünmüş görünümü - solda kontrol yığını, sağda çizdiği canlı gruplu çubuk grafik](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Birkaç araç (**Design** gibi) bunun yerine bir **serbest kanvas** olarak açılır - metin, şekil ve görsel kutularını sürüklediğin, yeniden boyutlandırdığın, döndürdüğün ve hizaladığın, metni yerinde düzenlemek için çift tıkladığın çerçevesiz, doğrudan manipülasyon yüzeyi. Diğer her araçla aynı oluşturma yolundan dışa aktarılır, yani kanvas, dosyanın *ta kendisidir*. Aşağıdaki [Serbest kanvas](#the-free-canvas-design) bölümüne bak.

Izgarayı istediğin hâle getirmenin iki yolu var:

- <!--i:star--> **Kullandığını yıldızla.** Bir kartı ★ yıldızla, ızgaranın üstündeki şeritte kendine ait büyük bir kutucuk kazansın - bkz. [Favorilerin](/info/favourites.html).
- <!--i:eyeoff--> **Hiç kullanmadığın bir aracı gizle.** Bir karta sağ tıkla (ya da birkaçını seçip seçim çubuğunu kullan) → **Aracı gizle**. Izgaradan ve ızgarada yazarken bulunanların arasından çıkar; en sondaki gri **Gizli araçları göster (N)** kutucuğu onları soluk hâlde geri getirir, her birinin kendi menüsünde **Aracı göster** bulunur. Gizleme yalnızca senin ızgaranla ilgilidir - araç kaydedilmiş bir bağlantıdan ya da bir yer iminden yine açılır ve herkes için olduğu yerde kalır.

![Araçlar ızgarasının sonu, gizli araçlar açığa çıkmış hâlde: soluk QR Code Generator kartı ve yanında onu yeniden görünür kılan, şimdi Hide hidden tools yazan gri kutucuk](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

### Lolly'ye sor

Aramak yerine sormayı tercih ettiğinde, **Lolly'ye sor** (`#/ask`) yazdığın soruyu alır ve bu belgelerin eşleşen bölümünü **birebir** geri verir - rehberlerin kendi sözleri, bir özet ya da bir üretim değil - geldiği sayfa kaynak gösterilerek ve yanında bir **Belgelerde aç** bağlantısıyla. Yanıtın altında, aynı sorunun uygulamada eşleştiği yerler durur: bir araç, bir ayar, kaydedilmiş bir proje; her biri seni oraya götüren birer düğme.

Döküm, oturum belleğidir: bir devam sorusu sor, konu ilerledikçe iş parçacığı birikir; sayfayı yenilediğinde sıfırdan başlar. Arama sonuçlarının en altında - diğer grupların bulduğu somut sonuçların altında - bir **Lolly'ye sor: *sorgun*** satırı yer alır ve soruyu doğrudan buraya devreder, böylece çubukta başlayıp burada bitirebilirsin.

## Kanvas (önizleme)

Önizleme her zaman tam olarak dışa aktarılacak şeyi gösterir.

**Masaüstü**

- **Yakınlaştırma:** Cmd/Ctrl ile kaydır ya da trackpad'de iki parmakla sıkıştır - yakınlaştırma imlecinin bulunduğu noktada ortalanır.
- **Kaydırma:** **Space** tuşunu basılı tutup sürükle ya da **orta fare tuşuyla** sürükle. (Düz tıklamalar, tasarımın parçalarına tıklamak için serbest kalır.)
- **Klavye:** `0` = pencereye sığdır · `1` = %100 · `+` / `−` = yakınlaştırma.
- **Yakınlaştırma HUD'u:** köşedeki küçük `−  NN%  +  Fit` kontrolü. Sığdır ↔ %100 arasında geçiş yapmak için yüzdeye tıkla.

![Kanvasın köşesindeki yakınlaştırma HUD'u - eksi, canlı yüzde, artı, Fit, ardından tema ve ses anahtarları](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Dokunmatik**

- **Sıkıştırarak** yakınlaştır, **sürükleyerek** kaydır, sığdırmaya dönmek için **çift dokun**.

**Bir kontrole atlamak için tıkla:** Tasarımdaki herhangi bir öğeye tıkla, ilgili kenar çubuğu girdisi odaklanır ve görünüme kayar - tekrar eden bir satır grubunda tıkladığın satırı tam olarak açar, böylece gördüğünü düzenlemek tek dokunuş uzaklıktadır.

Bir boyut değişikliği görünümü her zaman temiz bir sığdırmaya geri döndürür.

### Serbest kanvas (Design)

Serbest kanvas araçları, bir tasarımcının yapıştırma tahtası gibi, çalışma alanının *etrafına* bir çalışma yüzeyi ekler:

- **Kanvas dışında bekletme.** Bir kutuyu çerçeve kenarının ötesine sürükle, tamamen **görünür ve seçilebilir** kalır - kompozisyonu düzenlerken öğeleri kenara park et, sonra geri sürükle. Çerçevenin dışındaki her şey **hafifçe soluklaştırılır**, böylece dışa aktarım alanı her zaman bir bakışta anlaşılır ve çerçeve, dosyanın tam olarak nerede başladığını göstermek için gölgesini korur.
- **Yalnızca çerçeve dışa aktarılır.** Dışa aktarılan dosya çalışma alanıyla sınırlıdır - dışarıda kalan her şey (ya da bir kutunun kenardan taşan kısmı), hem raster hem vektör formatlarında, çıktıdan basitçe kırpılır.
- **Sığdırın ötesine uzaklaştır** (%20'ye kadar), öğeleri çerçevenin çok dışına yerleştirdiğinde tüm yapıştırma tahtasını gör.
- **Yeniden boyutlandırılabilir çalışma alanı.** Dışa aktarım boyutlarını değiştirmek çerçeveyi yerinde yeniden boyutlandırır; kutular konumlarını korur, böylece bir düzeni mevcut içeriğin etrafında yeniden çerçeveleyebilirsin.

![Design'ın serbest tuvali - çalışma yüzeyi ve onu çevreleyen yapıştırma masası](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Bir seçimi çevir.** Herhangi bir kutuya sağ tıkla ve yerinde aynalamak için **Flip horizontal** veya **Flip vertical**'i seç, ya da klavyeden `Shift+H` / `Shift+V` tuşlarına bas - Shift, çünkü tek başına `V` Pointer aracıdır. Seçili her kutu kendi ekseninde tek bir geri alma adımında aynalanır ve ayna gerçek bir dönüşümdür, bu yüzden sadece tuvalde değil, dışa aktarılan SVG, PDF ve PNG'de de kalıcıdır.

### Kendi şekillerini çizmek (kalem)

Kutular, daireler ve yuvarlatılmış çerçeveler çoğu düzeni karşılar. Bu listede olmayan bir şekle ihtiyacın olduğunda onu çiz: raydaki **Kalem** düğmesi (ya da `P` tuşu) seni çizim moduna alır. Modlar arasında üç tek tuş gezdirir - **`V`** İşaretçi'ye geri, **`P`** Kalem'e, **`N`** düğüm aracına (**Noktaları düzenle**) - ve İşaretçi, içinde bulunduğun her şeyden çıkış yoludur.

![Serbest kanvas araç rayı: bir sürükleme tutamacı, Lolly menüsü, ardından İşaretçi, Bir kutu ekle, Kalem, Noktaları düzenle, Çizgi, Zaman çizelgesi, Çalışma alanları ve Otomatik düzenle](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- Bir nokta yerleştirmek için **tıkla**. Varsayılan eğri türünde **tıklayıp sürüklemek** o noktanın tutamaçlarını dışarı çeker; köşe yerine eğri çizmenin yolu budur - sert bir köşe için tıklarken **Alt** tuşunu basılı tut. (Diğer eğri türlerinde yerleştirilen her nokta bir köşedir ve sürükleme bir işe yaramaz; aşağıdaki **Spline türü** bölümüne bak.)
- Noktalar, sen yerleştirdikçe çalışma alanına ve diğer kutularına yapışır ve normal bir sürüklemenin çizdiği kılavuzların aynısını çizer. Alt, sen çizerken ızgarayı, sonrasında bir noktayı sürüklerken hem ızgarayı hem kenarları bastırır.
- Döngüyü kapatıp tek hamlede bitirmek için **ilk noktana tıkla**. Aksi hâlde **Enter**'a bas, çift tıkla ya da yalnızca araç değiştir - çizim atılmaz, saklanır.
- **Escape** birer basamak ilerler: ilk basış çizimi bırakır ve hiçbir şey yazmaz, ikincisi kalemden çıkar.
- Çizim sırasında **Delete**, yerleştirdiğin son noktayı kaldırır.

Sonuç, kanvasta sıradan bir kutudur. Taşı, yeniden boyutlandır, döndür, grupla, hizala, yeniden sırala, dolgu, gradyan, gölge ya da opaklık ver - bir yol da diğer her kutu gibi davranır ve bu kontrollerin hiçbiri ona farklı davranmaz.

Boyalı olarak da gelir. Çizdiğin ilk yol, markanın bir yola verdiği dolgu ve konturu alır; sonrasında her yeni yol **en son kullandığını** alır - dolguyu bir kez ayarla ve çizmeye devam et, her şekli yeniden renklendirmek yerine. (Markası yollar hakkında bir şey söylemeyen bir araçta, çizilen bir yol onu çizerken gördüğün renkte konturlanır, yani hiçbir zaman görünmez olmaz.)

**Noktaları yeniden düzenleme.** Şekle çift tıkla (ya da nesne çubuğundaki **Noktaları düzenle**'yi kullan), noktalar geri gelir. Bir noktayı taşımak için sürükle, yönünü değiştirmek için bir tutamacı sürükle, nokta eklemek için eğrinin herhangi bir yerine tıkla, bir grup noktayı lastik bantla seç ve seçilenleri kaldırmak için Delete'e bas. Bir yol her zaman en az iki nokta tutar, yani onu yanlışlıkla yok olacak kadar silemezsin.

**Spline türü**, noktalarından hangi tür eğrinin geçeceğine karar verir ve anlamaya değer seçim de budur:

| Tür | Ne yapar |
|---|---|
| **Yumuşak (otomatik)** | Varsayılan. Kendi tutamaç uzunluklarını hesaplar, böylece düz tık-tık-tık gerçekten yumuşak bir eğri verir, tutamaçlarla boğuşmadan. Bir tutamaç ayarlarsan *yönü* sabitler, uzunluğun sahipliği eğride kalır. |
| **Bezier tutamaçları** | Klasik kalem. Tutamaçlar kontrol noktalarıdır ve nokta eklemek eğriyi hiç oynatmaz. |
| **Noktalar boyunca** | Yerleştirdiğin her noktadan tam olarak geçer, tutamaç yok. |
| **B-spline** | Noktaların içinden değil yakınından akar, daha yumuşak bir şekil için. |
| **Düz çizgiler** | Bir çoklu çizgi. |

Var olan bir yolu, tutamaçlarını kendi hesaplayan bir türe geçirmek önce sorar, çünkü ayarladığın tutamaç uzunlukları geri getirilemez - **Bezier tutamaçları**'na geçmek ise her zaman kayıpsızdır. Çizimin ortasında soru sorulmaz: geçiş doğrudan taslağa uygulanır ve o ana kadar çektiğin tutamaçlar da onunla birlikte gider. Tutamaçlarının sahibi olan türlerde nokta eklemek eğriyi çok az yeniden şekillendirir; **Bezier tutamaçları**'nda hiç değiştirmez.

Her nokta ayrıca bir süreklilik kuralı taşır ve bunu kanvastaki şekliyle gösterir - **Köşe** için kare (tutamaçlar bağımsız hareket eder), **Yumuşak** için yuvarlak (tutamaçlar hizada kalır), **Simetrik** için halkalı yuvarlak (hem hizada hem eşit uzunlukta). Seçili noktalar için ayarla, eğri kuralı hemen yeniden sağlar.

![Bir bağlantıdan doğrudan oluşturulmuş iki kalem yolu: konturlu bir S eğrisi ve kapalı, dolgulu bir leke](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Çizilen bir yol da diğer her şey gibi bağlantının içinde yolculuk eder, yani çizdiğin bir şekil bir paylaşım bağlantısından yeniden açılır ve CLI'dan birebir aynı oluşturulur. Hiçbir yanı düzenleyiciye bağlı değildir.

### Şekilleri birleştirmek (yol işlemleri)

İki ya da daha fazla şekil seç, kanvasa **sağ tıkla** (dokunmatikte iki parmakla dokun) ve menü, bir çizim uygulamasından bekleyeceğin işlemleri sunsun:

- **Birleşim** onları tek bir şekilde birleştirir, en üsttekinin boyasını koruyarak.
- **Çıkar** üstteki her şeyi alttaki şekilden keser.
- **Kesiştir** yalnızca çakışmayı korur.
- **Hariç tut** çakışma dışındaki her şeyi korur.

Üç işlem daha tek bir şekil üzerinde çalışır: **Vuruşu anahatla…** bir konturu aynı anahatta sahip dolgulu bir şekle çevirir (bir kalınlığı tam çizildiği gibi korumak istediğinde işe yarar), **Yolu ofsetle…** silueti dışarı doğru büyütür ya da negatif bir sayıyla içeri doğru daraltır ve **Basitleştir** bir yolu aynı şekilde, daha az parçayla yeniden kurar.

![Gerçek bir deliği olan bir hilal ve bir halka, ikisi de Çıkar ile üretildi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Sonuç, kalemle düzenlemeyi sürdürebileceğin yeni bir yoldur. Delikler gerçek deliklerdir - kontur panelindeki bir **Doldurma kuralı** kontrolü, çakışan konturların dolacağına (*non-zero*) mı yoksa delip geçeceğine (*even-odd*) mi karar verir.

Bu işlemlerin bilerek yapmadığı iki şey var. **Yıkmak yerine reddederler**: çakışmayan iki şekli kesiştirmek istersen korunacak bir şey olmadığı söylenir ve hiçbir şey değişmez. Metin ve görsel kutularının ise üzerinde çalışılacak bir anahattı yoktur, bu yüzden çerçeveleriyle yaklaşık olarak ele alınmak yerine oldukları gibi bırakılır. Birleştirilen sonuç düz Bezier eğrileri olarak saklanır, ki bir çizim uygulaması da bunu yapar - özgün spline türü işlemden sağ çıkmaz.

## Zaman çizelgesi (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio**, serbest kanvasa *zaman* ekler. Her kutu bir anda başlayabilir, bir süre boyunca çalışabilir, girip çıkarken canlanabilir; çalışma alanının altına yerleşen bir zaman çizelgesi de onları düzenlediğin yerdir. Aç, zaten çalan bir dizi bulursun - bir başlık kartı, bir klip, bir kapanış kartı, bir alt bant ve bir müzik yatağı - böylece model, sen hiçbir şeyi değiştirmeden önce görünür olur.

![Sequence Studio'nun zaman çizelgesi: taşıma kontrolleri, cetvel, bir bindirme şeridi, klipsleri ve dikiş yongalarıyla mıknatıslı sıralama sırası ve Always on şeridi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

İki tür satır var ve fark, işin bütün fikri:

- **Dizi satırı** *manyetiktir*. Klipler boşluksuz, birbiri ardına oturur; birini sürüklemek boşluk bırakmak yerine sıralamayı değiştirir. Bir klibi sil, kalanlar kapanır. Bu senin omurgan.
- **Bindirme şeritleri** serbesttir. Bir alt bant, bir logo, bir altyazı - omurganın üzerinde kendi zamanında yüzen her şey - kendi şeridini ve kendi başlangıcını alır.
- Onların altında **Her zaman açık**, hiç zamanlaması olmayan kutuları toplar: baştan sona öylece orada duran dekor. Bir düğmedeki `+` onlardan birini bir şeride yükseltir; **Her zaman açık yap** geri gönderir.

![Düzenleme sahnesi: ortada ön planda çalışma yüzeyi, solda araç rayı ve köşede yakınlaştırma HUD'u](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Zaman çizelgesini açmak klavyeyi ona verir, yani Space ve ok tuşları sayfayı değil oynatma başlığını sürer - ve zaten zamanlaması olan bir kompozisyonda kendiliğinden açıldığı için bu, Sequence Studio yüklendiği anda geçerlidir.

> **[Dizi düzenleyici](/info/sequence-editor.html)**, zamanda düzenlemenin öngörülebilir hissettirip hissettirmediğine karar veren dört şeyi derinlemesine anlatır: kanvastaki bir tıklamanın hangi klibi düzenlediği, komşu kliplerin soğan zarı hayaletleri, bölme kapsamı ve bir kesmeyi geri alan Birleştir ile kırpma (klavye seti dahil). Kısayol listesi için zaman çizelgesi odaktayken `?` tuşuna bas.

**Düzenleme.** Bir klibi taşımak ya da sırasını değiştirmek için ortasından sürükle, kırpmak için iki ucundan birinin birkaç piksel yakınından sürükle, bir klibi ikiye kesmek için **Oynatma başlığında böl**'e (ya da `S`) bas. Bölme, gerçek bir **Uzunluk** taşıyan bir klip ve onun biraz içinde duran bir oynatma başlığı ister, bu yüzden ucu açık bir klip (örneğin müzik yatağı) bölünemez. **Kenarlara hizala** varsayılan olarak açıktır ve klip kenarlarına, oynatma başlığına ve tam saniyelere yapışır; Alt ile geçersiz kılınır. Her sürükleme tek bir geri alma adımıdır ve sürükleme önizlemesi, işlemenin yaptığı hesabın aynısını yapar, yani sürüklerken gördüğün şey elde ettiğin şeydir.

Bir klip seç, denetçi aynı düzenlemeleri sayı olarak versin: **Uzunluk**, **Girişi kırp** (kaynağın ne kadar içinden başladığı), ×0,25'ten ×4'e sabit çarpanlar kümesi olarak **Hız**, uzunluklarıyla birlikte **Girişi canlandır** / **Çıkışı canlandır** ve **Klibi sessize al**. Manyetik satırdaki bir klipte bilerek **Başlangıç** alanı yoktur - sırayı satır yönetir, bu yüzden taşımak için sürüklersin.

**Geçişler** anahtar kare değil, hazır ayarlardır: Solma, Pop, Büyüt, Yükseliş, Bırak, dört Kaydırma, Yakınlaştır ve Uzaklaştır, Eğim, Süzülme, Döndür, Sürüklenme ya da **Kes (animasyon yok)**. Mesafeler nesneyle birlikte ölçeklenir, böylece aynı hazır ayar tam kare bir kartta da küçük bir rozette de doğru okunur. Dizi satırındaki bitişik iki klip arasında bir **ek noktası düğmesi** vardır: tıkla ve **Kes** ya da **Çapraz geçiş**'i seç; seçim anında uygulanır ve düğme kapanır. **Uzunluk (ms)** değerini değiştirmek için aynı düğmeyi tekrar aç ve **Tamam**'a bas. Bir çapraz geçiş, birinin sönmesi ve diğerinin belirmesi olarak saklanır ve dışa aktarım gerçek erimeyi bu çiftten türetir - çapraz geçişin önizlemede iki ayrı solma, dosyada ise gerçek bir devir teslim gibi görünmesinin sebebi budur.

**Ses.** Bir **Ses** klibi ekle, zaman çizelgesinde diğer her klip gibi yaşasın: dalga formu, kırpma, sessize alma. (Varsayılan oturumla gelen üretilmiş yatak tek istisnadır - dışa aktarım anında sentezlenir, bu yüzden sen oluşturana kadar çubuğu düz ve sessiz kalır.) Zaman çizelgesine doğrudan **seslendirme kaydetmek** için mikrofona bas; geri sayım ve seviye göstergesi vardır, kayıt da başladığın noktada kendi varlığın olarak saklanır. Aynı şekilde **video kaydetmek** için yanındaki kameraya bas: kayıt, kaydedilirken çalışma yüzeyinin dışa aktarım boyutuna kırpılır, böylece küçük öz görünüm, oynatma başlığında sıraya tam kare halinde tam olarak neyin ekleneceğini gösterir - bir meslektaşının klibini paylaşılan bir bağlantıdan toplamanın yolu budur. Müzik, konuşma ve bir klibin kendi ses bandı, dışa aktarılan miksin hepsine ulaşır. (Dışa aktarım panelindeki **Ses parçası** başka bir şeydir: tüm klibin altına serilen tek bir yatak, solma ve kısma ile. İkisi bir arada var olur.)

**Oluşturma.** Bir hareket dışa aktarımı, ekran kaydı değil **belirlenimci bir bileşimdir** - her kare tam bir zamanda çözülür, çizilir ve kodlanır, yani dosya makinenin yetişmesine bağlı değildir ve MP4 ya da WebM'de pratikte bir kare tavanı yoktur. Sen bir süre yazmadıkça süreyi zaman çizelgesinin kendi uzunluğu belirler. Content Credentials, diğer her dışa aktarımdaki gibi damgalanır. Sabit kare dışa aktarımı sana oynatma başlığındaki kareyi ya da çıktı boyutunun yanındaki **Kareler** alanından bütün bir kontakt föyü verir - bkz. [Dışa aktarma](/info/exporting.html#stills-from-a-timed-composition).

Akılda tutulacak birkaç sınır: bir dizi bir saatle sınırlıdır, GIF ve animasyonlu PNG karelerini tamponladığı için kısa kalırlar, hızı ×1 olmayan bir klipte ses susar (henüz zaman esnetme yok) ve **Canlı kaydet** burada gizlidir, çünkü bileşimci daha iyi yoldur.

**Ön ayarların ötesinde: anahtar kareler, derinlik ve bir kamera.** Bir geçiş, bir klibi geldiğinde ve ayrılırken animasyonlu hale getirir. Bir kutuyu bir klibin *içinde* konumlandırmak için - kaydırmak, soldurmak, bulanıklaştırmak, sayfadan kaldırıp geri yerleştirmek için - anahtar kareler ekle: klibi seç, **+Keyframe**'e bas (zaman çizelgesinin araç kümesindeki eşkenar dörtgen, tuval nesne çubuğundaki eşkenar dörtgen veya `K`), ve oynatma başlığının konumu bir sonraki düzenlemenin hangi pozu yazacağına karar verir. Aynı anahtar kare sistemi, her zamanlanmış kompozisyona içeri giren, yatay kayan ve odağı değiştiren, tek düz bir SVG'yi arasında uçabileceğin bir katman yığınına dönüştüren bir **kamera** verir. **[Animasyon](/info/animating.html)** eksiksiz kılavuzdur.

Design aracında da aynı zaman çizelgesi var, yani bir düzeni başka bir araca geçmeden zamanlayabilirsin ve o da hareketi dışa aktarır.

## Sunum yapma

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

**Çalışma alanlarından** oluşan bir Design belgesi zaten bir sunumdur. Araç rayındaki **Lolly menüsü**'nü aç ve son satır olan **Sun**'u seç - her çalışma alanı, kanvasta durdukları sırayla tam ekran bir slayta dönüşür. Sunum, oluşturulmuş çalışma alanlarının bir kopyası üzerinde çalışır, yani altındaki düzenleyiciye hiç dokunulmaz ve çıktığında tam bıraktığın yere dönersin.

- **Space**, `→`, **Page Down** ile ya da ekranın sağ kenarındaki şeride tıklayarak **ilerle**; `←`, **Page Up** ya da sol kenardaki şeritle geri dön. **Home** ve **End** ilk ve son slayta atlar. İşaretçiyi her hareket ettirdiğinde küçük bir denetim çubuğu belirir, durduğunda yeniden gizlenir.
- **Genel Görünüm** (`O` veya ızgara düğmesi) tüm çalışma yüzeylerini tuval üzerinde verdiğin düzende bir kerede sıralar; birini açmak için tıkla.
- **Aşamalı gösterme.** Bir kutuya sağ tıkla ve varsayılan **Her Zaman Görünür** yerine **1. Adımda Göster**, **2** veya **3**'ü seç. O kutu, sırası geldiğinde ilerleyene kadar bekler, böylece bir slayt parça parça gelebilir; aynı numarayı paylaşan kutular birlikte gelir.
- **Sunucu görünümü** (`S`) mevcut slaytı, sıradaki slaytı, o slayta ait notlarını ve işleyen bir saati içeren ikinci bir pencere açar. Tarayıcı açılır pencereyi engellerse sunumun üzerinde bir panele geri döner. Notlar çalışma yüzeyi başına ayarlanır ve asla slaytın kendisinde görünmez.
- `B` siyah bir ekranda tutar (herhangi bir tuş slaytı geri getirir), `F` tam ekrana döner ve **Escape** bir seferde bir katman soyar: genel görünümden sunuma, sunumdan düzenleyiciye.
- **Kiosk.** Bir çalışma yüzeyine bir **Süre** ver, sunum o kadar süre orada kalsın, ardından ince bir ilerleme çubuğunun arkasında kendiliğinden ilerlesin; `K` (ya da yalnızca bir öğenin süresi olduğunda görünen duraklat düğmesi) bunu durdurur ve yeniden başlatır. Bağlantıya `kiosk` ekle, sunum sonunda başa döner - onu tabela haline getiren de budur.

Sunum aynı zamanda bir bağlantıdır. `?present` doğrudan onu açar, `s=` slaydı adlandırır - bir konum, bir çalışma alanı kimliği ya da bir yapı adımı için `id.step` - ve sen ilerledikçe adres güncellenir, yani gönderdiğin şey üzerinde bulunduğun slayttır. Araç yazarları: bu parametreler [URL Modu](/info/url-mode.html#reserved-parameters) sayfasında belgelenmiştir.

## Telefonda

Dar ekranlarda düzen tek sütuna geçer:

- **Kontroller üstte bir panele dönüşür**, alt kenarında bir **sürükleme tutamacı** bulunur. Boyutlandırmak için tutamacı sürükle - **kısmi / yarım / tam** konumlarına yapışır - ya da daraltma ↔ genişletme arasında geçiş yapmak için tutamaca **dokun**. Önizleme alttaki alanı doldurur ve sen düzenlerken görünür kalır.
- Yüzen bir **Dışa aktar** düğmesi dışa aktarım panelini açar - format, boyut, kopyalama, kaydetme ve indirme kontrollerinin tümü tek yerde. Arka plana dokunarak kapat.

![Telefon genişliğinde bir ekranda bir araç - üstte panel hâlinde kontroller, altta önizlemeyi dolduran üretilmiş palet ve alt ortada yüzen oluşturma düğmesi](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Kontroller (girdiler)

Araçlar yalnızca değişmesi amaçlanan girdileri gösterir - geri kalan her şey (renkler, düzen, tipografi, mantık) araç yazarı tarafından sabitlenmiştir, böylece oluşturduğun her şey yazarın koyduğu kurallara uyar. Girdiler arasında metin, kaydırıcılar, renk seçiciler, açılır menüler, tarihler, görsel seçiciler ve tekrar eden satır grupları bulunur. Bazıları katlanabilir bölümler altında gruplanmıştır.

![Bir aracın kontrol yığını - bir metin alanı, renk düğmeleri ve bir kaydırıcı, yazarın sabitlemeyi seçtiği başka hiçbir şey yok](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Sıfırlama:** *Değişiklikleri temizle* her girdiyi varsayılan değerlerine döndürür.

### Geri alma ve yineleme

**Cmd/Ctrl-Z** bir adım geri gider, **Cmd/Ctrl-Shift-Z** (ya da **Cmd/Ctrl-Y**) yeniden ileri gider. Aynı ikili, kontrollerin üzerindeki satırda **Geri al** ve **Yinele** düğmeleri olarak durur - serbest kanvasta ise araç rayındadır - ve geri alınacak bir şey kalmadığında her biri soluklaşır. Her adım ne olduğunu söyler: bir rengi geri al, küçük bir mesaj az önce geri getirdiği girdiyi adlandırsın, içinde geri dönüş için bir **Yinele** düğmesiyle.

- **Bir sürükleme tek adımdır.** Aynı kontrolde yarım saniye içinde yapılan tekrarlı değişiklikler birleşir, yani bir kaydırıcıyı baştan sona çekmek iki yüz değil tek bir geri almadır.
- **Son 100 adım tutulur** - daha eskileri sondan düşer. Geri aldıktan sonra yeni bir düzenleme yapmak, her yerde olduğu gibi ileri yığınını temizler.
- **İmlecin bir metin kutusundayken** Cmd/Ctrl-Z, karakter karakter alanın kendisine aittir. Lolly, kendine ait işe yarar bir geri alması olmayan kontrolleri devralır: kaydırıcılar, açılır menüler, renkler ve anahtarlar.
- Bir **file** girdisinde **dosya seçmek** bir adım değildir - o baytlar yalnızca oturum boyunca tutulur, yani geri konacak bir şey olmazdı.

Canlı bir [işbirliğinde](/info/collaborate.html) geçmiş yalnızca sana ait kalır. Diğer cihazdan gelen bir değişiklik asla senin yığınına eklenmez, bu yüzden geri al yalnızca senin yaptığın bir şeyi geri getirebilir.

## Bilgilerin ve profil fotoğrafın

**Profil** (galerinin sağ üstünde) adını, iletişim bilgilerini ve isteğe bağlı bir **profil fotoğrafını** barındırır. Bu alanları isteyen araçlar onları otomatik olarak önceden doldurur - bir kez ayarla, e-posta imzan, lockup'ların ve rozetlerin kendiliğinden dolsun. Yine de her alanı oturum başına geçersiz kılabilirsin. Dışa aktardığın şeyde bilgilerinin yazar olarak yer alması için **Oluşturmak için bilgilerimi kullan**'ı aç.

Profil fotoğrafın ve bilgilerin **yalnızca bu cihazda** yaşar. Bir profil sadece sen olmaktan fazlası olabilir - arada bir üstlendiğin bir takım ya da bir rol. Birden fazlasını tutmak dahil tam tabloyu görmek için **[Profiller](/info/profile.html)** sayfasına bak.

## Kaydetme ve devam etme

Şu anki girdileri o araç için bir oturum olarak kaydetmek için **Kaydet**'e tıkla. Araç başına birden fazla adlandırılmış oturum tutabilirsin; her aracın **Devam et** düğmesi en son oturumunu yeniden açar ve **geçmiş düğmesi** (sağ üstte, profilinin yanında) tüm araçlardaki her kaydedilmiş oturumu listeler. Oturumlar cihaza özeldir. Bunları düzenlemek için **Projeler**'i aç (aşağıda).

![İki yarımlı oluşturma düğmesi - dışa aktarım panelini açan bir yukarı ok ve oturumu olduğu yerde kaydeden bir onay işareti](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projeler

**Projeler** - **Araçlar**'ın yanındaki **Projeler** sekmesinden ya da **Profil → Depolama → Projelerde düzenle**'den aç - kaydettiğin her şey için bir yuvadır ve bir dosya yöneticisi gibi çalışır:

![Projeler - iç içe geçebilen klasörlere düzenlenmiş kaydedilmiş oturumlar](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **İç içe geçen klasörler.** Kaydedilmiş oturumları klasörlere, klasörleri de istediğin kadar derin klasörlerin içine grupla. Bir klasör oluştur, yeniden adlandır ya da taşımak için bir kutucuğu başka bir klasörün üzerine sürükle; bir kırıntı yolu seni yukarı geri götürür. Her zaman var olan bir **Kategorisiz** klasörü, henüz dosyalanmamış her şeyi tutar.
- <!--i:clock--> **Kendi düzeninde sırala.** **Görüntüle ve sırala**; **Ad**, **Eklenme tarihi**, **Son değiştirilme** (varsayılan) ve bir klasörün içinde **Araca göre** seçeneklerini sunar. Hangi sıralama etkin olursa olsun klasörler her zaman önce gelir - sıralama yalnızca oturumları ve klasörleri kendi grupları içinde düzenler.
- <!--i:document--> **Yeni işi doğrudan dosyala.** **Yeni varlık** (kökte "Yeni bir çalışma başlat", bir klasörün içinde "*klasöre* ekle") bir araç açar ve ilk kaydını otomatik olarak o klasöre dosyalar.
- <!--i:checklist--> **Çoklu seçim (masaüstü).** Bir kutucuğun onay kutusunu işaretle, boş alanda bir seçim kutusu sürükle ya da **Shift/Cmd-tıkla**; bağlam menüsü için bir kutucuğa **sağ tıkla**. Sonra tüm seçim üzerinde bir kerede işlem yap - aynı hareket ve aynı yüzen işlem çubuğu yalnızca burada değil, Araçlar galerisinde, Yardımcı araçlarda, Katalog'da ve Projeler'de de çalışır.
- <!--i:download--> **Bütün bir klasörü ya da seçimi oluştur.** **Klasörü oluştur**, bir klasördeki her kaydedilmiş oturumu - alt klasörleri dahil - tek bir iç içe `.zip` olarak dışa aktarır. **Seçimi oluştur** herhangi bir çoklu seçim için aynısını yapar ve tek bir oturum doğrudan kendi dosyasına oluşturulur. Batch/Pro gerekmez.
- <!--i:link--> **Bir aracın kaydedilmiş işine doğrudan atla.** Araçlar galerisinde bir ya da daha fazla aracı işaretle ve seçim çubuğundan **Oturumları görüntüle**'yi seç - Projeler yalnızca o araçlarla yapılmış oturumları göstererek açılır, tam görünüme dönmek için bir **Temizle** ile.
- <!--i:link--> **Kaydedilmiş bir oturumu paylaş.** Bir oturuma sağ tıkla → tam olarak aynı girdilerle onu yeniden açan bir bağlantıyı kopyalamak için **Bağlantıyı paylaş** (tam Paylaş penceresi - aşağıya bak).

![Projeler'de açık Görüntüle ve sırala açılır penceresi: bir tema satırı, Önizleme ya da Liste arasında bir Görünüm seçimi ve Sırala altında Ad, Eklenme tarihi ve Son değiştirilme](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

**Seçim çubuğunun sunduğu şeyler** görünüme göre biraz değişir, çünkü her işlem her yerde anlamlı olmaz:

- **Araçlar / Yardımcı araçlar:** Favori (ya da Favoriden çıkar), Gizle (ya da Göster), Çevrimdışı kullanılabilir (ya da Çevrimdışından kaldır), **Oturumları görüntüle** (yukarıda anlatılan atlama) ve tam olarak tek bir kart seçiliyken Bağlantıyı kopyala.
- **Katalog:** Favori ve Gizle her seçime uygulanır; Çoğalt, İndir ve Sil yalnızca seçilen her öğe senin kendi yüklemelerinden biri olduğunda görünür - paylaşılan bir tasarım sistemi varlığı kalıcı bir taahhüttür, bu yüzden bu üçü toplu işlemde bile ona kapalı kalır.
- **Projeler:** **Seçimi oluştur**, **Taşı…**, **Yeni klasör**, **Sil**, seçim iki ile sekiz arasında tek araçlı oturumdan oluştuğunda **Birlikte düzenle** (onları tek bir birleşik kenar çubuğunun altında yan yana açar) ve bunun yerine tüm seçimi toplu ızgarada satırlar olarak açan **Sayfa olarak düzenle**. Bunun **boyut sınırı yoktur** ve oturumların aynı araçtan gelip gelmediğine bakmaz, yani bir seçim Birlikte düzenle'nin iki-sekiz aralığından büyük ya da daha karışık olduğunda kaçış kapısı odur.

> Bir etiket tuzağı: **Oturumları görüntüle** yalnızca bir şey *seçiliyken* vardır. Seçili olmayan tek bir karta sağ tıklamak bunun yerine **N kaydedilmiş oturum** sunar; bu da Projeler'e gitmek yerine o aracın kendi geçmiş penceresini açar.

![Tools galerisinde işaretlenmiş iki araç kartı, 2 selected yazan ve Available offline, View sessions, Favourite ve Hide sunan yüzen seçim çubuğuyla birlikte](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
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


## Çalışmanı paylaşma

Bir tasarım iki yoldan biriyle dışarı çıkar: bir bağlantı olarak ya da bir dosya olarak. Paylaş penceresi ikisini de sunar. Dışa aktarım kontrollerindeki **Paylaş** ile aç; Projeler'de kaydedilmiş bir oturumdaki **Bağlantıyı paylaş** aynı pencereyi o oturum için açar.

### Bağlantı

Her girdi sayfa URL'sinde yakalanır, yani bir bağlantı tasarımın *ta kendisidir*. Pencerenin en üstünde kopyalamaya hazır bağlantı durur, altında da katlanmış iki bölüm vardır.

- **Bağlantı seçenekleri** şunları barındırır: **En kısa bağlantı** (büyük bir tasarım uzun bir URL yapar, bu yüzden bu seçenek tüm durumu kompakt bir jetona sıkıştırır ve kaç karakter kazandığını gösterir; okunabilir biçim de her zaman oradadır), **Bu bağlantıyı parolayla koru** (tüm bağlantı üzerinde AES-256, parola bağlantının içinde asla yer almaz) ve **Bu araç sürümünü sabitle** - yani `_v` bayrağı, bağlantıyı baktığın araç sürümüne çivileyerek sonraki bir güncellemenin neyi oluşturduğunu değiştirmesini engeller.
- **Bağlantı davranışı**, alıcı onu açtığında ne olacağıdır: tam ekran, dışa aktarım paneli açılmış hâlde, `&export` ile açılışta indirme ya da `&copy` ile panoya kopyalama.

Bağlantıyı bir meslektaşına yapıştır, yer imlerine ekle ya da commit'le. (Tam ayrıntılar: [URL Modu](/info/url-mode.html).)

**Bazı araçlar bağlantıyı ürünün tamamı yapar.** Jump Page, dağıtmak için bağlantılarını tek bir sayfada toplar - bir bio bağlantısı, bir konferans konuşması, bir mağaza vitrini. Barındırılacak hiçbir şey ve arkasında hiçbir hesap yoktur: sayfa bağlantının kendisidir, bu yüzden URL ne kadar hızlı gidiyorsa o kadar hızlı açılır. Düzenleyicide bitmiş sayfayı alanların yanında görürsün; bağlantıyı açan bir ziyaretçi onu tam genişlikte alır, kaydırdıkça sahne başına bir bağlantı.

![Düzenleyicideki Jump Page - başlık, her biri kendi rengine sahip üç bağlantı sahnesi ve bir Made with Lolly altbilgisi, tuvalde tek bir sayfa olarak düzenlenmiş](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Pencere, bir bağlantının neyi taşıyamayacağını söyler.** Üç şey bir URL'ye sığmaz: bu cihazdan eklediğin bir görsel ya da dosya, çok uzun bir metin değeri ve çok büyük bir liste. Her biri bağlantı kurulurken sayılır. Bir şey dışarıda kalmak zorunda kaldıysa pencere bunu adıyla söyler ve seni aşağıdaki dosyaya yönlendirir; görseli eksik açılan bir bağlantı vermez. Yalnızca *uzun* olan bir bağlantı, karakter sayısıyla birlikte daha yumuşak bir not alır, çünkü sıkıştırma uzunluğu hâlâ kurtarabilir.

### .lolly dosyası

Üzerinde çalıştığın aracın Paylaş penceresindeki **.lolly indir**, aynı tasarımı bir dosya olarak yazar. Kaydedilmiş oturumu, cihazından eklediğin görseller ve dosyalarla birlikte taşır. Tasarımın yararlandığı katalog işleri de içinde yolculuk eder, böylece dosya markanı hiç görmemiş bir makinede eksiksiz açılır. Cihazında bir paylaşım sayfası varsa **Gönder…** o dosyayı diske kaydetmek yerine doğrudan ona verir (AirDrop, bir Android paylaşımı).

Bir `.lolly` sıradan bir zip'tir. Adını `.zip` yapıp aç: kendi görsellerin `assets/uploads/` altında, katalog işleri `assets/catalog/` altındadır, her biri gerçek adı ve uzantısıyla; `manifest.json` hepsini listeler ve en üstteki bir README dosyanın ne olduğunu söyler.

Gitmeden önce üç şeye sen karar verirsin:

- **Adının dahil edilip edilmeyeceği.** Adın, e-postan ve kuruluşun dosyaya yalnızca profilinde **Use my details to create** açıkken yazılır. Kapalıyken dosya, Lolly ile ne zaman oluşturulduğunu kaydeder - senin hakkında hiçbir şey değil.
- **Lisanslı görsellerin dahil edilip edilmeyeceği.** Lisanslı ve marka kilitli varlıklar varsayılan olarak dışarıda tutulur. Tasarım herhangi birini kullanıyorsa, iletişim kutusu kaç tane olduğunu söyler ve iki düğme sunar - *Download without them* ya da *Include and download* - çünkü onları dahil etmek, `.lolly` dosyasını açan herkese asıl dosyaları teslim eder demektir.
- **Aracın dahil edilip edilmeyeceği.** **Include the tool**, aracın kendi dosyalarını tasarımla birlikte paketler, böylece o araca sahip olmayan bir cihazda da açılır. Özel bir araç için - alıcının büyük olasılıkla sahip olmadığı bir fork veya özel bir marka aracı - işaretli gelir, imzalı katalogda listelenen bir araç için ise işaretsiz gelir, çünkü onların kopyası aynı kaynaktan gelir. (İmzalı katalog olmayan bir yapıda, her araç özel sayılır ve kutu işaretli başlar.)

**Bir dosyayı açmak.** Bir `.lolly` dosyasını uygulamaya bırak: içerikler kitaplığına gider, oturum Projects'e gider ve araç onun üzerinde açılır. Sana ait hiçbir şeyin üzerine yazılmaz: oturum yeni kaydedilmiş bir yuva olarak gelir, bu cihazda zaten bulunan bir içerik ise sağlama toplamıyla eşleştirilip çoğaltılmak yerine yeniden kullanılır. Her parça, girişte dosyanın kendi sağlama toplamlarına göre kontrol edilir, bu yüzden aktarım sırasında zarar gören bir kopya yarım içe aktarılmak yerine reddedilir.

Dosya sende olmayan bir araç taşıyorsa Lolly, o araç çalışmadan önce sorar: **Bu araca güveniliyor mu?** aracı ve yazarını adlandırır ve açmanın, aracın kendi kodunu cihazında çalıştıracağını açıkça söyler; geçiş yolu **Güven ve kur**'dur. Reddet, paylaşılan iş yine de projelerine kaydedilir ve aracı ekleyeceğin günü orada bekler. (Bir tür araç henüz yandan yüklenemez - kodu bir modül olarak gelenler - ve o da aynı şekilde geri çevrilir.)

Bir bağlantı da bir dosya da bir anlık görüntü devreder. Aynı oturum üzerinde başka biriyle *aynı anda* çalışmak için - iki cihaz, sunucu yok, aynı ağdaysanız internet gerekmez - bkz. [Birlikte çalışma](/info/collaborate.html).

## Canlı kamera (harekete duyarlı araçlar)

Her fotoğraf **Filtresi** - Halftone, Scanline, Posterize, Voronoi hücreleri, Renk işleme, Piksel esnetme ve Kusurlar - bir kameranın kullanılabilir olduğu yerde bir **Canlıya geç** düğmesi gösterir. Aç, efekt kare kare web kameranı takip etsin, böylece harekete tepki verir; sonucu GIF, WebM ya da MP4 olarak kaydedebilirsin. Kareler **cihazında** okunur ve işlenir, oradan asla çıkmaz; durduğun ya da araçtan ayrıldığın anda kamera serbest bırakılır. (Herhangi bir görsel seçicide, tek bir kareyi cihaz üzerinde bir görsel olarak yakalamak için **Fotoğraf çek** de bulunur.)

## Görsellerim

Bir araç cihazından bir görsel eklemene izin verdiğinde, görsel tam geldiği hâliyle saklanır - böylece üzerindeki bir Content Credential hâlâ doğrulanır - ve kişisel **Görsellerim** kütüphanene kaydedilir (**Profil → Depolama** altında). Yalnızca gerçekten çok büyük bir dosya, olduğu gibi mi kalsın yoksa küçültülsün mü diye sorar. Onu herhangi bir araçta yeniden kullan. Görseller girerken EXIF/GPS verilerini temizlemek için profilinde **Yüklemelerden meta verileri kaldır**'ı aç. Bir üst sınır yok: kütüphane tamamen yereldir ve yalnızca cihazının depolama alanıyla sınırlıdır - görselleri orada yönet ya da sil.

## Katalog - varlık kütüphanen

**Katalog** (`#/c` ya da her listeleme görünümünün üstündeki Projeler · Araçlar · Yardımcı araçlar · Katalog geçişinin **Katalog** bölümü), araçlarının yararlanabileceği her şeyi - marka logoları, görseller, ses ve hareketli görüntü, türe göre gruplanmış - bir araya getirir ve **kendi yaratıcı dosyaların** da burada yaşar. Sunucu yok, yönetim konsolu yok, pull request yok: her şey cihazında.

![Katalog - marka varlıkları, renk örnekleri ve yazı tipleri, artı kendi yüklemelerin](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Dosyalarını içeri getir.** Herhangi bir görseli, SVG'yi, ses klibini, videoyu, Lottie'yi, PDF'i veya PowerPoint sunumunu yükleme alanına sürükle - ya da seçmek için tıkla - ve anında kataloğunda belirir, her aracın içerik seçicisinde hazır olur. Çok sayfalı bir PDF veya bir `.pptx`, hangi sayfaları veya slaytları tutacağını sorar - her biri bir SVG varlığı olur. İstediğin kadar içeri aktar; cihazını asla terk etmez.
- <!--i:star--> **Sık kullandığını favorile.** Bir içeriği (veya bir marka renk örneğini) ★ ile işaretle, her seçicinin en üstüne sabitlensin, böylece en çok kullandığın logo veya renk bir tık uzağında olsun.
- <!--i:folder--> **Düzen yap.** Bir içeriği başka bir gruba yeniden kategorile, kullanmadığın paylaşılan bir marka içeriğini gizle (geri getirmek için **Show hidden** ile) veya kendi yüklemelerini tamamen sil. Projects'teki aynı çoklu seçim hareketi ve yüzen eylem çubuğu burada da çalışır, böylece bunların herhangi biri tüm bir seçime bir kerede yapılabilir.
- <!--i:layers--> **Bir videonun arka planını kaldır.** Bir videonun ayrıntısını aç veya herhangi bir içerik seçicisinde kartına sağ tıkla ve saydam bir alternatif kaydetmek için **Remove background…**'ı seç - gerçek alfa kanallı animasyonlu bir WebP veya PNG. Bir **Method** seç: bir **On-device model**, hareketli bir sahneden bir öznesi keser, veya bir **Colour key**, green screen veya düz bir duvar gibi eşit aydınlatılmış, düz bir arka planı anahtarlar, kenarı ayarlamak için **Tolerance**, **Softness** ve **Spill removal** ile birlikte. Renk anahtarı ne model indirmesi ne de ağ gerektirir, bu yüzden **Remove background** her videoda sunulur ve düzenli görüntülerde genellikle daha temizdir. Bir **Resolution** kontrolü (360, 480, 720 veya 1080p, asla kaynağın ötesine geçmez) ayrıntıyı daha küçük, daha hızlı bir dosyayla takas eder. Cihazında arka planda bir iş olarak çalışır. Bitmiş kesim, orijinalin yanına kendi içeriği olarak kaydedilir ve kaynak videonun Content Credential'ı bir bileşen olarak onunla birlikte gider. (Arka plan kaldırmanın neden sıradan bir düzenleme olarak kaldığı için [Bir kez üretildi, aynı şekilde render edildi](/info/ai-features.html) sayfasına bak.)

### Paletini ve yazı tiplerini her yere taşı

Kataloğun **Renk örnekleri** paneli göstermekten fazlasını yapar - bir rengi kopyalamak için tıkla ya da diğer aracının konuştuğu formatta **markanın tüm paletini indir**:

- <!--i:code--> **Tasarım tokenları (JSON)**, **CSS değişkenleri** ya da **CSS sınıfları** - markayı doğrudan bir stil sayfasına ya da bir derlemeye aktar;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - Illustrator ya da Photoshop'a yükle;
- <!--i:pentool--> **GIMP paleti (.gpl)** - GIMP ya da Inkscape için.

![Renk örnekleri paneli - üstte beş palet indirme düğmesi, ardından kopyalanabilir birer düğme olarak her marka rengi](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

**Yazı tipleri** paneli, yerel olarak kurmak ya da bir matbaaya vermek için marka yüzlerini her birinin yanında bir **indir** ile listeler. ([Brand Studio](/info/brand-studio.html)'nun Renkler odası aynı palet indirmesini sunar.)

Varlıklar, açık ve kendin-yap yolunun bir yarısıdır; diğeri **kendi araçlarını yapmaktır** - serbest kanvas (yukarıda anlatılan Design) kod yazmadan görsel olarak bir tane inşa etmeni sağlar.

## Ses ve erişilebilirlik

Lolly herkes için kullanımı rahat olmayı hedefler. Arayüz klavyeyle gezilebilir, özel kontroller ekran okuyucular için uygun etiketler taşır ve her aracın canlı önizlemesi, ne ürettiğini açıklayan tek, etiketlenmiş bir görsel olarak sunulur.

Nazik bir **yardımcı sesler** katmanı yaptığın şeyi onaylar - galeriye varış, geçerli ya da geçersiz bir Content Credentials kontrolü, bir paneli kapatma, bir filtre değiştirme. **Varsayılan olarak kapalıdır**: anahtarın göründüğü her yerde (her görünümün seçenekler açılır penceresi ya da **Profil**) **Ses**'i aç, seçim hatırlanır.

**Profil → Erişilebilirlik** altında dört isteğe bağlı konfor ayarı bulunur: **Hareketi azalt** (uygulamanın geçişlerini ve süslerini kaldırır), **Renkli önizlemeleri gizle** (sakin, simge ve metinden oluşan galeri kartları ve daha sessiz proje küçük resimleri), **Yüksek kontrast** (daha güçlü kenarlıklar, metin ve odak halkaları) ve **Büyük metin** (daha büyük uygulama tipografisi - etiketler, menüler, düğme metni). Dördü de uygulamayı işinin *etrafında* sakinleştirir: bir araç kanvasının içine hiç uzanmaz, dışa aktardığın şeyin tek bir pikselini bile değiştirmez ve her biri sen açana kadar kapalıdır. Tam ayrıntı: [Profilin → Erişilebilirlik](/info/profile.html#accessibility).

Ses anahtarının yanında **Neurospicy Modu** bulunur - çalışırken sessizce çalan, isteğe bağlı, sakinleştirici bir arka plan odak parçası. Onu açmak, seni uygulama boyunca takip eden küçük bir **oynatıcı dock'u** alt köşede açar; oradan bir parça arayıp seçebilir, ileri geri atlayabilir, sesi ayarlayabilir, küçültebilir ya da kapatabilirsin. Parça listesi birkaç kategoriye yayılır - prosedürel *Lolly Sings* melodileri, ambiyans döngüleri ve beat'ler, kendi yüklediğin sesler ve bir avuç canlı internet **radyo** istasyonu (bunlar bağlantı gerektirir; geri kalan her şey çevrimdışı çalar). **Varsayılan olarak kapalıdır** ve Ses gibi oturumlar ve cihazlar arasında hatırlanır. Sesi kapatmak odak parçasını da susturur.

## Depolama ve gizlilik

Her şey tarayıcının yerel veritabanında (IndexedDB) saklanır: profilin, kaydedilmiş oturumların, yüklediğin görseller ve indirilen katalog içeriğinin bir önbelleği. **Profil → Depolama** kullanımı gösterir ve şunları yapmana izin verir:

- <!--i:box--> **Önbelleği temizle** - indirilen katalog içeriğini at (bir sonraki yüklemede yeniden eşitlenir).
- <!--i:trash--> **Tüm verilerimi temizle** - profili, oturumları ve görselleri siler. *Geri alınamaz.*

![Telefon genişliğinde bir ekranda depolama kartı: cihazdaki her veri kategorisi adlandırılmış, altta Tüm verilerimi temizle düğmesiyle](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Bu yerel verilerin hiçbiri hiçbir yere iletilmez - telemetri yok, bulutta oluşturma yok. Uygulamanın hiç getirdiği ya da gönderdiği her şeyin tam listesi [Gizlilik Politikası](/info/privacy.html) sayfasında, isteğe bağlı sunucu bileşenlerinin dökümü ise [Sunucu Yüzeyi](/info/server-surface.html) sayfasındadır.

## Başka bir cihaza geçiş

Her şey cihazında yaşadığından, **Profil → Depolama → Başka bir cihaza taşı** her şeyi ikinci bir kuruluma taşımana izin verir - hesap yok, bulut yok:

- <!--i:download--> **Verilerimi dışa aktar**, profilini, her kaydedilmiş oturumu (küçük resmiyle birlikte), yüklediğin görselleri ve tercihlerini (tema, kenar çubuğu genişliği, yerel etkinlik istatistikleri) içeren tek bir `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` dosyasını indirir (ad kısımları profilinden gelir ve ayarlanmamışsa düşürülür; `<n>` aynı gün yapılan dışa aktarımların çakışmaması için günlük bir sayaçtır).
- <!--i:upload--> Diğer kurulumdaki **Veri içe aktar…** o dosyayı geri okur. **Birleştirir**: aynı ada sahip her şey (profilin, bir oturum yuvası, bir görsel) içe aktarılan kopyayla değiştirilir; o cihazdaki geri kalan her şey korunur. Kaydedilmiş oturumlar, içe aktardığın görsellerle otomatik olarak yeniden bağlanır.

Katalog önbelleği dahil değildir - yeni cihazda kendini yeniden indirir. Paket düz bir zip'tir (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, format kimliği `lolly-backup`), böylece e-posta, USB ya da AirDrop'tan sağlam çıkar ve her kabuğun okuduğu formatın aynısıdır. Her parçanın bir sağlama toplamı vardır, böylece aktarım sırasında zarar gören bir dosya yarım bozuk şekilde geri yüklenmek yerine içe aktarımda yakalanır. (Tam format özellikleri: [Veri Aktarımı](/info/data-transfer.html).)

## Bir tasarım içe aktarma (Figma, Penpot, Illustrator, InDesign)

Var olan bir tasarımı Lolly'ye getirip üzerinde çalışmaya devam edebilirsin: **Design**'ı aç, kanvas araç çubuğunda **Bir tasarım içe aktar**'a tıkla ve bir Figma **.fig** ya da SVG, bir Penpot **.penpot**, bir Illustrator **.ai** / **.pdf** ya da bir InDesign **.idml** seç. Katmanlar serbest kanvasta düzenlenebilir kutulara dönüşür - metin yeniden yazılabilir kalır, görseller **Görsellerim**'e yerleşir, tipografi ve renkler marka geneline uyar - sonra sonuç, diğer her oturum gibi kaydedilir, paylaşılır ve oluşturulur. Ayrıştırma tamamen cihazında gerçekleşir. Tam ayrıntı: **[Bir tasarım içe aktar](/info/design-import.html)**.

## Dışa aktarma

Format seçme, çıktı boyutu ve baskı birimleri, şeffaflık, video ve kopyalama/paylaşma dahil tüm ayrıntılar için **[Dışa Aktarma ve Formatlar](/info/exporting.html)** sayfasına bak. Kısaca: bir format seç, gerekiyorsa boyutu ayarla ve **İndir**'e bas (ya da panoya **Kopyala**'ya).

## Batch (Pro) modu

Güçlü kullanıcılar için **Batch** (galeriden bağlantılı, varsayılan olarak açık olan Pro özellik bayrağının arkasında) birçok varyasyonu bir kerede oluşturur - her satırın birlikte dışa aktarılan bir girdi seti olduğu bir ızgara. Bir kartı bir düzine dile yerelleştirmek ya da her boyut varyantını tek geçişte üretmek için ideal. Satırları yazarak, doğrudan bir e-tablodan yapıştırarak ya da bir CSV içe aktararak doldur (bir tane de dışa aktarabilirsin) ve satır başına format, boyut ve çıktı dosya adını ayarla. Bütün bir ızgarayı galeriden yeniden açılan adlandırılmış bir **batch oturumu** olarak kaydet ve her satırı tek bir `.zip` olarak indir.

![Toplu işlem araç çubuğu - zip adı, birimler, DPI ve her satırın miras aldığı format, sağda Sessions ve Render ile birlikte](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch, **bir şablonun birçok varyantını** bir kerede üretmek içindir. **Zaten kaydettiğin** oturumları yeniden oluşturmak için **Projeler → Klasörü oluştur / Seçimi oluştur**'u kullan (yukarıda) - Pro gerekmez.

## Yan yana düzenleme (Çoklu düzenleme)

Batch, *tek bir* tasarımın birçok varyantıdır. **Multi-edit** işin diğer yarısıdır: aynı anda açılmış birkaç **farklı** kaydedilmiş tasarım, böylece tek bir değişiklik hepsine uygulanır. Projects'te **iki ile sekiz** arasında kaydedilmiş oturumu işaretle ve seçim çubuğundan **Edit together**'ı seç; `#/multi?s=<slot>,<slot>…` adresinde yan yana canlı kartlar olarak açılırlar. Her kart o oturumun gerçek bir render'ıdır, kaydedilmiş bir küçük resim değil, bu yüzden gördüğün şey dışa aktarılacak şeydir.

Hepsini tek bir kenar çubuğu sürer:

- <!--i:sliders--> Başı **Paylaşılan** çeker - seçili oturumlardan ikisinin ya da daha fazlasının *aynı şekilde* tanımladığı her girdi (aynı kimlik, aynı tür, aynı kısıtlar - toplu ızgaranın sütunlarında kullandığı birleştirme kuralının aynısı). Paylaşılan bir kontrolü bir kez düzenle, değer onu tanımlayan her oturuma yayılsın, her kartta canlı olarak. Aynı aracın iki oturumu her şeyi paylaşır; iki farklı araç ise yalnızca ortak olan neyse onu paylaşır, başka bir şeyi değil.
- <!--i:document--> Onun altında, **oturum başına bir katlanmış kart** o oturumun kendi girdilerinin tümünü, aracın kendi kenar çubuğuyla aynı incelikte taşır - varlık seçiciler, tekrar eden satır grupları, renk alanları - artı derli toplu bir dışa aktarım bloğu: **Biçim**, **G** / **H**, **Birim**, **DPI** ve kendi **İndir**'i. Bu İndir önce oturumu kaydeder, sonra onu olağan oturum dışa aktarım yolundan oluşturur, böylece dosya doğrudan araçtan çıkacağı dosya adını, formatı ve Content Credentials'ı taşır.
- <!--i:search--> En üstteki **Girdileri filtrele…**, kontrolleri *her* kartta bir kerede daraltır - sekiz oturumdaki "manşet"e kaydırmadan böyle ulaşırsın.

Herhangi bir kanvasa tıkla (ya da üzerindeyken Enter'a bas), o oturumun kenar çubuğu kartı açılsın ve görünüme kaysın. **Tümünü kaydet** her oturumu kendi yuvasına geri yazar. **Tümünü indir** önce kaydeder, sonra tüm seti Projeler'in **Seçimi oluştur** yolunun geçtiği aynı hattan oluşturur - tek bir zip, yolda isteğe bağlı parola kilidi de önerilerek.

İki dürüst sınır. İki-sekiz üst sınırı gerçektir: her kart kendi canlı çalışma zamanını bağlar ve tepkisel kalan sayı budur - daha fazlasını (ya da artık var olmayan bir oturumu) isteyen bir bağlantı, yarım yüklenmek yerine bunu söyler. Ayrıca bağlantı *senin* kayıt yuvalarını adlandırır, yani o seti bu cihazda yeniden açar; bir paylaşım bağlantısı değildir.

Seçim sekizden büyük olduğunda, araçları karıştırdığında ya da oturumların yanında görseller de içerdiğinde kaçış kapısı aynı seçim çubuğundaki **Sayfa olarak düzenle**'dir: tüm seçimi, boyut sınırı ve aynı araç kuralı olmadan **toplu ızgarada satırlar** olarak açar (`#/pro?s=…`). Klasörler ikisinin de dışında kalır - onların ızgarada açılmak için kendi yolları var. ([Ara](/info/search.html) buraya henüz uzanmayan tek şeydir: Çoklu düzenleme, arama çubuğunun bilmediği tek görünümdür.)

## Çevrimdışı ve kurulum

Lolly bir PWA'dır. İlk yüklemeden sonra **çevrimdışı** çalışır - uygulama benzeri, tam ekran bir deneyim için tarayıcının adres çubuğundan kur (ya da mobilde *Ana Ekrana Ekle*). Tekrar çevrimiçi olduğunda kendini günceller.

Güncellemeler hakkında: bir güncellemeden hemen sonra bir görünüm yüklenemezse (boş bir panel, köşede bir \"failed to fetch\"), sayfayı bir kez yeniden yükle - uygulama yeni sürüme temiz bir şekilde geçer ve çalışman, oturumların ve markan dokunulmamış kalır. Her şeyi cihazında saklar, sayfada değil.
