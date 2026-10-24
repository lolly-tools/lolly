# Lolly nasıl çalışır

Bir Lolly aracı, tek tür dosyanın kurallarını taşır: düzen, yazı, renkler ve başkalarının hangi bölümleri değiştirebileceği. Sen, bir meslektaşın, bir betik veya bir yapay zekâ ajanı alanları doldurursunuz ve her dosya doğru çıkar. Bu sayfa kimin ne yaptığını ve bir araçtan bitmiş bir dosyaya giden dört yolu gösterir.

## Bir araç, senin kuralların, çok sayıda dosya

Marka kuralları aracın içinde yaşar, ürettiği her dosyada değil. Aracı bir kez doğru kur; ister tek bir kart ister düzinelerce dilde satırlardan oluşan bir elektronik tablo olsun, her çıktı aynı yazıyı, rengi ve aralığı devralır.

![Tek bir alanı doldurulmuş bir logotype aracı: yazı, renk ve aralık araç yapılırken belirlendi](/info/shots/aud-rules-in-the-tool.svg)

Yüzüncü dosyayı yapan kişi yalnızca sözcükleri yazar. İşi nasıl ve kimin denetleyeceği senin kararın olarak kalır. Lolly denetlemeye değer şeyi küçültür ve sonraki dosyayı daha hızlı yapılır kılar.

## Bir araca kimler dokunur

Bir kampanya kartını bir kuruluşun içinde izle; üç çift el ortaya çıkar. Her biri öncekinin üzerine kurar.

![Bir tasarımcı kuralları bir araçta bir kez belirler; bir geliştirici onu bir betikten çalıştırır ve herkes alanlarını doldurabilir; ikisi de bitmiş dosyalar üretir](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Bir tasarımcı kuralları belirler.** Kartı Design içinde markanın yazısı ve renkleriyle düzenler, sonra hangi alanların açık kalacağını seçer. Bunu bir kez yapar; böylece kimse kartı bir daha elle yerelleştirmez.
- <!--i:code--> **Bir geliştirici aracı ölçekler.** Aynı araç komut satırı üzerinden gece çalışan bir betikte çalışır; böylece taze bir grafik veya yeni bir dil sürümü, kimse tasarımı yeniden açmadan gelir.
- <!--i:people--> **Herkes doldurur.** Uçaktaki bir satış temsilcisi, ağ olmadan ve tasarım eğitimi almadan, aracı açar ve yarınki toplantı için kartı yapar.
:::

Geliştiricinin adımındaki taze grafik, bunun gibi bir render'dır: bir veri dizesinden ve birkaç ayardan, kimse bir tasarım dosyası açmadan yapılmıştır:

![Başlıklı bir yığılmış alan grafiği, üç serisi soğuk bir paletle bantlanmış; eksenler, gösterge ve başlık elle değil şablonla yerleştirilmiş](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Temsilcinin kolay dakikası, yalnızca tasarımcının özeni ve geliştiricinin betiği sayesinde mümkündür. Her rol, her biri için ayrı bir ürün yerine aynı araçla çalışır.

## Bir dosyaya dört yol

Her yol aynı aracın üzerinde aynı motoru çalıştırır; bu yüzden bir betiğin yaptığı dosya, uygulamada önizlediğinle eşleşir.

![URL parametreleri ve komut satırı argümanları aynı girdi modeline dönüşür; tek bir paylaşılan çalışma zamanı ve dışa aktarma köprüsünden geçer](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **Uygulamada, tek tek.** Bir aracı aç, alanları doldur ve **Export** düğmesine bas. [İlk dosyanı yap](/info/make-something.html) seni bir tanesinde yönlendirir.
- <!--i:layers--> **Uygulamada, hepsi bir arada.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) yapıştırılmış veya içe aktarılmış bir tabloyu alır ve her satır için bitmiş bir dosya render eder.
- <!--i:cpu--> **Bir betikten veya yapay zekâ ajanından.** [CLI](/info/cli.html) bir aracı arayüzsüz çalıştırır ve [MCP sunucusu](/info/mcp.html) bir ajanın araçları keşfedip çalıştırmasını sağlar. Bir araca giden bağlantı girdilerini de taşır; yani bir bağlantı eksiksiz bir istektir.
- <!--i:server--> **Kuruluşunun sunucusu üzerinden.** [Lolly Work](/info/organisation.html), kuruluşunun girişi ve araç politikası altında sunucuda render eder, sürdürülebilir işleri tutar ve çıktıyı indirme veya onaylı teslimat için saklar.

Bir işin hangi yolu kullanabileceği aracın biçimlerine ve ana bilgisayarın neler yapabildiğine bağlıdır: bazı biçimler bir tarayıcı gerektirir, bu yüzden komut satırı onları bir tarayıcı katmanına devreder. [Render with the CLI](/info/cli-rendering.html) hangi biçimlerin nerede render edildiğini listeler.

## Ne nerede çalışır

Yapmak, düzenlemek ve dışa aktarmak, hesap olmadan cihazında çalışır. Sync veya bağlı bir hizmete dosya göndermek gibi sunucu gerektiren bir özellik, yalnızca o özelliği kullandığında bağlanır. Lolly Work ile paylaşılan projeler, canlı ekip düzenlemesi, onaylar ve sunucu işleri kuruluşunun sunucusunu kullanır. [What runs where](/info/compare.html#what-runs-where) iki bölümü yan yana koyar.

## Sırada oku

- [İlk dosyanı yap](/info/make-something.html), şimdi denemek için.
- [Başla](/info/quickstart.html), kendi tasarım sistemini koymak için.
- [Automate](/info/builders.html), komut satırı, bağlantılar ve ajanlar için.
- [Lolly architecture](/info/overview.html), katkıda bulunanlar için: motor, kabuklar ve onları bir arada tutan kurallar.
