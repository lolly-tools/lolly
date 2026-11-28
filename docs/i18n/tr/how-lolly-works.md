# Lolly nasıl çalışır

Bir Lolly aracı, bir dosya türünün kurallarını tutar: düzen, yazı, renkler ve başkalarının hangi kısımları değiştirebileceği. Sen, bir meslektaşın, bir betik veya bir yapay zekâ ajanı alanları doldurur ve her dosya bu kurallara uyar.

<!--i:eti-repeat-->
## Tek araç, senin kuralların, çok sayıda dosya

Marka kuralları araçta yer alır. Aracı bir kez kur; tek bir karttan bir düzine dilde satırlar içeren bir elektronik tabloya kadar her çıktı aynı yazıyı, rengi ve aralığı kullanır.

![Tek alanı doldurulmuş bir wordmark aracı: yazı, renk ve aralık araç oluşturulurken belirlendi](/info/shots/aud-rules-in-the-tool.svg)

Yüzüncü dosyayı yapan kişi yalnızca sözcükleri yazar. İşin nasıl denetleneceğine ve kimin denetleyeceğine sen karar verirsin. Lolly, denetlenecek şeyleri azaltır ve sonraki dosyanın daha hızlı yapılmasını sağlar.

<!--i:eti-users-->
## Aracı kimler kullanır

Bir kuruluştaki üç rol, tek bir kampanya kartı üzerinde çalışır.

![Tasarımcı kuralları bir araçta bir kez belirler; geliştirici onu bir betikten çalıştırır ve herkes alanlarını doldurabilir; her iki yol da bitmiş dosyalar üretir](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Tasarımcı kuralları belirler.** Kartı Lolly Design'da markanın yazısı ve renkleriyle düzenler, ardından hangi alanların açık kalacağını seçer. Bunu bir kez yapar; böylece kimse kartı bir daha elle yerelleştirmez.
- <!--i:code--> **Geliştirici aracı ölçeklendirir.** Aynı araç, komut satırı üzerinden her gece bir betikte çalışır. Kimse tasarımı yeniden açmadan güncel bir grafik veya yeni bir dil sürümü gelir.
- <!--i:people--> **Herkes doldurabilir.** Ağ bağlantısı ve tasarım eğitimi olmayan, uçaktaki bir satış temsilcisi aracı açar ve yarınki toplantının kartını hazırlar.
:::

Geliştiricinin güncel grafiği, bir veri dizesi ve birkaç ayarla oluşturulmuş, bunun gibi bir render'dır:

![Soğuk bir palette şeritler halinde üç serili, başlıklı bir yığılmış alan grafiği; eksenler, gösterge ve başlık elle değil, şablon tarafından yerleştirildi](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Temsilcinin bir dakikada işini bitirmesi, tasarımcının kurallarına ve geliştiricinin betiğine bağlıdır. Her rol aynı araçla çalışır.

<!--i:eti-train-->
## Dosyaya giden dört yol

Her yol, aynı araç üzerinde aynı motoru çalıştırır; bu yüzden bir betiğin ürettiği dosya, uygulamada önizlediğin dosyayla eşleşir.

![URL parametreleri ve komut satırı argümanları aynı girdi modeline dönüşür, ortak bir çalışma zamanı ve dışa aktarma köprüsünden geçer](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Uygulamada, tek tek.** Bir araç aç, alanları doldur ve **Export** düğmesine bas. [İlk dosyanı oluştur](/info/make-something.html), bir örnekle sana yol gösterir.
- <!--i:layers--> **Uygulamada, aynı anda çok sayıda.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`), yapıştırılan veya içeri aktarılan bir tabloyu alır ve her satır için bitmiş bir dosya render eder.
- <!--i:cpu--> **Bir betikten veya yapay zekâ ajanından.** [CLI](/info/cli.html), aracı arayüzsüz çalıştırır ve [MCP sunucusu](/info/mcp.html), bir ajanın araçları keşfetmesini ve çalıştırmasını sağlar. Araç bağlantısı girdilerini de taşır; dolayısıyla bağlantı, eksiksiz bir istektir.
- <!--i:server--> **Kuruluşunun sunucusu üzerinden.** [Lolly Work](/info/organisation.html), kuruluşunun oturum açma ve araç politikası kapsamında sunucuda render eder, devam ettirebileceği işleri saklar ve çıktıyı indirme veya onaylı teslimat için tutar.

Bir işin hangi yolu kullanabileceği, aracın biçimlerine ve çalıştığı ortamın yeteneklerine bağlıdır. Bazı biçimler tarayıcı gerektirir; bu yüzden komut satırı bunları bir tarayıcı katmanına aktarır. [CLI ile render et](/info/cli-rendering.html), hangi biçimin nerede render edildiğini listeler.

<!--i:eti-monitor-->
## Ne nerede çalışır

Üretme, düzenleme ve dışa aktarma, hesap olmadan cihazında çalışır. Sync veya bağlı bir hizmete dosya gönderme gibi sunucu gerektiren bir özellik, yalnızca o özelliği kullandığında bağlanır. Lolly Work ile paylaşılan projeler, ekiple canlı düzenleme, onaylar ve sunucu işleri kuruluşunun sunucusunu kullanır. [Ne nerede çalışır](/info/compare.html#what-runs-where), iki bölümü yan yana gösterir.

<!--i:eti-graduation-cap-->
## Sırada okunacaklar

- Hemen denemek için [İlk dosyanı oluştur](/info/make-something.html).
- Kendi tasarım sistemini eklemek için [Başla](/info/quickstart.html).
- Komut satırı, bağlantılar ve ajanlar için [Otomatikleştir](/info/builders.html).
- Katkıda bulunanlar için [Lolly mimarisi](/info/overview.html): motor, kabuklar ve bunları bir arada tutan kurallar.
