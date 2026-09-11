# Lolly nasıl karşılaştırılır

Lolly'nin bugünün yaratıcı araçlarının yapmadığını yaptığı şeyler ve kasıtlı olarak onlara bıraktıkları.

Araç araç karşılaştırma için - Canva, Adobe, Figma, render API'leri ve çevrimiçi dönüştürücüler için birer sayfa - [Lolly compared, tool by tool](/info/compare.html) sayfasına bak. Her sayfa diğer aracın neyi daha iyi yaptığını ve Lolly'nin bunun yerine neyi yaptığını belirtir.

> **Pilot durumu:** Lolly kapalı bir pilot prototiptir, bitmiş bir ürün değildir ve güvenliği şu anda kurumsal ölçeğe hazırlanarak SUSE'nin sıkı altyapı sertleştirmesinden geçmektedir. [Adoption & Governance](/info/adoption-governance.html#status) sayfası mevcut durumu ele alıyor.

## Bugünün araçları

Aşağıdaki her halka, bir ürün sınıfının bir yeteneği **pazarlandığı gibi değil, bugün dağıtıldığı haliyle** ne kadar eksiksiz sunduğunu puanlar - her sınıf en iyi temsilcisi üzerinden puanlanır. Lolly de aynı bıçakla puanlanır: tablodaki tek kırmızı halkayı, olgunluk için alır. Puanların gerekçesi için bir satır adını aç. Sütunlar en üstteki Overall completeness satırına göre sıralanır - harcama satırı hariç tutularak puanlanan satırların ortalaması.

::: figure positioning-comparison
Ağustos 2026'da araştırılan, günümüzün yaratıcı araçları arasındaki yetenek eksiksizliği. Puanlama: 0 yok, 25 iş bitirici düzey, 50 gerçek ama kısıtlı veya kısmi, 75 çekincelerle güçlü, 100 temel yetkinlik.
:::

**Puanlama notları.** Lolly'nin puanları, yayımlanan iddialarının geçerli olduğunu varsayar; olgunluğun tek kırmızı halkası olmasının nedeni budur: kapalı pilot, devam eden güvenlik sertleştirmesi, henüz denetlenmemiş. Araştırma birkaç hücreyi değiştirdi.

Canva, Affinity ve Cavalry'ye sahip olduğundan (ikisi de Ekim 2025'te ücretsize açıldı) her satırda en iyi aile üyesi üzerinden puanlanır. Çevrimdışı ve cihaz üzerinde render, Affinity üzerinden 75 puan alır - hâlâ doğrulanmış bir hesap gerektiren ve telemetri taşıyan bir masaüstü paketi, Adobe'nin de aldığı aynı indirim - Canva'nın kendi çevrimdışı modu ise yalnızca önceden senkronize edilmiş tasarımları, tek bir cihazda, sınırlı bir pencerede düzenler. Otomatik doldurma 50 puan alır: gerçek ama Enterprise'a kilitli, eşzamansız, yalnızca metin ve görsel. Figma'nın kitlesel üretimi, Buzz elektronik tablo doldurmayı gönderdiğinde (ücretsiz beta, Ağustos 2026) 25'ten 50'ye yükseldi.

Tabloyu tek bir kural yönetir: içeriğine veya kimliğine dokunan satırlarda Full (100), hesap gerektirmeyen ve bulut ön koşulu olmayan bir yetenek ister; ürünün kendisini tanımlayan satırlar (olgunluk, kullanım kolaylığı) bundan muaftır. Bu kural Adobe'ye köken (provenance) konusunda pahalıya patlar: dağıtılan en geniş C2PA (Photoshop, Lightroom, Premiere, Firefly) yerel olarak ve bulutta imzalar, ama bir Adobe hesabı ve kimliği olmadan asla, dolayısıyla 75. Aynı nedenle render API'lerini kitlesel üretim ve otomasyonda sınırlar.

Lolly'nin köken puanı 75, cihaz üzerinde çevrimdışı imzalamayı yansıtır: mimari olarak daha güçlü ama denetlenmemiş, ve bir kimlik ya da bir kuruluşun kendi CA'sı onu doğrulamadıkça bir cihaz anahtarı standart doğrulayıcılarda doğrulanmamış olarak okunur. Penpot'un 50 puanı resmi Lolly Export eklentisi aracılığıyla gelir: aynı motor imzalaması, isteğe bağlı, Lolly'nin kendisi olarak açıklanmış. Penpot ayrıca tablodaki ölçek dışı tek halkayı, cihaz üzerinde render'da 90'ı alır - tarayıcı tuvali, kendi egemen bulutuna (bir dizüstü bilgisayar bile olsa) kaydetme, özel dışa aktarma; onu Lolly'den ayıran tek şey sunucu adımıdır. Cloudinary kendi sütununu alır: bir medya hattı (DAM, dönüştürme API'si, CDN) ve C2PA gönderen tek bulut sütunu (50, çünkü fl_c2pa teslimat sırasında imzalar ve senin tarafından değil, Cloudinary tarafından teslim edildiğini tasdik eder).

Canlı işbirliği tersine işler: Figma ölçek karşılaştırma noktasını belirler (200 editör) ve Lolly'nin ikili, hava boşluklu (air-gapped) P2P özelliği Partial puan alır. Fiyat bir tahmindir ve öyle etiketlenmiştir: gerçekçi koltuk karışımları üzerinde liste fiyatı aritmeti, kasıtlı olarak geniş, tedarik için değil ölçek için. Render API'leri kısıtlarda 75 alır: şablonlar kilitli, marka yönetişim katmanı yok.

Boşluk şu: bugün dağıtılan hiçbir şey kısıt öncelikli, çevrimdışı, hesapsız ve render yolunda sunucusuz değil, ve kimse hesap şartını kopyalamadı. Lolly artık kendi açık tuvalini sunuyor - doğrudan manipülasyonlu serbest bir tuval olan **Design** - ama üzerindeki renkler, tipografi ve varlıklar marka geneline uyar, bu yüzden serbest düzenleme bile kısıt öncelikli kalır.

Lolly'nin hâlâ **olmadığı** şey, kısıtsız bir tasarım paketidir; tasarımcılar özel işler için Illustrator ve Figma kullanmaya devam edecek - ve o iş yönetişimli, yeniden üretilebilir bir varlığa dönüşmesi gerektiğinde, Design aracının [Import a design](/info/design-import.html) özelliği bitmiş Figma, Penpot, Illustrator, InDesign veya PDF dosyasını tuvale düzenlenebilir, markaya uygun kutular olarak getirir.

![Design'ın serbest tuvali, sunulan renklerin, yazı tiplerinin ve varlıkların markanın kendisine ait olduğu yer](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Şunlar için kullan

- Operasyonel hale getirilmiş yaratıcı varlıkların hızlı üretimi (etkinlik kartları, rozetler, imzalar, uyarılar)
- Parçaların - renkler, tipografi, simgeler, görseller - marka geneline uygun kalması gerektiğinde açık tuvalde (Design) serbest biçimli düzenleme
- Bitmiş bir Figma, Penpot, Illustrator, InDesign veya PDF tasarımını (Design aracının Import a design özelliğiyle) getirip her Lolly biçiminde deterministik olarak düzenlenebilir, yönetişimli ve yeniden render edilebilir hale getirmek
- Birden çoğa "üç alanı doldur, bitmiş varlığı al" akışları - `/pro` toplu ızgarasında bir elektronik tablo/CSV'den toplu çalıştırmalar dahil (satırları yapıştır veya içe aktar, satır başına bir bitmiş varlık, zip olarak indir)
- Her zaman açık, tekrarlanan markalı çıktılar
- Marka ifadesinin merkezi denetiminin ifade esnekliğinden daha önemli olduğu şeyler

Deck Studio, buradaki tavanın iyi bir ölçüsüdür: veri olarak tanımlanmış bütün bir slayt destesi, tuval üzerinde canlı olarak yerleştirilir ve yerel, düzenlenebilir bir PowerPoint olarak dışa aktarılır.

![Bölünmüş görünümde Deck Studio - destenin slaytları solda bloklar olarak listelenmiş, yerleştirilmiş deste sağda render ediliyor](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Şunlar için kullanma

- Özel veya amiral gemisi hero içerik (billboardlar, büyük videolar)
- Gerçekten bir tasarımcı gerektiren benzersiz kampanya işleri
- Marka sisteminden tamamen kaçması gereken fikir üretimi - Lolly'nin açık tuvali renkleri, tipografiyi ve varlıkları hâlâ marka geneline uydurur, ve mesele de bu

## Olasılıksal yenilik yap, deterministik olarak ölçeklendir

Çoğu "AI yaratıcılık" sunumu, modeli eski bir çizginin yanlış tarafına koyar. Yazıcılar ve tezhipçiler bu çizginin nereye düştüğünü çoktan belirlemişti: her şeyin denenebildiği ve hiçbir şeyin taahhüt edilmediği eskizde gevşek çalışırsın, sonra tam da taahhüt ettiği için ürkütücü olan matbaaya geçersin. Sanat eskizlerdeydi. Matbaa ise onun yayılma yoluydu. İki araç, iki iş, her biri kendi yolunda yaratıcı, ve basılı iş güvenilirdi çünkü matbaa her baskıda verdiği sözü tuttu.

Lolly, eskiz değil matbaadır. Fikir üretimine istediğini getir - bir model, bir tasarımcı, bir peçete - ama bir fikrin on bin varlığa dönüşmesi gerektiği anda, herkesin geri okuyabileceği girdilerden her seferinde aynı şekilde render eden bir şeyden geçer. Yukarıdaki karşılaştırmanın gerçek konusu da budur: kimin daha iyi bir üreticisi olduğu değil, kimin taahhüt edilen adımı yeniden üretilebilir kıldığı.

> Yaratıcı sürece güven, titizlikle ölçeklendir.

## Dosyayı değil, aracı onayla

Piyasadaki diğer her araç, sonradan kontrol edilmesi gereken bir *dosya* üretir - bir Slack konusunda marka yöneticisi, feragatname için hukuk ekibi, bir değişiklik turu, bir inceleme daha. Lolly onayı **bir adım yukarı** taşır. Marka kuralları - tam hex kodları, lisanslı yazı tipi dosyaları, taşma payları, boşluklar - aracın HTML ve CSS'ine sabit kodlanmıştır, bu yüzden şablon marka dışı bir çıktı *üretemez*. Uygulamayı zorlayan, düzenin kendisidir.

Böylece çıktıları onaylamayı bırakır, onları üreten **aracı** onaylamaya başlarsın. Bir kez onayla, ürettiği her varlık yapısı gereği önceden onaylanmış olur - hiçbir hacimde insan müdahalesi veya inceleme döngüsü gerekmez.

Belirlenimci motorun asıl getirdiği değişiklik budur: eski onay sürecinin daha hızlı bir sürümü değil, sürecin kendisinin ortadan kalkmasıdır. Yaratıcı ekip için bu bir yerine geçme değil, bir koruma bariyeridir - topu (veriyi, metni, görseli) yine sen atarsın, kod ise her atışı oyun dışına düşmekten alıkoyan bumper şeridi olur.

![Prodüktörün tüm işi: kelimeleri yazmak. Yazı tipi, renk ve boşluklar araç onaylandığında belirlenmişti](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Varlıkları eski yöntemle onaylamak | Aracı Lolly usulü onaylamak |
|---|---|
| Her bitmiş dosya tek tek kontrol edilir | Araç bir kez kontrol edilir |
| Talep → tasarımcı oluşturur → marka incelemesi → hukuk kontrolü → değişiklikler → yeniden inceleme | Bir parametre değişikliği → bitmiş varlık |
| Tasarımcı, marka yöneticisi, hukuk ve talep sahibi sürecin içinde | Prodüktör tek başına |
| Varlık başına günler | Varlık başına saniyeler |
| 10.000 varlık = 10.000 inceleme döngüsü | 10.000 varlık = sıfır (şablon zaten onaylanmıştı) |

## Bunun eşsiz olarak sağladığı

- **Sınırsız tasarım potansiyeli, bağlam içinde güvenle sunulur.** Araçlar, sabit kodlanmış koruma bariyerleri içinde cesur tasarım fikirlerini ifade edebilir.

- **Nihai varlığı doğrudan döndüren, yazılım tanımlı içerik otomasyonu.** Girdi → nihai dosya. "Şimdi tasarım aracından kaydet ve sonradan işle" yok.
- **Araçlar araçları bir araya getirir.** Bir araç, başka bir aracın çıktısını gömebilir ve onu tek bir bitmiş varlığın parçası olarak döndürebilir; araçlar arasında hiçbir kod bağımlılığı olmadan - piyasadaki hiçbir açık tuval veya DAM şablonlama ürününün sunmadığı bir ilkel.
- **Tedarikçiden bağımsızlık.** Tam özellik ve maliyet kontrolü. Açık kaynaklı motor. Araçlar ve varlıklar, bir SaaS veritabanına kilitlenmiş değil, git ile izlenen içeriktir.

Bunlardan ilki, insanların değerini hafife aldığı özelliktir. Bir açılır menü ve markanın dışına çıkamayan iki renk alanından, gerçek vektör yol ve su yollarıyla çizilmiş, poster kalitesinde bir şehir haritası:

![Amsterdam'ın kanal halkaları ve yol ağı, markanın kendi mürekkebiyle uçtan uca çizilmiş; her fırça darbesi elle değil şablon tarafından yerleştirilmiş](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## İçerik egemenliği

Önceki bölümün toplamda vardığı şeyin bir adı var: egemenlik. Medya iş akışın, sahibi olduğun donanım üzerinde çalışır. Markan - token'lar, yazı tipleri, logolar, bunları uygulayan araçlar - bir tedarikçinin dışa aktar düğmesi olan veritabanında değil, senin elinde tuttuğun dosyalarda, senin kontrol ettiğin sürüm kontrolünde yaşar. İşleme, önündeki cihazda gerçekleşir; böylece bir varlığın var olması için hiçbir zaman üçüncü bir tarafa uğraması gerekmez ve girdiden bitmiş dosyaya kadar tüm yol açık kaynaklı ve denetlenebilirdir. Tüm SaaS tasarım tedarikçileri yarın ortadan kalksa, bir Lolly kurulumu bunu fark etmez.

Bu, işi bir abonelikten daha uzun ömürlü olması gereken herkes için önemlidir: fotoğraf kitabı o dizüstü bilgisayarda yaşayan bir ebeveyn de, marka kütüphanesi satın alma kurallarına tabi olan bir kamu kurumu da. Kuruluşlar için - kamu kurumları, düzenlemeye tabi sektörler, markası bir süsten çok stratejik bir varlık olan herkes için - "içeriğimiz nerede yaşıyor ve onu kim kapatabilir" bir tercih değil, bir yönetişim sorusudur. Buradaki egemenlik, uyumluluk için sonradan eklenmiş bir barındırma özelliği değil, mimarinin bir niteliğidir; [Gizlilik Politikası](/info/privacy.html) ve [Kendin Doğrula](/info/verify-yourself.html) sayfaları, bu iddiayı kabul etmek yerine kontrol edebilesin diye vardır.

Tüm bunların altında, bir özellik değil bir taahhüt olarak ifade edilen tek bir söz var: **cihazında işleniyorsa, sonsuza kadar ücretsizdir.** Motor, kabuklar, araçlar, formatlar - cihaz üzerindeki tüm yaratıcı yol açık kaynaklıdır ve öyle kalır. Bu sözün bir mekanizması var: yayımlanmış bir sürüm, geri alınamayacak şekilde lisanslanmıştır ve işi daha sonra yeniden lisanslayabilecek hiçbir katkıda bulunan sözleşmesi yoktur. Tüm sınır tek bir cümleye sığar: cihazında işlenen her şey sonsuza kadar ücretsiz ve açık kaynaklıdır; ağ üzerinden insanları ve makineleri koordine etmek ise ayrı bir kontrol düzleminin, [lolly.work](https://lolly.work), işidir.
