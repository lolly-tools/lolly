# Başla

Bu sayfanın sonunda araçların kendi renklerini ve yazı tiplerini giyecek ve elindeki işler yeniden kullanıma hazır olacak. Hesap gerekmez; üretim ve dışa aktarma cihazında çalışır.

::: timeline
- <!--i:sparkle--> **Bir dosya yap.** [İlk dosyanı yap](/info/make-something.html), birkaç dakikada bir QR koduyla seni yönlendirir.
- <!--i:palette--> **Markanı içeri al.** Tek bir renkten, bir token dosyasından veya bitmiş bir tasarımdan başla.
- <!--i:layers--> **Aynısından daha fazlasını yap.** Bir bağlantı paylaş, bir elektronik tabloyu doldur veya aracı bir betikten çalıştır.
:::

Fikrin kendisine yeni misin? [What is Lolly?](/info/what-is-lolly.html) beş dakikalık giriştir; [How Lolly works](/info/how-lolly-works.html) kimin ne yaptığını gösterir.

## Markanı içeri al

lolly.tools, Lolly'nin kendi örnek tasarım sistemi olan **Lolly Demo** ile açılır; [Meet Lolly Demo](/info/lolly-demo.html) neye baktığını gösterir. Senin tasarım sistemin onun yerini alır: her aracın kullandığı küçük bir tasarım token'ları kümesi, yani renkler, yazı tipleri ve birkaç kural. Bir kez ayarla; ürettiğin her şey markaya uygun başlar.

Elindekine uyan yolu seç:

- <!--i:palette--> **Tek bir renk.** **Design System Setup** (`#/start`) uygulamasını aç, tasarım sistemine bir ad ver ve bir ana renk seç. Lolly ondan açık ve koyu yüzeyler, metin ve vurgularla eksiksiz, erişilebilir bir palet türetir. Bir yazı tipi seç ve çalışan bir markan olur.
- <!--i:upload--> **Bir token dosyası.** Design System Setup'taki oda rayının altındaki **Add from…**, bir DTCG, Tokens Studio veya Penpot token dosyasını, bir SVG'yi ya da bir `LollyBrand` paketini alır. İçine bırak ve palet dolsun. Tasarım sistemi hâlâ boşken Overview odasındaki **Start from a reference** aynı seçiciyi açar.
- <!--i:pentool--> **Bitmiş bir tasarım.** Design içinde **Import a design** seçeneğini seç ve bir `.fig`, `.penpot`, `.ai`, `.idml` veya SVG dosyası bırak. Aşağıdaki [Elindekini içeri al](#bring-in-what-you-already-have) bölümüne bak.

Galeriyi ilk açtığında kısa bir karşılama aynı seçenekleri sunar: **Make it yours** Design System Setup'ı açar, **Bring your design** bir tasarım için dosya seçici açar ve **Explore the community tools** karşılamayı kapatır.

![Yeni kurulumda Design System Setup'ın Colours odası: bir canlı çip, bir alan ve ilk kararın tamamı](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Oradan yedi oda, istediğin kadar ileri, istediğin sırayla götürür: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** ve **Usage & rules**. Uygulamadaki her önizleme yazdıkça güncellenir. [Design System Setup](/info/brand-studio.html) her odayı kapsar.

Yazı tipleri cihazında tutulur. Bir Google Font seç; Lolly dosyayı bir marka varlığı olarak saklar, böylece yazın çevrimdışı da seninle gelir ve bir araç çizerken hiçbir şey getirilmez.

### Bir tasarım sistemini gör, değiştir ve paylaş

- **Etkin olanı gör.** **Settings → Design system**, etkin tasarım sistemini salt okunur bir kapak ve sayfalar olarak gösterir.
- **Aralarında geçiş yap.** **Settings → Preferences → Design systems** bu cihazdaki her tasarım sistemini listeler. Bir kuruluş birkaç tasarım sistemi ya da birkaç colourway'li tek bir sistem işletebilir; [Brand architectures](/info/brand-architectures.html) düzenlemeleri haritalar.
- **Birini paylaş.** Tasarım sistemini bir `LollyBrand` paketi olarak dışa aktar: bir meslektaşının içe aktarıp aynı paleti, yazı tiplerini ve kuralları alacağı tek dosya.

Sürümünün veya kuruluşunun sağladığı bir tasarım sistemi **yönetilir**: kilit gösterir ve salt okunur kalır. Birini değiştirmek için **Settings → Preferences → Design systems** altından düzenlenebilir bir kopya yap.

![Settings içindeki Design system sekmesi: etkin tasarım sistemi bir kapak ve sayfalar olarak](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Tasarım sistemin DTCG token'larıdır; bu, Penpot'un okuyup yazdığı ve Tokens Studio'nun Figma'ya getirdiği biçimdir. Böylece tasarladığın palet ile Lolly'nin uyguladığı palet tek bir belgedir. [Design Tokens](/info/design-tokens.html) ayrıntıları verir.

::: details Geliştiriciler için: komut satırından bir marka paketi oluştur
Bir çalışma kopyasında yeniden kullanılabilir bir marka paketi kurmak için `ingest:brand`, Penpot ve Tokens Studio'nun dışa aktardığı üç kapsayıcıyı kabul eder: tek bir `tokens.json`, `$metadata.json` ile küme başına dosyalardan oluşan bir dizin veya bir `project.penpot` arşivi.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` markayı bir profil olarak kaydeder ve kataloğunu derleyip doğrular. Varsayılan profili asla değiştirmez: yeni paketi kullanmak için `LOLLY_PROFILE=acme` ile çalıştır. [Configuration](/info/configuration.html) marka paketlerinin ve profillerin nasıl bir araya geldiğini açıklar.
:::

## Elindekini içeri al

Boş bir sayfadan başlamıyorsun.

**Tasarım dosyaları.** Figma, Penpot, Illustrator, InDesign veya herhangi bir SVG uygulamasından bitmiş işler Design içinde yaşayan bir düzen olarak açılır: metin yeniden yazılabilir kalır, şekiller şekil kalır ve görseller kitaplığına iner. Dosya tarayıcında okunur ve hiçbir şey yüklenmez. [Import a design](/info/design-import.html) her biçimi ve nelerin taşındığını listeler.

**Sunumlar.** Slaytlarını varlık olarak dosyalamak için bir PowerPoint `.pptx` dosyasını Lolly'ye bırak, **Markdown Slides** içinde Markdown'dan yeni bir sunum yaz veya tüm sunumu tasarım sistemine taşımak için [Rebrand a deck](/info/rebrand.html) kullan.

**Veri.** Bir CSV veya JSON tablosunu yapıştır ya da bırak; bir aracın yinelenen alanları ondan dolar. Ya da [Batch](/info/batch.html#make-many-versions-of-one-design) her satır için bitmiş bir dosya üretir.

### Tek seferlik bir işten şablona

İçe aktarılmış bir düzen sıradan bir Design oturumudur. **Share with rules** onu bir araca dönüştürür: başkalarının hangi bölümleri değiştirebileceğini sen seçersin ve onlar yalnızca bunları doldurur.

![Design ana dosyasını koru, bir yazarlık kopyasında girdileri ve sınırları seç, sonra alıcıların doldurduğu yeniden kullanılabilir bir .lolly aracı paylaş](/info/diagrams/concepts/share-with-rules.svg)

[Share a design with rules](/info/create-a-tool.html) her adımda sana yol gösterir.

## Çok yap, paylaş ve otomatikleştir

- <!--i:download--> **Dışa aktar.** Araçlar, her aracın sunduğu biçimlerde, gerektiğinde gerçek baskı boyutlarında SVG, PDF, PNG, JPG, WebP, video ve daha fazlasını üretir. Bkz. [Export a file](/info/exporting.html).
- <!--i:link--> **Bir bağlantı paylaş.** Bir aracın ayarları bağlantısında taşınır; böylece bağlantı aynı dosyayı her yerde yeniden açar.
- <!--i:layers--> **Her satır için bir tane yap.** Bir aracı [Batch](/info/batch.html#make-many-versions-of-one-design) içinde elektronik tablodan sür.
- <!--i:cpu--> **Otomatikleştir.** Aynı render [CLI](/info/cli.html) üzerinden ve bir [yapay zekâ ajanı](/info/ai-agents.html) üzerinden çalışır.

Bir bağlantı eksiksiz bir istektir. Aşağıdaki grafiği kimse çizmedi: türü, başlığı ve veri tablosunun tamamı adres çubuğuna yazıldı ve aynı bağlantı aynı grafiği her cihazda çizer.

![Her değeri bir tıklama yerine sorgu parametresi olarak gelen, aylık kayıtları gösteren bir alan grafiği](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Bundan sonra nereye

- <!--i:people--> **[Create](/info/creators.html)**: yapma, canlandırma, kaydetme, paylaşma ve dışa aktarma.
- <!--i:code--> **[Automate](/info/builders.html)**: tasarım sistemleri, araç yazımı, komut satırı, bağlantılar ve ajanlar.
- <!--i:usercheck--> **[Manage](/info/operators.html)**: Lolly Work ile bir ekip için Lolly'yi işletme.
- <!--i:server--> **[Deploy](/info/operate.html)**: Lolly ve Lolly Work'ü barındırma.
- <!--i:shieldcheck--> **[Trust](/info/trust.html)**: gizlilik, güvenlik ve bir dosyayı kendin denetleme.
