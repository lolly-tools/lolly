# Lolly'yi kullanma

Uygulamayı gerçekten *kullanmaya* dair pratik bir rehber - bir araç açmak, kanvasta çalışmak, dışa aktarmak, kaydetmek ve paylaşmak. Buradaki her şey **cihazında** çalışır: hesap yok, yükleme yok, ve zaten açtığın ekranlar için internet gerekmez.

> Yeni misin? [Hızlı başlangıç](/info/quickstart.html) seni dakikalar içinde bir şeyler üretir hale getirir, [Operatörler için Lolly](/info/operators.html) ise uygulamayı kurmayı/dağıtmayı anlatır; bu sayfa ise açıldıktan sonra onu kullanmakla ilgili.

## Bir araç açma

Ana ekran **galeri**dir - kategoriye göre gruplanmış tüm araçlar. O araçta yeni bir şey başlatmak için bir karta tıkla; [kaydedilmiş işler](#saving-continuing) **Projeler**'den yeniden açılır. İsme göre filtrelemek için arama kutusunu kullan - ya da altı listeleme ekranının (galeri, Yardımcı araçlar, Projeler, Varlıklar, Panel ve Ayarlar) altındaki çubuktan [Ara](/info/search.html); bu arama, araçların yanı sıra kaydedilmiş işlerine, varlıklarına ve ayarlarına da ulaşır. Bir aracın içinde çubuk, aracın kendi arayüzüne yer açmak için kenara çekilir.

![Örnek gezinme ve bir Yeni eylemi içeren bir galeri kartı](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

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

Birden fazla kart üzerinde işlem yapmak için, her kartın onay kutusunu işaretle, boş alanın üzerine bir seçim kutusu sürükle ya da **Shift/Cmd-click** yap, ve yüzen bir eylem çubuğu belirir. **Seçim çubuğunun sunduğu**, görünüme göre biraz değişir, çünkü her eylem her yerde mantıklı değildir:

- **Araçlar / Yardımcı araçlar:** Favori (ya da Favorilerden çıkar), Gizle (ya da Göster), Çevrimdışı kullanılabilir (ya da Çevrimdışından kaldır), tam olarak bir kart seçiliyken **Oturumları görüntüle** (yalnızca o araçlarla yapılmış oturumları gösteren Projeler'i açar) ve Bağlantıyı kopyala.
- **Varlıklar:** Favori ve Gizle her seçime uygulanır; Çoğalt, İndir ve Sil yalnızca seçili her öğe kendi yüklemelerinden biri olduğunda görünür - paylaşılan bir tasarım sistemi varlığı kalıcı bir sözleşmedir, bu yüzden bu üçü toplu seçimde bile kapalı kalır.
- **Projeler:** bkz. [Çalışmanı bul ve kurtar](/info/find-your-work.html#find-something-you-saved).

> Bir etiket tuzağı: **Oturumları görüntüle** yalnızca bir şey *seçiliyken* vardır. Seçili olmayan tek bir karta sağ tıklamak ise, Projeler'e gitmek yerine, o aracın kaydedilmiş oturumlarının listesini açan **N saved sessions**'ı sunar; burada bir silme kalıcıdır.

![İki araç için galeri seçim çubuğu, Available offline, View sessions, Favourite ve Hide sunuyor](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
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
- **Dışa aktarmadan önce.** Denetçinin Belge bölümü, kaydedilmiş katman yapısını kontrol eder, ardından kırpılmış metin ve düz renk kontrastı için yerleşmiş kanvası okur. Ayrıca SVG/PDF anahatlamada kullanılan aynı yazı tipi kaydına, her metin parçasının gömülebilir yazı tipi baytları olup olmadığını sorar; görsel ve gradyan arka planları ise uydurma bir kontrast puanı yerine görsel kontroller olarak adlandırılır.

![Design'ın serbest tuvali - çalışma yüzeyi ve onu çevreleyen yapıştırma masası](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

**Bir seçimi çevir.** Herhangi bir kutuya sağ tıkla ve yerinde aynalamak için **Flip horizontal** veya **Flip vertical**'i seç, ya da klavyeden `Shift+H` / `Shift+V` tuşlarına bas - Shift, çünkü tek başına `V` Pointer aracıdır. Seçili her kutu kendi ekseninde tek bir geri alma adımında aynalanır ve ayna gerçek bir dönüşümdür, bu yüzden sadece tuvalde değil, dışa aktarılan SVG, PDF ve PNG'de de kalıcıdır.

### Katmanlar ve Denetçi

**Katmanlar**'da her çalışma yüzeyi katlanabilir bir üst grup olur. Oraya atlamak için adını seç, katmanlarını genişlet, o çalışma yüzeyi içindeki nesneleri seç veya yeniden sırala. Küçük resimler ve sayfa sıralaması için **Sayfalar**'a geç. Ok tuşları katman listesinde gezinir; Left, çalışma yüzeyi başlığına döner.

**Denetçi**, seçili nesne için önce metin veya görsel kontrollerini gösterir. Hızlı seçimler için seçenek çiplerini kullan ve stil ayrıntıları için **Advanced**'i genişlet. Telefonlarda **Denetçi**'yi **Diğer eylemler**'den aç. Kontroller bir sayfada açılır; Escape veya Geri, seçimini korurken onu kapatır.

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

### 3D sahneler

Araç rayındaki ekleme menüsünden **3D sahne**'yi seç ve bir çerçeve çiz: 3D Studio yeni kutunun üzerinde hemen açılır ve orada ayarladığın şey kanvasa geri döner. Her açıdan bir sahne kutusu sıradan bir kutudur. Taşı, yeniden boyutlandır, döndür, gölge ver, bir slayda ya da zaman çizelgesine koy; diğerleri gibi davranır.

**Bir sahne kutusu resmi değil tarifi tutar.** Bir görsel kutusu oluşturulmuş bir dosya tutar; bir sahne kutusu tek bir ayar tutar - sahnenin kendisi, 3D Studio'nun kendi bağlantı sorgusu olarak yazılır, hâlâ stüdyonun varsayılanında kalan her değer dışarıda bırakılır. Bir sahnenin bütün bir tarifin maliyeti olan birkaç kilobayt yerine yüz bayt kadar olmasının, aynı dizenin bir paylaşım bağlantısında ve düzenleyici kapısında çalışmasının ve yeni bir stüdyo kontrolünün Design'da hiçbir değişiklik gerektirmemesinin nedeni budur. Kutunun, daha önce çekilmiş bir resimden büyütülmek yerine belgenin istediği herhangi bir boyutta ve anda yeniden oluşturulmasının nedeni de budur. Bir sahnenin kullandığı resimler varlık olarak kalır ve kimlikle taşınır, bu yüzden bir sahnenin içindeki bir yükleme, belgenin geri kalanıyla birlikte bir `.lolly` dosyasına gider.

**Onu stüdyoda düzenle.** Kutuyu seç, Denetçi bir **3D sahne** bölümü göstersin: sahnenin neyden yapıldığını adlandıran bir satır, birini seçtikten sonra ışıklandırma stüdyosunu adlandıran ikinci bir satır ve tek bir düğme, **3D Studio'da düzenle**. Düğme, stüdyoyu o kutunun sahnesi üzerinde, aracın sahip olduğu her kontrolle açar. Uygula, düzenlenmiş sahne tek bir adım olarak geri yazılır, böylece tek bir geri alma kutuyu başladığın sahneye döndürür; uygulamadan stüdyoyu kapat, hiçbir şey değişmez. Kutuyla ilgili geri kalan her şey - çalışma yüzeyindeki yeri, ne kadar büyük olduğu, gölgesi, bir slayta ne zaman geldiği - her zaman kullandığı bölümlerde kalır. Bir sahne kutusunun kendine ait görseli ve altyazısı yoktur: resmi stüdyodan gelir, sözleri de orada belirlenir.

**Tek bir canlı sahne, diğer her kutuda bir poster.** Bir belgedeki her 3D kutusu bir poster gösterir: sahnenin durağan bir resmi, kutunun kapladığı boyutta, paylaşılan oluşturucu havuzu aracılığıyla ekran dışında çizilir. Yirmi sahneli bir belge yirmi değil tek bir çizim bağlamına mal olur. Bir sahne kutusunu seç, belgenin tek canlı sahnesi olsun; seçimi kaldır, ekranda olan çerçeve onun posteri olsun, böylece hiçbir şey sıçramaz. Aynı anda yalnızca bir sahne canlıdır ve iki sahne kutusunu aynı anda seçmek ikisini de poster olarak bırakır. Bu sürümde canlı sahne bakmak içindir, dönmek için değil: bir sahneyi **3D Studio'da düzenle** üzerinden değiştir. Kayan noktalı bir grafik bağlamı açamayan bir cihaz posteri korur ve boş bir dikdörtgen göstermek yerine nedenini kutunun içinde söyler, belgenin geri kalanı etkilenmez. 3D kutusu olmayan bir Design belgesini açmak hiç 3D kodu yüklemez.

**Zaman çizelgesinde** bir sahne kutusu bir video klibi gibi oynatma başlığını izler: başlangıcı, klip girişi ve hızı sahneyi kendi animasyonu boyunca hareket ettirir, sahnenin uzunluğu ise 3D Studio'da ayarladığın uzunluktur, bu yüzden bir kutuyu daha kısa kırpmak sahneyi hızlandırmak yerine ondan daha azını gösterir. Yalnızca seçili sahne kutusu canlıdır; diğer her biri durağan bir resimdir ve durağan bir resim taranmaz.

**Bir dışa aktarımda** her sahne, stüdyonun kullandığı aynı oluşturucuyla, dosyanın ihtiyaç duyduğu boyutta yeniden çizilir. Bir video, sahne başına, an başına bir kare oluşturur; bir PNG, SVG veya PDF, kutu başına, kutunun kendi piksel boyutunda bir resim gömer. Hiçbir şey ekrandan fotoğraflanmaz, bu yüzden bir dışa aktarım hangi kutuyu seçmiş olduğuna bağlı değildir. Çizilemeyen bir sahne dışa aktarımı başarısız kılar ve nedenini stüdyonun kendi sözleriyle söyler.

**Kendi yüklemene dayanan bir sahneyi paylaşmak.** Bir Design belgesinin paylaşım bağlantısı, bir görsel kutusunun onu boşalttığı yerde, bir sahnenin içinde cihaza özel bir yükleme kimliğini olduğu gibi taşır. Bu yüzden görseli veya modeli senin yüklediğin bir dosya olan bir sahne, belge baytları taşıyan bir `.lolly` dosyası olarak yolculuk etmedikçe, başkasının cihazında o resim için stüdyonun varsayılanını gösterir.

## Zaman çizelgesi (Sequence)

**Sequence**, Design'ın zaman çizelgesidir: serbest kanvasa *zaman* ekler. Her kutu bir anda başlayabilir, bir süre boyunca çalışabilir, girip çıkarken canlanabilir; çalışma alanının altına yerleşen bir zaman çizelgesi de onları düzenlediğin yerdir. Aç, zaten çalan bir dizi bulursun - bir başlık kartı, bir klip, bir kapanış kartı, bir alt bant ve bir müzik yatağı - böylece model, sen hiçbir şeyi değiştirmeden önce görünür olur.

![Sequence'in zaman çizelgesi: taşıma kontrolleri, cetvel, bir bindirme şeridi, klipleriyle ve ek noktası düğmeleriyle mıknatıslı sıralama sırası ve Always on şeridi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

İki tür satır var ve fark, işin bütün fikri:

- **Dizi satırı** *manyetiktir*. Klipler boşluksuz, birbiri ardına oturur; birini sürüklemek boşluk bırakmak yerine sıralamayı değiştirir. Bir klibi sil, kalanlar kapanır. Bu senin omurgan.
- **Bindirme şeritleri** serbesttir. Bir alt bant, bir logo, bir altyazı - omurganın üzerinde kendi zamanında yüzen her şey - kendi şeridini ve kendi başlangıcını alır.
- Onların altında **Her zaman açık**, hiç zamanlaması olmayan kutuları toplar: baştan sona öylece orada duran dekor. Bir düğmedeki `+` onlardan birini bir şeride yükseltir; **Her zaman açık yap** geri gönderir.

![Düzenleme sahnesi: ortada ön planda çalışma yüzeyi, solda araç rayı ve köşede yakınlaştırma HUD'u](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Zaman çizelgesini açmak klavyeyi ona verir, yani Space ve ok tuşları sayfayı değil oynatma başlığını sürer - ve zaten zamanlaması olan bir kompozisyonda kendiliğinden açıldığı için bu, Sequence yüklendiği anda geçerlidir.

> **[Dizi düzenleyici](/info/sequence-editor.html)**, zamanda düzenlemenin öngörülebilir hissettirip hissettirmediğine karar veren dört şeyi derinlemesine anlatır: kanvastaki bir tıklamanın hangi klibi düzenlediği, komşu kliplerin soğan zarı hayaletleri, bölme kapsamı ve bir kesmeyi geri alan Birleştir ile kırpma (klavye seti dahil). Kısayol listesi için zaman çizelgesi odaktayken `?` tuşuna bas.

**Düzenleme.** Bir klibi taşımak ya da sırasını değiştirmek için ortasından sürükle, kırpmak için iki ucundan birinin birkaç piksel yakınından sürükle, bir klibi ikiye kesmek için **Oynatma başlığında böl**'e (ya da `S`) bas. Bölme, gerçek bir **Uzunluk** taşıyan bir klip ve onun biraz içinde duran bir oynatma başlığı ister, bu yüzden ucu açık bir klip (örneğin müzik yatağı) bölünemez. **Kenarlara hizala** varsayılan olarak açıktır ve klip kenarlarına, oynatma başlığına ve tam saniyelere yapışır; Alt ile geçersiz kılınır. Her sürükleme tek bir geri alma adımıdır ve sürükleme önizlemesi, işlemenin yaptığı hesabın aynısını yapar, yani sürüklerken gördüğün şey elde ettiğin şeydir.

Bir klip seç, denetçi aynı düzenlemeleri sayı olarak versin: **Uzunluk**, **Girişi kırp** (kaynağın ne kadar içinden başladığı), ×0,25'ten ×4'e sabit çarpanlar kümesi olarak **Hız**, uzunluklarıyla birlikte **Girişi canlandır** / **Çıkışı canlandır** ve **Klibi sessize al**. Manyetik satırdaki bir klipte bilerek **Başlangıç** alanı yoktur - sırayı satır yönetir, bu yüzden taşımak için sürüklersin.

**Geçişler** anahtar kare değil, hazır ayarlardır: Solma, Pop, Büyüt, Yükseliş, Bırak, dört Kaydırma, Yakınlaştır ve Uzaklaştır, Eğim, Süzülme, Döndür, Sürüklenme ya da **Kes (animasyon yok)**. Mesafeler nesneyle birlikte ölçeklenir, böylece aynı hazır ayar tam kare bir kartta da küçük bir rozette de doğru okunur. Dizi satırındaki bitişik iki klip arasında bir **ek noktası düğmesi** vardır: tıkla ve **Kes** ya da **Çapraz geçiş**'i seç; seçim anında uygulanır ve düğme kapanır. **Uzunluk (ms)** değerini değiştirmek için aynı düğmeyi tekrar aç ve **Tamam**'a bas. Bir çapraz geçiş, bir klibin sönmesi ve bir sonrakinin belirmesi olarak saklanır ve gerçek erime bu çiftten türetilir: ilk klip kesimden sonra oynamaya devam ederek söner, bu sırada bir sonraki klip onun altında belirir. Önizleme ve dosya aynı kuralı izler, yani ek noktasında gördüğün şey dışa aktardığın şeydir.

**Ses.** Bir **Ses** klibi ekle, zaman çizelgesinde diğer her klip gibi yaşasın: dalga formu, kırpma, sessize alma. (Varsayılan oturumla gelen üretilmiş yatak tek istisnadır - dışa aktarım anında sentezlenir, bu yüzden sen oluşturana kadar çubuğu düz ve sessiz kalır.) Zaman çizelgesine doğrudan **seslendirme kaydetmek** için mikrofona bas; geri sayım ve seviye göstergesi vardır, kayıt da başladığın noktada kendi varlığın olarak saklanır. Aynı şekilde **video kaydetmek** için yanındaki kameraya bas: kayıt, kaydedilirken çalışma yüzeyinin dışa aktarım boyutuna kırpılır, böylece küçük öz görünüm, oynatma başlığında sıraya tam kare halinde tam olarak neyin ekleneceğini gösterir - bir meslektaşının klibini paylaşılan bir bağlantıdan toplamanın yolu budur. Müzik, konuşma ve bir klibin kendi ses bandı, dışa aktarılan miksin hepsine ulaşır. (Dışa aktarım panelindeki **Ses parçası** başka bir şeydir: tüm klibin altına serilen tek bir yatak, solma ve kısma ile. İkisi bir arada var olur.)

**Ses şeridi.** Ses taşıyan herhangi bir klibi seç, zaman çizelgesinin altında kompakt bir şerit açılsın: bir **Ses düzeyi** faderi, stereo konum için **Kaydır**, üç bantlı bir **EQ** (**Düşük**, **Orta**, **Yüksek**), sesin karakterini korurken yarım tonlarla aktaran bir **Perde** kontrolü ve klibi yayın ses düzeyine (BS.1770) getiren **Ses düzeyini normalize et**, böylece sessiz bir ses notu ile yüksek bir parça aynı seviyede durur. İki klip birleştiğinde **Çapraz geçiş** kesmek yerine bağlantıyı harmanlar. Bir **Efekt** yuvası klip üzerinde cihaz üstü işleme çalıştırır - **Ses temizleme** bir kayıttan odanın sesini ve cızırtıyı alır. Hız değişiklikleri perdeyi de korur: yavaşlatılmış ya da hızlandırılmış bir klip sincap sesine dönüşmez, zaman esnetilir. Her mikste dışa aktarım, konuşma geldikçe ve gittikçe müziği konuşmanın altına çeker ve tüm programı gerçek tepe sınırlayıcısı altında tutar, böylece çıkışta hiçbir şey kırpılmaz; kırpılacak olan bir dalga formu, gerçekleştiği yerde bir uyarıyla çizilir.

![Müzik klibi seçiliyken zaman çizelgesi: şeridi altta Hız, Solmalar, Ses düzeyi, Kaydır, EQ, Perde, Ses düzeyini normalize et ve Efekt yuvasıyla uzanır](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Oluşturma.** Bir hareket dışa aktarımı, ekran kaydı değil **belirlenimci bir bileşimdir** - her kare tam bir zamanda çözülür, çizilir ve kodlanır, yani dosya makinenin yetişmesine bağlı değildir ve MP4 ya da WebM'de pratikte bir kare tavanı yoktur. Sen bir süre yazmadıkça süreyi zaman çizelgesinin kendi uzunluğu belirler. Content Credentials, diğer her dışa aktarımdaki gibi damgalanır. Sabit kare dışa aktarımı sana oynatma başlığındaki kareyi ya da çıktı boyutunun yanındaki **Kareler** alanından bütün bir kontakt föyü verir - bkz. [Dışa aktarma](/info/exporting.html#stills-from-a-timed-composition).

Akılda tutulacak birkaç sınır: bir dizi bir saatle sınırlıdır, GIF ve animasyonlu PNG karelerini tamponladığı için kısa kalırlar, daha hızlı ya da yavaş oynatılan bir klip perdesini korur (ses şeridi onu zamanda esnetir ve bir **Perde** kontrolü, sesin karakteri korunarak yarım tonlarla aktarır) ve **Canlı kaydet** burada gizlidir, çünkü bileşimci daha iyi yoldur.

**Ön ayarların ötesinde: anahtar kareler, derinlik ve bir kamera.** Bir geçiş, bir klibi geldiğinde ve ayrılırken animasyonlu hale getirir. Bir kutuyu bir klibin *içinde* konumlandırmak için - kaydırmak, soldurmak, bulanıklaştırmak, sayfadan kaldırıp geri yerleştirmek için - anahtar kareler ekle: klibi seç, **+Keyframe**'e bas (zaman çizelgesinin araç kümesindeki eşkenar dörtgen, tuval nesne çubuğundaki eşkenar dörtgen veya `K`), ve oynatma başlığının konumu bir sonraki düzenlemenin hangi pozu yazacağına karar verir. Aynı anahtar kare sistemi, her zamanlanmış kompozisyona içeri giren, yatay kayan ve odağı değiştiren, tek düz bir SVG'yi arasında uçabileceğin bir katman yığınına dönüştüren bir **kamera** verir. **[Animasyon](/info/animating.html)** eksiksiz kılavuzdur.

Design aracında da aynı zaman çizelgesi var, yani bir düzeni başka bir araca geçmeden zamanlayabilirsin ve o da hareketi dışa aktarır.

## Sunum yapma

Kameranı, bir logoyu ve bir isim altyazısını izleyici görüntüsünün üzerine yerleştirmek için **Present with camera**'yı kullan. Onun kendi kontrolleri, kaydedilmiş sahneleri, paylaşım ve kayıt adımları [Kamerayla sunum yapma](/info/presenting.html) sayfasında anlatılır. Aşağıdaki sıradan sunum kontrolleri **Sun** üzerinden erişilebilir kalır.

**Çalışma alanlarından** oluşan bir Design belgesi zaten bir sunumdur. Araç rayındaki **Lolly menüsü**'nü aç ve son satır olan **Sun**'u seç - her çalışma alanı, kanvasta durdukları sırayla tam ekran bir slayta dönüşür. Sunum, oluşturulmuş çalışma alanlarının bir kopyası üzerinde çalışır, yani altındaki düzenleyiciye hiç dokunulmaz ve çıktığında tam bıraktığın yere dönersin.

- **Space**, `→`, **Page Down** ile ya da ekranın sağ kenarındaki şeride tıklayarak **ilerle**; `←`, **Page Up** ya da sol kenardaki şeritle geri dön. **Home** ve **End** ilk ve son slayta atlar. İşaretçiyi her hareket ettirdiğinde küçük bir denetim çubuğu belirir, durduğunda yeniden gizlenir.
- **Genel Görünüm** (`O` veya ızgara düğmesi) tüm çalışma yüzeylerini tuval üzerinde verdiğin düzende bir kerede sıralar; birini açmak için tıkla.
- **Aşamalı gösterme.** Bir kutuya sağ tıkla ve varsayılan **Her Zaman Görünür** yerine **1. Adımda Göster**, **2** veya **3**'ü seç. O kutu, sırası geldiğinde ilerleyene kadar bekler, böylece bir slayt parça parça gelebilir; aynı numarayı paylaşan kutular birlikte gelir.
- **Sunucu görünümü** (`S`) mevcut slaytı, sıradaki slaytı, o slayta ait notlarını ve işleyen bir saati içeren ikinci bir pencere açar. Tarayıcı açılır pencereyi engellerse sunumun üzerinde bir panele geri döner. Notlar çalışma yüzeyi başına ayarlanır ve asla slaytın kendisinde görünmez.
- `B` siyah bir ekranda tutar (herhangi bir tuş slaytı geri getirir), `F` tam ekrana döner ve **Escape** bir seferde bir katman soyar: genel görünümden sunuma, sunumdan düzenleyiciye.
- **Kiosk.** Bir çalışma yüzeyine bir **Süre** ver, sunum o kadar süre orada kalsın, ardından ince bir ilerleme çubuğunun arkasında kendiliğinden ilerlesin; `K` (ya da yalnızca bir öğenin süresi olduğunda görünen duraklat düğmesi) bunu durdurur ve yeniden başlatır. Bağlantıya `kiosk` ekle, sunum sonunda başa döner - onu tabela haline getiren de budur.

- **Alt slayt yığınları.** Bir çalışma yüzeyine sağ tıkla ve **Önceki slaytın altına istifle**'yi seç; böylece kendi başına bir slayt olmak yerine o slaydın bir adımı olur: genel görünüm tek bir kart gösterir, sunum yığını sırayla gezer ve denetçinin **Yığın** satırı hangi slayta ait olduğunu söyler.
- **Dönüştür.** İki ardışık slayt aynı **Dönüşüm eşleşmesi** adına sahip bir kutu taşıdığında (bir kutuya sağ tıkla ya da denetçinin **Dönüşüm eşleşmesi** satırını kullan - örneğin `hero`), geçiş o kutuyu kesmek yerine olduğu yerden olacağı yere taşır, yol boyunca yeniden boyutlandırıp yeniden renklendirir. Sunum geneli bir **Dönüştür** geçişi eşleşen her çift için aynısını yapar.
- **Anlatım.** Her çalışma yüzeyinin **Konuşmacı notları** sesli okunabilir. Denetçinin **Belge** bölümünde bir **Ses** seç, isteğe bağlı olarak **Şununla karıştır** için ikinci bir ses, okuma **Hızı** ve her slaytın etrafında milisaniye cinsinden bir **Giriş** ve **Kuyruk** seç; **Sunum yaparken altyazıları göster**'i aç, sözler söylendikçe belirsin. Ses cihazında çalışır. Aynı notlar bir video dışa aktarımında filme, bir PowerPoint dışa aktarımında gerçek slayt sesine ve bir [SCORM paketi](/info/create/exporting.html#scorm-course-packages) içindeki anlatılan filme dönüşür.

![Denetçinin Belge bölümü: Ses, Şununla karıştır, Hız, Giriş, Kuyruk ve Sunum yaparken altyazıları göster](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Sunum aynı zamanda bir bağlantıdır. `?present` doğrudan onu açar, `s=` slaydı adlandırır - bir konum, bir çalışma alanı kimliği ya da bir yapı adımı için `id.step` - ve sen ilerledikçe adres güncellenir, yani gönderdiğin şey üzerinde bulunduğun slayttır. Araç yazarları: bu parametreler [URL Modu](/info/url-parameters.html#reserved-parameters) sayfasında belgelenmiştir.

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

Geri al yalnızca bu ziyaret boyunca geri gider; dokuz araç ayrıca **Geri al**'ın yanında, **History** altında önceki sürümleri de tutar (bkz. [Önceki bir sürüme geri dön](/info/find-your-work.html#go-back-to-an-earlier-version)).

## Bilgilerin ve profil fotoğrafın

**Ayarlar** (galerinin sağ üstünde, bir kez ayarladıktan sonra adını gösterir) adını, iletişim bilgilerini ve isteğe bağlı bir **profil fotoğrafı** barındırır. Bu alanları isteyen araçlar onları otomatik olarak önceden doldurur - bir kez ayarla, e-posta imzan, lockup'ların ve rozetlerin kendiliğinden dolsun. Yine de her alanı oturum başına geçersiz kılabilirsin. Dışa aktardığın şeyde bilgilerinin yazar olarak yer alması için **Oluşturmak için bilgilerimi kullan**'ı aç.

Profil fotoğrafın ve bilgilerin **yalnızca bu cihazda** yaşar. Bir profil sadece sen olmaktan fazlası olabilir - arada bir üstlendiğin bir takım ya da bir rol. Birden fazlasını tutmak dahil tam tabloyu görmek için **[Profiller](/info/profile.html)** sayfasına bak.

## Kaydetme ve devam etme

Çalışmanı korumak için **Farklı kaydet**'e bas; bu, **Dışa aktar**'ın yanındaki onay işaretidir. **Save to a project** altında, **Kitaplığım** seçili kalsın ya da bir proje seç (**＋ Yeni proje…** bir tane oluşturur), sonra **Kaydet**'e bas. Tekrar kaydetmek kopya oluşturmak yerine aynı öğeyi günceller. Design'da, **Farklı kaydet** Lolly logosunun altındaki menüdedir; telefonda, **•••**'e, sonra **File menu**'ye, sonra **Farklı kaydet**'e bas.

Dışa aktarım panelindeki **Kaydet** düğmesi aynısını tek tıkla yapar ve asla dosya indirmez: yeni çalışma Kitaplığım'a gider, daha önce kaydettiğin çalışma ise bulunduğu yerde güncellenir.

Daha sonra geri dönmek için sol üstteki **Ana sayfa**'ya bas, sonra **Projeler** sekmesini aç (telefonda bir klasör simgesi). Kitaplığım kayıtları onun ilk ekranındadır; bir proje orada bir klasördür. Öğeler, dışa aktarım panelinde yazdığın dosya adını, ya da yoksa araçlarının adını taşır, örneğin **QR Code**. Birini aç, her ayar orada, değiştirmeye ve yeniden dışa aktarmaya hazır.

Kaydedilmiş çalışma, [Sync](/info/sync.html)'i açmadıkça, kaydettiğin tarayıcıda ya da uygulamada bu cihazda kalır. **İndir**'le aldığın bir dosya bitmiş bir kopyadır; daha sonra değiştirmek için kaydedilmiş öğeyi Projeler'de aç. Bir şey beklediğin yerde değilse, bkz. [Çalışmanı bul ve kurtar](/info/find-your-work.html).

![İki yarımlı oluşturma düğmesi - dışa aktarım panelini açan bir yukarı ok ve kayıt sayfasını açan Save as etiketli bir onay işareti](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projeler

**Projeler**, ana ekranın üstündeki **Projeler** sekmesi, kaydettiğin her şeyi, oluşturduğun klasörlerde tutar. Çalışmanı orada bulmak, sıralamak ve aramak, ve **Çöp kutusu**'ndan bir öğeyi geri yüklemek, [Çalışmanı bul ve kurtar](/info/find-your-work.html#find-something-you-saved) sayfasındadır.


## Çalışmanı paylaşma

Bir tasarım iki yoldan biriyle dışarı çıkar: bir bağlantı olarak ya da bir dosya olarak. Paylaş penceresi ikisini de sunar. Dışa aktarım kontrollerindeki **Paylaş** ile aç; Projeler'de kaydedilmiş bir oturumdaki **Bağlantıyı paylaş** aynı pencereyi o oturum için açar.

### Bağlantı

Her girdi sayfa URL'sinde yakalanır, yani bir bağlantı tasarımın *ta kendisidir*. Pencerenin en üstünde kopyalamaya hazır bağlantı durur, altında da katlanmış iki bölüm vardır.

- **Bağlantı seçenekleri** şunları barındırır: **Yüklü uygulamada aç** (alanı Shortcuts, başlatıcılar ve otomasyon için bir `lolly://` URI'sine çevirir, her parametre değişmeden kalır), **En kısa bağlantı** (büyük bir tasarım uzun bir URL yapar, bu yüzden bu seçenek tüm durumu kompakt bir jetona sıkıştırır ve kaç karakter kazandığını gösterir; okunabilir biçim de her zaman oradadır), **Bu bağlantıyı parolayla koru** (tüm bağlantı üzerinde AES-256, parola bağlantının içinde asla yer almaz) ve **Bu araç sürümünü sabitle** - yani `_v` bayrağı, bağlantıyı baktığın araç sürümüne çivileyerek sonraki bir güncellemenin neyi oluşturduğunu değiştirmesini engeller.
- **Bağlantı davranışı**, alıcı onu açtığında ne olacağıdır: tam ekran, dışa aktarım paneli açılmış hâlde, `&export` ile açılışta indirme ya da `&copy` ile panoya kopyalama.

Bağlantıyı bir meslektaşına yapıştır, yer imlerine ekle ya da commit'le. (Tam ayrıntılar: [URL Modu](/info/url-mode.html).)

**Bazı araçlar bağlantıyı ürünün tamamı yapar.** Jump Page, dağıtmak için bağlantılarını tek bir sayfada toplar - bir bio bağlantısı, bir konferans konuşması, bir mağaza vitrini. Barındırılacak hiçbir şey ve arkasında hiçbir hesap yoktur: sayfa bağlantının kendisidir, bu yüzden URL ne kadar hızlı gidiyorsa o kadar hızlı açılır. Düzenleyicide bitmiş sayfayı alanların yanında görürsün; bağlantıyı açan bir ziyaretçi onu tam genişlikte alır, kaydırdıkça sahne başına bir bağlantı.

![Düzenleyicideki Jump Page - başlık, her biri kendi rengine sahip üç bağlantı sahnesi ve bir Made with Lolly altbilgisi, tuvalde tek bir sayfa olarak düzenlenmiş](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Pencere, bir bağlantının neyi taşıyamayacağını söyler.** Üç şey bir URL'ye sığmaz: bu cihazdan eklediğin bir görsel ya da dosya, çok uzun bir metin değeri ve çok büyük bir liste. Her biri bağlantı kurulurken sayılır. Bir şey dışarıda kalmak zorunda kaldıysa pencere bunu adıyla söyler ve seni aşağıdaki dosyaya yönlendirir; görseli eksik açılan bir bağlantı vermez. Yalnızca *uzun* olan bir bağlantı, karakter sayısıyla birlikte daha yumuşak bir not alır, çünkü sıkıştırma uzunluğu hâlâ kurtarabilir.

### .lolly dosyası

`.lolly`, Lolly'nin taşınabilir paket uzantısıdır, her dosyanın aynı şeyi içerdiğine dair bir söz değildir. `manifest.json` içindeki `format` yetkili olandır. Uygulama önce o küçük manifesti okur ve herhangi bir şey yazmadan önce boyutu, içeriği ve eylemi gösterir:

- Bir **paylaşılan tasarım** (`lolly-share`), kaydedilmiş bir araç oturumunu, gömülü dosyalarını ve hâlâ referansla çözülen her şey için bir makbuzu içerir. Ayrıca onu yapmak için kullanılan aracı ve tasarım sistemini de taşıyabilir. Açmak yeni bir Proje ekler; var olan bir oturumun üzerine asla yazmaz.
- Bir **paylaşılan proje** (`project` türündeki `lolly-share`), Projeler'den bir klasörü içerir: alt klasörlerini, içlerine dosyalanmış her kaydedilmiş oturumu, her oturumun kutucuğunu ve orada dosyalanmış resimleri. Açmak, tüm klasörün bir kopyasını Projeler'e ekler; orada zaten var olan hiçbir şeyin yerini almaz. Proje dosyaları var olmadan önceki bir Lolly bunu okuyamaz ve güncellemeni söyler.
- Bir **tasarım sistemi paketi** (`lolly-brand`), tokenlar içerir ve yazı tipleri, logolar, yayınlanmış sürümler ve saklanan kaynaklar içerebilir. Açmak onu ayrı, adlandırılmış bir tasarım sistemi olarak ekler, sonra ona geçer; cihazda zaten olan sistemler kalır.
- Bir **marka çalışma alanı / örnek paketi**, bildirilmiş araçlar, katalog varlıkları ve isteğe bağlı bir örnek adresi olan bir `lolly-brand`'dir. Ön kontrol bu cihaz geneli etkileri listeler, çünkü onu yüklemek daha önce yüklenmiş tek çalışma alanı katmanının yerini alır.

Tam bir **cihaz/profil yedeği bir `.lolly` değildir**. `lolly-backup` formatıyla bir `LollyTools-….zip` olarak kalır ve yalnızca **Ayarlar → Depolama** üzerinden geri yüklenir. Düz zip'lenmiş bir araç klasörü de `.zip` olarak kalır. Başka bir deyişle, oturum ve tasarım sistemi paketleri `.lolly`'ye sahiptir; yedek ve düz arşiv iş akışları değil.

Üzerinde çalıştığın aracın Paylaş penceresindeki **.lolly indir**, geçerli tasarımı bir paylaşılan tasarım paketi olarak yazar. Kaydedilmiş oturumu, bu cihazda bulunan görseller ve dosyalarla birlikte taşır. Sıradan katalog işleri de yanında yolculuk eder. Lisanslı işler, açıkça dahil etmedikçe geride tutulur ve eski ya da erişilemeyen bir dosya kaybolmak yerine dış bir referans olarak kalır. Hazırlanan makbuz, gerçek `.lolly` boyutunu, gömülü dosya sayısını, dış referans sayısını ve aracın dahil olup olmadığını gösterir. Cihazında bir paylaşım sayfası varsa **Gönder…** o dosyayı diske kaydetmek yerine doğrudan ona verir (AirDrop, bir Android paylaşımı).

**Projeler**'de bir klasörün menüsündeki **Download project (.lolly)**, o klasörü paylaşılan bir proje olarak yazar, böylece başka biri onu açıp içindeki her oturumla devam edebilir. Her oturum kendi parçası olarak yolculuk eder (`sessions/<key>.json`, kutucuğu `thumbs/` altında), klasör ağacı `manifest.json`'da listelenir, yüklemeler ve katalog işleri tek bir paylaşılan tasarımla aynı kurallar altında yolculuk eder. Toplu iş oturumları araç oturumu değildir ve geride kalır; bildirim kaç tane olduğunu söyler. Yanındaki **Download originals** değişmedi: her öğenin kendi dosyası olarak düz bir zip'i.

Bir `.lolly` sıradan bir zip'tir. Adını `.zip` yapıp aç: kendi görsellerin `assets/uploads/` altında, katalog işleri `assets/catalog/` altındadır, her biri gerçek adı ve uzantısıyla; `manifest.json` hepsini listeler ve en üstteki bir README dosyanın ne olduğunu söyler.

Gitmeden önce üç şeye sen karar verirsin:

- **Adının dahil edilip edilmeyeceği.** Adın, e-postan ve kuruluşun dosyaya yalnızca profilinde **Use my details to create** açıkken yazılır. Kapalıyken dosya, Lolly ile ne zaman oluşturulduğunu kaydeder - senin hakkında hiçbir şey değil.
- **Lisanslı görsellerin dahil edilip edilmeyeceği.** Lisanslı ve marka kilitli varlıklar varsayılan olarak dışarıda tutulur. Tasarım herhangi birini kullanıyorsa, iletişim kutusu kaç tane olduğunu söyler ve iki düğme sunar - *Download without them* ya da *Include and download* - çünkü onları dahil etmek, `.lolly` dosyasını açan herkese asıl dosyaları teslim eder demektir.
- **Aracın dahil edilip edilmeyeceği.** **Include the tool**, aracın kendi dosyalarını tasarımla birlikte paketler, böylece o araca sahip olmayan bir cihazda da açılır. Özel bir araç için - alıcının büyük olasılıkla sahip olmadığı bir fork veya özel bir marka aracı - işaretli gelir, imzalı katalogda listelenen bir araç için ise işaretsiz gelir, çünkü onların kopyası aynı kaynaktan gelir. (İmzalı katalog olmayan bir yapıda, her araç özel sayılır ve kutu işaretli başlar.)

**Bir dosyayı açmak.** Kurulu bir masaüstü ya da mobil uygulamada bir `.lolly`ye çift tıkla ya da dokun, **Open with Lolly**'i seç, ya da sistemin paylaşım sayfasından Lolly'ye gönder. macOS, Windows, Linux, iOS ve Android biçimi kaydeder; masaüstü dosya yöneticileri onu bir Lolly belgesi olarak gösterir (ve GNOME Files, kaydedilmiş bir oturumun kendi küçük resmini gösterebilir). Web uygulamasında **Aç**'ı kullan ya da dosyayı Lolly'nin üzerine bırak. Her kapı aynı manifest öncelikli ön kontrolü kullanır. Brand Studio'dan açmak, paylaşılan bir tasarım bir tasarım sistemi taşıdığında bu eylemi önerir, ama dosyayı asla yeniden etiketlemez ya da **Open shared design**'ı gizlemez.

Başka bir uygulamadan devralınan bir iOS ya da Android belgesi 48 MB ile sınırlıdır, çünkü doğal devralma, baytlarını uygulama sınırı boyunca kopyalamak zorundadır. Mobil uygulama, aşırı büyük bir dosyayı sessizce yok saymak yerine bunu söyler. Lolly içindeki **Aç**, o devralmayı kullanmaz; daha büyük bir paket için denenecek yol odur.

Onaydan sonra seçilen okuyucu paketi bir kez açar ve doğrular. Paylaşılan bir tasarımın varlıkları kitaplığına gider, oturumu Projeler'e gider ve aracı kullanılabilirse açılır. Paylaşılan bir projenin oturumları, aynı dosyanın iki kez açılabilmesi için klasörlerinin yeni kimliklerle yeni bir kopyası altında Projeler'e gider ve klasör açılır; bu cihazda aracı bulunmayan bir oturum orada bekler. Cihazda zaten olan bir varlık sağlama toplamıyla eşleştirilir ve yeniden kullanılır. Bir tasarım sistemi paketi, uygulama ona geçmeden önce kendi ad alanında saklanır. 100 MB'ın üzerindeki dosyalar büyük olarak belirtilir ve tarayıcı depolaması, bildirilen yükün ihtiyaç duyduğundan daha az boş alan bildirdiğinde ön kontrol uyarır. Bütünlük kapsamındaki her parça, işlem onaylanmadan önce kontrol edilir; hasarlı bir kopya reddedilir ve yeni oluşturulan hedef geri alınır.

Dosya sende olmayan bir araç taşıyorsa Lolly, o araç çalışmadan önce sorar: **Bu araca güvenilsin mi?** aracı ve yazarını gösterir ve açmanın, aracın kendi kodunu cihazında çalıştıracağını açıkça söyler; geçiş yolu **Güven ve kur**'dur. Reddet, paylaşılan iş yine de projelerine kaydedilir ve aracı ekleyeceğin günü orada bekler. (Bir tür araç henüz yandan yüklenemez - kodu bir modül olarak gelenler - ve o da aynı şekilde geri çevrilir.)

Bir bağlantı da bir dosya da bir anlık görüntü devreder. Aynı oturum üzerinde başka biriyle *aynı anda* çalışmak için - iki cihaz, sunucu yok, aynı ağdaysanız internet gerekmez - bkz. [Birlikte çalışma](/info/collaborate.html).

## Canlı kamera (harekete duyarlı araçlar)

Her fotoğraf **Filtresi** - Halftone, Scanline, Posterize, Voronoi hücreleri, Renk işleme, Piksel esnetme ve Kusurlar - bir kameranın kullanılabilir olduğu yerde bir **Canlıya geç** düğmesi gösterir. Aç, efekt kare kare web kameranı takip etsin, böylece harekete tepki verir; sonucu GIF, WebM ya da MP4 olarak kaydedebilirsin. Kareler **cihazında** okunur ve işlenir, oradan asla çıkmaz; durduğun ya da araçtan ayrıldığın anda kamera serbest bırakılır. (Herhangi bir görsel seçicide, tek bir kareyi cihaz üzerinde bir görsel olarak yakalamak için **Fotoğraf çek** de bulunur.)

## Görsellerim

Bir araç cihazından bir görsel eklemene izin verdiğinde, görsel tam geldiği hâliyle saklanır - böylece üzerindeki bir Content Credential hâlâ doğrulanır - ve kişisel **Görsellerim** kütüphanene kaydedilir (**Ayarlar → Depolama** altında). Yalnızca gerçekten çok büyük bir dosya, olduğu gibi mi kalsın yoksa küçültülsün mü diye sorar. Onu herhangi bir araçta yeniden kullan. Görseller girerken EXIF/GPS verilerini temizlemek için profilinde **Yüklemelerden meta verileri kaldır**'ı aç. Bir üst sınır yok: kütüphane tamamen yereldir ve yalnızca cihazının depolama alanıyla sınırlıdır - görselleri orada yönet ya da sil.

## Varlıklar - kütüphanen

**Varlıklar** (`#/a` ya da her listeleme görünümünün üstündeki Araçlar · Yardımcı araçlar · Varlıklar · Projeler geçişinin **Varlıklar** bölümü), araçlarının yararlanabileceği her şeyi - marka logoları, görseller, ses ve hareketli görüntü, türe göre gruplanmış - bir araya getirir ve **kendi yaratıcı dosyaların** da burada yaşar. Sunucu yok, yönetim konsolu yok, pull request yok: her şey cihazında.

![Varlıklar, markanın renk örnekleri ve yazı tipleriyle ve kendi yüklemelerinle](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Dosyalarını içeri getir.** Herhangi bir görseli, SVG'yi, ses klibini, videoyu, Lottie'yi, PDF'i veya PowerPoint sunumunu yükleme alanına sürükle - ya da seçmek için tıkla - ve anında Varlıklar'da belirir, her aracın içerik seçicisinde hazır olur. Çok sayfalı bir PDF veya bir `.pptx`, hangi sayfaları veya slaytları tutacağını sorar - her biri bir SVG varlığı olur. İstediğin kadar içeri aktar; cihazını asla terk etmez.
- <!--i:star--> **Sık kullandığını favorile.** Bir içeriği (veya bir marka renk örneğini) ★ ile işaretle, her seçicinin en üstüne sabitlensin, böylece en çok kullandığın logo veya renk bir tık uzağında olsun.
- <!--i:folder--> **Düzen yap.** Bir içeriği başka bir gruba yeniden kategorile, kullanmadığın paylaşılan bir marka içeriğini gizle (geri getirmek için **Show hidden** ile) veya kendi yüklemelerini tamamen sil. Projects'teki aynı çoklu seçim hareketi ve yüzen eylem çubuğu burada da çalışır, böylece bunların herhangi biri tüm bir seçime bir kerede yapılabilir.
- <!--i:layers--> **Bir videonun arka planını kaldır.** Bir videonun ayrıntısını aç veya herhangi bir içerik seçicisinde kartına sağ tıkla ve saydam bir alternatif kaydetmek için **Remove background…**'ı seç - gerçek alfa kanallı animasyonlu bir WebP veya PNG. Bir **Method** seç: bir **On-device model**, hareketli bir sahneden bir öznesi keser, veya bir **Colour key**, green screen veya düz bir duvar gibi eşit aydınlatılmış, düz bir arka planı anahtarlar, kenarı ayarlamak için **Tolerance**, **Softness** ve **Spill removal** ile birlikte. Renk anahtarı ne model indirmesi ne de ağ gerektirir, bu yüzden **Remove background** her videoda sunulur ve düzenli görüntülerde genellikle daha temizdir. Bir **Resolution** kontrolü (360, 480, 720 veya 1080p, asla kaynağın ötesine geçmez) ayrıntıyı daha küçük, daha hızlı bir dosyayla takas eder. Cihazında arka planda bir iş olarak çalışır. Bitmiş kesim, orijinalin yanına kendi içeriği olarak kaydedilir ve kaynak videonun Content Credential'ı bir bileşen olarak onunla birlikte gider. (Arka plan kaldırmanın neden sıradan bir düzenleme olarak kaldığı için [Bir kez üretildi, aynı şekilde render edildi](/info/ai-features.html) sayfasına bak.)

### Paletini ve yazı tiplerini her yere taşı

Varlıklar'daki **Renk örnekleri** paneli göstermekten fazlasını yapar - bir rengi kopyalamak için tıkla ya da diğer aracının konuştuğu formatta **markanın tüm paletini indir**:

- <!--i:code--> **Tasarım tokenları (JSON)**, **CSS değişkenleri** ya da **CSS sınıfları** - markayı doğrudan bir stil sayfasına ya da bir derlemeye aktar;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - Illustrator ya da Photoshop'a yükle;
- <!--i:pentool--> **GIMP paleti (.gpl)** - GIMP ya da Inkscape için.

![Renk örnekleri paneli - üstte beş palet indirme düğmesi, ardından kopyalanabilir birer düğme olarak her marka rengi](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

**Yazı tipleri** paneli, yerel olarak kurmak ya da bir matbaaya vermek için marka yüzlerini her birinin yanında bir **indir** ile listeler. ([Brand Studio](/info/brand-studio.html)'nun Renkler odası aynı palet indirmesini sunar.)

Varlıklar, açık ve kendin-yap yolunun bir yarısıdır; diğeri **kendi araçlarını yapmaktır** - serbest kanvas (yukarıda anlatılan Design) kod yazmadan görsel olarak bir tane inşa etmeni sağlar.

## Ses ve erişilebilirlik

Lolly herkes için kullanımı rahat olmayı hedefler. Arayüz klavyeyle gezilebilir, özel kontroller ekran okuyucular için uygun etiketler taşır ve her aracın canlı önizlemesi, ne ürettiğini açıklayan tek, etiketlenmiş bir görsel olarak sunulur.

Nazik bir **yardımcı sesler** katmanı yaptığın şeyi onaylar - galeriye varış, geçerli ya da geçersiz bir Content Credentials kontrolü, bir paneli kapatma, bir filtre değiştirme. **Varsayılan olarak kapalıdır**: anahtarın göründüğü her yerde (her görünümün seçenekler açılır penceresi, ya da **Ayarlar**) **Ses**'i aç, seçim hatırlanır.

Dört isteğe bağlı konfor ayarı **Ayarlar → Erişilebilirlik** altında yaşar: **Reduce motion** (Hareketi azalt - uygulamanın geçişlerini ve süslerini kaldırır), **Hide colourful previews** (Renkli önizlemeleri gizle - sakin, simge ve metinden oluşan galeri kartları ve daha sessiz proje küçük resimleri), **High contrast** (Yüksek kontrast - daha güçlü kenarlıklar, metin ve odak halkaları) ve **Large text** (Büyük metin - daha büyük uygulama tipografisi: etiketler, menüler, düğme metni). Dördü de uygulamayı çalışmanın *etrafında* sakinleştirir: bir araç kanvasının içine hiç uzanmaz, dışa aktardığın şeyin tek bir pikselini bile değiştirmez ve her biri sen açana kadar kapalıdır. Tam ayrıntı: [Profilin → Erişilebilirlik](/info/profile.html#accessibility).

Ses anahtarının yanında **Neurospicy Modu** bulunur - çalışırken sessizce çalan, isteğe bağlı, sakinleştirici bir arka plan odak parçası. Onu açmak, seni uygulama boyunca takip eden küçük bir **oynatıcı dock'u** alt köşede açar; oradan bir parça arayıp seçebilir, ileri geri atlayabilir, sesi ayarlayabilir, küçültebilir ya da kapatabilirsin. Parça listesi birkaç kategoriye yayılır - prosedürel *Lolly Sings* melodileri, ambiyans döngüleri ve beat'ler, kendi yüklediğin sesler ve bir avuç canlı internet **radyo** istasyonu (bunlar bağlantı gerektirir; geri kalan her şey çevrimdışı çalar). **Varsayılan olarak kapalıdır** ve Ses gibi oturumlar ve cihazlar arasında hatırlanır. Sesi kapatmak odak parçasını da susturur.

## Depolama ve gizlilik

Lolly, çalışmanı cihazında tutar: web uygulamasında bu tarayıcının kendi depolamasında, masaüstü ve mobil uygulamalarda ise uygulamanın kendi depolamasında. Nelerin tutulduğu, **Tüm verilerimi temizle**'nin nelerini kaldırdığı ve tarayıcı verilerini temizlemenin nelerini beraberinde götürdüğü [Çalışmanı bul ve kurtar](/info/find-your-work.html#if-you-clear-your-browser-data) sayfasındadır; [Gizlilik Politikası](/info/privacy.html) uygulamanın getirdiği ya da gönderdiği her şeyi listeler, [Sunucu Yüzeyi](/info/server-surface.html) ise isteğe bağlı sunucu bileşenlerini.

## Başka bir cihaza geçiş

Çalışmanı ikinci bir bilgisayara ya da telefona taşımak için Sync, bir yedek dosyası ya da bir `.lolly` dosyası kullan. [Çalışmanı başka bir cihaza taşı](/info/find-your-work.html#move-your-work-to-another-device), üçünü karşılaştırır ve **Verilerimi dışa aktar** ile **Veri içe aktar…**'ı adım adım anlatır.

## Bir tasarım içe aktarma (Figma, Penpot, Illustrator, InDesign)

Var olan bir tasarımı Lolly'ye getirip üzerinde çalışmaya devam edebilirsin: **Design**'ı aç, kanvas araç çubuğunda **Bir tasarım içe aktar**'a tıkla ve bir Figma **.fig** ya da SVG, bir Penpot **.penpot**, bir Illustrator **.ai** / **.pdf** ya da bir InDesign **.idml** seç. Katmanlar serbest kanvasta düzenlenebilir kutulara dönüşür - metin yeniden yazılabilir kalır, görseller **Görsellerim**'e yerleşir, tipografi ve renkler marka geneline uyar - sonra sonuç, diğer her oturum gibi kaydedilir, paylaşılır ve oluşturulur. Ayrıştırma tamamen cihazında gerçekleşir. Tam ayrıntı: **[Bir tasarım içe aktar](/info/design-import.html)**.

## Dışa aktarma

Format seçme, çıktı boyutu ve baskı birimleri, şeffaflık, video ve kopyalama/paylaşma dahil tüm ayrıntılar için **[Dışa Aktarma ve Formatlar](/info/exporting.html)** sayfasına bak. Kısaca: bir format seç, gerekiyorsa boyutu ayarla ve **İndir**'e bas (ya da panoya **Kopyala**'ya).

## Batch (Pro) modu

Güçlü kullanıcılar için **Batch** (galeriden bağlantılı, varsayılan olarak açık olan Pro özellik bayrağının arkasında) birçok varyasyonu bir kerede oluşturur - her satırın birlikte dışa aktarılan bir girdi seti olduğu bir ızgara. Bir kartı bir düzine dile yerelleştirmek ya da her boyut varyantını tek geçişte üretmek için ideal. Satırları yazarak, doğrudan bir e-tablodan yapıştırarak ya da bir CSV içe aktararak doldur (bir tane de dışa aktarabilirsin) ve satır başına format, boyut ve çıktı dosya adını ayarla. Bütün bir ızgarayı galeriden yeniden açılan adlandırılmış bir **batch oturumu** olarak kaydet ve her satırı tek bir `.zip` olarak indir.

![Toplu işlem araç çubuğu - zip adı, birimler, DPI ve her satırın miras aldığı format, sağda Sessions ve Render ile birlikte](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch, **bir şablonun birçok varyantını** bir kerede üretmek içindir. **Zaten kaydettiğin** oturumları yeniden oluşturmak için **Projeler → Klasörü oluştur / Seçimi oluştur**'u kullan (bkz. [Çalışmanı bul ve kurtar](/info/find-your-work.html#find-something-you-saved)) - Pro gerekmez.

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

Lolly bir PWA'dır. Zaten açtığın ekranlarda **çevrimdışı** çalışmaya devam eder, **Ayarlar → Çevrimdışı kullanılabilir** altındaki **Uygulama** ise geri kalanını indirir - uygulama benzeri, tam ekran bir deneyim için tarayıcının adres çubuğundan kur (ya da mobilde *Ana Ekrana Ekle*). Tekrar çevrimiçi olduğunda kendini günceller.

Güncellemeler hakkında: bir güncellemeden hemen sonra bir görünüm hiç yüklenemezse (boş bir panel, köşede bir "failed to fetch"), sayfayı bir kez yeniden yükle - uygulama yeni sürümü temiz bir şekilde alır ve kaydedilmiş çalışman, oturumların ve markan dokunulmamış kalır; yalnızca eklediğin ve hiç kaydetmediğin bir görsel yeniden eklenmesi gerekebilir. Her şeyi sayfada değil, cihazında saklar.

Design ve Darkroom, Sequence videosu dahil, **Wide colour / HDR** düzenlemesiyle özgün görsel hassasiyetini koruyabilir. Marka renk örnekleri ayrı sRGB ve P3 değerleri taşıyabilir. Çıktı seçenekleri ve güncel sınırlar için [Wide colour ve HDR düzenleme](/info/hdr-editing.html) sayfasına bak.
