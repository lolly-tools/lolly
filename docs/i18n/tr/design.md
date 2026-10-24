# Design: serbest tuval

Design, hiçbir şablonun kapsamadığı düzenler için araçtır: sıfırdan bir poster, bir slayt sunumu, ses kaydı olan bir hareket parçası. Bir denetim formu yerine sürüklediğin, yeniden boyutlandırdığın, döndürdüğün ve içine yazdığın kutulardan oluşan bir tuval elde edersin. Diğer her araçla aynı render yolundan dışa aktarır; yani tuvalde gördüğün, aldığın dosyadır.

Bu sayfa tuvali ilk kutudan bitmiş bir sunuma kadar gezdirir: pencere, kutuları şekillendirme, kendi şekillerini çizme, 3D sahneleri ve diğer araçları yerleştirme, zaman ekleme, sonucu denetleme ve bitmiş sunumu sunma. [Using Lolly](/info/using.html), Design'ın her araçla paylaştıklarını, örneğin kaydetme ve paylaşmayı kapsar.

![Design'ın serbest tuvali - çalışma yüzeyi ve onu çevreleyen yapıştırma masası](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Design penceresi

**Üst çubuk**, **Home**, **File menu** ve belgenin adıyla başlar (belgeyi yeniden adlandırmak için ada tıkla). Orta kısım **Undo**, **Redo**, **History**, yakınlaştırma denetimleri (**Fit all** ve **Fit artboard** ile) ve **Timeline**, **Navigator** ile **Inspector** anahtarlarını tutar. Sağda **Share**, **Present** ve **Export** durur. Bir telefonda daha az kullanılan düğmeler **More actions** içine taşınır.

Yanda aşağı doğru uzanan **araç rayı**, Lolly menüsünü ve çizim yaptığın araçları tutar: **Pointer**, **Add a box**, **Pen**, **Edit points**, **Line**, sonra Timeline, Artboards ve Auto-arrange düğmeleri.

![Serbest kanvas araç rayı: bir sürükleme tutamacı, Lolly menüsü, ardından İşaretçi, Bir kutu ekle, Kalem, Noktaları düzenle, Çizgi, Zaman çizelgesi, Çalışma alanları ve Otomatik düzenle](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Tuval, çalışma alanının etrafında bir tasarımcının masası gibi çalışır:

- **Kutuları çalışma alanının dışına park et.** Bir kutuyu çerçeve kenarının ötesine sürükle; görünür ve seçilebilir kalır. Çerçevenin dışındaki her şey soluklaşır ve çerçeve, dosyanın nerede başladığını işaretlemek için gölgesini korur.
- **Yalnızca çalışma alanı dışa aktarılır.** Çerçevenin dışındaki her şey veya bir kutunun kenara taşan kısmı, raster ve vektör biçimlerinde çıktıdan kesilir.
- **Fit'in ötesinde uzaklaştır**, yüzde 20'ye kadar, park ettiğin her şeyi görmek için.
- **Çalışma alanını yeniden boyutlandır** dışa aktarma boyutunu değiştirerek. Kutular konumlarını korur; böylece mevcut içerik etrafında bir düzeni yeniden çerçeveleyebilirsin.

![Düzenleme sahnesi: çalışma alanı ön ve ortada, solda araç rayı ve köşede yakınlaştırma HUD'u](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Navigator ve Inspector

**Navigator**, her çalışma alanını (**Artboards** başlığı altında ya da bir sunumda **Slides**) **Layers** katmanlarının katlanan bir grubu olarak listeler. Oraya atlamak için bir çalışma alanının adını seç, katmanlarını seçmek veya yeniden sıralamak için genişlet ve listede gezinmek için ok tuşlarını kullan; Sol, çalışma alanı başlığına döner. **Pages**, çalışma alanlarını adlandırılmış sayfalar halinde gruplar ve bir sayfa seçmek yalnızca düzenleyicinin hangi çalışma alanlarını göstereceğini değiştirir.

**Inspector**, seçili nesnenin metin veya görsel denetimlerini ilk sıraya koyar. Seçenek çipleri hızlı seçimleri kapsar ve **Advanced** stil ayrıntısını tutar. Bir telefonda Inspector, **More actions** içinden bir sayfa olarak açılır; Escape veya Back sayfayı kapatır ve seçimini korur.

![Inspector'ın Document bölümü: Selection ve Canvas sekmeleri, ardından Dimensions ve Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Yeniden boyutlandır, ölçekle ve döndür

Bir nesne seç, sonra boyutunu değiştirmek için bir tutamağı sürükle ya da nesneyi çevirmek için seçimin altındaki yuvarlak tutamağı sürükle. Bir boyut sürüklemesi iki moddan birinde çalışır:

- **Resize**, varsayılan olarak yalnızca kutuyu değiştirir. Metin yeni boyuta göre yeniden sarılır; yazı tipi boyutu, çizgi kalınlığı, köşe yarıçapı ve efektler olduğu gibi kalır.
- **Scale**, tüm nesneyi içeriğiyle büyütür veya küçültür: yazı tipi boyutu, çizgi, köşe yarıçapı, gölge, bulanıklık, dolgu ve aralık aynı oranda değişir.

Scale'i açıp kapatmak için `K` tuşuna bas. Klavye yoksa Lolly menüsünde **Scale mode** seç ya da raydaki **Pointer** düğmesine basılı tut (veya düğmeye sağ tıkla) ve **Scale** seç; dokunmatik ekranda nesne çubuğunda da bir Scale anahtarı vardır. Scale açıkken Pointer düğmesi Scale simgesini gösterir ve her tutamağın ortasında bir nokta bulunur. `V` veya **Escape** Resize'a döner ve seçimini korur. Her belge Scale kapalı açılır; böylece kimse çizgileri yanlışlıkla ölçeklemez.

**Bir sayıyla ölçekle.** Scale açıkken ya da birkaç nesne seçiliyken, **Scale** açılır penceresini açmak için nesne çubuğundaki göstergeye tıkla. Bir yüzde, bir genişlik veya yükseklik yaz, 3 x 3 ızgarada sabit kalacak noktayı seç ve **Apply** seç. Her ölçekleme tek bir geri alma adımıdır.

**Birkaç nesne.** Birkaç nesnenin seçimi, köşelerinin yanı sıra kenarlarında da tutamaklara sahiptir. Her nesne dik durduğu ya da tam çeyrek dönüşlerle çevrildiği ve seçim grup veya daire içermediği sürece, bir köşe sürüklemesi genişliği ve yüksekliği serbestçe değiştirir. Aksi hâlde seçim oranlarını korur ve gösterge **Proportional** ekler. Sürüklerken küçük bir etiket boyutu, Scale modunda ise yüzdeyi gösterir.

**Bir seçimi çevir.** Sağ tıkla ve **Flip horizontal** veya **Flip vertical** seç ya da `Shift+H` veya `Shift+V` bas (Shift, çünkü çıplak bir `V` Pointer'dır). Ayna gerçek bir dönüşümdür; bu yüzden dışa aktarılan SVG, PDF ve PNG çevirmeyi korur.

**Sürükleme sırasında basılı tuttuğun tuşlar** bastığın veya bıraktığın anda etki eder; kısayol sayfası (`?`) de bunları listeler.

| Basılı tut | Yeniden boyutlandırma veya ölçekleme | Döndürme | Taşıma |
|---|---|---|---|
| **Shift** | Oranları korur (Scale her zaman korur) | 15 derecelik adımlarla döner | Değişiklik yok |
| **Alt** (Option) | Merkezden çalışır | Serbestçe döner | Yakalamayı ve ızgarayı kapatır |
| **Cmd/Ctrl** | Yakalamayı ve ızgarayı kapatır | Serbestçe döner | Yakalamayı ve ızgarayı kapatır |

Hiçbir tuş basılı değilken bir dönüş, 15 derecelik bir değere 4 derece yaklaştığında en yakın 15 dereceye çekilir. Çalışma alanları dönmez, bu yüzden döndürme tutamakları yoktur.

::: details Tutamaklar, tutma bölgeleri ve dokunma
**Kenar boyunca her yerden tut.** Bir seçimin her kenarı, tüm uzunluğu boyunca bir yeniden boyutlandırma şeridir ve fare veya kalemle her köşenin hemen dışında bir döndürme bölgesi vardır. İşaretçi, bir sürüklemenin ne yapacağını gösterir. Bir şeritte veya bölgede basmak, yalnızca sürüklemeye başladığında bir yeniden boyutlandırma veya dönüşe dönüşür; böylece düz bir tıklama eskisi gibi seçer. Kilitli bir nesnenin tutamağı, şeridi veya bölgesi yoktur.

**Küçük nesneler taşınabilir kalır.** Ekranda 25 piksel veya daha dar bir nesnede orta tutamaklar gizlenir ve diğerleri çerçeveden biraz dışarı kayar; böylece nesneye basmak nesneyi taşır. 10 piksel veya daha dar olduğunda köşe tutamakları da gider ve ince bir çizgi her ucunda bir tutamak tutar. İnce bir çizginin veya minik bir nesnenin hemen yanına, tutamaklarından uzağa basmak nesneyi taşır.

**Büyük tutma alanları.** Dokunmatik ekranda her köşe bölgesi, ekranda seçimin genişliğinin ve yüksekliğinin dörtte biridir; 24 ile 44 piksel arasındadır ve her kenar bölgesi iki köşe arasındaki aralığı kapsar. Seçim bunun için çok küçük olduğunda bölgeler çerçevenin dışına taşınır. İşaretçinin veya parmağının altındaki bölge gölgelenir. Aynı bölgeleri fare veya kalemle almak için Lolly menüsünde **Large grab areas** seçeneğini aç; ayar bu cihazda kalır.

**Bir seçimde iki parmak.** Dokunmatik ekranda seçili bir nesneye iki parmak koy: ölçeklemek için sıkıştır, döndürmek için bük ya da seçimi taşımak için iki parmağı birlikte hareket ettir; hepsi tek bir geri alma adımıdır. Scale açıkken sıkıştırma içeriği de ölçekler; Scale kapalıyken orantılı olarak yeniden boyutlandırır. Bir büküm yakınken en yakın 15 dereceye oturur ve iki parmakla taşıma hiçbir zaman yakalamaz. İlk parmağın seçimin üzerine inmesi, ikincinin de hızla, seçimin üzerine ya da kenarının hemen dışına takip etmesi gerekir. Başka her yerdeki iki parmak görünümü yakınlaştırır ve kaydırır; bir çalışma alanı veya kilitli nesne içeren, görünümün çoğunu kaplayan ya da kenarını aşan bir seçimdeki iki parmak da öyle.
:::

## Kendi şekillerini çiz

Kutular, daireler ve yuvarlatılmış çerçeveler düzenlerin çoğunu kapsar. Başka her şekil için bir tane çiz: raydaki **Pen** düğmesi (veya `P`) seni çizim moduna alır. Üç tek tuş modlar arasında gezdirir: Pointer için `V`, Pen için `P` ve **Edit points** için `N`. Çıkış yolu her zaman Pointer'dır.

- Bir nokta yerleştirmek için **tıkla**. Varsayılan eğri türünde **tıkla ve sürükle**, bir eğri yapmak için noktanın tutamaklarını çeker; sert bir köşe için tıklarken **Alt** tuşunu basılı tut. (Diğer eğri türlerinde her nokta bir köşedir ve sürükleme bir şey yapmaz.)
- Noktalar yerleştirirken çalışma alanına ve diğer kutularına yakalanır. Alt, çizerken ızgarayı; sonradan bir noktayı sürüklerken hem ızgarayı hem de kenarları bastırır.
- Şekli kapatmak için **ilk noktana tıkla**. Aksi hâlde **Enter**'a bas, çift tıkla veya araç değiştir; çizim korunur.
- **Escape** adım adım çalışır: ilk basış çizimi bırakır, ikincisi kalemden çıkar.
- Çizerken **Delete** son noktayı düşürür.

Sonuç sıradan bir kutudur. Yolu diğer her kutu gibi taşı, yeniden boyutlandır, döndür, grupla, hizala, yeniden sırala, doldur, gölgele veya soldur. İlk yol, markanın bir yola verdiği dolguyu ve çizgiyi alır ve sonraki her yeni yol en son kullandığını alır. Markasının yollar için hiçbir şey ayarlamadığı bir araçta yeni bir yol çizdiğin renkle çizilir; böylece şekil asla görünmez olmaz.

**Noktaları yeniden düzenle.** Şekle çift tıkla ya da nesne çubuğunda **Edit points** kullan. Taşımak için bir noktayı sürükle, eğriyi yeniden yönlendirmek için bir tutamağı sürükle, bir nokta eklemek için eğriye tıkla ya da birkaç noktanın etrafına bir kutu sürükle ve Delete'e bas. Bir yol her zaman en az iki nokta tutar.

**Spline type**, noktalarından hangi tür eğrinin geçeceğine karar verir:

| Tür | Ne yapar |
|---|---|
| **Smooth (auto)** | Varsayılan. Kendi tutamak uzunluklarını hesaplar, bu yüzden düz tıklamalar düzgün bir eğri verir. Ayarladığın bir tutamak yönü sabitler ve eğri uzunluğa yine sahip çıkar. |
| **Bezier handles** | Klasik kalem: her tutamağı sen denetlersin ve bir nokta eklemek eğriyi asla oynatmaz. |
| **Through the points** | Tutamaksız, her noktadan tam olarak geçer. |
| **B-spline** | Daha yumuşak bir çizgi için noktaların içinden değil yakınından akar. |
| **Straight lines** | Bir çoklu çizgi. |

Var olan bir yolu kendi tutamaklarını hesaplayan bir türe geçirmek önce sorar, çünkü ayarladığın tutamak uzunlukları geri getirilemez; **Bezier handles** türüne geçmek her zaman kayıpsızdır. Çizim sırasında geçiş hemen uygulanır ve çektiğin tutamaklar düşer.

Her nokta ayrıca şekliyle gösterilen bir süreklilik kuralı taşır: **Corner** için kare (tutamaklar bağımsız hareket eder), **Smooth** için yuvarlak (tutamaklar hizada kalır) ve **Symmetric** için halkalı yuvarlak (hizada ve eşit uzunlukta). Seçili noktalar için kuralı ayarla; eğri hemen takip eder.

![Bir bağlantıdan doğrudan oluşturulmuş iki kalem yolu: konturlu bir S eğrisi ve kapalı, dolgulu bir leke](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Çizilmiş bir yol, diğer her kutu gibi bir paylaşım bağlantısında taşınır ve komut satırından aynı şekilde render edilir.

## Şekilleri birleştir

İki veya daha fazla şekil seç, tuvale sağ tıkla (dokunmatikte iki parmakla dokun) ve seç:

- **Union**, onları en üstteki şeklin boyasıyla tek bir şekilde birleştirir.
- **Subtract**, üstteki her şeyi alttaki şekilden keser.
- **Intersect**, yalnızca örtüşmeyi tutar.
- **Exclude**, örtüşme dışındaki her şeyi tutar.

Üç tanesi daha tek bir şekil üzerinde çalışır. **Outline stroke…** bir çizgiyi aynı kalınlıkta dolu bir çerçeveye çevirir. **Offset path…** çerçeveyi dışa doğru büyütür ya da negatif bir sayıyla içe doğru küçültür. **Simplify** bir yolu aynı çerçevede daha az parçayla yeniden kurar.

![İkisi de Subtract ile üretilmiş, bir hilal ve gerçek bir deliği olan bir halka](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Sonuç, kalemle düzenlemeye devam edebileceğin, düz Bezier eğrileri olarak saklanan yeni bir yoldur; bu yüzden özgün spline türü taşınmaz. Delikler gerçek deliklerdir: çizgi panelindeki **Fill rule** denetimi, örtüşen konturların doldurulup doldurulmayacağına (*non-zero*) ya da delinip delinmeyeceğine (*even-odd*) karar verir. İşlemler yok etmek yerine reddeder: örtüşmeyen iki şekli kesiştirmeyi istersen hiçbir şey değişmez. Metin ve görsel kutularının çerçevesi yoktur, bu yüzden dokunulmaz.

## Bir tasarımın içindeki 3D sahneler ve araçlar

Bir kutu bir resimden fazlasını tutabilir. Aşağıdaki iki tür de render edilmiş bir görsel yerine bir tarif tutar; bu yüzden belgenin istediği her boyutta ve anda yeniden çizilirler ve kaynağa yapılan bir güncelleme, kaynağı kullanan her tasarıma ulaşır.

### 3D sahneler

Raydaki ekleme menüsünden **3D scene** seç ve bir çerçeve sürükle: 3D Studio yeni kutuda açılır ve orada ayarladığın şey tuvale geri gelir. Sonrasında Inspector'ın **3D scene** bölümündeki **Edit in 3D Studio** stüdyoyu yeniden açar. [Place a scene in Design](/info/3d-studio.html#place-a-scene-in-design) posterleri, zaman çizelgesini, dışa aktarmayı ve paylaşımı kapsar.

### Bir tasarımın içindeki araçlar

Raydaki ekleme menüsünden **Image** seç, bir çerçeve sürükle ve seçicinin **Tools** sekmesinde bir araç seç. Araç çerçeveyi varsayılanlarıyla doldurur ve Inspector, o aracın kendi denetimlerini tutan bir **Tool** bölümünde açılır. Bir alanı değiştirirsin ve kutu bir an sonra tek bir geri alma adımı olarak güncellenir. **Image fit** ve **Image position** her resim için olduğu gibi çalışır ve **Replace with another tool or image** kutunun içeriğini değiştirir.

**Hareket eden araçlar** kutunun içinde oynar: döngüdeki bir çizim tuvalde döngüsünü sürdürür, zaman çizelgesi açıldığında oynatma kafasını izler ve kare kare GIF, MP4 veya WebM olarak dışa aktarılır. Araç bir döngünün ne kadar sürdüğünü söylediğinde kutu tam o uzunlukta bir klip alır; böylece bir video tam döngüler tutar. Yeniden zamanladığın bir klip zamanlamanı korur ve aracın hareketini kapatmak kutuyu yeniden durağan bir resim yapar.

## Zaman çizelgesi (Sequence)

**Sequence**, Design'ın zaman çizelgesidir: tuvale zaman ekler. Her kutu bir anda başlayabilir, bir süre çalışabilir ve girip çıkarken canlandırılabilir; çalışma alanının altına yerleştirilen zaman çizelgesi bunları düzenlediğin yerdir. Design'ın **Video** şablonundan başla ve kısa bir dizi zaten yerindedir: dizi satırında zamanlanmış iki metin kartı ve altlarında prosedürel bir müzik zemini; böylece bir şeyi değiştirmeden önce zaman çizelgesinin nasıl çalıştığını görebilirsin.

![Sequence'in zaman çizelgesi: taşıma kontrolleri, cetvel, bir bindirme şeridi, klipleriyle ve ek noktası düğmeleriyle mıknatıslı sıralama sırası ve Always on şeridi](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

İki tür satır vardır:

- **Sequence satırı** mıknatıslıdır. Klipler uç uca durur, birini sürüklemek dizisini yeniden sıralar ve birini silmek boşluğu kapatır. Bu omurgadır.
- **Overlay lanes** serbesttir. Bir alt üçte bir bandı, bir logo veya bir alt yazı kendi zamanında, her biri kendi şeridinde omurganın üzerinde yüzer.
- Altlarında **Always on**, zamanlaması olmayan, baştan sona mevcut kutuları tutar. Bir çipteki `+` birini bir şeride taşır; **Make always on** onu geri gönderir.

Zaman çizelgesini açmak ona klavyeyi verir, böylece Space ve ok tuşları oynatma kafasını sürer. Zamanlaması olan bir kompozisyon zaman çizelgesini kendiliğinden açar.

**Düzenleme.** Taşımak için bir klibin ortasını sürükle, kırpmak için her iki ucuna yakın sürükle ve ikiye kesmek için **Split at playhead** (veya `S`) düğmesine bas. Bölme, gerçek bir **Length** değerine sahip bir klip ve içinde biraz ilerideki bir oynatma kafası gerektirir; bu yüzden müzik zemini gibi uçları açık bir klip bölünemez. **Snap to edges** varsayılan olarak açıktır; klip kenarlarına, oynatma kafasına ve tam saniyelere yakalanır; yakalamadan sürüklemek için Alt tuşunu basılı tut. Her sürükleme tek bir geri alma adımıdır ve sürüklerken önizleme sonuçla aynı aritmetiği kullanır.

Bir klip seç; denetleyici aynı düzenlemeleri sayı olarak verir: **Length**, **Trim in** (klibin kaynağa ne kadar içeriden başladığı), ×0,25 ile ×4 arası **Speed**, uzunluklarıyla **Animate in** ve **Animate out** ve **Mute clip**. Mıknatıslı satırdaki bir klibin **Start** alanı yoktur, çünkü sırayı satır belirler.

**Transitions** ön ayarlardır: Fade, Pop, Grow, Rise, Drop, dört Slide, Zoom in ve out, Tilt, Swoop, Spin, Drift veya **Cut (no animation)**. Mesafeler nesneyle ölçeklenir; bu yüzden tek bir ön ayar hem tam kare bir kartta hem küçük bir rozette doğru okunur. Dizi satırındaki iki klip arasında bir **seam chip** **Cut** veya **Crossfade** seçer; **Length (ms)** değerini ayarlamak için yeniden aç ve **Done** düğmesine bas. Bir crossfade'de ilk klip kesimin ötesinde oynamaya devam eder ve sonraki belirirken solar; önizlemede de dosyada da aynıdır.

**Ses.** Bir **Audio** klibi, dalga biçimi, kırpma ve sessize alma ile diğer her klip gibi zaman çizelgesinde yaşar. Video şablonunun üretilmiş müzik zemini dışa aktarma sırasında sentezlenir; bu yüzden çubuğu sen render alana kadar sade ve sessiz kalır. Geri sayım ve seviye göstergesiyle **bir seslendirme kaydetmek** için mikrofona bas; kayıt, oynatma kafasında kendi varlığın olarak kaydedilir. Mikrofonun yanındaki kamera düğmesi aynı şekilde **bir video kaydeder**, kayıt sırasında çalışma alanına kırpılarak; böylece bir meslektaşın paylaşılan bir bağlantıdan klip ekleyebilir. Sesli herhangi bir klibi seç ve şeridi hacim, panorama, EQ, perde, normalleştirme ve **Voice cleanup** gibi efektler için zaman çizelgesinin altında açılır; şeridi sequence editor kılavuzundaki [Sound](/info/sequence-editor.html#sound) kapsar. Dışa aktarma panelinin **Audio track** bölümü ayrıdır: tüm klibin altında solma ve kısma ile tek bir zemin.

![Müzik klibi seçiliyken zaman çizelgesi: şeridi altta Hız, Solmalar, Ses düzeyi, Kaydır, EQ, Perde, Ses düzeyini normalize et ve Efekt yuvasıyla uzanır](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Render.** Bir hareket dışa aktarması her kareyi tam bir zamanda çizer, çözer ve kodlar; böylece dosya makinenin yetişmesine bağlı değildir ve MP4 ile WebM'in pratik bir kare sınırı yoktur. Sen bir tane yazmadıkça zaman çizelgesinin uzunluğu süreyi belirler ve Content Credentials her dışa aktarmada olduğu gibi damgalanır. Bir durağan dışa aktarma oynatma kafasındaki kareyi ya da **Frames** alanından bir kontak sayfası verir; bkz. [Stills from a timed composition](/info/exporting.html#stills-from-a-timed-composition). Bir dizi bir saatle sınırlıdır. GIF ve animasyonlu PNG her kareyi bellekte tutar, bu yüzden kısa kliplere uygundur. **Record live** burada gizlidir, çünkü kare kare render daha iyi yoldur.

**Anahtar kareler, derinlik ve bir kamera.** Bir geçiş bir klibi gelirken ve giderken canlandırır. Bir kutuyu bir klip içinde konumlandırmak için (kaydır, soldur, bulanıklaştır, sayfadan kaldır ve geri oturt), klibi seç ve **+Keyframe** düğmesine bas: zaman çizelgesinin araçlarındaki elmas, tuval nesne çubuğundaki elmas veya zaman çizelgesi odaktayken **Shift+K**. Oynatma kafasının konumu, bir sonraki düzenlemenin hangi pozu yazacağına karar verir. Aynı anahtar kareler, zamanlanmış bir kompozisyona içeri iten, kaydıran ve odak çeken bir kamera verir. [Animating](/info/animating.html) tam kılavuzdur ve [The sequence editor](/info/sequence-editor.html) seçimi, soğan kabuğunu, bölmeyi, kırpmayı ve işaretçileri kapsar.

## Dışa aktarmadan önce

Design, dosyayı göndermeden önce belgeni denetler. Inspector'ın **Document** bölümündeki ve yine dışa aktarma panelindeki **Before you export** kartı kayıtlı katman yapısını okur, sonra yerleşmiş tuvale kesilmiş metin ve düz renk kontrastı için bakar. Her metin parçasının gömülebilecek yazı tipi baytlarına sahip olup olmadığını, SVG ve PDF dış çizgilemesinin kullandığı aynı yazı tipi kayıt defterine sorar. Görsel ve gradyan arka planlar uydurulmuş bir kontrast puanı verilmek yerine görsel denetimler olarak listelenir.

### Bir kompozisyonu tasarım sistemine göre denetle

Dışa aktarma panelindeki kart ayrıca kompozisyonu, render'ın kullandığı aynı tasarım sistemi sürümünde tasarım sistemin ile karşılaştırır. Yazılmış renklere, token takma adlarına, yazı tipi seçimlerine ve görsel varlık kimliklerine bakar. Özel bir değer kasıtlı olabilir ve bildirilen marka varlıklarının dışındaki bir görsel yasaklı bir görsel değil, bir inceleme öğesidir.

Somut bir renk veya yazı tipi önerisi bulunduğunda, düğmesi yalnızca o katmanı değiştirir ve **Undo** özgününü geri yükler. Kilitli ya da sonradan değiştirilmiş katmanların üzerine eski bir öneri asla yazılmaz. Gradyanlar, efektler, iç içe araç içeriği, haklar ve öznel kalite bu karşılaştırmanın dışındadır ve hiçbir denetim Download'u engellemez.

### Kurumsal stil kuralları ve yazım sinyali

Dışa aktarma panelindeki kart ayrıca tasarım sistemin ile gelen kurumsal stil kurallarını, yani metin ağırlığı ve hizalama, onaylı renk eşleşmeleri veya yüzey başına bir logo gibi kuralları katman katman denetler. Her bulgu, kuralın üstünde katmanın adıyla bir uyarıdır. Bu sürümün denetleyicisi olmayan bir kural, asla izlenmiş olarak değil denetlenmemiş olarak listelenir. [Usage & rules](/info/brand-studio.html#usage-rules) kuralları listeler ve `lolly check` aynı kuralları kayıtlı bir belgeye uygular.

Aynı kart, belgenin çizdiği metin için yazım sinyalini gösterir: bandı (none, weak, notable veya strong), sonra 100 üzerinden puanla Verify'ın kendi cümlesi ve her biri onları tutan katmanla birlikte en fazla üç işaretli ifade. **Open the text in Verify** o metni tam okuma için [Verify](/#/verify) sayfasına götürür; [AI evidence in Verify](/info/verify-ai-evidence.html) puanın neyi tarttığını açıklar. Puan bir sinyaldir, hüküm değil: üretilmiş yazıda yaygın örüntüleri sayar ve sözcükleri kimin yazdığını söyleyemez. Gizli katmanlar iki denetimin de dışında bırakılır ve kart kaç tane olduğunu söyler.

Kurumsal stil kuralı bulguları ve güçlü bir yazım sinyali, kartın "to fix" toplamına sayılır; böylece bulunmaları kolaydır. Bilgilendirirler ve asla engellemezler: Download kullanılabilir kalır ve reddedilecek ya da istisna olarak kaydedilecek bir şey yoktur. Açık belgede çalışan bir ajan aynı raporu site araçları üzerinden alır ([Agents in an open document](/info/open-document-agents.html)).

Baskı denetimleri (taşma payı, çözünürlük, mürekkep kapsama ve plaka sayıları), **Settings → Feature flags → Print preflight** seçeneğini açtığında aynı karta katılır. Diğer araçlarda kartı gösteren tek şey o bayraktır; [Export a file](/info/exporting.html) baskı denetimlerini anlatır.

## Sunum yapma

Çalışma alanlarından oluşan bir Design belgesi zaten bir sunumdur. Üst çubukta **Present** düğmesine bas; her çalışma alanı, çalışma alanlarının tuvaldeki sırasıyla tam ekran bir slayt olur. Belgenin **Design outcome** değeri **Slides** olana kadar düğme **Preview** yazar. Sunum, render edilmiş çalışma alanlarının bir kopyası üzerinde çalışır; bu yüzden ayrılmak seni tam olarak bulunduğun yere geri koyar.

**Present** yanındaki ok **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** ve **Export slides as video** seçeneklerini açar.

| Tuş | Ne yapar |
|---|---|
| **Space**, `→`, **Page Down** | Sonraki adım veya slayt (ya da sağ kenardaki şeride tıkla) |
| `←`, **Page Up** | Geri (ya da sol kenardaki şeride tıkla) |
| **Home**, **End** | İlk veya son slayt |
| `O` | Genel bakış: tuval düzenindeki her çalışma alanı; açmak için birine tıkla |
| `S` | Konuşmacı görünümü: geçerli slayt, sonraki slayt, notlar ve ikinci bir pencerede saat |
| `B` | Siyah ekran; herhangi bir tuş slaytı geri getirir |
| `F` | Tam ekrana dön |
| `K` | Bir kiosk sunumunu duraklat veya yeniden başlat |
| **Escape** | Bir katman soy: genel bakıştan sunuma, sunumdan düzenleyiciye |

İşaretçiyi hareket ettirdiğinde küçük bir denetim çubuğu belirir ve durdurduğunda yeniden gizlenir. Tarayıcı konuşmacı açılır penceresini engellerse konuşmacı görünümü sunumun üzerinde bir panel olarak açılır. Notlar her çalışma alanına aittir ve slaytta asla görünmez.

- **Reveal steps.** Bir kutuya sağ tıkla ve **Always visible** yerine **Reveal at step 1**, **2** veya **3** seç; kutu sen kendi adımına ilerleyene kadar bekler. Aynı numarayı paylaşan kutular birlikte gelir.
- **Kiosk.** Bir çalışma alanına **Length** ver; sunum orada o süre kadar bekler, sonra ince bir ilerleme çubuğunun ardında ilerler. Bağlantıya `kiosk` ekle; sunum, tabela için sonunda başa sarar.
- **Sub-slide stacks.** Bir çalışma alanına sağ tıkla ve onu o slaytın bir adımı yapmak için **Stack under the previous slide** seç. Genel bakış tek bir kart gösterir ve denetleyicinin **Stack** satırı çalışma alanının hangi slayta ait olduğunu söyler.
- **Morph.** Ardışık slaytların ikisi de aynı **Morph match** adına (örneğin `hero`) sahip bir kutu tuttuğunda, geçiş kesmek yerine o kutuyu taşır, yeniden boyutlandırır ve yeniden renklendirir. Sunum çapındaki bir **Morph** geçişi eşleşen her çift için aynısını yapar.
- **Narration.** Her çalışma alanının **Speaker notes** değerleri sesli okunabilir. Inspector'ın **Document** bölümünde bir **Voice**, isteğe bağlı olarak **Blend with** için ikinci bir ses, **Speed** ve milisaniye cinsinden bir **Lead-in** ile **Tail** seç; **Show captions when presenting** sözcükleri söylendikçe gösterir. Ses cihazında çalışır ve aynı notlar bir video dışa aktarmasının ses kaydı, bir PowerPoint dışa aktarmasında slayt sesi ve bir [SCORM package](/info/create/exporting.html#scorm-course-packages) içindeki anlatımlı film olur.

Sunum da bir bağlantıdır. `?present` doğrudan içine açar ve `s=` slaytı seçer (bir konum, bir çalışma alanı kimliği veya bir yapı adımı için `id.step`) ve adres seni izler; böylece gönderdiğin şey bulunduğun slayttır. [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open) bunları belgelendirir.

**Present with camera** kameranı, bir logoyu ve bir ad alt yazısını özel denetimler ve kayıtlı sahnelerle slaytların üzerine yerleştirir; bkz. [Presenting with camera](/info/presenting.html). Bir **Web page** kutusu, denetleyicisinde **Make interactive** seçeneğini açtığında bir konuşma sırasında sunum kumandasını alabilir: **Focus on click** adımında Up ve Down sayfayı denetler, Next ise sunuma devam eder. [Live pages that take the clicker](/info/interactive-pages.html) odak stillerini, kaydırma duraklarını ve site onayını kapsar.

## Bundan sonra nereye

- **[Text in Design](/info/text-composition.html)**: tuvalde metin düzenleme, makaleleri çerçevelerden akıtma ve tipografi.
- **[Animating](/info/animating.html)**: anahtar kareler, derinlik, sahne kamerası ve Lift katmanları.
- **[Import a design](/info/design-import.html)**: bir Figma, Penpot, Illustrator veya InDesign dosyasını düzenlenebilir kutular olarak aç.
- **[Share a design with rules](/info/create-a-tool.html)**: bir Design belgesini yalnızca seçtiğin girdilerle bir araca dönüştür.
- **[Export a file](/info/exporting.html)**: biçimler, boyutlar, baskı birimleri ve video.
