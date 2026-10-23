# Lolly nasıl karşılaştırılır

Lolly, tek bir açık kaynak projesinin iki parçasıdır. **Lolly**, hesap olmadan cihazında yapmak, düzenlemek, dönüştürmek ve dışa aktarmak için motor, uygulamalar ve araçlardır. **Lolly Work**, giriş, paylaşılan projeler, onaylar ve sunucu render'ı için kendi altyapında çalışan kuruluş sunucusudur. İkisi de MPL-2.0'dır. Bu sayfa çifti insanların dosya tasarladığı, yönettiği ve ürettiği diğer yollarla karşılaştırır.

## Bugünün araçları

Her halka, bir ürün sınıfının bir yeteneği ne kadar eksiksiz sunduğunu puanlar; her sınıf en iyi temsilcisi üzerinden puanlanır. Lolly sütunu Lolly ve Lolly Work'ü birlikte kapsar ve her satır hangi parçanın neyi sağladığını söyler. Puanının ardındaki gerekçe için bir satır adını aç. Sütunlar en üstteki Overall completeness satırına göre sıralanır: harcama satırı hariç, puanlanan satırların ortalaması.

::: figure positioning-comparison
Yetenek karşılaştırması: rakip araştırması ve puanlar Ağustos 2026; Lolly + Lolly Work kapsamı 28 Eylül 2026'da gözden geçirildi. Puanlama: 0 yok, 25 geçici çözüm düzeyinde, 50 gerçek ama kısıtlı veya kısmi, 75 çekincelerle güçlü, 100 temel yetkinlik.
:::

::: details Puanlama notları
Mevcut özellikler ve üretim olgunluğu ayrıdır. Lolly yayımlandı: 1.0 sürümü 30 Ağustos 2026'da açık kaynak olarak çıktı, güvenliği henüz bağımsız bir denetimden geçmedi ve benimsenme kanıtı birkaç aylık ([Adoption & Governance](/info/adoption-governance.html#status) güncel durumu içerir). Çoklu oturum açma, onaylar veya sunucu render'ına sahip olmak bir üretim sicilini kanıtlamaz; olgunluk puanı bunu yansıtır. Rakip puanları tarihli Ağustos incelemesini korur.

Tek bir kural tabloyu yönetir. İçeriğine veya kimliğine dokunan satırlarda tam puan (100), hesap ve bulut ön koşulu olmadan kullanabileceğin bir yetenek gerektirir; olgunluk ve kullanım kolaylığı gibi ürünün kendisiyle ilgili satırlar bu kuraldan muaftır. Bu kural Adobe'ye Content Credentials'ta mal olur: en geniş gönderilmiş uygulama (Photoshop, Lightroom, Premiere, Firefly) yerelde ve bulutta imzalar ama hiçbir zaman bir Adobe hesabı ve kimliği olmadan değil, yani 75. Aynı nedenle render API'lerini toplu üretim ve otomasyonda sınırlar.

Canva, Affinity ve Cavalry'nin (ikisi Ekim 2025'te bedava dağıtıldı) sahibi olduğu için satır başına en iyi aile üyesi üzerinden puanlanır. Çevrimdışı ve cihaz üzerinde render, hâlâ doğrulanmış bir hesap gerektiren ve telemetri taşıyan bir masaüstü paketi olan Affinity üzerinden 75 puan alır; Adobe'nin de aldığı kesinti. Canva'nın kendi çevrimdışı modu yalnızca önceden eşitlenmiş tasarımları, tek cihazda, sınırlı bir süre için düzenler. Autofill 50 puan alır: gerçektir ama Enterprise ile kısıtlıdır, eşzamansızdır ve yalnızca metin ve görselleri doldurur. Figma'nın toplu üretimi, Buzz elektronik tablo doldurmayı (ücretsiz bir beta, Ağustos 2026) gönderdiğinde 25'ten 50'ye çıktı.

Lolly'nin 75 olan Content Credentials puanı cihaz üzerinde imzalamayı ve Lolly Work'ün yapılandırılmış bir kuruluş kimliğiyle sunucu imzalamasını kapsar; bir doğrulayıcı yine imzalayana güvenmelidir ([Content Credentials Identity](/info/content-credentials-identity.html)). Penpot'un 50 puanı Lolly'nin kendi Penpot dışa aktarma eklentisinden gelir: aynı motor imzalaması, isteğe bağlı ve Lolly'nin olarak açıklanmış. Penpot cihaz üzerinde render'da 90 alır: kendi sunucusunda barındırılabilen kaydetme hedefiyle bir tarayıcı tuvali. Cloudinary, varlık kitaplığı, dönüştürme API'si ve CDN'i için kendi sütununu alır; Ağustos incelemesi teslimat imzalamasını 50 puanladı.

Lolly'nin canlı iş birliği, doğrudan iki cihazlı özel collab'ları ve Lolly Work üzerinden paylaşılan düzenlemeler, imleçler ve kayıtlı ekip oturumlarıyla kimliği doğrulanmış work collab'ları içerir. Partial puanı, ekip düzenlemesinin yokluğunu değil, mevcut tek düğümlü work dağıtımını ve kısa işletim geçmişini yansıtır. Fiyat tahminleri, ölçek için tarihli liste fiyatı aritmetiğidir, satın alma değildir.
:::

## Lolly'ye ne zaman uzanmalı

::: cols
## Lolly'ye şu durumlarda uzan

- Aynı tür dosya tekrar tekrar gerekiyor: etkinlik karoları, rozetler, sertifikalar, uyarılar, sosyal medya kartları
- Çok sayıda dosya bir şablondan ve bir değer tablosundan geliyor; [Batch](/info/batch.html#make-many-versions-of-one-design) veya CLI ile
- Renkler, yazı ve varlıklar, açık bir tuvalde bile tasarım sisteminin içinde kalmalı
- Bitmiş bir Figma, Penpot, Illustrator, InDesign veya PDF tasarımı düzenlenebilir ve tekrarlanabilir olmalı ([Import a design](/info/design-import.html))
- Dosyalar kendi cihazlarında veya sunucularında yapılmalı

## Başka bir şeye şu durumlarda uzan

- İş ayrıntılı fotoğraf rötuşu veya illüstrasyon
- Bir uygulama arayüzü tasarlıyor ve prototipliyorsun
- İlk günden hazır büyük bir stok ve şablon kitaplığına ihtiyacın var
- Ölçekte uzun bir sicili olan yönetilen bir hizmete ihtiyacın var
:::

İçe aktarılan tasarımlar ve paylaşılan tasarım token'ları bir ekibin Lolly'yi uzmanlaşmış uygulamalarla birleştirmesine izin verirken Lolly Work paylaşılan varlıkları, incelemeyi ve teslimatı yönetir.

Bütün bir slayt sunumu tavanı gösterir: **Markdown Slides** içinde bir sunum veri olarak bildirilir, canlı yerleştirilir ve yerel, düzenlenebilir bir PowerPoint dosyası olarak dışa aktarılır.

![Bölünmüş görünümde Markdown Slides: solda blok olarak listelenen sunumun slaytları, sağda yerleştirilmiş sunumun render'ı](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Kurallar araçta yaşar

Lolly yeniden kullanılabilir marka kurallarını araca koyar: renkler, yazı tipleri, taşma payları, aralık ve izin verilen girdiler. Şablon, bir alıcının değiştirmemesi gereken parçaları sabitler. Lolly Work bu şablonun etrafına grup erişimi ve girdi politikaları ekler; katalog gönderimleri ve teslimat için onay zincirleriyle.

Bir aracı bir kez denetlemek tekrarlanabilir üretimi kolaylaştırır, çünkü her çıktı düzen kurallarını devralır. Metin, yüklenen görseller ve kullanım hakları yine de denetim gerektirebilir ve Lolly Work bunun için paylaşılan katalogları ve onay adımlarını sağlar. Yaratıcı ekip için araç bir korkuluktur: veriyi, metni ve görseli yine sen getirirsin ve araç her sonucu markaya uygun tutar.

![Üreticinin tüm işi: sözcükleri yazmak. Yazı, renk ve aralık araç yapılırken belirlendi](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Bu yaklaşımı ayıran üç şey daha var:

- **Girdilerden nihai dosya.** Girdi girer, bitmiş dosya çıkar; "şimdi tasarım aracından kaydet ve düzelt" yoktur.
- **Araçlar araçları oluşturur.** Bir araç, aralarında kod bağı olmadan, başka bir aracın render'ını tek bir bitmiş dosyaya gömebilir.
- **En alta kadar açık.** Motor açık kaynaktır ve araçlar, varlıklar ve tasarım token'ları, sürüm denetiminde tutabileceğin veya Lolly Work'te yönetebileceğin dosyalardır; başkasının veritabanında satırlar değil.

Maceracı tasarım korkulukların arasından sağ çıkar. Bu poster kalitesindeki şehir haritası, bir açılır menüden ve tasarım sisteminin dışına yönlendirilemeyen iki renk alanından gelen, gerçek vektör yol ve su yollarıdır:

![Amsterdam'ın kanal halkaları ve yol ağı, tasarım sisteminin kendi mürekkebiyle kenardan kenara çizilmiş; her çizgi elle değil şablonla yerleştirilmiş](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Olasılıksal yenilik yap, deterministik olarak ölçeklendir

"Yapay zekâ yaratıcılığı" önerilerinin çoğu modeli eski bir çizginin yanlış tarafına koyar. Yazıcılar ve tezhipçiler çizginin nereden geçtiğini belirlemişti. Eskiz üzerinde gevşek çalışırsın; orada her şey denenebilir ve hiçbir şey taahhüt edilmez. Sonra taahhüt eden matbaaya gidersin. Sanatın olduğu yer eskizlerdi ve matbaa, onun yolculuk etme biçimiydi; basılı işe güvenilebilirdi, çünkü matbaa her baskıda sözünü tuttu.

Lolly matbaadır. Fikirlere ne istersen getir: bir model, bir tasarımcı veya kaba bir çizim; ancak bir fikir birçok dosyaya dönüşmek zorunda kaldığı anda, her seferinde aynı şekilde, herkesin geri okuyabileceği girdilerden render eden bir şeyden geçer. Yukarıdaki karşılaştırma gerçekte, bu taahhüt edilmiş adımı kimin tekrarlanabilir yaptığıyla ilgilidir.

> Yaratıcı sürece güven, titizlikle ölçeklendir.

## Sonsuza dek ücretsiz

**Cihazında render ediliyorsa sonsuza dek ücretsizdir.** Motor, kabuklar, araçlar ve biçimler açık kaynaktır ve yayımlanmış bir sürüm geri alınamaz. Lolly Work da açık kaynaktır. Bir kuruluş, seçtiği altyapı ve işletme için öder; kendi sunucusunda barındırma için koltuk veya render başına yazılım lisansı ücreti yoktur. [Questions & answers](/info/faq.html) sözün arkasındaki hikâyeyi anlatır.

## İçeriğin nerede yaşar

Lolly'nin yaratıcı işi sahip olduğun donanımda çalışabilir ve tasarım token'ları, yazı tipleri, logolar ve araçlar saklayabileceğin dosyalardır. Lolly Work ile paylaşılan projeler, varlıklar, politika ve denetim kayıtları kuruluşunun yapılandırdığı depolamada yaşar. Bunun neden önemli olduğunu [Trust](/info/trust.html) açıklar ve [Privacy Policy](/info/privacy.html) ile [Verify It Yourself](/info/verify-yourself.html) bizim sözümüze güvenmek yerine iddiayı denetlemene izin verir.

## Araç araç

[Lolly compared, tool by tool](/info/compare.html), Lolly'yi Canva, Adobe, Figma, Penpot, marka portalları, render API'leri ve çevrimiçi dönüştürücülerle, her biri için bir sayfa olarak karşılaştırır ve [what runs where](/info/compare.html#what-runs-where) bölümünü ortaya koyar.
