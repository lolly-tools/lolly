# Yapay zekâya yaklaşımımız

Lolly, medyanın üretilme biçiminde matbaadan bu yana yaşanan en büyük değişimin ortasında, yapay zekâ konusunda ne paniğe kapılan ne de teknoloji karşısında kendinden geçen insanlar tarafından geliştirildi. İşte projenin duruşu ve her taahhüdün arkasındaki mekanizma; böylece güvenmek yerine doğrulayabilirsin.

> "Musluk her an kuruyacakmış gibi içiyoruz. Kurumayacak - bugünün yapay zekâsı, olacağı en kötü hâlinde. Selden sağ çıkarsak bu, tepenin aşağısındaki paslı, tortu dolu su deposunda olanı istifleyerek olmayacak. Müreffeh bir gelecek için ***kendi*** toprağımızı sulayıp yeniden kazanarak olacak."
>
> - Andy Fitzsimon, Lolly Katkıcısı

![Avustralya'nın iç kesimlerindeki bir çiftlik evinin üzerinde patlayan süper hücre fırtınası - aşağıda su deposu ve barakalar, sel suları kuru otlakta şimdiden kanallar açıyor](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} tarafından üretilen görsel %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} ve %act{exported to WebP}, %file{the-flood.webp} olarak %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Bunu şimdi doğrula](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Kesin konuşmak gerekirse, çünkü bu sayfa kesinliğin önemli olduğunu savunuyor: yukarıdaki görsel üretildi, fotoğrafı çekilmedi. O çiftlik evine hiçbir kamera doğrultulmadı, çünkü öyle bir çiftlik evi yok. Birleşik Krallık'tan verilen bir istemle, Amerika Birleşik Devletleri'ndeki bir veri merkezinde üretilmiş olarak Avustralya'nın Queensland kırsalını betimliyor. Bir yerin kaydı olmadan o yere sadık kalmaya çalışıyor ve görselin Content Credentials taşımasının tek nedeni bu ayrım.

Dosyayı denetlediğinde bunun nasıl göründüğü burada. Dosyada dokuz adım korunur: Google'ın görseli üretirken ve filigran eklerken kaydettiği beş adım, ardından Lolly'nin bu sayfadaki sürümü açarken, oluştururken, işaretlerken ve dönüştürürken kaydettiği dört adım. Lolly hiçbir şey üretmedi ve kaydı da bunu söylüyor.

![Lolly'nin bitmiş dosyadan okuduğu değişiklik geçmişi: Google'ın kaydettiği beş adım, ardından Lolly'nin kaydettiği dört adım ve sonunda bu sayfadaki WebP](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Andy'nin benzetmesinde yapay zekâya kıtlık anlayışıyla yaklaşmak, sel suları ovalarda hızla akarken depodaki bozulmuş suyu içmektir. Üretilmiş içerik neredeyse sınırsız hâle gelmek üzere. Bir şey sınırsız olduğunda değeri, çevresinde kıt kalan şeylere kayar: güven, kaynak bilgisi, marka tutarlılığı ve insan muhakemesi. Lolly, sel için daha büyük bir kova değildir. Sulamadır: suyu yönlendiren kanallar ve gerçekten bir şeylerin yetiştiği toprak.

<!--i:eti-checklist-->
## Beş taahhütle yaklaşımımız

- <!--i:layers--> **Yapay zekâya girdi olarak yer var, taklit yoluyla yanıltmaya asla.** Ajanlar, Lolly'nin birinci sınıf kullanıcılarıdır: [MCP sunucusu](/info/mcp.html) ve [URL modu](/info/url-mode.html) üzerinden, tamamen aynı kısıtlamalar içinde insanların kullandığı araçları çalıştırırlar. Hiçbir ajanın yapamayacağı şey, çıktısını olmadığı bir şeymiş gibi sunmaktır. [Girdi, taklit yoluyla yanıltma değil](/info/input-not-impersonation.html) bu sınırı çizer.
- <!--i:shieldcheck--> **Yapay zekâ kendini beyan eder.** Pikselleri yapay zekâ ürettiyse dışa aktarma bunu belirtir: dosyanın Content Credentials bilgileri içinde makine tarafından okunabilir bir beyan ve dosyayı doğrulayan herkese görünen bir GEN AI rozeti. Yapay zekâ ürünü olarak beyan ettiğin medya bir tasarıma yerleştirildiğinde, dışa aktarmanın kendi kimlik bilgisi de bunu belirtir: bileşik köken işareti ve imzalı, makine tarafından okunabilir bir yapay zekâ açıklaması. Lolly ayrıca başka yerde üretilen dosyaların yapay zekâ beyanlarını okur ve gösterir; SynthID filigranı bulunması muhtemelse bunu işaretler, filigranın kendisini değil beyanı okur. Aynı kural, Lolly'nin cihazda çalışan kendi yeniden yazma aracı için de geçerlidir: yazdığı her cümle, sözcük seçimlerinde burada ve araçta açıklanan, herkese açık istatistiksel bir filigran taşır; böylece modelin yazdığı metin, düz metin kopyası olarak bile kendini beyan etmeye devam eder ve herkes bu metni [Lolly Verify](/#/verify) içinde denetleyebilir ([denetim nasıl çalışır](/info/what-verify-checks.html#text-reworded-by-lolly)). Sistem, tasarımı gereği herkese açıktır: doğrulama herkese, sırlar kimseye. İzleyiciler medyanın nasıl üretildiğini bilmeyi hak eder.
- <!--i:check--> **Kaynak bilgisi varsayılan olarak açıktır.** Dışa aktarmalar, gizli bir ayara bağlı olmadan varsayılan olarak [Content Credentials](/info/content-credentials-identity.html) taşır. Zincir, düzenlemeleri ve bileşenleri kapsar; böylece bir çalışmanın geçmişi çalışmayla birlikte taşınır. Lolly'nin ürettiği her dosyada [bunu kendin doğrulayabilirsin](/info/verify-yourself.html).
- <!--i:people--> **Eser sahibi insan olmaya devam eder.** Sözcükler, görsel, palet, muhakeme gerektiren karar: araçlar bu muhakemeyi ölçekler ve asla insanın yerine geçmez. Otomatikleşenler sıkıcı kısımlardır: marka denetimi, her boyutta yeniden dışa aktarma, elle yerelleştirme. Geriye eser sahipliği kalır.
- <!--i:globe--> **Kovalar değil, kanallar.** Bugünün modelleri tavan değil tabandır; bu yüzden değeri bu modellere erişimi tekelleştirmeye bağlı olan hiçbir şey yapmayı kabul etmiyoruz. Motor açık kaynaklıdır, kendi cihazında render eder ve çevrimdışı çalışır. Model üzerinden kurulmuş bir rekabet duvarı, kullanım sayacı veya selin kendisine bağlanmış bir kıtlık işi yoktur. Kalıcı yatırım, suyun çevresindeki altyapıdır - ve ücretsiz sunduğumuz şey bu altyapıdır.

<!--i:eti-user-check-->
## Amaç insanın karar vermesidir

Bireyler yeryüzünü ve tarihimizi şekillendirir. Tek tek yaptıkları seçimler, geri kalanımızın yaşadığı dünyaya dönüşür. Eylemleri o dünyayı oluşturur. Her şey hep böyle gerçekleşmiştir.

Bu yüzden insanın karar verme gücünü artırır ve bundan asla ödün vermeyiz. Seçme hakkı. İrade. Özerklik. Karar verebilmek, eyleme geçebilmek ve o eylemin sana ait olması.

Buradaki araçlar bir kişinin verdiği kararın etkisini büyütür ve hiçbir zaman sessizce onun yerine karar vermez. Bir kararı otomasyon uygulasa da kayıt, yol boyunca kaç sistemden ve beklenmedik dönüşten geçmiş olursa olsun, yine onu başlatan kişiye uzanır.

Buna baştan sona bağlı kalır ve bunu kayda geçiririz: geçmiş, hesap verebilirlik, güven ve yarın için.

<!--i:eti-sliders-->
## Yapay zekâ, senin koşullarınla

Burada yapay zekâya hiçbir zaman ihtiyacın yok. Kullanmayı seçersen üç şey geçerli:

- <!--i:people--> **Kontrol sende.** Yapay zekâ yalnızca istediğinde ve yalnızca gösterdiğin parçada yardımcı olur. Senin yerine hiçbir şeye karar verilmez.
- <!--i:check--> **Maliyeti sona erer.** Yapay zekâ bir şeyi bir kez yapmana yardım ederse sonuç senindir. Sonuca kaç kez ihtiyaç duyarsan duy, yeniden kullanmak ücretsizdir.
- <!--i:shieldcheck--> **Dürüst kalır.** Yapay zekâyla yapılan bir parça bunu belirtir ve yaptığın şey başkasıymış gibi görünmek yerine senin adını taşır. Yerleşik yardım bile böyle çalışır: [Ask Lolly](/info/ask.html), uydurma bir yanıt yerine kılavuzun kendi cümlesi ve bir bağlantıyla yanıt verir.

<!--i:eti-info-->
## Bu ne değildir

- <!--i:check--> **Bir yasak değil.** Araçlar işe yaradığı yerde yapay zekâ kullanabilir ve ajanlar desteklenen bir kullanıcı grubudur - bkz. [Yapay zekâ ajanları](/info/ai-agents.html).
- <!--i:seal--> **Bir saflık iddiası değil.** Lolly kaynak bilgisini geniş kapsamlı okur ve dürüstçe yazar; internette üretilmiş her pikseli tespit edebildiğini iddia etmez.
- <!--i:sunburst--> **Ahlaki bir panik değil.** Düşman sel değil. Kaynağı belirsiz su.

<!--i:eti-search-->
## Bu taahhütleri kendin denetle

Yukarıdaki her taahhüt bir politika PDF'inde değil, açık kod tabanında uygulanır: kaynak bilgisi akışı, GEN AI etiketlemesi ve izleyici kullanmama garantisinin hepsi testlerle birlikte sunulur. [Kendin doğrula](/info/verify-yourself.html) sayfası da iddiaları gerçek bir dışa aktarma üzerinde denetlemende sana yol gösterir.
