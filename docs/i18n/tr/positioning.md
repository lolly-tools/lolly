# Lolly'nin diğerleriyle karşılaştırması

Lolly, hesap olmadan kendi cihazında markaya uygun dosyalar üretir. **Lolly Work**, ekipler için sunucudur: kuruluşunun işlettiği makinelerde oturum açma, paylaşılan projeler, onaylar ve sunucuda render. İkisi de MPL-2.0 kapsamında açık kaynaklıdır.

Çoğu ekip elindeki araçları kullanmaya devam eder. Tasarım uygulaması tasarımları sağlar, DAM esas kayıt kaynağı olarak kalır ve Lolly onaylanmış girdileri bitmiş dosyalara dönüştürür. [Lolly'yi mevcut DAM sisteminle kullan](/info/use-with-dam.html) bu birleşimi anlatır. Bu birleşimin arkasındaki fikir [içerik egemenliğidir](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Günümüzün araçları

Her halka, bir ürün sınıfının bir ihtiyacı ne ölçüde karşıladığını gösterir. Kanıtları görmek için bir satırın yanındaki **?** düğmesine, puanların nasıl işlediğini görmek için açıklama anahtarının yanındaki **?** düğmesine bas.

::: figure positioning-comparison
Yetenek karşılaştırması. Tedarikçi belgelerinden rakip araştırması, Ağustos - 21 Kasım 2026. Lolly ve Lolly Work, 21 Kasım 2026'da incelendi. Puanlama: 0 yok, 25 dolaylı çözüm, 50 var ama erişimi kısıtlı veya kısmi, 75 bazı sınırlamalarla güçlü, 100 temel yetkinlik.
:::

::: details Kasım 2026'da değişen puanların kaynakları
- Canva: [API değişiklik günlüğü](https://www.canva.dev/docs/apps/rest-apis/changelog/), [hizmet uygulamaları](https://www.canva.dev/blog/developers/canva-service-accounts/), [Brand Controls yardımı](https://www.canva.com/help/brand-control/)
- Adobe: [InDesign API değişiklik günlüğü](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [Adobe Express fiyatlandırması](https://www.adobe.com/express/pricing)
- Figma: [ajan ve yapay zekâ kredileri](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP sunucusu](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify ve Bynder: [Frontify Ekim 2026 sürüm notu](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear ve Placid: [Bannerbear fiyatlandırması](https://www.bannerbear.com/pricing/), [Bannerbear değişiklik günlüğü](https://www.bannerbear.com/changelog/), [Placid fiyatlandırması](https://placid.app/pricing)
- Penpot: [kendi sunucunda barındırma fiyatlandırması](https://penpot.app/pricing/self-host), [sürümler](https://github.com/penpot/penpot/releases)
- Cloudinary: [içeriğin kaynak bilgisi](https://cloudinary.com/documentation/content_provenance_and_authenticity), [fiyatlandırma](https://cloudinary.com/pricing)
:::

Özellikler ve geçmiş performans ayrı satırlardır. Lolly'nin ilk genel sürümü, 30 Ağustos 2026'da yayımlanan 1.0.1'di; güvenliği henüz bağımsız bir denetimden geçmedi ve benimsenmesine ilişkin kanıtlar birkaç aylık. [Benimseme & Yönetişim](/info/adoption-governance.html#status) güncel durumu içerir.

<!--i:eti-hammer-->
## Lolly ne zaman seçilmeli

::: cols
## Şu durumlarda Lolly'yi seç

- Aynı tür dosyaya tekrar tekrar ihtiyaç varsa: etkinlik kartları, rozetler, sertifikalar, uyarılar, sosyal medya kartları
- [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) veya CLI'da tek bir şablondan ve değer tablosundan çok sayıda dosya üretiliyorsa
- Renkler, yazı tipleri ve varlıklar, açık bir tuvalde bile tasarım sisteminin içinde kalmalıysa
- Bitmiş bir Figma, Penpot, Illustrator, InDesign, Affinity veya PDF tasarımının düzenlenebilir ve tekrarlanabilir olması gerekiyorsa ([Tasarım içeri aktar](/info/design-import.html))
- Dosyalar kendi cihazlarında veya sunucularında üretilmeliyse

## Şu durumlarda başka bir şey seç

- İş, ayrıntılı fotoğraf rötuşu veya illüstrasyonsa
- Bir uygulama arayüzü tasarlıyor ve prototipini hazırlıyorsan
- İlk günden hazır, geniş bir stok içerik ve şablon kitaplığına ihtiyacın varsa
- Büyük ölçekte uzun bir işletim geçmişine sahip, yönetilen bir hizmete ihtiyacın varsa
:::

İçeri aktarılan tasarımlar ve paylaşılan tasarım token'ları, ekibin Lolly'yi uzman uygulamalarla birleştirmesini sağlar; Lolly Work ise paylaşılan varlıkları, incelemeyi ve teslimatı yönetir.

Özenle düzenlenmiş bir DAM kullanan ekiplerde, o kitaplığı ve yöneticilerini yerinde tutarak başla. [SUSE'nin Brandfolder deneyimi](/info/suse-brandfolder.html), entegrasyonun benimsemeyi ve onay süreçlerindeki değişiklik yönetimini nasıl desteklediğini kaydeder. DAM tedarikçileri ve uygulama ortakları, aynı düzeni [iş ortağı iş akışı](/info/dam-partners.html) üzerinden değerlendirebilir.

**Lolly Markdown Slides** içinde, bütün bir sunum veri olarak yazılır, düzeni canlı olarak oluşturulur ve PowerPoint'in kendi biçiminde, düzenlenebilir bir dosya olarak dışa aktarılır.

![Bölünmüş görünümde Lolly Markdown Slides: solda bloklar olarak listelenen sunum slaytları, sağda düzeni oluşturulmuş sunumun render'ı](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Kurallar aracın içindedir

Lolly, yeniden kullanılabilir marka kurallarını aracın içine koyar: renkler, yazı tipleri, taşma payları, aralıklar ve izin verilen girdiler. Şablon, alıcının değiştirmemesi gereken bölümleri sabitler. Lolly Work, bu şablonun çevresine grup erişimi ve girdi politikaları, katalog gönderimleri ve teslimat için de onay zincirleri ekler.

Bir aracı bir kez denetlemek, tekrarlanabilir üretimi kolaylaştırır; çünkü her çıktı, aracın düzen kurallarını devralır. Metinlerin, yüklenen görsellerin ve kullanım haklarının yine de denetlenmesi gerekebilir; Lolly Work bunun için paylaşılan kataloglar ve onay adımları sağlar. Yaratıcı ekip için araç bir korkuluktur: veriyi, metni ve görseli yine sen getirirsin ve araç her sonucu markaya uygun tutar.

![Üreticinin bütün işi: sözcükleri yazmak. Yazı tipi, renk ve aralıklar araç yapılırken belirlenmişti](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Üç fark daha:

- **Girdilerden son dosyaya.** Girdiyi ver, bitmiş dosyayı al; "şimdi tasarım aracından kaydet ve düzelt" adımı yok.
- **Araçlar araçları birleştirir.** Bir araç, aralarında kod bağımlılığı olmadan başka bir aracın render'ını tek bir bitmiş dosyaya gömebilir.
- **Açık kaynak.** Motor açık kaynaklıdır; araçlar, varlıklar ve tasarım token'ları da başkasının veritabanındaki satırlar değil, sürüm kontrolünde tutabileceğin veya Lolly Work'te yönetebileceğin dosyalardır.

Cesur tasarım, sınırlar içinde de yaşar. Poster kalitesindeki bu şehir haritası, tasarım sisteminin dışına çıkamayan bir açılır menü ve iki renk alanından üretilen gerçek vektör yol ve su çizgilerinden oluşur:

![Amsterdam'ın kanal halkaları ve yol ağı, tasarım sisteminin kendi mürekkebiyle kenardan kenara çizilmiş; her çizgi elle değil, şablon tarafından yerleştirilmiş](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Olasılıksal olarak yenilik yap, deterministik olarak ölçekle

Çoğu "yapay zekâyla yaratıcılık" sunumu, modeli eski bir sınırın yanlış tarafına koyar. Hattatlar ve tezhip sanatçıları o sınırın yerini belirlemişti. Eskiz üzerinde serbestçe çalışırsın; her şey denenebilir ve hiçbir şey kesinleşmez. Sonra işi kesinleştiren matbaaya geçersin. Sanat eskizlerdeydi, matbaa ise onu yaymanın yoluydu ve basılı işe güvenilebilirdi, çünkü matbaa her baskıda sözünü tutardı.

Lolly matbaadır. Fikirler için istediğini getir: bir model, bir tasarımcı veya kaba bir çizim; ancak bir fikrin çok sayıda dosyaya dönüşmesi gerektiği anda, herkesin geri okuyabileceği girdilerden her seferinde aynı şekilde render eden bir süreçten geçer. Yukarıdaki karşılaştırma, aslında bu kesinleştirme adımını kimin tekrarlanabilir kıldığıyla ilgilidir.

> Yaratıcı sürece güven, titizlikle ölçekle.

<!--i:eti-tag-->
## Sonsuza kadar ücretsiz

**Cihazında render ediliyorsa sonsuza kadar ücretsizdir.** Motor, kabuklar, araçlar ve biçimler açık kaynaklıdır ve yayımlanmış bir sürüm geri alınamaz. Lolly Work de açık kaynaklıdır. Bir kuruluş, seçtiği altyapı ve işletim için ödeme yapar; kendi sunucunda barındırmada kullanıcı başına veya render başına yazılım lisans ücreti yoktur. [Sorular & yanıtlar](/info/faq.html), bu sözün arkasındaki hikâyeyi anlatır.

<!--i:eti-map-pin-->
## İçeriğin nerede durur

Lolly'nin yaratıcı işleri, sahibi olduğun donanımda çalışabilir; tasarım token'ları, yazı tipleri, logoları ve araçları da saklayabileceğin dosyalardır. Lolly Work ile paylaşılan projeler, varlıklar, politika ve denetim kayıtları, kuruluşunun yapılandırdığı depolamada tutulur. [Güven](/info/trust.html), bunun neden önemli olduğunu açıklar; [Gizlilik Politikası](/info/privacy.html) ve [Kendin doğrula](/info/verify-yourself.html) ise sözümüze güvenmek yerine iddiayı denetlemeni sağlar.

<!--i:eti-grid-->
## Araç araç

[Lolly karşılaştırması, araç araç](/info/compare.html), her biri için bir sayfada Lolly'yi Canva, Adobe, Figma, Penpot, marka portalları, render API'leri ve çevrimiçi dönüştürücülerle karşılaştırır ve [neyin nerede çalıştığını](/info/compare.html#what-runs-where) açıklar.
