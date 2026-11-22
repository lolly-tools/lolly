# Lolly ve render API'leri

_Son denetim: 5 Kasım 2026._

Bir API üzerinden şablonlardan görseller üretiyorsan bu sayfa, o üretimi kendi cihazında, CI'da veya kontrol ettiğin bir sunucuda çalıştırdığında nelerin değiştiğini anlatır. [Barındırılan bir render API'sinden geçiş yap](/info/work-move-from-render-api.html) adımları verir.

<!--i:eti-award-->
## Barındırılan render API'leri neyi daha iyi yapar

[Bannerbear](https://www.bannerbear.com/) ve [Placid](https://placid.app/) yönetilen hizmetlerdir: sen bir istek gönderirsin ve sunucuları başkası işletir.

- **İşleteceğin hiçbir şey yok.** Sunucu, veritabanı, depolama, güncellemeler veya kapasite planlaması yok.
- Uyarlamaya hazır şablonlarla **barındırılan bir şablon düzenleyicisi**.
- **Tek API'den daha fazla çıktı türü.** İkisi de video ve PDF uç noktaları yayımlar. Bannerbear ayrıca animasyonlu çıktı, WebP ve AVIF, ekran görüntüleri ve yapay zekâyla arka plan kaldırmayı belgeler.
- **Kendi entegrasyonları ve destekleri.**

İstediğin düzen buysa bu hizmetler sağlam bir seçimdir.

<!--i:eti-home-->
## Kendi sunucunda barındırmak sana ne sağlar

- **İçeriğin kendi sistemlerinde kalır.** Girdiler, varlıklar ve çıktılar seçtiğin altyapıda bulunur. Cihazda veya CI'da render etmek bir hizmet gerektirmez.
- **Kurallar araçta bulunur.** Renkler, yazı tipleri, logolar ve kilitli girdiler [tasarım sisteminden](/info/brand-studio.html) gelir; bu yüzden çağrı yapan yalnızca izin verdiğin şeyleri değiştirebilir. [Lolly Work](/info/compare.html#what-runs-where), araç görünürlüğünü ve girdi politikalarını her isteğe uygular.
- **Her yerde aynı araç.** Bir araç dizüstü bilgisayarda, CI işinde veya sunucuda aynı girdilerden render eder. İnsanlar aynı aracı uygulamada düzenleyebilir.
- **Elinde tuttuğun kayıtlar.** [Render makbuzları](/info/work-renders.html#evidence-and-identity), denetim kaydı ve imzalama kimliği yapılandırdığın yerde Content Credentials.
- **Açık kaynak ve kullanıma göre ücret yok.** Kodu sen çalıştırırsın ve yalnızca kendi altyapının maliyetini ödersin.

Bu hizmetlerin senin için yaptığı işi sen üstlenirsin. Kalıcı bir sunucu, kalıcı veritabanı ve çıktı depolaması gerektirir. Tarayıcıya ihtiyaç duyan araçlar Chromium işçisine ihtiyaç duyar. [Lolly Work'ü kur](/info/work-install.html) ikisini de açıklar.

<!--i:eti-table-->
## İşler nasıl karşılaştırılır

| İş | Barındırılan render API'si | Lolly |
|---|---|---|
| Verilerden bir şablon doldurma | Bir şablonu ve katmanlarını belirten API isteği | Bir aracı ve girdilerini belirten [URL](/info/url-mode.html), [CLI](/info/cli.html) veya [sunucu API'si](/info/work-automation-api.html) |
| Bir tablodan çok sayıda dosya | Toplu işler ve koleksiyonlar | Cihazında [toplu işlem](/info/batch.html) veya sunucuda [toplu render işleri](/info/work-renders.html#batches-with-durable-rows) |
| Sonuç bekleme veya sorgulama | Sorgulama veya eşzamanlı bir seçenek | Sorguladığın kalıcı render'lar veya anında render |
| Bitince webhook çağırma | Evet | İzin verdiğin kökenlere [imzalı geri çağrılar](/info/work-renders.html) |
| Dinamik görsel URL'si | Evet | [Paylaşım bağlantıları ve `/render` URL'leri](/info/url-mode.html) |
| Şablon düzenleme | Barındırılan düzenleyici | Cihazında [Design](/info/using.html) |
| Ajanlar | İkisi de bir MCP sunucusu yayımlar | Lolly Work'te bir belirtecin politikasına tabi kuruluş uç noktasıyla [MCP](/info/mcp.html) |

Lolly'nin kendi çıktı türleri [Dışa aktarma](/info/exporting.html) sayfasında listelenir. Bugün bir Work sunucusunda kalıcı render'lar SVG, PNG, JPG ve PDF üretir ve [video cihazda, CLI'da ve MCP'de kalır](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Neler taşınır ve neler taşınmaz

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| İsteklerin | Work'ün geçiş API'si aynı yapıyı kabul eder | Aynı | Aynı |
| Şablonların | Doğrulanmış şeması olmayan katman türleri dışında, **Import** ile düzenlenebilir belgeler olarak içeri aktar | Yalnızca alan adları ve bir önizleme. Her birini yeniden oluştur | Yalnızca alan adları ve bir önizleme. Her birini yeniden oluştur |
| Mevcut dinamik URL'ler | Desteklenmez | Desteklenmez | İmzalı URL'ler, sunucu değişiminden sonra eski özel belirtecinle çalışmaya devam eder |
| Webhook'lar | Kayıtlı webhook'lar desteklenmez | `webhook_url` çalışır | `webhook_success` çalışır |
| WebP ve AVIF çıktısı | Ada göre reddedilir | Sunulmaz | WebP ada göre reddedilir |
| Animasyonlar, videolar, koleksiyonlar, ekran görüntüleri | Geçiş API'sinde yok | Geçiş API'sinde yok | Geçiş API'sinde yok |

::: note Kamuya açık belgelerden geliştirildi
Bu, her sağlayıcının kamuya açık belgelerinden geliştirildi ve canlı bir hesapta çalıştırılmadı. Bir hesabın varsa [geçiş kılavuzunda](/info/work-move-from-render-api.html#check-it-on-your-own-account) kısa bir denetim listesi bulunur.
:::

Bir şablonu taşıyıp kalanını olduğu yerde tutabilirsin. [Lolly'den ayrılmak](/info/work-move-from-render-api.html#leave-lolly-too) da aynı derecede açıktır: araçlar düz dosyalardır ve CLI bunları sunucu olmadan render eder.

<!--i:eti-building-->
## Hizmeti kim işletir

Lolly ile bir kişi yerel olarak render eder veya bir ekip Lolly Work'ü kendi altyapısında çalıştırır. Bir sunucu işi, girdilerini ve gereken varlıkları o örneğe gönderir. Cihazdaki akış bunu yapmaz.

Bannerbear ve Placid, sahiplerinin ticari markalarıdır. Bu sayfa, kamuya açık belgelerine dayanarak ürünlerin nerede örtüştüğünü anlatır ve ikisiyle de bağlantılı değildir.
