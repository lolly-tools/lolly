# Başla

Araçlarını kendi renklerine ve yazı tiplerine ayarla ve elindeki işleri yeniden kullan. Hesaba ihtiyacın yoktur ve üretim ve dışa aktarma cihazında çalışır.

::: steps
- <!--i:eti-sparkles--> **[Bir dosya oluştur](/info/make-something.html)** Her adımı gösterilerek birkaç dakikada bir QR kodu.
- <!--i:eti-palette--> **[Markanı ekle](#put-your-brand-in)** Bir renkten, token dosyasından veya bitmiş bir tasarımdan başla.
- <!--i:eti-folder-move--> **[İşlerini getir](#bring-in-what-you-already-have)** Elindeki tasarımlar, sunumlar ve veriler, cihazında okunur.
- <!--i:eti-repeat--> **[Aynısından daha çok üret](#make-many-share-and-automate)** Bir bağlantı paylaş, bir elektronik tablo doldur veya aracı bir betikten çalıştır.
:::

[Lolly nedir?](/info/what-is-lolly.html) beş dakikalık bir tanıtımdır. [Lolly nasıl çalışır](/info/how-lolly-works.html) kimin ne yaptığını gösterir.

<!--i:eti-palette-->
## Markanı ekle

lolly.tools, Lolly'nin kendi örnek tasarım sistemi **Lolly Demo** ile açılır ([Lolly Demo ile tanış](/info/lolly-demo.html)). Tasarım sistemin Lolly Demo'nun yerini alır. Her aracın çizim yaparken kullandığı küçük bir tasarım token'ları kümesidir (renkler, yazı tipleri ve birkaç kural). Bir kez ayarla ve ürettiğin her şey markana uygun başlasın.

Elindekilere uyan yolu seç:

- <!--i:palette--> **Tek bir renk.** **Design System Setup** görünümünü (`#/start`) aç, tasarım sistemine ad ver ve bir ana renk seç. Lolly, o renkten açık ve koyu yüzeyler, metin ve vurgularla erişilebilir bir palet türetir. Bir yazı tipi seç ve kullanabileceğin bir markan olsun.
- <!--i:upload--> **Bir token dosyası.** Lolly Design System Setup'ın üstündeki **Add from…**, bir DTCG, Tokens Studio veya Penpot token dosyası, SVG ya da `LollyBrand` paketi alır. Palet dosyadan doldurulur. Tasarım sistemi boşken Board üzerindeki **Start from a reference** aynı seçiciyi açar.
- <!--i:pentool--> **Bitmiş bir tasarım.** Lolly Design içinde **Import a design** seç ve bir Figma, Penpot, Illustrator, InDesign, Affinity, Photoshop, PowerPoint veya SVG dosyası bırak ([tüm biçimler](/info/design-import.html#what-comes-in-from-each-app)). Aşağıdaki [Elindekileri getir](#bring-in-what-you-already-have) bölümüne bak.

Galeriyi ilk açtığında üstteki karşılama bir sonraki adımı sunar. lolly.tools üzerinde **Start making**, Lolly Design'ı Launch posteriyle açar. Yeni bir kurulumda **Make it yours**, Lolly Design System Setup'ı açar. O düğmenin altında **Bring a file**, bir tasarım için dosya seçiciyi açar ve bu iki seçeneğin diğeri bağlantı olarak görünür. Bunlardan herhangi biri veya kapatma düğmesi, karşılamayı kalıcı olarak kaldırır.

![Yeni bir tasarım sisteminde Lolly Design System Setup'ın Colours odası: bir canlı renk çipi, bir alan ve ilk kararın tamamı](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

İstediğin sırayla kullanabileceğin sekiz oda tasarım sistemini ileri taşır: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** ve **Skills**. Uygulamadaki her önizleme sen yazarken güncellenir. [Lolly Design System Setup](/info/brand-studio.html) her odayı anlatır.

Yazı tipleri cihazında tutulur. Seçtiğin Google Font bir marka varlığı olarak saklanır; böylece yazıların çevrimdışı çalışır ve bir araç çizim yaparken hiçbir şey getirilmez.

### Bir tasarım sistemini gör, değiştir ve paylaş

- **Etkin olanı gör.** **Settings → Design system**, etkin tasarım sistemini salt okunur bir kapak ve sayfalar olarak gösterir.
- **Aralarında geçiş yap.** **Settings → Preferences → Design systems**, bu cihazdaki her tasarım sistemini listeler. Bir kuruluş birden fazla tasarım sistemi veya birden fazla colourway içeren tek bir sistem kullanabilir. [Marka mimarileri](/info/brand-architectures.html) düzenlemeleri gösterir.
- **Birini paylaş.** Tasarım sistemini bir `LollyBrand` paketi olarak dışa aktar: meslektaşının aynı paleti, yazı tiplerini ve kuralları almak için içeri aktardığı tek bir dosya.

Kullandığın derlemenin veya kuruluşunun sağladığı tasarım sistemi **yönetilen** bir sistemdir: bir kilit gösterir ve salt okunur kalır. Değiştirmek için **Settings → Preferences → Design systems** üzerinden düzenlenebilir bir kopya oluştur.

![Settings içindeki Design system sekmesi: kapak ve sayfalar olarak etkin tasarım sistemi](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Tasarım sistemin, Penpot'un okuyup yazdığı ve Tokens Studio'nun Figma'ya taşıdığı biçim olan DTCG token'larından oluşur. Tasarım yaparken kullandığın paletle Lolly'nin uyguladığı palet aynı belgedir. Ayrıntılar için [Tasarım Token'ları](/info/design-tokens.html) sayfasına bak.

::: details Geliştiriciler için: komut satırından marka paketi oluştur
`ingest:brand`, deponun yerel kopyasında yeniden kullanılabilir bir marka paketi oluşturur. Penpot ve Tokens Studio'nun dışa aktardığı üç kapsayıcıyı kabul eder: tek bir `tokens.json`, `$metadata.json` ile birlikte her küme için ayrı dosyalar içeren bir dizin veya bir `project.penpot` arşivi.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate`, markayı profil olarak kaydeder, kataloğunu oluşturur ve doğrular. Varsayılan profili asla değiştirmez: yeni paketi kullanmak için `LOLLY_PROFILE=acme` ile çalıştır. [Yapılandırma](/info/configuration.html), marka paketleriyle profillerin nasıl bir araya geldiğini açıklar.
:::

<!--i:eti-folder-move-->
## Elindekileri içeri getir

**Lolly Design dosyaları.** Figma, Penpot, Illustrator, InDesign veya herhangi bir SVG uygulamasında tamamlanan işler, Lolly Design'da düzenlenebilir bir düzen olarak açılır. Metin yeniden yazılabilir kalır, şekiller şekil olarak kalır ve görseller kitaplığına yerleşir. Dosya tarayıcında okunur ve hiçbir şey yüklenmez. [Tasarım içeri aktar](/info/design-import.html), her biçimi ve nelerin korunduğunu listeler.

**Sunumlar.** Slaytlarını varlık olarak kaydetmek için Lolly'ye bir PowerPoint `.pptx` dosyası bırak. **Lolly Markdown Slides** içinde Markdown'dan yeni bir sunum yaz. [Sunumun markasını değiştir](/info/rebrand.html), bir sunumu senin tasarım sistemine taşır.

**Veriler.** Bir aracın yinelenen alanlarını doldurmak için CSV veya JSON tablosu yapıştır ya da bırak. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design), her satır için bitmiş bir dosya üretir.

### Tek seferlik bir işten şablona

İçeri aktarılan düzen, sıradan bir Lolly Design oturumudur. **Share with rules**, oturumu bir araca dönüştürür. Başkalarının hangi kısımları değiştirebileceğini sen seçersin, onlar da yalnızca bu kısımları doldurur.

![Lolly Design ana dosyasını koru, bir düzenleme kopyasında girdileri ve sınırları seç, ardından alıcıların dolduracağı, yeniden kullanılabilir bir .lolly aracı paylaş](/info/diagrams/concepts/share-with-rules.svg)

[Tasarımı kurallarla paylaş](/info/create-a-tool.html), her adımı anlatır.

<!--i:eti-repeat-->
## Çok sayıda üret, paylaş ve otomatikleştir

- <!--i:download--> **Dışa aktar.** Araçlar SVG, PDF, PNG, JPG, WebP, video ve daha fazlasını, gerektiğinde gerçek baskı boyutlarında üretir. Her araç kendi biçimlerini sunar. Bkz. [Dosya dışa aktar](/info/exporting.html).
- <!--i:link--> **Bağlantı paylaş.** Aracın ayarları bağlantısında taşınır; böylece bağlantı her yerde aynı dosyayı yeniden açar.
- <!--i:layers--> **Her satır için bir tane üret.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) içinde bir aracı elektronik tablodan çalıştır.
- <!--i:cpu--> **Otomatikleştir.** Aynı render, [CLI](/info/cli.html) ve bir [yapay zekâ ajanı](/info/ai-agents.html) üzerinden çalışır.

Bir bağlantı, eksiksiz bir istektir. Aşağıdaki grafiğin türü, başlığı ve veri tablosu adres çubuğuna yazıldı.

![Tasarım sisteminin renklerinde, kanala göre aylık kayıtları gösteren bir çubuk grafik; her değeri bir tıklamayla değil, sorgu parametresi olarak geldi](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Sırada nereye gitmeli

- <!--i:people--> **[Üret](/info/creators.html)**: üretme, canlandırma, kaydetme, paylaşma ve dışa aktarma.
- <!--i:code--> **[Otomatikleştir](/info/builders.html)**: tasarım sistemleri, araç oluşturma, komut satırı, bağlantılar ve ajanlar.
- <!--i:usercheck--> **[Yönet](/info/operators.html)**: Lolly Work ile bir ekip için Lolly çalıştırma.
- <!--i:server--> **[Dağıt](/info/operate.html)**: Lolly ve Lolly Work barındırma.
- <!--i:shieldcheck--> **[Güven](/info/trust.html)**: gizlilik, güvenlik ve bir dosyayı kendin denetleme.
