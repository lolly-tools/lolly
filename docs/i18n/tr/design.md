# Lolly Design: serbest tuval

<a id="design-the-free-canvas"></a>

Lolly Design, hiçbir şablona uymayan düzenler için kullanılan araçtır: sıfırdan bir poster, bir slayt sunumu veya ses eşlik eden hareketli bir çalışma. Tuvaldeki kutuları sürükler, yeniden boyutlandırır, döndürür ve içlerine yazarsın. Tuval, diğer tüm araçlarla aynı render yolunu kullanarak dışa aktarılır.

[Lolly'yi kullanma](/info/using.html), kaydetme ve paylaşma gibi tüm araçların ortak özelliklerini ele alır.

![Lolly Design'ın serbest tuvali - çalışma alanı ve çevresindeki yapıştırma masası](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

<!--i:eti-grid-->
## Design penceresi

**Üst çubuğun** başında **Home**, **File menu** ve belgenin adı bulunur (yeniden adlandırmak için belge adına tıkla). Ortada **Undo**, **Redo**, **History**, yakınlaştırma denetimleri (**Fit all** ve **Fit artboard** dahil) ve **Timeline**, **Navigator** ile **Inspector** anahtarları yer alır. Sağ tarafta **Share**, **Present** ve **Export** bulunur. Telefonda az kullanılan düğmeler **More actions** içine geçer.

Yandaki **araç rayında** Lolly menüsü ve çizim araçların bulunur: **Pointer**, **Add a box**, **Pen** (**Pencil** ile aynı düğmededir), **Edit points**, **Line** ve ardından Timeline, Artboards ve Auto-arrange düğmeleri.

![Serbest tuvalin araç rayı: sürükleme tutamacı, Lolly menüsü, ardından Pointer, Add a box, Pen, Edit points, Line, Timeline, Artboards ve Auto-arrange](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Tuval, çalışma alanının çevresinde tasarımcının yapıştırma masası gibi kullanılır:

- **Kutuları çalışma alanının dışında beklet.** Çerçevenin kenarını aşacak şekilde sürüklenen kutu görünür ve seçilebilir kalır. Çerçeve dışındaki her şey soluklaşır; çerçevenin gölgesi dosyanın başlangıcını gösterir.
- **Dışa aktarmaya yalnızca çalışma alanı girer.** Kutunun kenardan taşan kısmı dahil çerçeve dışındaki her şey, raster ve vektör çıktıda kırpılır.
- Beklettiğin her şeyi görmek için **Fit'in ötesine uzaklaştır**.
- Dışa aktarma boyutunu değiştirerek **çalışma alanını yeniden boyutlandır**. Kutular yerlerinde kalır; böylece düzeni mevcut içeriğin çevresinde yeniden çerçeveleyebilirsin. Kutular yerlerinde kalır.

![Düzenleme sahnesi: önde ve ortada çalışma alanı, solda araç rayı, köşede yakınlaştırma HUD'u](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator ve Inspector

**Navigator**, her çalışma alanını (**Artboards** başlığıyla veya sunumda **Slides** başlığıyla), **Layers** katmanlarından oluşan daraltılabilir bir grup olarak gösterir. Çalışma alanına gitmek için adını seç; katmanlarını seçmek veya sıralamak için çalışma alanını genişlet. Ok tuşları listede ilerler; Sol tuşu çalışma alanı başlığına geri döner. **Pages**, çalışma alanlarını adlandırılmış sayfalarda gruplar. Sayfa seçimi yalnızca düzenleyicide hangi çalışma alanlarının gösterildiğini değiştirir.

**Inspector**, seçtiğin nesnenin metin veya görsel denetimlerini en başta gösterir. Hızlı seçimler seçenek çiplerinde, stil ayrıntıları **Advanced** içinde yer alır. Telefonda Inspector ve katmanlar listesi, diğer araçlarda olduğu gibi üst çubuğun altından açılan ortak bir panel kullanır. Alt çubuktaki **Inspect** ve **Layer/Page**, paneli ilgili sekmede açar. Panelin alt kenarındaki tutamacı sürükleyerek veya tutamaca dokunarak iki sekmeli şerit, yarım ekran ve neredeyse tam ekran arasında geçiş yap. Yarım ekran durumunda panelin altındaki tuval, seçimini gösterir. Escape, seçimini koruyarak paneli tekrar şerit hâline getirir.

![Inspector'ın Document bölümü: Selection ve Canvas sekmeleri, ardından Dimensions ve Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

<!--i:eti-crop-->
## Yeniden boyutlandır, ölçekle ve döndür

Nesneyi seçip boyutunu değiştirmek için tutamağını sürükle; döndürmek için seçimin altındaki yuvarlak tutamağı sürükle. Boyut değiştirme sürüklemesi iki moddan biriyle çalışır:

- Varsayılan **Resize**, yalnızca kutuyu değiştirir. Metin yeni boyuta göre yeniden satırlara bölünür; yazı tipi boyutu, çizgi kalınlığı, köşe yarıçapı ve efektler değişmez.
- **Scale**, nesneyi içeriğiyle birlikte büyütüp küçültür: yazı tipi boyutu, çizgi, köşe yarıçapı, gölge, bulanıklık, dolgu ve aralık aynı ölçüde değişir.

`K` tuşuyla Scale'i açıp kapat. Klavye kullanmıyorsan Lolly menüsünden **Scale mode** seç veya raydaki **Pointer** düğmesini basılı tutup (ya da sağ tıklayıp) **Scale** seç. Dokunmatik ekranda nesne çubuğunda ayrıca bir Scale anahtarı bulunur. Scale açık olduğunda Pointer düğmesinde Scale simgesi, her tutamağın ortasında da bir nokta görünür. `V` veya **Escape**, seçimi koruyarak Resize'a geri döndürür. Çizgilerin yanlışlıkla ölçeklenmemesi için her belge Scale kapalı olarak açılır. Her belge Scale kapalı olarak açılır.

**Sayısal değerle ölçekle.** Scale açıkken veya birden çok nesne seçtiğinde nesne çubuğundaki göstergeye tıklayarak **Scale** açılır penceresini aç. Yüzde, genişlik veya yükseklik gir; 3 x 3 ızgaradan sabit tutulacak noktayı seç ve **Apply** seç. Her ölçekleme bir geri alma adımı oluşturur.

**Birden çok nesne.** Birden çok nesne içeren seçimin hem kenarlarında hem köşelerinde tutamaklar bulunur. Tüm nesneler dik durumdaysa veya tam çeyrek dönüşlerle döndürülmüşse ve seçimde grup veya daire yoksa köşeyi sürüklemek genişliği ve yüksekliği serbestçe değiştirir. Diğer durumlarda seçimin oranları korunur ve göstergede **Proportional** de görünür. Sürükleme sırasında küçük bir etiket boyutu, Scale modundaysa yüzdeyi gösterir.

**Seçimi çevir.** Sağ tıklayıp **Flip horizontal** veya **Flip vertical** seç ya da `Shift+H` veya `Shift+V` tuşlarına bas. Dışa aktarılan SVG, PDF ve PNG dosyaları çevirmeyi korur.

**Sürüklerken basılı tuttuğun tuşlar**, basıldıkları veya bırakıldıkları anda etkili olur. Kısayol sayfasında (`?`) da listelenirler.

| Basılı tut | Yeniden boyutlandırma veya ölçekleme | Döndürme | Taşıma |
|---|---|---|---|
| **Shift** | Oranları korur (Scale her zaman korur) | 15 derecelik adımlarla döndürür | Değişiklik yok |
| **Alt** (Option) | Merkezden uygular | Serbestçe döndürür | Yakalamayı ve ızgarayı kapatır |
| **Cmd/Ctrl** | Yakalamayı ve ızgarayı kapatır | Serbestçe döndürür | Yakalamayı ve ızgarayı kapatır |

Tuş basılı değilken döndürme, 15 derecelik bir açıya 4 derece yaklaştığında en yakın 15 dereceye oturur. Çalışma alanları döndürülemez ve döndürme tutamakları bulunmaz.

::: details Tutamaklar, tutma bölgeleri ve dokunma
**Kenarın herhangi bir yerinden tut.** Seçimin her kenarı bir yeniden boyutlandırma şerididir. Fare veya kalem kullanırken her köşenin hemen dışında bir döndürme bölgesi de bulunur. İşaretçi, sürüklemenin ne yapacağını gösterir. Şeride veya bölgeye basmak ancak sürüklemeye başladığında yeniden boyutlandırmaya veya döndürmeye dönüşür; bu yüzden normal tıklama yine seçim yapar. Kilitli nesnelerde tutamak, şerit veya bölge bulunmaz.

**Küçük nesneler taşınabilir kalır.** Ekrandaki boyutu 25 piksel veya daha az olan nesnelerde orta tutamaklar gizlenir, diğerleri dış çizgiden biraz uzaklaşır; böylece nesneye basmak nesneyi taşır. Boyut 10 piksel veya altına indiğinde köşe tutamakları da kaybolur; ince bir çizgi ise her ucunda bir tutamak tutar. İnce bir çizginin veya çok küçük bir nesnenin hemen yanında, tutamakların dışında bir yere basmak nesneyi taşır.

**Geniş tutma alanları.** Dokunmatik ekranda her köşe bölgesi, seçimin ekrandaki genişliğinin ve yüksekliğinin dörtte biri kadardır ve 24 ile 44 piksel arasındadır; her kenar bölgesi ise iki köşe arasını kaplar. Seçim çok küçükse bölgeler dış çizginin dışına taşınır. İşaretçinin veya parmağının altındaki bölge gölgelenir. Aynı bölgeleri fare veya kalemle kullanmak için Lolly menüsünde **Large grab areas** seçeneğini aç. Ayar bu cihazda saklanır.

**Seçim üzerinde iki parmak.** Dokunmatik ekranda seçili nesneye iki parmağını koy: ölçeklemek için sıkıştır, döndürmek için çevir veya seçimi taşımak için iki parmağını birlikte hareket ettir. Her hareket bir geri alma adımıdır. Scale açıkken sıkıştırma içeriği de ölçekler; Scale kapalıyken orantılı olarak yeniden boyutlandırır. Döndürme, yaklaştığında en yakın 15 dereceye oturur; iki parmakla taşımada yakalama asla uygulanmaz. İlk parmak seçimin üzerine gelmeli; ikincisi hemen ardından seçimin üzerine veya kenarının hemen dışına gelmelidir. Başka bir yerdeki iki parmak görünümü yakınlaştırır ve kaydırır. Çalışma alanı veya kilitli nesne içeren, görünümün çoğunu kaplayan ya da kenarının dışına taşan bir seçim üzerindeki iki parmak da aynı şeyi yapar.
:::

<!--i:eti-pen-tool-->
## Kendi şekillerini çiz

Kutular, daireler ve yuvarlatılmış çerçeveler çoğu düzen için yeterlidir. Diğer şekiller için raydaki **Pen** düğmesi (veya `P`) çizim modunu başlatır. Dört tuş mod değiştirir: Pointer için `V`, Pen için `P`, **Pencil** için `Shift C` ve **Edit points** için `N`. Pointer her zaman çizim modundan çıkar.

- Nokta yerleştirmek için **tıkla**. Varsayılan eğri türünde **tıklayıp sürüklemek**, eğri oluşturmak için noktanın tutamaklarını dışarı çeker; keskin köşe için tıklarken **Alt** tuşunu basılı tut. Diğer eğri türlerinde her nokta bir köşedir ve sürüklemek hiçbir şey yapmaz.
- Yatay, dikey ve 45 derecelik çizgiler için tıklarken **Shift** tuşunu basılı tutarak yeni parçayı önceki noktaya göre 15 derecenin katlarıyla yerleştir. Shift, dışarı çektiğin tutamağı da adımlarla hareket ettirir.
- Noktaları yerleştirirken çalışma alanına, diğer kutularına ve yolun diğer noktalarına yakalanırlar. Alt, çizim sırasında ızgarayı kapatır; daha sonra bir noktayı sürüklediğinde hem ızgarayı hem kenarlara yakalamayı kapatır.
- Şekli kapatmak için **ilk noktana tıkla**. Çizimi açık bırakmak için **Enter** tuşuna bas, çift tıkla veya araç değiştir.
- **Escape** önce çizimi iptal eder, ardından kalemden çıkar.
- Çizim sırasında **Delete** veya Undo (`⌘ Z` ya da `Ctrl Z`) son noktayı kaldırır.

**Açık bir yola devam et.** Pen açıkken açık bir yolun iki ucundan birine basarak o yolu çizmeye devam et. Her tıklama o uçtan sonra bir nokta ekler; baştan başladıysan ilk noktadan önce ekler. Enter sonucu korur; Escape yolu önceki hâlinde bırakır. Yol, dolgusu, çizgisi ve ok uçlarıyla aynı kutu olarak kalır; tek bir geri alma değişikliği geri çevirir. Delete yalnızca eklediğin noktaları kaldırır. Kapalı şeklin, kutuya bağlı çizginin ve birkaç parçalı yolun serbest ucu yoktur.

**Pencil ile serbest çizim yap.** `Shift C` tuşlarına bas veya raydaki **Pen** düğmesini basılı tutup (ya da sağ tıklayıp) **Pencil** seç. Yeniden Pen'i seçene kadar düğmede Pencil görünür. Pencil, sürüklerken çizdiğin izi kaydeder. Bıraktığında Lolly, izi Bezier tutamaklı birkaç noktaya dönüştürerek yumuşatır. Keskin dönüşler köşe olarak kalır; eğri, çizdiğin izden en fazla birkaç ekran pikseli uzaklaşır. Başladığı yere yakın biten bir çizim kapanır.

Pen veya Pencil yolu sıradan bir kutudur: diğerleri gibi yolu taşı, yeniden boyutlandır, döndür, grupla, hizala, yığın sırasını değiştir, doldur, gölgelendir veya soldur. İlk yol, markanın yollar için belirlediği dolguyu ve çizgiyi alır; sonraki her yol son kullandığın ayarları alır. Marka yollar için hiçbir şey belirlememişse yeni yolun çizgisi çizim yaptığın renkte olur; böylece şekil asla görünmez kalmaz.

**Noktaları yeniden düzenle.** Şekle çift tıkla veya nesne çubuğundaki **Edit points** seçeneğini kullan. Noktayı taşımak için sürükle, eğrinin yönünü değiştirmek için tutamağı sürükle, nokta eklemek için eğriye tıkla veya birkaç noktayı kutuyla çevreleyip Delete tuşuna bas. Bir yolda her zaman en az iki nokta kalır.

- Noktayı sürüklerken **Shift** tuşunu basılı tutarak açısını, yol üzerindeki hareket etmeyen bir sonraki noktaya göre ölçülen 15 derecelik adımlarla değiştir. Tutamağı sürüklerken Shift, tutamağı kendi noktası etrafında adımlarla döndürür. Shift ile tıklamak yine seçime nokta veya tutamak ekler; adımlama sürüklemeye başladığında devreye girer.
- Sürüklenen nokta çalışma alanına, diğer kutulara ve yolun diğer noktalarına yakalanır. Noktayı serbestçe yerleştirmek için Alt tuşunu basılı tut.
- Tutamağa tıkla, ardından **Delete** tuşuna basarak tutamağı kendi noktasına geri çek. Noktanın o tarafı köşeye dönüşür. Noktalar seçiliyken Delete, noktaları kaldırır.

**Spline type**, noktalarından ne tür bir eğri geçeceğini belirler:

| Tür | Ne yapar |
|---|---|
| **Smooth (auto)** | Varsayılandır. Tutamak uzunluklarını kendisi belirlediği için normal tıklamalar yumuşak bir eğri oluşturur. Ayarladığın tutamak yönü sabitler; uzunluğu yine eğri belirler. |
| **Bezier handles** | Her tutamağı sen yönetirsin; nokta eklemek eğriyi asla hareket ettirmez. |
| **Through the points** | Tutamak kullanmadan her noktadan geçer. |
| **B-spline** | Daha yumuşak bir çizgi için noktaların içinden değil, yakınından geçer. |
| **Straight lines** | Çok parçalı bir çizgi. |

Mevcut bir yolu tutamaklarını kendisi belirleyen bir türe geçirirken önce onay istenir; çünkü ayarladığın tutamak uzunlukları kaybolur. Çizim sırasında geçiş hemen uygulanır ve çektiğin tutamaklar kaldırılır. **Bezier handles** türüne geçmek hiçbir şeyi kaybettirmez. Çizerken geçiş anında uygulanır ve çektiğin tüm tutamaklar kaldırılır.

Her nokta ayrıca şekliyle gösterilen bir süreklilik kuralı taşır: **Corner** için kare (tutamaklar bağımsız hareket eder), **Smooth** için yuvarlak (tutamaklar aynı doğrultuda kalır) ve **Symmetric** için halkalı yuvarlak (aynı doğrultuda ve eşit uzunlukta). Seçili noktaların kuralını ayarla; eğri anında güncellenir.

![Doğrudan bir bağlantıdan render edilen iki kalem yolu: çizgili bir S eğrisi ve kapalı, dolgulu bir leke](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Çizilmiş bir yol, diğer kutular gibi paylaşım bağlantısında taşınır ve komut satırından da aynı şekilde render edilir.

<!--i:eti-blend-->
## Şekilleri birleştir

İki veya daha fazla şekil seç, tuvale sağ tıkla (dokunmatik ekranda iki parmakla dokun) ve seç:

- **Union**, en üsttekinin boyasını kullanarak bunları tek bir şekilde birleştirir.
- **Subtract**, üstteki her şeyi en alttaki şekilden kesip çıkarır.
- **Intersect**, yalnızca kesişimi tutar.
- **Exclude**, kesişim dışında her şeyi tutar.

Üç işlem daha tek bir şekil üzerinde çalışır. **Outline stroke…**, çizgiyi aynı kalınlıkta dolgulu bir dış çizgiye dönüştürür. **Offset path…**, dış çizgiyi dışa doğru genişletir veya negatif sayıyla içe doğru daraltır. **Simplify**, aynı dış çizgiyi daha az parçayla koruyarak yolu yeniden oluşturur.

![İkisi de Subtract ile oluşturulmuş bir hilal ve ortasında gerçek bir delik bulunan halka](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Sonuç, kalemle düzenleyebileceğin düz Bezier eğrilerinden oluşan yeni bir yoldur. Özgün spline türü aktarılmaz. Çizgi panelindeki **Fill rule** denetimi, üst üste binen konturların dolmasını (*non-zero*) veya delik oluşturmasını (*even-odd*) belirler. İşlemler yok etmek yerine reddeder: kesişmeyen iki şekli kesiştirmeyi istersen hiçbir şey değişmez. İşlemler şekilleri asla yok etmez: kesişmeyen iki şekli kesiştirmek hiçbir şeyi değiştirmez. Metin ve görsel kutularının dış çizgisi yoktur; bu yüzden işlemler onları atlar.

<!--i:eti-image-->
## Görseli vektörleştir

Görseli düzenlenebilir şekillere dönüştürmek için tek bir görsel seç, sağ tıkla ve **Trace image…** seç. Bir hazır ayar seçip **Trace** düğmesine bas:

- **Logo**, birkaç düz renk bulur; net kenarları ve gerçek dairelerle çizgileri korur. Logo, geçişli renkler veya fotoğraf tonları içeren görseli reddeder ve nedenini söyler.
- **Illustration**, birkaç rengi dolgulu şekiller, düz renkli çalışma veya posterize edilmiş görsel olarak vektörleştirir.
- **Line art**, açık renkli sayfadaki koyu çizgileri siyah şekiller olarak vektörleştirir.
- **Centreline**, koyu çizgileri kalınlığını değiştirebileceğin tek çizgiler olarak vektörleştirir.

Şekiller, görselin üstüne bir grup olarak eklenir; görsel yerinde kalır. Yalnızca yolları görmek için görseli gizle veya sil. Vektörleştirme, cihazında Cancel düğmesi olan bir arka plan işi olarak çalışır ve hiçbir şey yüklenmez. 1500 piksellik bir görsel genellikle bir ila birkaç saniye sürer; yoğun ayrıntılı bir fotoğraf daha uzun sürer.

Vektörleştirme, kutunun gösterdiği görüntüyü izler; bu yüzden kırpılmış (Cover) bir görselin yalnızca görünen kısmı vektörleştirilir. Şu sınırlar geçerlidir:

- Görseller vektörleştirmeden önce uzun kenarları en fazla 1500 piksel olacak şekilde küçültülür; bu yüzden kenarların yerleştirme hassasiyeti özgün boyutun değil, bu boyutun bir kesri kadardır.
- Tek bir vektörleştirme en fazla 1.500 şekil ve 60.000 nokta oluşturur. Fotoğraflar genellikle bu sınırı aşar; bu durumda Lolly Design bunu belirtir ve hiçbir şeyi değiştirmez. Logo veya Line art'ı ya da daha sade bir görseli dene.
- Renk geçişleri düz renk bantlarına, yumuşak gölgeler ise keskin kenarlı şekillere dönüşür.
- Görsel kutusunun köşe yarıçapı, şekil maskesi ve efekti yollara uygulanmaz.
- Aynı görsel ve hazır ayar her zaman aynı şekilleri üretir.

<!--i:eti-hexagon-->
## Çizgiler

Kutu, görsel, çalışma alanı ve kalem yolu birer çizgi taşıyabilir: renk, kalınlık ve stil (düz, kesikli veya noktalı). Çizgi satırları Inspector'da **Fill** altında bulunur; nesne çubuğundaki **Stroke** düğmesi bunları açar.

**Position**, çizginin dış çizgi üzerindeki yerini belirler: **Inside**, **Centre** veya **Outside**. Kutunun çizgisi varsayılan olarak içeride çizilir; böylece kutu, çizdiğin dış kenarı korur. Kalem yolunun çizgisi eğrinin ortasına hizalanır. Ortalanmış veya dışarıda bir çizgide dolgu, görsel ve metin çizginin iç kenarının içinde kalır; seçim dış çizgisi ise kutunun kenarında kalır. Açık yolun içi olmadığı için çizgisi her zaman ortalanır. Çalışma alanının çizgisi her zaman sayfanın içinde kalır; çünkü sayfa kenarı dışa aktarma kenarıdır.

**Her kenar için çizgi.** Dikdörtgende, yuvarlatılmış kutuda, hap biçiminde veya çalışma alanında kalınlığın yanındaki anahtar dört kalınlık gösterir: **Top**, **Right**, **Bottom** ve **Left**. İkinci bir şekil kullanmadan ayırıcı veya alt çizgi oluşturmak için bir kenarı 0 yaparak gizle. Anahtar yalnızca dört hücreyi gösterir veya gizler; hiçbir değeri değiştirmez. Kenarlar farklıyken kalınlıkta **Mixed** yazar; dört kenarı da ayarlamak için buraya bir kalınlık gir. Tüm kenarlar aynı rengi, konumu ve stili paylaşır. Yuvarlatılmış köşeler, CSS kenarlığı gibi yanlarındaki kalınlıklara göre kıvrılır. Elipsler, daireler ve kalem yolları her yanda tek kalınlıkla çizilir.

::: details Her biçim çizgiyi nasıl taşır
| Biçim | Konum | Kenar başına |
|---|---|---|
| SVG, PDF, PNG ve diğer görseller | Tam olarak korunur. Kalem yolunun iç veya dış çizgisi iki kat kalın çizilir ve dış çizginin bir tarafına kırpılır. | Düz çizgi, çizginin dış ve iç kenarları arasındaki tek bir şekil olarak tam korunur. Kesikli veya noktalı çizgi, SVG'de her kenar boyunca kesikli, PDF'de düz çizilir. |
| Penpot | İçeride, ortada ve dışarıda konumları Penpot'un çizgi hizalaması olarak taşınır. Çalışma alanı her zaman `inner` olur. | Penpot 2.19 veya sonrası dört kalınlığı yerel olarak okur. Penpot 2.18 her yanda üst kenarın kalınlığını çizer; Penpot 2.17 veya öncesi, kenar başına kalınlık içeren dosyayı reddeder. |
| PowerPoint | PowerPoint, şeklin kenarına ortalanmış bir çizgi çizer. Ortada konumu tam korunur. Dışarıda konumu, şekli kalınlığın yarısı kadar dışarı taşır; böylece PowerPoint'in çizgisi kutunun dışında kalır. İçeride konumu, eski dışa aktarmaların yazdığı ortalanmış çizgiyi korur. | Çizgi, çizgisiz bir şeklin üzerinde ayrı bir şekle (dış ve iç kenarlar arasındaki halka) dönüşür. |
| dotLottie | Lottie çizgileri ortalanır; bu yüzden dışarıda kutu çizgisi veya içeride ya da dışarıda çizilen kalem yolu bir mesajla reddedilir. | Bir mesajla reddedilir. |
:::

Yarı saydam, ortalanmış bir çizginin iç yarısından, tuvalde ve her dışa aktarmada dolgu değil sayfa görünür. İçeri aktarılan Penpot dosyası, her çizginin hizalamasını ve kenar başına kalınlıklarını korur. Figma dosyasının `strokeAlign` değeri ve ayrı çizgi kalınlıkları da aktarılır.

<!--i:eti-box-->
## Tasarım içindeki 3D sahneler ve araçlar

Bir kutu, görselden fazlasını içerebilir. 3D sahne veya araç, render edilmiş görsel yerine bir tarif saklar; böylece kutu, belgenin istediği her boyutta ve anda yeniden çizilir. Kaynaktaki güncelleme, o kaynağı kullanan her tasarıma ulaşır.

### 3D sahneler

Rayın ekleme menüsünden **3D scene** seç ve sürükleyerek bir çerçeve çiz. Lolly 3D Studio yeni kutuda açılır; oradaki ayarların tuvale geri döner. Inspector'ın **3D scene** bölümündeki **Edit in 3D Studio**, stüdyoyu yeniden açar. [Lolly Design'a sahne yerleştir](/info/3d-studio.html#place-a-scene-in-lolly-design), posterleri, zaman çizelgesini, dışa aktarmayı ve paylaşmayı ele alır.

### Tasarım içindeki araçlar

Rayın ekleme menüsünden **Image** seç, sürükleyerek bir çerçeve çiz ve seçicinin **Tools** sekmesinden bir araç seç. Araç, çerçeveyi varsayılanlarıyla doldurur; Inspector, aracın denetimlerini içeren **Tool** bölümünde açılır. Bir alanı değiştirdiğinde kutu kısa süre sonra tek bir geri alma adımı olarak güncellenir. **Image fit** ve **Image position**, diğer görsellerdeki gibi çalışır; **Replace with another tool or image**, kutunun içeriğini değiştirir.

**Hareketli araçlar**, kutunun içinde oynatılır. Döngülü bir illüstrasyon tuvalde döner, zaman çizelgesi açıldığında oynatma imlecini izler ve kare kare GIF, MP4 veya WebM olarak dışa aktarılır. Araç döngü süresini belirttiğinde kutuya o uzunlukta bir klip verilir; böylece video tam döngüler içerir. Zamanlamasını değiştirdiğin klip senin zamanlamanı korur. Aracın hareketini kapatmak, kutuyu sabit bir görsele dönüştürür.

<!--i:eti-film-->
## Zaman çizelgesi (Sequence)

**Sequence**, Lolly Design'ın çalışma alanının altına yerleşen zaman çizelgesidir. Her kutu belirli bir anda başlayabilir, belirli bir süre çalışabilir ve animasyonla girip çıkabilir.

Lolly Design'ın **Video** şablonu kısa bir sekansla başlar: sekans satırında zamanlanmış iki metin kartı ve altlarında prosedürel olarak üretilen bir müzik zemini.

![Sequence zaman çizelgesi: oynatma denetimleri, cetvel, bindirme şeridi, klipleri ve birleşim çipleriyle manyetik sekans satırı ve Always on şeridi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

İki tür satır vardır:

- **Sekans satırı** manyetiktir. Klipler uç uca durur; birini sürüklemek sıralamayı değiştirir, birini silmek boşluğu kapatır. Bu satır omurgadır.
- **Bindirme şeritleri** serbesttir. Alt bant yazısı, logo veya altyazı, kendi zamanında ve kendi şeridinde omurganın üzerinde yer alır.
- Altlarında **Always on**, zamanlaması olmayan ve baştan sona gösterilen kutuları tutar. Çipteki `+`, kutuyu bir şeride taşır; **Make always on** geri gönderir.

Zaman çizelgesi açıkken Space ve ok tuşları oynatma imlecini yönetir. Zaten zamanlama içeren bir kompozisyon zaman çizelgesini otomatik olarak açar.

**Düzenleme.** Bir klibi taşımak için ortasından, kırpmak için uçlarından birinin yakınından sürükle ve ikiye bölmek için **Split at playhead** düğmesine (veya `S` tuşuna) bas. Bölmek için klibin **Length** değeri ayarlanmış ve oynatma kafası klibin biraz içinde olmalıdır; bu yüzden arka plan müziği gibi açık uçlu bir klip bölünemez. **Snap to edges** varsayılan olarak açıktır ve klip kenarlarına, oynatma kafasına ve tam saniyelere yakalar. Yakalama olmadan sürüklemek için Alt tuşunu basılı tut. Her sürükleme tek bir geri alma adımıdır ve sürükleme önizlemesi sonuçla eşleşir.

Bir klip seç; Inspector aynı düzenlemeleri sayılarla sunar: **Length**, **Trim in** (klibin kaynakta ne kadar ileriden başladığı), ×0.25 ile ×4 arasında **Speed**, süreleriyle birlikte **Animate in** ve **Animate out** ve **Mute clip**. Manyetik satırdaki bir klipte **Start** alanı yoktur; çünkü sırayı satır belirler.

**Transitions** hazır ayarlardır: Fade, Pop, Grow, Rise, Drop, dört Slides, Zoom in ve Zoom out, Tilt, Swoop, Spin, Drift veya **Cut (no animation)**. Mesafeler nesneyle birlikte ölçeklenir; böylece tek bir hazır ayar hem tam çerçeve bir kartta hem küçük bir rozette çalışır. Sekans satırındaki iki klip arasında bir **birleşim çipi**, **Cut** veya **Crossfade** seçmeni sağlar. **Length (ms)** değerini ayarlamak için çipi yeniden aç, sonra **Done** düğmesine bas. Çapraz geçişte ilk klip kesme noktasından sonra oynamaya devam edip kaybolurken sonraki klip belirir; hem önizlemede hem dosyada.

**Ses.** Bir **Audio** klibi zaman çizelgesinde dalga biçimi, kırpma ve sesi kapatma denetimleriyle yer alır. Video şablonunun üretilen arka plan müziği dışa aktarma sırasında sentezlenir; bu yüzden render edene kadar çubuğu düz ve sessiz kalır. Geri sayım ve seviye ölçerle zaman çizelgesine **seslendirme kaydetmek** için mikrofona bas. Kayıt, oynatma kafasının bulunduğu yere kendi varlığın olarak kaydedilir. Mikrofonun yanındaki kamera düğmesi aynı şekilde, çalışma alanına kırpılmış olarak **video kaydeder**; böylece bir meslektaşın paylaşılan bağlantıdan klip ekleyebilir. Ses düzeyi, pan, EQ, perde, normalleştirme ve **Voice cleanup** gibi efektler için zaman çizelgesinin altındaki şeridi açmak üzere sesli bir klip seç. Sekans düzenleyici kılavuzundaki [Ses](/info/sequence-editor.html#sound) bölümü bu şeridi anlatır. Dışa aktarma panelindeki **Audio track** ayrıdır: tüm klibin altında, yumuşak giriş ve çıkış ile otomatik ses kısma içeren tek bir arka plan sesi.

![Müzik klibi seçiliyken zaman çizelgesi: şeridi altta Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume ve Effect yuvasıyla uzanır](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Czzfxm%25253A7%25253Alofi%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Render etme.** Bir hareket dışa aktarması her kareyi tam belirlenmiş bir anda çizer, çözer ve kodlar; böylece dosya makinenin hızına bağlı olmaz. MP4 ve WebM'de pratik bir kare sınırı yoktur. Bir süre yazmadığın sürece süreyi zaman çizelgesinin uzunluğu belirler. Content Credentials, diğer dışa aktarmalarda olduğu gibi damgalanır. Sabit görsel dışa aktarması, oynatma kafasındaki kareyi veya **Frames** alanından bir kontak baskıyı verir; bkz. [Zamanlanmış bir kompozisyondan sabit görseller](/info/exporting.html#stills-from-a-timed-composition). Bir sekans en fazla bir saat olabilir. GIF ve animasyonlu PNG her kareyi bellekte tutar; bu yüzden kısa kliplere uygundurlar. Burada kare kare render kullanıldığı için **Record live** gizlidir.

**Anahtar kareler, derinlik ve kamera.** Bir geçiş, klibi gelirken ve ayrılırken canlandırır. Bir kutuya klip içinde poz vermek (kaydırmak, soldurmak, bulanıklaştırmak, sayfadan kaldırıp geri yerleştirmek) için klibi seç ve **+Keyframe** düğmesine bas: zaman çizelgesinin araçlarındaki elmas, tuvaldeki nesne çubuğundaki elmas veya zaman çizelgesi odaktayken **Shift+K**. Oynatma kafasının konumu, sonraki düzenlemenin hangi pozu yazacağını belirler. Aynı anahtar kareler zamanlanmış bir kompozisyona yaklaşan, kayan ve odağı değiştiren bir kamera kazandırır. Bir yumuşatma, bir [yay](/info/animating.html#springs) veya tasarım sisteminin tanımladığı bir eğri olabilir; konum anahtar karesindeki tutamakları sürüklemek tuvaldeki [hareket yolunu](/info/animating.html#edit-the-motion-path) büker. [Animasyon](/info/animating.html) tam kılavuzdur; [Sekans düzenleyici](/info/sequence-editor.html) ise seçim, soğan zarı görünümü, bölme, kırpma ve işaretçileri anlatır.

<!--i:eti-checklist-->
## Dışa aktarmadan önce

Dosyayı göndermeden önce belgeni **Before you export** kartı kontrol eder. Kart, Inspector'ın **Document** bölümünde ve dışa aktarma panelinde görünür.

Kart, kayıtlı katman yapısını okur, sonra çizimi tamamlanmış tuvalde kesilen metin ve düz renk kontrastını kontrol eder. Kart, SVG ve PDF için metni dış çizgilere dönüştürmede kullanılan yazı tipi kayıt sistemine her metin parçası için gömülebilir yazı tipi baytlarının bulunup bulunmadığını sorar. Dışa aktarmada bir [yedek yazı tipinin](/info/fallback-fonts.html) çizdiği metin kapsanmış sayılır. Yedek yazı tipi olmayan bir yazı sistemi veya bu yazı tiplerinin içerdiği kümelerin dışındaki bir Çince, Japonca ya da Korece karakter yine bildirilir. Görsel ve gradyan arka planlar, uydurma bir kontrast puanı olmadan görsel kontroller olarak listelenir.

### Bir kompozisyonu tasarım sistemine göre kontrol et

Dışa aktarma panelinin kartı, kompozisyonu tasarım sisteminle de karşılaştırır; render'ın kullandığı tasarım sistemi sürümünü kullanır. Tanımlanan renkleri, token takma adlarını, yazı tipi seçimlerini ve görsel varlık kimliklerini kontrol eder. Özel bir değer kasıtlı olabilir ve tanımlanan marka varlıklarının dışındaki bir görsel, yasaklanmış bir görsel değil, incelenecek bir öğedir.

Bir renk veya yazı tipi önerisi varsa düğmesi yalnızca o katmanı değiştirir ve **Undo** özgün hâlini geri yükler. Eski bir öneri, kilitlenmiş veya sonradan değiştirilmiş bir katmanın üzerine asla yazmaz. Karşılaştırma gradyanları, efektleri, iç içe araç içeriğini, hakları ve öznel kaliteyi kapsamaz. Hiçbir kontrol Download'ı engellemez.

### Kurumsal kurallar ve yazım sinyali

Dışa aktarma panelinin kartı, tasarım sistemindeki metin kalınlığı ve hizalama, onaylı renk eşleşmeleri veya yüzey başına bir logo gibi kurumsal kuralları da katman katman kontrol eder. Her bulgu, kuralın üzerinde katmanın adını gösterir. Zorunlu bir kurala aykırılık uyarı, tavsiye niteliğindeki bir kurala aykırılık ise not olarak gösterilir. Logo bulgusu her logonun katalogdaki adını verir. Bu derlemede kontrol mekanizması olmayan bir kural, asla uyulmuş olarak değil, kontrol edilmemiş olarak listelenir. [Kurallar](/info/brand-studio.html#rules) kuralları listeler ve `lolly check` aynı kuralları kayıtlı bir belgeye uygular. Bir Lolly Work iş ortağı programında kart, iş ortağı şirketin marka işaretlerini [iş ortağı kitine](/info/manage/partner-programmes.html#partner-kits) göre de kontrol eder ve neleri ölçemediğini söyler.

Aynı kart, belgenin çizdiği metnin yazım sinyalini gösterir: önce düzeyi (yok, zayıf, kayda değer veya güçlü), sonra Lolly Verify'ın 100 üzerinden puanı ve işaretlenmiş en fazla üç ifadeyi içeren cümlesi; her ifadenin bulunduğu katman da gösterilir. **Open the text in Verify**, ayrıntılı değerlendirme için o metni [Lolly Verify](/#/verify)'a götürür. [Lolly Verify'da yapay zekâ kanıtları](/info/verify-ai-evidence.html) puanın neleri değerlendirdiğini açıklar. Puan bir sinyaldir, hüküm değildir. Puan, üretilmiş yazılarda yaygın olan örüntüleri sayar ve sözcükleri kimin yazdığını söyleyemez. Gizli katmanlar her iki kontrolün de dışında tutulur ve kart bunların sayısını söyler.

Zorunlu kurumsal kurallara aykırı bulgular ve güçlü bir yazım sinyali, kartın "düzeltilecekler" toplamına eklenir. Tavsiye niteliğindeki bulgular bilinmesi gerekenler olarak sayılır. Bulgular hiçbir zaman engellemez: Download kullanılabilir kalır ve kapatılması ya da istisna olarak kaydedilmesi gereken bir şey yoktur. Açık belgede çalışan bir ajan, site araçları üzerinden aynı raporu alır ([Açık bir belgedeki ajanlar](/info/open-document-agents.html)).

::: note Baskı kontrolleri için bir özellik bayrağı gerekir
Baskı kontrolleri (taşma payı, çözünürlük, mürekkep kaplama oranı ve kalıp sayıları), **Settings → Feature flags → Print preflight** seçeneğini açtığında aynı karta eklenir. Diğer araçlarda kart yalnızca bu bayrak açıkken görünür. [Dosya dışa aktar](/info/exporting.html) baskı kontrollerini anlatır.
:::

<!--i:eti-monitor-->
## Sunum yapma

Çalışma alanlarından oluşan bir Lolly Design belgesi bir sunumdur. Üst çubuktaki **Present** düğmesine bas; her çalışma alanı, tuvaldeki sırasına göre tam ekran bir slayta dönüşür.

Belgenin **Design outcome** değeri **Slides** olana kadar düğmede **Preview** yazar. Sunum, render edilmiş çalışma alanlarının bir kopyası üzerinde çalışır; bu yüzden çıkınca kaldığın yere dönersin.

Ok, **Present** düğmesinin yanında yer alır ve **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** ve **Export slides as video** seçeneklerini açar.

| Tuş | Ne yapar |
|---|---|
| **Space**, `→`, **Page Down** | Sonraki adım veya slayt (ya da sağ kenardaki şeride tıkla) |
| `←`, **Page Up** | Geri (ya da sol kenardaki şeride tıkla) |
| **Home**, **End** | İlk veya son slayt |
| `O` | Genel görünüm: tuval düzenindeki tüm çalışma alanları; açmak için birine tıkla |
| `S` | Konuşmacı görünümü: ikinci bir pencerede geçerli slayt, sonraki slayt, notlar ve saat |
| `B` | Siyah ekran; herhangi bir tuş slaytı geri getirir |
| `F` | Tam ekrana dön |
| `K` | Bir kiosk sunumunu duraklat veya yeniden başlat |
| **Escape** | Bir düzey geri git: genel görünümden sunuma, sunumdan düzenleyiciye |

İşaretçiyi hareket ettirdiğinde küçük bir denetim çubuğu görünür, durduğunda gizlenir. Tarayıcı konuşmacı açılır penceresini engellerse konuşmacı görünümü sunumun üzerinde bir panel olarak açılır. Notlar her çalışma alanına aittir ve slaytta asla görünmez.

Dokunmatik ekranda sonraki adım veya slayt için sola, geri gitmek için sağa kaydır. **Slide** veya **Fade** geçişi parmağını izler ve bıraktığında tamamlanır. **Cut**, **Morph** veya **Fly between artboards** geçişi bıraktığında baştan sona oynar. Kısa ve yavaş bir kaydırma hiçbir şeyi değiştirmez. Web sayfası kutuları, video denetimleri, kaydırılabilen kutular ve seçili metin kendi hareketlerini korur; bu yüzden üzerlerinde bir slayt kaydırması başlamaz. Dikey kaydırma ve sıkıştırarak yakınlaştırma her zamanki gibi çalışır. Azaltılmış hareket açıkken slayt yine değişir ama parmağını izlemez.

- **Gösterme adımları.** Bir kutuya sağ tıkla ve **Always visible** yerine **Reveal at step 1**, **2** veya **3** seç. Adımına ilerlediğinde kutu görünür. Aynı numarayı paylaşan kutular birlikte gelir.
- **Kiosk.** Bir çalışma alanına **Length** değeri ver; sunum, ince bir ilerleme çubuğuyla o süre boyunca orada kalır, sonra ilerler. Bilgilendirme ekranlarında sunumu sonunda başa döndürmek için bağlantıya `kiosk` ekle.
- **Alt slayt yığınları.** Bir çalışma alanına sağ tıkla ve onu önceki slaytın bir adımı yapmak için **Stack under the previous slide** seç. Genel görünüm tek bir kart gösterir ve Inspector'daki **Stack** satırı, çalışma alanının hangi slayta ait olduğunu söyler.
- **Morph.** Ardışık slaytların ikisinde de aynı **Morph match** adına (örneğin `hero`) sahip bir kutu varsa geçiş, kesmek yerine o kutuyu taşır, yeniden boyutlandırır ve rengini değiştirir. Sunum genelindeki bir **Morph** geçişi, eşleşen her çift için aynısını yapar.
- **Seslendirme.** Her çalışma alanının **Speaker notes** metni sesli okunabilir. Inspector'ın **Document** bölümünde bir **Voice**, isteğe bağlı olarak **Blend with** için ikinci bir ses, **Speed** ve milisaniye cinsinden **Lead-in** ile **Tail** seç. **Show captions when presenting**, sözcükleri söylendikleri anda gösterir. Ses cihazında çalışır. Aynı notlar, video dışa aktarmasında ses kaydı, PowerPoint dışa aktarmasında slayt sesi ve bir [SCORM paketinde](/info/create/exporting.html#scorm-course-packages) seslendirilmiş film olur.

Sunum aynı zamanda bir bağlantıdır. `?present` sunumu açar ve `s=` slaytı seçer: bir sıra numarası, çalışma alanı kimliği veya bir gösterme adımı için `id.step`. Adres geçerli slaytı izler; böylece gönderdiğin bağlantı o slaytta açılır. [Ayrılmış URL parametreleri](/info/url-parameters.html#what-happens-on-open) ikisini de belgeler.

**Present with camera**, özel denetimler ve kayıtlı sahnelerle kameranı, bir logoyu ve bir ad etiketini slaytların üzerine yerleştirir; bkz. [Kamerayla sunum yapma](/info/presenting.html). Bir **Web page** kutusu, Inspector'ında **Make interactive** seçeneğini açtığında konuşma sırasında sunum kumandasını devralabilir. **Focus on click** adımında Up ve Down sayfayı denetlerken Next sunumu sürdürür. [Sunum kumandasını devralan canlı sayfalar](/info/interactive-pages.html) odak stillerini, kaydırma duraklarını ve site onayını anlatır.

<!--i:eti-map-pin-->
## Sırada nereye gitmeli

- **[Lolly Design'da metin](/info/text-composition.html)**: tuvalde metin düzenleme, yazıları çerçeveler arasında akıtma ve tipografi.
- **[Animasyon](/info/animating.html)**: anahtar kareler, derinlik, sahne kamerası ve Lift katmanları.
- **[Lolly Chart](/info/chart.html)**: bir kutunun diğer araçlar gibi barındırdığı, vektör, istatistiksel, 3D veya sinematik grafik olarak çizilen bir tablo.
- **[Tasarım içe aktar](/info/design-import.html)**: Figma, Penpot, Illustrator, InDesign, Affinity ve DXF dosyalarını düzenlenebilir kutular, kurgu zaman çizelgelerini ise sekans olarak açma.
- **[Bir tasarımı kurallarla paylaş](/info/create-a-tool.html)**: bir Lolly Design belgesini yalnızca seçtiğin girdileri içeren bir araca dönüştür.
- **[Dosya dışa aktar](/info/exporting.html)**: biçimler, boyutlar, baskı birimleri ve video.
