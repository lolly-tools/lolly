# Lolly ve işleme (rendering) API'leri

_Son kontrol: 5 Kasım 2026._

Bugün şablonlardan görselleri bir API ile üretiyorsan bu sayfa, o üretimi kendin çalıştırırsan neyin değiştiğini söyler: kendi cihazında, CI'da veya denetlediğin bir sunucuda. [Barındırılan bir render API'sinden geçiş](/info/work-move-from-render-api.html) bunun nasıl yapılacağını anlatır.

## Barındırılan render API'lerinin daha iyi yaptığı

[Bannerbear](https://www.bannerbear.com/) ve [Placid](https://placid.app/) yönetilen hizmetlerdir ve bu gerçek bir avantajdır. Bir istek gönderirsin; sunucuları başkası çalıştırır, ayakta tutar ve yükü karşılar.

- **İşletecek bir şey yok.** Sunucu, veritabanı, depolama, güncelleme veya kapasite planlaması yok.
- **Barındırılan bir şablon düzenleyicisi** ve uyarlanmaya hazır şablonlar.
- **Tek API'den daha fazla çıktı türü.** İkisi de video ve PDF uç noktaları yayımlar; Bannerbear ayrıca animasyonlu çıktıyı, WebP ve AVIF'i, ekran görüntülerini ve yapay zekâ ile arka plan kaldırmayı belgeler.
- **Kendi entegrasyonları ve desteği.**

İstediğin düzen buysa bu hizmetler sağlam bir seçimdir.

## Kendi sunucunda barındırmanın sağladıkları

- **İçeriğin sistemlerinde kalır.** Girdiler, varlıklar ve çıktılar senin seçtiğin altyapıda durur. Bir cihazda veya CI'da render etmek hiçbir hizmet gerektirmez.
- **Kurallar araçta yaşar.** Renkler, yazı, logolar ve kilitli girdiler [tasarım sisteminden](/info/brand-studio.html) gelir; böylece bir çağıran yalnızca senin izin verdiğini değiştirebilir. [Lolly Work](/info/compare.html#what-runs-where) her isteğe araç görünürlüğü ve girdi politikaları uygular.
- **Her yerde aynı araç.** Bir araç aynı girdilerden bir dizüstü bilgisayarda, bir CI işinde veya bir sunucuda render edilir ve insanlar aynı aracı uygulamada düzenleyebilir.
- **Elinde tuttuğun kayıtlar.** [Render makbuzları](/info/work-renders.html#evidence-and-identity), bir denetim izi ve bir imzalama kimliği yapılandırdığın yerde Content Credentials.
- **Açık kaynak ve sayaç yok.** Kodu sen çalıştırırsın ve ödediğin şey kendi altyapındır.

O hizmetlerin senin yerine yaptığı işi üstlenirsin. Dayanıklı bir sunucu kalıcı bir veritabanı ve çıktı depolaması gerektirir; bir tarayıcıya ihtiyaç duyan araçlar Chromium çalışanını gerektirir. [Install Lolly Work](/info/work-install.html) ikisini de anlatır.

## İşler nasıl eşleşir

| İş | Barındırılan render API'si | Lolly |
|---|---|---|
| Bir şablonu veriden doldurmak | Bir şablonu ve katmanlarını adlandıran API isteği | Bir aracı ve girdilerini adlandıran [URL](/info/url-mode.html), [CLI](/info/cli.html) veya [sunucu API'si](/info/work-automation-api.html) |
| Bir tablodan çok sayıda dosya | Toplu işler ve koleksiyonlar | Cihazında [Batch](/info/batch.html) veya bir sunucuda [render toplu işleri](/info/work-renders.html#batches-with-durable-rows) |
| Bir sonucu beklemek veya yoklamak | Yoklama veya eşzamanlı bir seçenek | Yokladığın dayanıklı render'lar veya anlık bir render |
| Bitince bir webhook çağırmak | Evet | İzin verdiğin kaynaklara [imzalı geri çağrılar](/info/work-renders.html) |
| Dinamik görsel URL'si | Evet | [Paylaşım bağlantıları ve `/render` URL'leri](/info/url-mode.html) |
| Bir şablonu düzenlemek | Barındırılan düzenleyici | Cihazında [Design](/info/using.html) |
| Aracılar | İkisi de bir MCP sunucusu yayımlar | [MCP](/info/mcp.html); Lolly Work'te bir belirtecin politikası altında bir kuruluş uç noktasıyla |

Lolly'nin kendi çıktı türleri [Exporting](/info/exporting.html) içinde listelenir. Bugün bir Work sunucusunda dayanıklı render'lar SVG, PNG, JPG ve PDF yapar; [video cihazda, CLI'de ve MCP'de kalır](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Nelerin taşındığı ve nelerin taşınmadığı

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| İsteklerin | Work'ün geçiş API'si aynı biçimi alır | Aynı | Aynı |
| Şablonların | Doğrulanmış şeması olmayan katman türleri dışında düzenlenebilir belgeler olarak **içe aktarılır** | Yalnızca alan adları ve bir önizleme. Her birini yeniden kur | Yalnızca alan adları ve bir önizleme. Her birini yeniden kur |
| Mevcut dinamik URL'ler | Desteklenmez | Desteklenmez | İmzalı URL'ler, eski özel belirtecinle bir ana makine değişikliğinden sonra çalışmaya devam eder |
| Webhook'lar | Kayıtlı webhook'lar desteklenmez | `webhook_url` çalışır | `webhook_success` çalışır |
| WebP ve AVIF çıktısı | Adıyla reddedilir | Sunulmaz | WebP adıyla reddedilir |
| Animasyonlar, videolar, koleksiyonlar, ekran görüntüleri | Geçiş API'sinde yok | Geçiş API'sinde yok | Geçiş API'sinde yok |

Bunların hepsi her satıcının herkese açık belgelerinden kuruldu ve canlı bir hesaba karşı çalıştırılmadı. Bir hesabın varsa [geçiş kılavuzunda](/info/work-move-from-render-api.html#check-it-on-your-own-account) kısa bir denetim listesi var.

Geçiş ya hep ya hiç değildir. Bir şablonu taşıyıp geri kalanını olduğu yerde bırakabilirsin ve [Lolly'den ayrılmak](/info/work-move-from-render-api.html#leave-lolly-too) da aynı ölçüde açık kalır: araçlar düz dosyalardır ve CLI onları sunucusuz render eder.

## Hizmeti kim çalıştırır

Lolly ile bir birey yerelde render eder ya da bir ekip Lolly Work'ü kendi altyapısında çalıştırır. Bir sunucu işi göndermek, girdilerini ve gereken varlıkları o örneğe gönderir; bu, cihaz üzerindeki yoldan farklıdır.

Bannerbear ve Placid, sahiplerinin ticari markalarıdır. Bu sayfa ürünlerin nerede örtüştüğünü, herkese açık belgelerinden anlatır ve ikisiyle de bağlantılı değildir.
